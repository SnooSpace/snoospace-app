/**
 * Signal Emitter — Behavioral Tracking Utility
 *
 * Emits a user behavior signal into the AQI pipeline.
 * Called fire-and-forget from action controllers (poll vote, event register, etc.)
 * Never throws — errors are logged and swallowed to protect the calling request.
 *
 * Pipeline steps:
 *   1. Upsert user_aqi_signals row (creates it for new users)
 *   2. Insert into user_behavior_events stream
 *   3. Upsert user_interest_vectors (if category provided)
 *   4. Increment total_behavior_events + update onboarding/behavior weights
 *   5. Auto-trigger AQI recalculation every 10 signals (debounced)
 */

const SIGNAL_STRENGTH_MAP = {
  // ── Physical attendance ───────────────────────────────────────────────────
  qr_checkin:                    5.0,  // verified physical attendance — strongest
  paid_event_attended:           3.0,  // legacy (pre-resolver) full attendance
  manually_confirmed_attended:   2.5,  // organiser confirmed post-event
  paid_event_inferred_attended:  2.1,  // payment + app activity near event
  paid_event_purchase_only:      1.8,  // payment confirmed, attendance unknown
  free_event_attended:           1.5,
  // ── Content ───────────────────────────────────────────────────────────────
  content_shared:                2.0,
  challenge_submit:              1.8,
  content_watched_long:          1.0,  // ≥50% — override with getVideoSignalStrength()
  event_rsvp:                    1.0,
  challenge_join:                0.9,
  prompt_submit:                 0.9,
  poll_vote:                     0.8,
  qna_question:                  0.7,
  follow_content:                0.6,
  post_save:                     0.5,
  qna_upvote:                    0.4,
  content_watched_short:         0.3,  // <50%
  post_like:                     0.3,
  // ── Search intelligence ───────────────────────────────────────────────────
  search_converted_to_rsvp:      1.5,  // search that led to RSVP within 10 min
  search_performed:              0.4,  // deliberate search — modulated by sophistication
  // ── Post-event ────────────────────────────────────────────────────────────
  post_event_echo:               null, // dynamic — set from calculateEchoScore() (0–2.0)
  // ── System markers (signal_strength = 0, never scored) ───────────────────
  post_event_window_start:       0,
  post_event_echo_analysed:      0,
};

/**
 * Dynamic signal strength for video watches based on completion ratio.
 * Callers should pass the result as the eventType='content_watched_long'
 * or 'content_watched_short' depending on completion.
 *
 * @param {number} completionRatio - 0 to 1
 * @returns {{ eventType: string, strength: number }}
 */
function getVideoSignalStrength(completionRatio) {
  const ratio = Math.max(0, Math.min(1, completionRatio || 0));
  if (ratio >= 0.90) return { eventType: 'content_watched_long', strength: 1.5 };
  if (ratio >= 0.75) return { eventType: 'content_watched_long', strength: 1.0 };
  if (ratio >= 0.50) return { eventType: 'content_watched_long', strength: 0.7 };
  if (ratio >= 0.25) return { eventType: 'content_watched_short', strength: 0.4 };
  return { eventType: 'content_watched_short', strength: 0.1 }; // bounce / autoplay scroll
}

/**
 * Build an incremental SQL update for user_aqi_signals sub-signal columns
 * based on the event type. Called inside emitSignal() after the behavior
 * event is inserted.
 *
 * Returns { sql: string, values: any[] } or null if no sub-signal applies.
 *
 * @param {string} eventType
 * @param {object} metadata
 * @returns {{ sql: string, values: any[] } | null}
 */
