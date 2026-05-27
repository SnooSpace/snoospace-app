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
  event_rsvp:           1.0,
  free_event_attended:  1.5,
  paid_event_attended:  3.0,
  content_shared:       2.0,
  poll_vote:            0.8,
  qna_question:         0.7,
  qna_upvote:           0.4,
  challenge_join:       0.9,
  challenge_submit:     1.8,
  prompt_submit:        0.9,
  post_like:            0.3,
  content_watched_long: 1.0,
  content_watched_short:0.3,
};

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
async function emitSignal(pool, { userId, userType, eventType, category = null, hourOfDay = null, metadata = {} }) {
  try {
    if (!userId || !userType) return;

    // Consent gate — silent skip, never error
    const consent = await hasConsent(pool, userId, userType);
    if (!consent) return;

    const signalStrength = SIGNAL_STRENGTH_MAP[eventType] ?? 0.3;

    // 1. Upsert user_aqi_signals row (idempotent for new users)
    await pool.query(
      `INSERT INTO user_aqi_signals (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    // 2. Insert into behavior event stream
    await pool.query(
      `INSERT INTO user_behavior_events (user_id, event_type, category, metadata, signal_strength)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, eventType, category, JSON.stringify(metadata), signalStrength],
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
        [userId, category.toLowerCase(), signalStrength],
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

    // 5. Update engagement hour pattern + professional hours ratio
    const hour = (hourOfDay !== null && hourOfDay >= 0 && hourOfDay <= 23)
      ? hourOfDay
      : new Date().getHours();

    const hourUpdates = [
      `engagement_hour_pattern = jsonb_set(
         COALESCE(engagement_hour_pattern, '{}'::jsonb),
         ARRAY[$2::text],
         (COALESCE((engagement_hour_pattern->>$2)::int, 0) + 1)::text::jsonb
       )`,
    ];
    // Professional hours = 8am-7pm (inclusive)
    if (hour >= 8 && hour <= 19) {
      hourUpdates.push(`professional_hours_ratio = (professional_hours_ratio * 0.95) + (1.0 * 0.05)`);
    } else {
      hourUpdates.push(`professional_hours_ratio = (professional_hours_ratio * 0.95) + (0.0 * 0.05)`);
    }
    await pool.query(
      `UPDATE user_aqi_signals SET ${hourUpdates.join(', ')} WHERE user_id = $1`,
      [userId, String(hour)],
    ).catch(err => console.error('[SignalEmitter] Hour pattern update failed:', err.message));

    // 6. Update premium_categories_ratio if category known
    const premiumCategories = ['wellness', 'tech', 'technology', 'business', 'luxury', 'finance', 'professional'];
    if (category) {
      const isPremium = premiumCategories.includes(category.toLowerCase());
      await pool.query(
        `UPDATE user_aqi_signals
         SET premium_categories_ratio = (premium_categories_ratio * 0.9) + ($2 * 0.1)
         WHERE user_id = $1`,
        [userId, isPremium ? 1.0 : 0.0],
      ).catch(err => console.error('[SignalEmitter] Premium category update failed:', err.message));
    }

    // 7. Auto-trigger AQI recalculation every 10 signals (debounced, async)
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

  const previousScore = parseFloat(signals.aqi_score_4w_ago) || 0;
  const delta = aqiScore - previousScore;
  const trajectory = delta > 5 ? 'rising' : delta < -5 ? 'declining' : 'stable';

  await pool.query(
    `UPDATE user_aqi_signals
     SET aqi_score = $2, aqi_tier = $3, aqi_trajectory = $4,
         last_calculated_at = NOW(), updated_at = NOW()
     WHERE user_id = $1`,
    [userId, aqiScore, aqiTier, trajectory],
  );

  // Snapshot aqi_score → aqi_score_4w_ago only if 7+ days have passed
  // (or if aqi_score_4w_ago is still NULL from first calculation)
  await pool.query(
    `UPDATE user_aqi_signals
     SET aqi_score_4w_ago = aqi_score
     WHERE user_id = $1
       AND (aqi_score_4w_ago IS NULL
            OR last_calculated_at IS NULL
            OR NOW() - last_calculated_at > INTERVAL '7 days')`,
    [userId],
  );

  // Trigger interest vector decay + drift detection async
  const { recalculateInterestVectors, detectDrift } = require('./interestVectorEngine');
  recalculateInterestVectors(pool, userId)
    .then(() => detectDrift(pool, userId))
    .catch(err => console.error(`[SignalEmitter] Vector decay/drift failed for user ${userId}:`, err.message));

  console.log(`[SignalEmitter] AQI recalculated for user ${userId}: score=${aqiScore} tier=${aqiTier} trajectory=${trajectory}`);
}

module.exports = { emitSignal, getCategoryForPost, getCategoryForEvent, recalculateAqiAsync };
