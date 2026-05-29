/**
 * Event Quality Scorer
 *
 * Rates individual events based on the AQI distribution of their attendees.
 * Enables brand sponsorship decisions before (prediction) and after (actuals) events.
 *
 * Two exported functions:
 *   predictEventQuality(pool, eventId)      — pre-event, called at RSVP thresholds
 *   calculatePostEventQuality(pool, eventId) — post-event, called by postEventAttendanceResolver
 *
 * Key schema notes (verified against actual DB):
 *   - event_registrations.member_id links to members
 *   - event_registrations.attendance_status has: confirmed_attended, inferred_attended, manually_confirmed
 *   - user_aqi_signals.aqi_tier and aqi_score
 *   - user_aqi_signals.fraud_flag
 *   - events.community_id (not creator_id — that's a separate column)
 *   - follow_events.creator_id, follow_events.followed_at
 *   - user_behavior_events: post_event_echo exists (verified in live data)
 *   - posts has no event_id column — content_generated is counted via user_behavior_events
 *     content_shared events with event metadata instead
 */

'use strict';

const { emitSignal } = require('./signalEmitter');

// ─── Pre-Event Prediction ─────────────────────────────────────────────────────

/**
 * Calculates pre-event quality prediction based on RSVP audience AQI distribution.
 *
 * Called at RSVP thresholds (10, 20, 50, 100) — always non-blocking.
 * Requires at least 5 RSVPs with AQI data to generate a meaningful prediction.
 *
 * @param {object} pool    - pg connection pool
 * @param {string|number} eventId
 * @returns {object|null}  - { buyingClassDensity, confidence, total } or null if insufficient data
 */
const predictEventQuality = async (pool, eventId) => {
  // Get AQI distribution of current RSVPs (only for members with valid AQI scores)
  const rsvpResult = await pool.query(
    `SELECT
       COUNT(*)                                           AS total_rsvps,
       COUNT(CASE WHEN s.aqi_tier = 1 THEN 1 END)        AS tier1,
       COUNT(CASE WHEN s.aqi_tier = 2 THEN 1 END)        AS tier2,
       COUNT(CASE WHEN s.aqi_tier = 3 THEN 1 END)        AS tier3,
       COUNT(CASE WHEN s.aqi_tier = 4 THEN 1 END)        AS tier4,
       AVG(s.aqi_score)                                  AS avg_aqi
     FROM event_registrations er
     JOIN user_aqi_signals s ON s.user_id = er.member_id
     WHERE er.event_id = $1
       AND s.aqi_score IS NOT NULL
       AND s.fraud_flag = false`,
    [eventId],
  );

  const stats = rsvpResult.rows[0];
  const total = parseInt(stats.total_rsvps);

  if (total < 5) return null; // Not enough data for a meaningful prediction

  const tier1Pct = (parseInt(stats.tier1) / total) * 100;
  const tier2Pct = (parseInt(stats.tier2) / total) * 100;
  const tier3Pct = (parseInt(stats.tier3) / total) * 100;
  const tier4Pct = (parseInt(stats.tier4) / total) * 100;
  const buyingClassDensity = tier1Pct + tier2Pct;

  const confidence = total >= 20 ? 'high' : total >= 10 ? 'medium' : 'low';

  await pool.query(
    `INSERT INTO event_quality_scores (
       event_id, total_rsvps,
       tier1_attendee_pct, tier2_attendee_pct,
       tier3_attendee_pct, tier4_attendee_pct,
       avg_attendee_aqi, buying_class_density,
       predicted_buying_class_density, prediction_confidence,
       is_post_event, calculated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, NOW())
     ON CONFLICT (event_id) DO UPDATE SET
       total_rsvps                    = EXCLUDED.total_rsvps,
       tier1_attendee_pct             = EXCLUDED.tier1_attendee_pct,
       tier2_attendee_pct             = EXCLUDED.tier2_attendee_pct,
       tier3_attendee_pct             = EXCLUDED.tier3_attendee_pct,
       tier4_attendee_pct             = EXCLUDED.tier4_attendee_pct,
       avg_attendee_aqi               = EXCLUDED.avg_attendee_aqi,
       buying_class_density           = EXCLUDED.buying_class_density,
       predicted_buying_class_density = EXCLUDED.predicted_buying_class_density,
       prediction_confidence          = EXCLUDED.prediction_confidence,
       calculated_at                  = NOW()
     -- Only update pre-event fields; never overwrite is_post_event = true
       WHERE event_quality_scores.is_post_event = false`,
    [
      eventId,
      total,
      tier1Pct,
      tier2Pct,
      tier3Pct,
      tier4Pct,
      parseFloat(stats.avg_aqi ?? 0),
      buyingClassDensity,
      buyingClassDensity,
      confidence,
    ],
  );

  console.log(
    `[EventQuality] Pre-event prediction for event ${eventId}: ` +
    `BCD=${buyingClassDensity.toFixed(1)}%, confidence=${confidence}, RSVPs=${total}`,
  );

  return { buyingClassDensity, confidence, total };
};