function buildSubSignalUpdate(eventType, metadata) {
  switch (eventType) {

    case 'paid_event_attended': {
      // Increment paid event count and update running average ticket price
      const ticketPrice = parseFloat(metadata.ticketPrice ?? metadata.ticket_price ?? 0);
      return {
        sql: `
          paid_events_attended = COALESCE(paid_events_attended, 0) + 1,
          avg_ticket_price_paid = (
            (COALESCE(avg_ticket_price_paid, 0) * COALESCE(paid_events_attended, 0)) + $2
          ) / NULLIF(COALESCE(paid_events_attended, 0) + 1, 0)
        `,
        values: [ticketPrice],
      };
    }

    case 'qr_checkin': {
      // QR check-in = verified physical presence
      // Increments total_attended and recalculates rsvp_to_attend_ratio inline
      // Use GREATEST(total_rsvps, 1) to avoid divide-by-zero when no prior RSVP exists
      return {
        sql: `
          total_attended = COALESCE(total_attended, 0) + 1,
          rsvp_to_attend_ratio = ROUND(
            (COALESCE(total_attended, 0) + 1)::numeric
            / GREATEST(COALESCE(total_rsvps, 0), 1)::numeric,
            4
          )
        `,
        values: [],
      };
    }

    case 'event_rsvp': {
      // Track RSVP count for ratio calculation
      return {
        sql: `total_rsvps = COALESCE(total_rsvps, 0) + 1`,
        values: [],
      };
    }

    case 'free_event_attended': {
      // Free attendance still counts as physically showing up
      return {
        sql: `
          total_attended = COALESCE(total_attended, 0) + 1,
          rsvp_to_attend_ratio = ROUND(
            (COALESCE(total_attended, 0) + 1)::numeric
            / GREATEST(COALESCE(total_rsvps, 0), 1)::numeric,
            4
          )
        `,
        values: [],
      };
    }

    case 'event_hosted': {
      return {
        sql: `events_hosted = COALESCE(events_hosted, 0) + 1`,
        values: [],
      };
    }

    case 'content_watched_long': {
      // Long watch = strong depth signal. completion ratio in metadata.
      const completion = parseFloat(metadata.completionRatio ?? metadata.completion_ratio ?? 0.75);
      const depthValue = Math.round(completion * 100); // 0-100
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.85) + ($2 * 0.15)`,
        values: [depthValue],
      };
    }

    case 'content_watched_short': {
      const completion = parseFloat(metadata.completionRatio ?? metadata.completion_ratio ?? 0.2);
      const depthValue = Math.round(completion * 100);
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.90) + ($2 * 0.10)`,
        values: [depthValue],
      };
    }

    case 'post_save': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.90) + (70.0 * 0.10)`,
        values: [],
      };
    }

    case 'challenge_submit': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.90) + (65.0 * 0.10)`,
        values: [],
      };
    }

    case 'qna_question': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.90) + (55.0 * 0.10)`,
        values: [],
      };
    }

    case 'poll_vote': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.92) + (45.0 * 0.08)`,
        values: [],
      };
    }

    case 'challenge_join': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.92) + (40.0 * 0.08)`,
        values: [],
      };
    }

    case 'post_like': {
      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.95) + (25.0 * 0.05)`,
        values: [],
      };
    }

    case 'paid_event_inferred_attended':
    case 'manually_confirmed_attended': {
      // Both count toward paid event analytics (partial/confirmed attendance)
      const ticketPrice = parseFloat(metadata.ticketPrice ?? metadata.ticket_price ?? 0);
      return {
        sql: `
          paid_events_attended = COALESCE(paid_events_attended, 0) + 1,
          avg_ticket_price_paid = (
            (COALESCE(avg_ticket_price_paid, 0) * COALESCE(paid_events_attended, 0)) + $2
          ) / NULLIF(COALESCE(paid_events_attended, 0) + 1, 0),
          total_attended = COALESCE(total_attended, 0) + 1,
          rsvp_to_attend_ratio = (
            COALESCE(total_attended, 0) + 1
          )::float / NULLIF(COALESCE(total_rsvps, 1), 0)
        `,
        values: [ticketPrice],
      };
    }

    case 'paid_event_purchase_only': {
      // Payment confirmed but no attendance evidence — contributes to ticket price avg
      // Does NOT increment total_attended (unconfirmed)
      const ticketPrice = parseFloat(metadata.ticketPrice ?? metadata.ticket_price ?? 0);
      return ticketPrice > 0 ? {
        sql: `
          avg_ticket_price_paid = (
            (COALESCE(avg_ticket_price_paid, 0) * COALESCE(paid_events_attended, 0)) + $2
          ) / NULLIF(COALESCE(paid_events_attended, 0) + 1, 0)
        `,
        values: [ticketPrice],
      } : null;
    }

    case 'search_performed': {
      // Score search sophistication → nudges content_depth_score
      // More specific, contextual searches = higher intent user
      const query     = (metadata.query ?? '').trim().toLowerCase();
      const wordCount = query ? query.split(/\s+/).length : 0;
      const hasLocation    = /bangalore|mumbai|delhi|pune|hyderabad|chennai|kolkata|noida|gurgaon|[a-z]+ nagar|koramangala|bandra|andheri/i.test(query);
      const hasTimeContext = /saturday|sunday|weekend|tonight|this week|morning|evening|next/i.test(query);
      const hasNicheTerms = query.length > 15 && wordCount >= 3;

      let sophisticationScore = 20; // base for any deliberate search
      if (wordCount >= 2) sophisticationScore += 15;
      if (wordCount >= 3) sophisticationScore += 15;
      if (hasLocation)    sophisticationScore += 20;
      if (hasTimeContext) sophisticationScore += 15;
      if (hasNicheTerms)  sophisticationScore += 15;
      sophisticationScore = Math.min(100, sophisticationScore);

      return {
        sql: `content_depth_score = (COALESCE(content_depth_score, 0) * 0.92) + ($2 * 0.08)`,
        values: [sophisticationScore],
      };
    }

    default:
      return null; // no sub-signal update needed
  }
}

