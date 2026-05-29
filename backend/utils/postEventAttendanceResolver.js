/**
 * Post-Event Attendance Resolver
 *
 * Handles three scenarios for events that ended without a QR scan:
 *   1. Paid + app active near event → inferred_attended (2.1 signal)
 *   2. Paid + no activity → paid_unattended (1.8 partial signal)
 *   3. Free RSVP + no checkin → free_no_show (no signal, status updated for clean data)
 *
 * Called by:
 *   - Hourly cron in schedulerService.js (automatic, for recently ended events)
 *   - manuallyConfirmAttendance() from organiser dashboard endpoint
 *
 * Payment truth: razorpay_payments.status = 'captured' AND webhook_verified = true
 * App activity proxy: any user_behavior_events within ±2h of event window
 */
'use strict';

const { emitSignal, getCategoryForEvent } = require('./signalEmitter');

// ─── Internal: Check app activity near event window ───────────────────────────

const checkAppActivityDuringEvent = async (pool, userId, eventId) => {
  const eventResult = await pool.query(
    `SELECT start_datetime, COALESCE(end_datetime, start_datetime + INTERVAL '2 hours') as end_datetime
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (eventResult.rows.length === 0) return false;

  const { start_datetime, end_datetime } = eventResult.rows[0];

  const activityResult = await pool.query(
    `SELECT COUNT(*) AS activity_count
     FROM user_behavior_events
     WHERE user_id = $1
       AND occurred_at BETWEEN $2::timestamptz - INTERVAL '2 hours'
                           AND $3::timestamptz + INTERVAL '2 hours'`,
    [userId, start_datetime, end_datetime]
  );

  return parseInt(activityResult.rows[0]?.activity_count ?? 0) > 0;
};

// ─── Main resolution: runs per-event after it ends ───────────────────────────

const resolvePostEventAttendance = async (pool, eventId) => {
  console.log(`[AttendanceResolver] Resolving attendance for event ${eventId}...`);

  // Find paid registrations (confirmed via Razorpay) that are still 'registered'
  const unresolved = await pool.query(
    `SELECT
       er.id          AS registration_id,
       er.member_id   AS user_id,
       rp.amount_paise,
       rp.razorpay_payment_id
     FROM event_registrations er
     JOIN razorpay_payments rp
       ON rp.event_id = er.event_id
      AND rp.user_id  = er.member_id
      AND rp.status   = 'captured'
      AND rp.webhook_verified = true
     WHERE er.event_id         = $1
       AND er.attendance_status = 'registered'`,
    [eventId]
  );

  const category = await getCategoryForEvent(pool, eventId).catch(() => null);

  for (const reg of unresolved.rows) {
    const { registration_id, user_id, amount_paise } = reg;
    const ticketPrice = amount_paise / 100;

    const wasActive = await checkAppActivityDuringEvent(pool, user_id, eventId);

    if (wasActive) {
      // ── Inferred attended: payment + app activity near event window ──────────
      await pool.query(
        `UPDATE event_registrations SET
           attendance_status            = 'inferred_attended',
           attendance_resolved_at       = NOW(),
           attendance_inference_reason  = 'app_activity_during_event_window'
         WHERE id = $1`,
        [registration_id]
      );

      await emitSignal(pool, {
        userId:    user_id,
        userType:  'member',
        eventType: 'paid_event_inferred_attended',
        category,
        metadata:  {
          event_id:    eventId,
          ticket_price: ticketPrice,
          inference:   'app_activity_during_event_window',
        },
      });

      // Confirmed-ish attendance resets consecutive no-show counter
      await pool.query(
        `UPDATE user_aqi_signals
         SET consecutive_paid_no_shows = 0
         WHERE user_id = $1`,
        [user_id]
      );

      console.log(`[AttendanceResolver] User ${user_id} → inferred_attended (app active near event)`);

    } else {
      // ── Paid but no attendance evidence ─────────────────────────────────────
      await pool.query(
        `UPDATE event_registrations SET
           attendance_status            = 'paid_unattended',
           attendance_resolved_at       = NOW(),
           attendance_inference_reason  = 'no_app_activity_during_event_window'
         WHERE id = $1`,
        [registration_id]
      );

      await emitSignal(pool, {
        userId:    user_id,
        userType:  'member',
        eventType: 'paid_event_purchase_only',
        category,
        metadata:  { event_id: eventId, ticket_price: ticketPrice },
      });

      // Increment no-show counters
      await pool.query(
        `UPDATE user_aqi_signals
         SET consecutive_paid_no_shows = consecutive_paid_no_shows + 1,
             total_paid_no_shows       = total_paid_no_shows + 1
         WHERE user_id = $1`,
        [user_id]
      );

      // Flag for review at 3+ consecutive no-shows (human review, not auto-penalty)
      const flagCheck = await pool.query(
        `SELECT consecutive_paid_no_shows FROM user_aqi_signals WHERE user_id = $1`,
        [user_id]
      );
      if ((flagCheck.rows[0]?.consecutive_paid_no_shows ?? 0) >= 3) {
        await pool.query(
          `UPDATE user_aqi_signals SET
             fraud_flag   = true,
             fraud_reason = 'consecutive_paid_no_shows'
           WHERE user_id = $1 AND (fraud_flag = false OR fraud_flag IS NULL)`,
          [user_id]
        );
        console.warn(`[AttendanceResolver] User ${user_id} flagged: 3+ consecutive paid no-shows`);
      }

      console.log(`[AttendanceResolver] User ${user_id} → paid_unattended (no app activity)`);
    }

    // Register 48h post-event observation window for all paid attendees
    await registerPostEventWindow(pool, user_id, eventId);
  }

  // ── Free RSVPs that didn't show up ───────────────────────────────────────────
  // No signal — just mark status for clean data reporting
  const freeNoShow = await pool.query(
    `UPDATE event_registrations SET
       attendance_status      = 'free_no_show',
       attendance_resolved_at = NOW()
     WHERE event_id         = $1
       AND attendance_status = 'registered'
       AND NOT EXISTS (
         SELECT 1 FROM razorpay_payments rp
         WHERE rp.event_id = $1
           AND rp.user_id  = event_registrations.member_id
           AND rp.status   = 'captured'
       )`,
    [eventId]
  );

  console.log(
    `[AttendanceResolver] Event ${eventId}: ${unresolved.rows.length} paid resolved, ${freeNoShow.rowCount} free no-shows marked`
  );

  // Calculate final event quality score after all attendance is resolved.
  // Fire-and-forget — this is a read-only enrichment pass on top of the resolver.
  const { calculatePostEventQuality } = require('./eventQualityScorer');
  calculatePostEventQuality(pool, eventId).catch((err) =>
    console.error(`[EventQuality] Post-event score failed for event ${eventId}:`, err.message)
  );
};

// ─── Organiser manual confirmation (within 7 days of event end) ──────────────

const manuallyConfirmAttendance = async (pool, registrationId, communityId) => {
  // Verify ownership and timing
  const check = await pool.query(
    `SELECT er.member_id AS user_id, er.event_id, er.attendance_status, er.total_amount
     FROM event_registrations er
     JOIN events e ON e.id = er.event_id
     WHERE er.id    = $1
       AND e.community_id = $2
       AND er.attendance_status IN ('registered', 'paid_unattended')
       AND COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours') >= NOW() - INTERVAL '7 days'`,
    [registrationId, communityId]
  );

  if (check.rows.length === 0) {
    return { success: false, reason: 'not_authorised_or_expired' };
  }

  const { user_id, event_id, attendance_status, total_amount } = check.rows[0];

  await pool.query(
    `UPDATE event_registrations SET
       attendance_status           = 'manually_confirmed',
       attendance_resolved_at      = NOW(),
       attendance_inference_reason = 'organiser_manual_confirmation'
     WHERE id = $1`,
    [registrationId]
  );

  // If previously marked as paid_unattended, reverse the no-show counters
  if (attendance_status === 'paid_unattended') {
    await pool.query(
      `UPDATE user_aqi_signals SET
         consecutive_paid_no_shows = GREATEST(0, consecutive_paid_no_shows - 1),
         total_paid_no_shows       = GREATEST(0, total_paid_no_shows - 1)
       WHERE user_id = $1`,
      [user_id]
    );

    // Clear fraud flag if it was set only for consecutive no-shows and count is now < 3
    await pool.query(
      `UPDATE user_aqi_signals SET
         fraud_flag   = false,
         fraud_reason = NULL
       WHERE user_id = $1
         AND fraud_reason = 'consecutive_paid_no_shows'
         AND consecutive_paid_no_shows < 3`,
      [user_id]
    );
  }

  const category = await getCategoryForEvent(pool, event_id).catch(() => null);
  await emitSignal(pool, {
    userId:    user_id,
    userType:  'member',
    eventType: 'manually_confirmed_attended',
    category,
    metadata:  {
      event_id,
      registration_id: registrationId,
      ticket_price:    parseFloat(total_amount) || 0,
    },
  });

  await registerPostEventWindow(pool, user_id, event_id);

  return { success: true };
};

