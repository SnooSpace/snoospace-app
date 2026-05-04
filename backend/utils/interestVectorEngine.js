/**
 * Interest Vector Engine
 *
 * Handles the dynamic interest vector system:
 * - Exponential decay of interest scores over time
 * - Trend calculation (rising, stable, declining, emerging, dormant)
 * - Drift detection (category shifts, spending changes, tier upgrades)
 *
 * No preset interest mappings. Interests emerge purely from behavior.
 */

// Decay constant is now loaded from platform_config at runtime.
// Fallback: 0.02 (a 30-day-old signal retains ~55% weight).
// Update via: UPDATE platform_config SET value = '0.03' WHERE key = 'interest_vector_decay_lambda';
const DEFAULT_DECAY_LAMBDA = 0.02;

/**
 * Recalculate all interest vectors for a user.
 * Applies exponential decay to raw scores and computes trend labels.
 *
 * Should run weekly per user.
 */
async function recalculateInterestVectors(pool, userId) {
  try {
    // Load decay lambda from platform_config (DB-configurable, no code deploy needed)
    let decayLambda = DEFAULT_DECAY_LAMBDA;
    try {
      const configResult = await pool.query(
        `SELECT value FROM platform_config WHERE key = $1`,
        ['interest_vector_decay_lambda']
      );
      if (configResult.rows.length > 0) {
        decayLambda = parseFloat(configResult.rows[0].value);
        if (!Number.isFinite(decayLambda) || decayLambda <= 0) decayLambda = DEFAULT_DECAY_LAMBDA;
      }
    } catch {
      // platform_config table may not exist yet — use default
    }

    // Fetch all interest vectors for this user
    const { rows: vectors } = await pool.query(
      `SELECT id, category, raw_score, decayed_score, last_signal_at, signal_count, trend
       FROM user_interest_vectors
       WHERE user_id = $1`,
      [userId],
    );

    if (vectors.length === 0) return;

    const now = Date.now();

    for (const vec of vectors) {
      // Apply exponential decay based on time since last signal
      const lastSignal = vec.last_signal_at ? new Date(vec.last_signal_at).getTime() : now;
      const daysSinceSignal = Math.max(0, (now - lastSignal) / (1000 * 60 * 60 * 24));
      const newDecayed = parseFloat(vec.raw_score) * Math.exp(-decayLambda * daysSinceSignal);

      // Compute trend by comparing to previous decayed_score
      const previousDecayed = parseFloat(vec.decayed_score) || 0;
      const delta = newDecayed - previousDecayed;

      let trend = "stable";
      if (delta > 15 && vec.signal_count <= 3 && previousDecayed < 2) {
        trend = "emerging";
      } else if (delta > 5 && vec.signal_count > 2) {
        trend = "rising";
      } else if (delta < -5) {
        trend = "declining";
      } else if (newDecayed < 2 && daysSinceSignal > 60) {
        trend = "dormant";
      }

      await pool.query(
        `UPDATE user_interest_vectors
         SET decayed_score = $2, trend = $3, trend_delta = $4, last_calculated_at = NOW()
         WHERE id = $1`,
        [vec.id, Math.round(newDecayed * 100) / 100, trend, Math.round(delta * 100) / 100],
      );
    }

    // Update the timestamp on user_aqi_signals
    await pool.query(
      `UPDATE user_aqi_signals SET interest_vector_updated_at = NOW() WHERE user_id = $1`,
      [userId],
    );

    console.log(
      `[InterestVector] Recalculated ${vectors.length} vectors for user ${userId}`,
    );
  } catch (err) {
    console.error(
      `[InterestVector] recalculateInterestVectors error for user ${userId}:`,
      err.message,
    );
  }
}

/**
 * Detect meaningful behavioral shifts for a user and log them
 * as drift signals. Run after weekly recalculation.
 */