/**
 * Resolve a post's community category slug for interest vector tagging.
 * Looks up the post author's community → community.category_id → categories.slug
 * Returns null if the post has no community author or no category.
 *
 * @param {object} pool  - pg Pool
 * @param {number} postId
 * @returns {Promise<string|null>}
 */
async function getCategoryForPost(pool, postId) {
  try {
    const result = await pool.query(
      `SELECT c.category
       FROM posts p
       JOIN communities c ON p.author_id = c.id AND p.author_type = 'community'
       WHERE p.id = $1
       LIMIT 1`,
      [postId],
    );
    return result.rows[0]?.category || null;
  } catch {
    return null;
  }
}

/**
 * Resolve an event's community category slug.
 *
 * @param {object} pool
 * @param {number} eventId
 * @returns {Promise<string|null>}
 */
async function getCategoryForEvent(pool, eventId) {
  try {
    const result = await pool.query(
      `SELECT c.category
       FROM events e
       JOIN communities c ON e.community_id = c.id
       WHERE e.id = $1
       LIMIT 1`,
      [eventId],
    );
    return result.rows[0]?.category || null;
  } catch {
    return null;
  }
}

/**
 * Check if user has behavioral tracking consent.
 * Defaults to TRUE (opt-out model) if no consent row exists.
 * Returns true on DB error too — better to track than to silently drop.
 *
 * @param {object} pool
 * @param {number} userId
 * @param {string} userType
 * @returns {Promise<boolean>}
 */
async function hasConsent(pool, userId, userType) {
  try {
    const result = await pool.query(
      `SELECT behavioral_tracking_consent
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = $2`,
      [userId, userType],
    );
    // Default: true (opt-out model — user must explicitly revoke consent)
    return result.rows[0]?.behavioral_tracking_consent ?? true;
  } catch {
    return true; // Fail open — never silently block signals on DB error
  }
}

/**
 * Emit a single behavioral signal for a user.
 * Fire-and-forget — call without await from action controllers.
 *
 * @param {object} pool       - pg Pool instance
 * @param {object} opts
 * @param {number} opts.userId
 * @param {string} opts.userType      - 'member' | 'community'
 * @param {string} opts.eventType     - key from SIGNAL_STRENGTH_MAP
 * @param {string|null} opts.category - interest category slug (optional)
 * @param {number|null} opts.hourOfDay - hour 0-23 when action occurred (optional, defaults to now)
 * @param {object} [opts.metadata]    - extra JSON context (postId, eventId, etc.)
 */