// ─── Register 48h post-event observation window ───────────────────────────────

const registerPostEventWindow = async (pool, userId, eventId) => {
  const windowEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO user_behavior_events (user_id, event_type, metadata, signal_strength, occurred_at)
     VALUES ($1, 'post_event_window_start', $2, 0, NOW())
     ON CONFLICT DO NOTHING`,
    [userId, JSON.stringify({ event_id: eventId, window_ends_at: windowEndsAt })]
  ).catch(() => {
    // If ON CONFLICT fails (no unique constraint), use a plain insert
    return pool.query(
      `INSERT INTO user_behavior_events (user_id, event_type, metadata, signal_strength, occurred_at)
       SELECT $1, 'post_event_window_start', $2, 0, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM user_behavior_events
         WHERE user_id = $1
           AND event_type = 'post_event_window_start'
           AND (metadata->>'event_id')::int = $3
           AND occurred_at >= NOW() - INTERVAL '72 hours'
       )`,
      [userId, JSON.stringify({ event_id: eventId, window_ends_at: windowEndsAt }), eventId]
    );
  });
};

// ─── Post-event echo analysis (called by 6h cron) ────────────────────────────

const analysePostEventEcho = async (pool, window) => {
  const { user_id, event_id, window_start, window_end, community_id, category } = window;

  // What did the user do in the 48h after the event?
  const echoActions = await pool.query(
    `SELECT event_type, COUNT(*) AS count
     FROM user_behavior_events
     WHERE user_id = $1
       AND occurred_at BETWEEN $2 AND $3
       AND event_type NOT IN ('post_event_window_start', 'post_event_echo_analysed')
     GROUP BY event_type`,
    [user_id, window_start, window_end]
  );

  const actions = {};
  for (const row of echoActions.rows) {
    actions[row.event_type] = parseInt(row.count);
  }

  // Did they follow the organiser after attending?
  const followedOrganiser = await pool.query(
    `SELECT COUNT(*) AS count
     FROM follows
     WHERE follower_id   = $1
       AND follower_type = 'member'
       AND following_id  = $2
       AND following_type = 'community'
       AND created_at BETWEEN $3 AND $4`,
    [user_id, community_id, window_start, window_end]
  );

  // Did they search for similar category events after attending?
  const searchedSimilar = await pool.query(
    `SELECT COUNT(*) AS count
     FROM user_behavior_events
     WHERE user_id    = $1
       AND event_type = 'search_performed'
       AND occurred_at BETWEEN $2 AND $3
       AND metadata->>'category' = $4`,
    [user_id, window_start, window_end, category]
  );

  const echoScore = calculateEchoScore({
    followedOrganiser:      parseInt(followedOrganiser.rows[0]?.count ?? 0) > 0,
    searchedSimilarCategory: parseInt(searchedSimilar.rows[0]?.count ?? 0) > 0,
    savedContent:           (actions['post_save'] ?? 0) > 0,
    returnedToEventPage:    (actions['profile_visited'] ?? 0) > 0,
    sentDms:                (actions['dm_initiated'] ?? 0) > 0,
  });

  if (echoScore > 0) {
    await emitSignal(pool, {
      userId:         user_id,
      userType:       'member',
      eventType:      'post_event_echo',
      category,
      metadata:       {
        event_id,
        echo_score:        echoScore,
        actions_taken:     actions,
        followed_organiser: parseInt(followedOrganiser.rows[0]?.count ?? 0) > 0,
      },
      signalStrength: echoScore, // dynamic — set directly on the event
    });
  }

  // Mark window analysed
  await pool.query(
    `INSERT INTO user_behavior_events (user_id, event_type, metadata, signal_strength, occurred_at)
     VALUES ($1, 'post_event_echo_analysed', $2, 0, NOW())`,
    [user_id, JSON.stringify({ event_id, echo_score: echoScore })]
  );

  console.log(`[AttendanceResolver] Echo analysis for user ${user_id}, event ${event_id}: score=${echoScore}`);
};

const calculateEchoScore = ({
  followedOrganiser,
  searchedSimilarCategory,
  savedContent,
  returnedToEventPage,
  sentDms,
}) => {
  let score = 0;
  if (followedOrganiser)        score += 0.8; // strongest: followed the organiser
  if (searchedSimilarCategory)  score += 0.6; // confirmed category interest
  if (savedContent)             score += 0.5; // saved something
  if (sentDms)                  score += 0.4; // reached out
  if (returnedToEventPage)      score += 0.2; // revisited event
  return Math.min(2.0, score);
};

module.exports = {
  resolvePostEventAttendance,
  manuallyConfirmAttendance,
  registerPostEventWindow,
  analysePostEventEcho,
};