// ─── Post-Event Final Score ───────────────────────────────────────────────────

/**
 * Calculates final post-event quality score after all attendance is resolved.
 *
 * Called by postEventAttendanceResolver.resolvePostEventAttendance at the end
 * of attendance resolution. Always fire-and-forget — never blocks the resolver.
 *
 * Scoring formula (weights sum to 1.0):
 *   buying_class_density * 0.40  — headline: who actually showed up
 *   avg_attendee_aqi     * 0.25  — overall audience quality
 *   rsvp_to_attend_ratio * 0.15  — commitment signal (high = genuine interest)
 *   echo_signal_count    * 0.10  — post-event engagement (capped at 20 signals)
 *   post_event_follows   * 0.10  — organiser follower growth (capped at 50)
 *
 * @param {object} pool    - pg connection pool
 * @param {string|number} eventId
 * @returns {object|null}  - { eventQualityScore, eventQualityTier, buyingClassDensity } or null
 */
const calculatePostEventQuality = async (pool, eventId) => {
  // Get actual attended AQI distribution
  // attendance_status values verified: confirmed_attended, inferred_attended, manually_confirmed
  const attendeeResult = await pool.query(
    `SELECT
       COUNT(*)                                           AS total_attended,
       COUNT(CASE WHEN s.aqi_tier = 1 THEN 1 END)        AS tier1,
       COUNT(CASE WHEN s.aqi_tier = 2 THEN 1 END)        AS tier2,
       COUNT(CASE WHEN s.aqi_tier = 3 THEN 1 END)        AS tier3,
       COUNT(CASE WHEN s.aqi_tier = 4 THEN 1 END)        AS tier4,
       AVG(s.aqi_score)                                  AS avg_aqi
     FROM event_registrations er
     JOIN user_aqi_signals s ON s.user_id = er.member_id
     WHERE er.event_id = $1
       AND er.attendance_status IN (
         'confirmed_attended', 'inferred_attended', 'manually_confirmed'
       )
       AND s.aqi_score IS NOT NULL
       AND s.fraud_flag = false`,
    [eventId],
  );

  const stats = attendeeResult.rows[0];
  const totalAttended = parseInt(stats.total_attended);

  if (totalAttended === 0) {
    console.log(`[EventQuality] Event ${eventId}: no verified attendees — skipping post-event score`);
    return null;
  }

  // RSVP count for commitment ratio
  const rsvpResult = await pool.query(
    `SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = $1`,
    [eventId],
  );
  const totalRsvps = Math.max(1, parseInt(rsvpResult.rows[0]?.count ?? 1));

  // Post-event echo signal count
  // NOTE: post_event_echo is emitted by analysePostEventEcho with metadata.event_id
  const echoResult = await pool.query(
    `SELECT COUNT(*) AS count FROM user_behavior_events
     WHERE event_type = 'post_event_echo'
       AND (metadata->>'event_id')::text = $1::text`,
    [eventId],
  );
  const echoCount = parseInt(echoResult.rows[0]?.count ?? 0);

  // Content generated: count content_shared events referencing this event
  // NOTE: posts table has no event_id column — using behavior events instead
  const contentResult = await pool.query(
    `SELECT COUNT(*) AS count FROM user_behavior_events
     WHERE event_type = 'content_shared'
       AND (metadata->>'event_id')::text = $1::text`,
    [eventId],
  );
  const contentGenerated = parseInt(contentResult.rows[0]?.count ?? 0);

  // Post-event follows gained by the organiser within 48h of event end
  // Uses events.community_id as the organiser identity
  let postEventFollows = 0;
  const eventResult = await pool.query(
    `SELECT community_id,
            COALESCE(end_datetime, start_datetime + INTERVAL '2 hours') AS event_end
     FROM events WHERE id = $1`,
    [eventId],
  );

  if (eventResult.rows.length > 0) {
    const { community_id, event_end } = eventResult.rows[0];
    if (community_id) {
      // follow_events.creator_id is the followed community; follower_type = member
      const followsResult = await pool.query(
        `SELECT COUNT(*) AS count
         FROM follow_events
         WHERE creator_id = $1
           AND followed_at >= $2
           AND followed_at <= $2::timestamptz + INTERVAL '48 hours'`,
        [community_id, event_end],
      );
      postEventFollows = parseInt(followsResult.rows[0]?.count ?? 0);
    }
  }

  // Calculate score components
  const tier1Pct = (parseInt(stats.tier1) / totalAttended) * 100;
  const tier2Pct = (parseInt(stats.tier2) / totalAttended) * 100;
  const tier3Pct = (parseInt(stats.tier3) / totalAttended) * 100;
  const tier4Pct = (parseInt(stats.tier4) / totalAttended) * 100;
  const buyingClassDensity = tier1Pct + tier2Pct;
  const avgAqi = parseFloat(stats.avg_aqi ?? 0);
  const rsvpToAttendRatio = totalAttended / totalRsvps;

  // Composite event quality score (0-100)
  // Weights: buying class density (0.40), avg AQI (0.25), commitment ratio (0.15),
  //          echo signals (0.10), post-event follows (0.10)
  const eventQualityScore = Math.min(100, Math.round(
    (buyingClassDensity                                   * 0.40) +
    (avgAqi                                               * 0.25) +
    (rsvpToAttendRatio * 100                              * 0.15) +
    (Math.min(echoCount, 20) / 20 * 100                  * 0.10) +
    (Math.min(postEventFollows, 50) / 50 * 100            * 0.10),
  ));

  const eventQualityTier =
    eventQualityScore >= 80 ? 'premium'    :
    eventQualityScore >= 60 ? 'quality'    :
    eventQualityScore >= 40 ? 'standard'   :
    'developing';

  await pool.query(
    `INSERT INTO event_quality_scores (
       event_id, total_rsvps, total_verified_attendees,
       tier1_attendee_pct, tier2_attendee_pct,
       tier3_attendee_pct, tier4_attendee_pct,
       avg_attendee_aqi, buying_class_density,
       rsvp_to_attend_ratio, content_generated,
       post_event_follows, echo_signal_count,
       event_quality_score, event_quality_tier,
       is_post_event, calculated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,NOW())
     ON CONFLICT (event_id) DO UPDATE SET
       total_rsvps              = EXCLUDED.total_rsvps,
       total_verified_attendees = EXCLUDED.total_verified_attendees,
       tier1_attendee_pct       = EXCLUDED.tier1_attendee_pct,
       tier2_attendee_pct       = EXCLUDED.tier2_attendee_pct,
       tier3_attendee_pct       = EXCLUDED.tier3_attendee_pct,
       tier4_attendee_pct       = EXCLUDED.tier4_attendee_pct,
       avg_attendee_aqi         = EXCLUDED.avg_attendee_aqi,
       buying_class_density     = EXCLUDED.buying_class_density,
       rsvp_to_attend_ratio     = EXCLUDED.rsvp_to_attend_ratio,
       content_generated        = EXCLUDED.content_generated,
       post_event_follows       = EXCLUDED.post_event_follows,
       echo_signal_count        = EXCLUDED.echo_signal_count,
       event_quality_score      = EXCLUDED.event_quality_score,
       event_quality_tier       = EXCLUDED.event_quality_tier,
       is_post_event            = true,
       calculated_at            = NOW()`,
    [
      eventId,
      totalRsvps,
      totalAttended,
      tier1Pct,
      tier2Pct,
      tier3Pct,
      tier4Pct,
      avgAqi,
      buyingClassDensity,
      rsvpToAttendRatio,
      contentGenerated,
      postEventFollows,
      echoCount,
      eventQualityScore,
      eventQualityTier,
    ],
  );

  console.log(
    `[EventQuality] Post-event score for event ${eventId}: ` +
    `score=${eventQualityScore} tier=${eventQualityTier} BCD=${buyingClassDensity.toFixed(1)}%`,
  );

  return { eventQualityScore, eventQualityTier, buyingClassDensity };
};

module.exports = { predictEventQuality, calculatePostEventQuality };