async function detectDrift(pool, userId) {
  try {
    // Fetch current AQI signals
    const { rows: signals } = await pool.query(
      `SELECT aqi_score, aqi_score_4w_ago, aqi_tier, aqi_trajectory,
              avg_ticket_price_paid, events_hosted
       FROM user_aqi_signals WHERE user_id = $1`,
      [userId],
    );

    if (signals.length === 0) return;
    const sig = signals[0];
    const drifts = [];

    // --- Tier change ---
    const currentScore = parseFloat(sig.aqi_score) || 0;
    const previousScore = parseFloat(sig.aqi_score_4w_ago) || 0;
    const currentTier = sig.aqi_tier;
    const previousTier = previousScore >= 75 ? 1 : previousScore >= 50 ? 2 : previousScore >= 25 ? 3 : 4;

    if (currentTier && previousTier && currentTier < previousTier) {
      drifts.push({
        type: "tier_upgrade",
        from: { tier: previousTier, score: previousScore },
        to: { tier: currentTier, score: currentScore },
      });
    } else if (currentTier && previousTier && currentTier > previousTier) {
      drifts.push({
        type: "tier_downgrade",
        from: { tier: previousTier, score: previousScore },
        to: { tier: currentTier, score: currentScore },
      });
    }

    // --- Category shift — top category changed ---
    const { rows: currentTop } = await pool.query(
      `SELECT category, decayed_score FROM user_interest_vectors
       WHERE user_id = $1 AND decayed_score > 5
       ORDER BY decayed_score DESC LIMIT 1`,
      [userId],
    );

    // Check if we have a stored previous top category in drift history
    const { rows: lastCatDrift } = await pool.query(
      `SELECT to_state FROM user_drift_signals
       WHERE user_id = $1 AND drift_type = 'category_shift'
       ORDER BY detected_at DESC LIMIT 1`,
      [userId],
    );

    if (currentTop.length > 0) {
      const currentTopCat = currentTop[0].category;
      const previousTopCat = lastCatDrift.length > 0
        ? lastCatDrift[0].to_state?.category
        : null;

      if (previousTopCat && previousTopCat !== currentTopCat) {
        drifts.push({
          type: "category_shift",
          from: { category: previousTopCat },
          to: { category: currentTopCat, score: parseFloat(currentTop[0].decayed_score) },
        });
      }
    }

    // --- Spending drift ---
    if (previousScore > 0) {
      const currentTicket = parseFloat(sig.avg_ticket_price_paid) || 0;
      // We don't have a 4w ago ticket price in the schema, so compare based on AQI movement
      const scoreDelta = currentScore - previousScore;
      if (scoreDelta > 15) {
        drifts.push({
          type: "spending_increase",
          from: { score: previousScore },
          to: { score: currentScore, delta: scoreDelta },
        });
      } else if (scoreDelta < -15) {
        drifts.push({
          type: "spending_decrease",
          from: { score: previousScore },
          to: { score: currentScore, delta: scoreDelta },
        });
      }
    }

    // --- Identity shift to creator ---
    const eventsHosted = sig.events_hosted || 0;
    if (eventsHosted >= 2) {
      // Check if they recently started hosting (no previous drift logged for this)
      const { rows: existingCreatorDrift } = await pool.query(
        `SELECT id FROM user_drift_signals
         WHERE user_id = $1 AND drift_type = 'identity_shift_to_creator'
         LIMIT 1`,
        [userId],
      );

      if (existingCreatorDrift.length === 0) {
        drifts.push({
          type: "identity_shift_to_creator",
          from: { events_hosted: 0 },
          to: { events_hosted: eventsHosted },
        });
      }
    }

    // Insert all detected drifts
    for (const drift of drifts) {
      await pool.query(
        `INSERT INTO user_drift_signals (user_id, drift_type, from_state, to_state)
         VALUES ($1, $2, $3, $4)`,
        [userId, drift.type, JSON.stringify(drift.from), JSON.stringify(drift.to)],
      );
    }

    // Update trajectory on user_aqi_signals
    let trajectory = "stable";
    const delta = currentScore - previousScore;
    if (delta > 5) trajectory = "rising";
    else if (delta < -5) trajectory = "declining";

    await pool.query(
      `UPDATE user_aqi_signals
       SET aqi_trajectory = $2, aqi_score_4w_ago = $3
       WHERE user_id = $1`,
      [userId, trajectory, currentScore],
    );

    if (drifts.length > 0) {
      console.log(
        `[InterestVector] Detected ${drifts.length} drift signal(s) for user ${userId}: ${drifts.map((d) => d.type).join(", ")}`,
      );
    }
  } catch (err) {
    console.error(
      `[InterestVector] detectDrift error for user ${userId}:`,
      err.message,
    );
  }
}

module.exports = {
  recalculateInterestVectors,
  detectDrift,
  DECAY_LAMBDA: DEFAULT_DECAY_LAMBDA,
};