async function emitSignal(pool, { userId, userType, eventType, category = null, hourOfDay = null, metadata = {}, completionRatio, signalStrength: overrideStrength }) {
  try {
    if (!userId || !userType) return;

    // Consent gate — silent skip, never error
    const consent = await hasConsent(pool, userId, userType);
    if (!consent) return;

    // Signal strength resolution (precedence: override → completionRatio → map → default 0.3)
    let finalStrength;
    if (overrideStrength !== undefined) {
      finalStrength = overrideStrength;
    } else if (completionRatio !== undefined) {
      // Dynamic video strength — ignores the map value
      finalStrength = getVideoSignalStrength(completionRatio).strength;
      // Rewatch bonus: user scrubbed back = strong interest signal, cap at 2.0
      if (metadata?.rewatch_detected) {
        finalStrength = Math.min(2.0, finalStrength * 1.3);
      }
    } else {
      finalStrength = SIGNAL_STRENGTH_MAP[eventType] ?? 0.3;
    }

    // Propagate completionRatio into metadata for sub-signal update
    const enrichedMetadata = completionRatio !== undefined
      ? { ...metadata, completionRatio, completion_ratio: completionRatio }
      : metadata;

    // 1. Upsert user_aqi_signals row (idempotent for new users)
    await pool.query(
      `INSERT INTO user_aqi_signals (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    // 2. Insert into behavior event stream
    await pool.query(
      `INSERT INTO user_behavior_events (user_id, event_type, category, metadata, signal_strength)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, eventType, category, JSON.stringify(enrichedMetadata), finalStrength],
    );

    // 3. Upsert interest vector if category is known
    if (category) {
      await pool.query(
        `INSERT INTO user_interest_vectors (user_id, category, raw_score, signal_count, last_signal_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (user_id, category) DO UPDATE SET
           raw_score     = user_interest_vectors.raw_score + $3,
           signal_count  = user_interest_vectors.signal_count + 1,
           last_signal_at = NOW()`,
        [userId, category.toLowerCase(), finalStrength],
      );
    }

    // 4. Increment event count + update dynamic weights + last_active_at
    const updateResult = await pool.query(
      `UPDATE user_aqi_signals SET
         total_behavior_events = total_behavior_events + 1,
         onboarding_weight     = GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1))),
         behavior_weight       = 1.0 - GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1))),
         last_active_at        = NOW(),
         updated_at            = NOW()
       WHERE user_id = $1
       RETURNING total_behavior_events`,
      [userId],
    );

    const totalEvents = parseInt(updateResult.rows[0]?.total_behavior_events) || 0;

    // 5. Incremental sub-signal update — populates paid_events_attended,
    //    content_depth_score, total_rsvps, total_attended, events_hosted, etc.
    //    This is what feeds the behavioral AQI components directly.
    const subSignal = buildSubSignalUpdate(eventType, enrichedMetadata);
    if (subSignal) {
      await pool.query(
        `UPDATE user_aqi_signals
         SET ${subSignal.sql}, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, ...subSignal.values],
      ).catch(err => console.error('[SignalEmitter] Sub-signal update failed:', err.message));
    }

    // 6. Update engagement_hour_pattern + professional_hours_ratio
    //    Use IST (UTC+5:30) for professional hours classification.
    const nowUtc = new Date();
    const istMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + 330; // +5h30m
    const hourIST = Math.floor(istMinutes / 60) % 24;
    const dayIST  = new Date(nowUtc.getTime() + 330 * 60000).getUTCDay(); // 0=Sun
    // Override with explicit hourOfDay if provided (backfill / test cases)
    const hour = (hourOfDay !== null && hourOfDay >= 0 && hourOfDay <= 23) ? hourOfDay : hourIST;
    // Mon–Fri, 9am–6pm IST = professional hours
    const isProfessionalHour = dayIST >= 1 && dayIST <= 5 && hourIST >= 9 && hourIST < 18;

    await pool.query(
      `UPDATE user_aqi_signals SET
         engagement_hour_pattern = jsonb_set(
           COALESCE(engagement_hour_pattern, '{}'::jsonb),
           ARRAY[$2::text],
           (COALESCE((engagement_hour_pattern->>$2)::int, 0) + 1)::text::jsonb
         ),
         professional_hours_ratio = LEAST(1.0, (COALESCE(professional_hours_ratio, 0) * 0.92) + ($3 * 0.08))
       WHERE user_id = $1`,
      // $3: 1.0 if professional hour, 0.0 if not — matches NUMERIC(5,4) 0–1 range
      [userId, String(hour), isProfessionalHour ? 1.0 : 0.0],
    ).catch(err => console.error('[SignalEmitter] Hour pattern update failed:', err.message));

    // 7. Update premium_categories_ratio if category known
    const premiumCategories = ['wellness', 'tech', 'technology', 'business', 'luxury', 'finance', 'professional'];
    if (category) {
      const isPremium = premiumCategories.includes(category.toLowerCase());
      await pool.query(
        `UPDATE user_aqi_signals
         SET premium_categories_ratio = (COALESCE(premium_categories_ratio, 0) * 0.9) + ($2 * 0.1)
         WHERE user_id = $1`,
        [userId, isPremium ? 1.0 : 0.0],
      ).catch(err => console.error('[SignalEmitter] Premium category update failed:', err.message));
    }

    // 8. Auto-trigger AQI recalculation every 10 signals (debounced, async)
    if (totalEvents > 0 && totalEvents % 10 === 0) {
      recalculateAqiAsync(pool, userId).catch((err) =>
        console.error(`[SignalEmitter] AQI auto-recalc failed for user ${userId}:`, err.message),
      );
    }

  } catch (err) {
    // Non-fatal — never block the calling request
    console.error(`[SignalEmitter] Failed to emit signal for user ${userId} (${eventType}):`, err.message);
  }
}

/**
 * Fire-and-forget AQI recalculation.
 * Mirrors the logic in audienceIntelligenceController.calculateAqi but runs
 * inline without an HTTP round-trip.
 */
async function recalculateAqiAsync(pool, userId) {
  const {
    getLearnedDemographicScore,
    resolveOccupationFallback,
    resolveAgeFallback,
    resolveLocationFallback,
    normalizeCity,
    getPlatformMedianAqi,
  } = require('./demographicScoreLookup');

  // Fetch current signals
  const signalResult = await pool.query(
    `SELECT * FROM user_aqi_signals WHERE user_id = $1`,
    [userId],
  );
  if (signalResult.rows.length === 0) return;
  const signals = signalResult.rows[0];

  // Platform averages
  const avgResult = await pool.query(`
    SELECT
      COALESCE(AVG(paid_events_attended), 1) as avg_paid_events,
      COALESCE(AVG(avg_ticket_price_paid), 100) as avg_ticket_price,
      COALESCE(AVG(events_hosted), 1) as avg_events_hosted
    FROM user_aqi_signals
    WHERE aqi_score IS NOT NULL
  `);
  const platformAvg = avgResult.rows[0];

  function normalizeScore(value, benchmark) {
    if (!benchmark || benchmark <= 0) return Math.min(100, value * 10);
    return Math.min(100, (value / benchmark) * 50);
  }

  const paidEventsScore       = normalizeScore(signals.paid_events_attended, parseFloat(platformAvg.avg_paid_events));
  const avgTicketPriceScore   = normalizeScore(parseFloat(signals.avg_ticket_price_paid), parseFloat(platformAvg.avg_ticket_price));
  const rsvpAttendRatio       = parseFloat(signals.rsvp_to_attend_ratio) * 100;
  const contentDepth          = parseFloat(signals.content_depth_score);
  const professionalHours     = parseFloat(signals.professional_hours_ratio) * 100;
  const networkQuality        = parseFloat(signals.network_quality_avg);
  const eventsHostedScore     = normalizeScore(signals.events_hosted, parseFloat(platformAvg.avg_events_hosted));

  const behavioralAqi =
    paidEventsScore * 0.27 +
    avgTicketPriceScore * 0.22 +
    rsvpAttendRatio * 0.15 +
    contentDepth * 0.13 +
    professionalHours * 0.10 +
    networkQuality * 0.08 +
    eventsHostedScore * 0.05;

  // Onboarding AQI from demographics
  const memberResult = await pool.query(
    `SELECT occupation, dob, location FROM members WHERE id = $1 LIMIT 1`,
    [userId],
  );

  const median = await getPlatformMedianAqi(pool);
  let occupationScore = median;
  let ageScore = median;
  let locationScore = median;
  let deviceScore = median; // 4th component: device price tier

  if (memberResult.rows.length > 0) {
    const member = memberResult.rows[0];
    if (member.occupation) {
      const occFallback = await resolveOccupationFallback(pool, member.occupation);
      const occResult = await getLearnedDemographicScore(pool, 'occupation_exact', member.occupation, occFallback);
      occupationScore = occResult.score;
    }
    if (member.dob) {
      const age = Math.floor((Date.now() - new Date(member.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const ageFallback = await resolveAgeFallback(pool, age);
      const ageResult = await getLearnedDemographicScore(pool, 'age_exact', String(age), ageFallback);
      ageScore = ageResult.score;
    }
    const loc = member.location || {};
    const city = normalizeCity(loc.city);
    if (city) {
      const locFallback = await resolveLocationFallback(pool, city, loc.area || null);
      const locResult = await getLearnedDemographicScore(
        pool,
        loc.area ? 'location_area' : 'location_city',
        loc.area || city,
        locFallback,
      );
      locationScore = locResult.score;
    }
  }

  // Device signal: read tier from user_aqi_signals, look up score from learned table
  const deviceTierResult = await pool.query(
    `SELECT device_tier FROM user_aqi_signals WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const deviceTier = deviceTierResult.rows[0]?.device_tier || null;
  if (deviceTier) {
    const devResult = await getLearnedDemographicScore(pool, 'device_tier', deviceTier, []);
    deviceScore = devResult.score;
  }

  // Onboarding AQI: occ=40%, age=20%, location=20%, device=20%
  // Device is the most gameable signal so it gets the same weight as location
  // but onboarding_weight decays to near 0 over time as behavior takes over.
  const onboardingAqi = (occupationScore * 0.40) + (ageScore * 0.20) + (locationScore * 0.20) + (deviceScore * 0.20);
  const onboardingWeight = parseFloat(signals.onboarding_weight) || 0.9;
  const behaviorWeight   = parseFloat(signals.behavior_weight) || 0.1;
  const aqiScore = Math.min(100, Math.max(0, Math.round(((onboardingAqi * onboardingWeight) + (behavioralAqi * behaviorWeight)) * 100) / 100));

  let aqiTier = 4;
  if (aqiScore >= 75) aqiTier = 1;
  else if (aqiScore >= 50) aqiTier = 2;
  else if (aqiScore >= 25) aqiTier = 3;

  // Snapshot aqi_score_4w_ago: only update if it's the first calculation (NULL)
  // or 7+ days have passed since last_calculated_at.
  // We do this BEFORE computing trajectory so new users start with 'stable'
  // rather than comparing against 0 (which would show every first-scored user as 'rising').
  const isFirstCalc = signals.aqi_score_4w_ago === null;
  if (isFirstCalc) {
    await pool.query(
      `UPDATE user_aqi_signals SET aqi_score_4w_ago = $2 WHERE user_id = $1`,
      [userId, aqiScore],
    );
  } else {
    // Only roll the snapshot forward after 7 days — it's a 4-week baseline
    await pool.query(
      `UPDATE user_aqi_signals
       SET aqi_score_4w_ago = aqi_score
       WHERE user_id = $1
         AND last_calculated_at IS NOT NULL
         AND NOW() - last_calculated_at > INTERVAL '7 days'`,
      [userId],
    );
  }

  // Trajectory: compare new score vs the real previous snapshot
  // If this is the first calculation, always 'stable' — no baseline to compare against
  const previousScore = isFirstCalc ? aqiScore : (parseFloat(signals.aqi_score_4w_ago) || aqiScore);
  const delta = aqiScore - previousScore;
  const trajectory = isFirstCalc
    ? 'stable'
    : delta > 5 ? 'rising' : delta < -5 ? 'declining' : 'stable';

  await pool.query(
    `UPDATE user_aqi_signals
     SET aqi_score = $2, aqi_tier = $3, aqi_trajectory = $4,
         last_calculated_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId, aqiScore, aqiTier, trajectory],
  );

  // Trigger interest vector decay + drift detection async
  const { recalculateInterestVectors, detectDrift } = require('./interestVectorEngine');
  recalculateInterestVectors(pool, userId)
    .then(() => detectDrift(pool, userId))
    .catch(err => console.error(`[SignalEmitter] Vector decay/drift failed for user ${userId}:`, err.message));

  console.log(`[SignalEmitter] AQI recalculated for user ${userId}: score=${aqiScore} tier=${aqiTier} trajectory=${trajectory}`);
}

module.exports = { emitSignal, getCategoryForPost, getCategoryForEvent, recalculateAqiAsync, getVideoSignalStrength };
