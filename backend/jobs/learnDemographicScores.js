/**
 * Learn Demographic Scores — Weekly Background Job
 *
 * This is the ONLY place that writes to learned_demographic_scores.
 * It queries real user behavior and derives what occupation/age signals
 * predict about buying power — purely from data, no human opinions.
 *
 * The system is always working from Day 1 — it just becomes progressively
 * more accurate as behavioral data accumulates.
 */

const { recalculateInterestVectors, detectDrift } = require("../utils/interestVectorEngine");

// Minimum behavior events before a user's AQI is considered trustworthy
const MINIMUM_BEHAVIOR_EVENTS_TO_QUALIFY = 80;

// Sample size thresholds for confidence levels
const CONFIDENCE_THRESHOLDS = {
  occupation_exact: 50,
  occupation_category: 200,
  occupation_super: 500,
  age_exact: 30,
  age_band: 150,
  age_life_stage: 400,
  location_area: 80,
  location_city: 300,
  location_city_tier: 800,
};

/**
 * Calculate confidence level based on sample size and dimension thresholds.
 */
function getConfidenceLevel(sampleSize, dimension) {
  const threshold = CONFIDENCE_THRESHOLDS[dimension] || 100;
  if (sampleSize >= threshold) return "high";
  if (sampleSize >= threshold * 0.5) return "medium";
  if (sampleSize >= threshold * 0.2) return "low";
  return "insufficient";
}

/**
 * Learn scores for a specific demographic dimension.
 * Uses the SQL function compute_demographic_medians to group users and
 * calculate median behavioral AQI per group.
 */
async function learnScoresForDimension(pool, dimension) {
  try {
    const result = await pool.query(
      `SELECT * FROM compute_demographic_medians($1, $2)`,
      [dimension, MINIMUM_BEHAVIOR_EVENTS_TO_QUALIFY],
    );

    if (!result.rows || result.rows.length === 0) {
      console.log(`[DemographicLearning] No qualifying data for dimension=${dimension}`);
      return;
    }

    let upserted = 0;

    for (const row of result.rows) {
      if (!row.dimension_value) continue;

      const confidence = getConfidenceLevel(row.sample_size, dimension);

      await pool.query(
        `INSERT INTO learned_demographic_scores
           (dimension, dimension_value, learned_score, sample_size, confidence_level, last_calculated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (dimension, dimension_value) DO UPDATE SET
           learned_score = $3,
           sample_size = $4,
           confidence_level = $5,
           last_calculated_at = NOW()`,
        [dimension, row.dimension_value, row.median_behavioral_aqi, row.sample_size, confidence],
      );

      upserted++;
    }

    console.log(
      `[DemographicLearning] Learned ${upserted} scores for dimension=${dimension}`,
    );
  } catch (err) {
    console.error(
      `[DemographicLearning] Error learning scores for ${dimension}:`,
      err.message,
    );
  }
}

/**
 * Seed occupation_hierarchy from existing members data.
 * Picks up any occupation + occupation_category pairs that aren't
 * already tracked in the hierarchy. Runs as part of the learning job
 * to catch newly added occupations.
 */
async function seedOccupationHierarchy(pool) {
  try {
    const result = await pool.query(`
      INSERT INTO occupation_hierarchy (occupation_exact, occupation_category)
      SELECT DISTINCT m.occupation, m.occupation_category
      FROM members m
      WHERE m.occupation IS NOT NULL
        AND m.occupation != ''
      ON CONFLICT (occupation_exact) DO UPDATE SET
        occupation_category = COALESCE(occupation_hierarchy.occupation_category, EXCLUDED.occupation_category)
    `);

    console.log("[DemographicLearning] Seeded occupation hierarchy from members data");
  } catch (err) {
    console.error("[DemographicLearning] seedOccupationHierarchy error:", err.message);
  }
}

/**
 * Recalculate interest vectors and detect drift for all active users.
 * "Active" = has at least 1 behavior event in the last 90 days.
 */
async function recalculateAllUserVectors(pool) {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT user_id FROM user_behavior_events
      WHERE occurred_at > NOW() - INTERVAL '90 days'
    `);

    console.log(
      `[DemographicLearning] Recalculating interest vectors for ${rows.length} active users`,
    );

    let processed = 0;
    for (const row of rows) {
      await recalculateInterestVectors(pool, row.user_id);
      await detectDrift(pool, row.user_id);
      processed++;

      // Log progress every 100 users
      if (processed % 100 === 0) {
        console.log(`[DemographicLearning] Processed ${processed}/${rows.length} users`);
      }
    }

    console.log(
      `[DemographicLearning] Completed interest vector recalculation for ${processed} users`,
    );
  } catch (err) {
    console.error("[DemographicLearning] recalculateAllUserVectors error:", err.message);
  }
}

/**
 * Detect anomalous signals before the learning run.
 * Flags users whose behaviour patterns suggest bot activity or artificial
 * signal inflation. Flagged users are excluded from this week's scoring.
 *
 * Rule 1 — Velocity anomaly:
 *   User's 7-day event count > 5× the platform-wide 7-day per-user average.
 *
 * Rule 2 — Uniform timing anomaly:
 *   Users with > 50 events in 30 days whose hourly STDDEV is below 1.5
 *   (real humans cluster at specific hours; bots spread uniformly).
 *
 * Rule 3 — Follow/unfollow loop:
 *   > 5 follow/unfollow cycles between the same pair in 7 days.
 */
async function detectAnomalousSignals(pool) {
  console.log("[DemographicLearning] Running fraud detection...");

  try {
    // Rule 1: Signal velocity anomaly
    await pool.query(`
      WITH weekly_avg AS (
        SELECT AVG(event_count) AS avg_events
        FROM (
          SELECT user_id, COUNT(*) AS event_count
          FROM user_behavior_events
          WHERE occurred_at >= NOW() - INTERVAL '7 days'
          GROUP BY user_id
        ) counts
      )
      UPDATE user_aqi_signals
      SET fraud_flag = true, fraud_reason = 'velocity_anomaly'
      WHERE user_id IN (
        SELECT user_id FROM user_behavior_events
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
        GROUP BY user_id
        HAVING COUNT(*) > (SELECT avg_events * 5 FROM weekly_avg)
      )
    `);

    // Rule 2: Signal uniformity anomaly — unnaturally uniform hour distribution
    await pool.query(`
      UPDATE user_aqi_signals
      SET fraud_flag = true, fraud_reason = 'uniform_timing'
      WHERE user_id IN (
        SELECT user_id
        FROM user_behavior_events
        WHERE occurred_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
        HAVING COUNT(*) > 50
          AND STDDEV(EXTRACT(HOUR FROM occurred_at)) < 1.5
      )
    `);

    // Rule 3: Follow/unfollow loop — > 5 cycles between same pair in 7 days
    await pool.query(`
      UPDATE user_aqi_signals
      SET fraud_flag = true, fraud_reason = 'follow_loop'
      WHERE user_id IN (
        SELECT follower_id
        FROM follow_events
        WHERE followed_at >= NOW() - INTERVAL '7 days'
        GROUP BY follower_id, creator_id
        HAVING COUNT(*) > 5
      )
    `);

    const flaggedResult = await pool.query(
      `SELECT COUNT(*) AS flagged FROM user_aqi_signals WHERE fraud_flag = true`
    );
    console.log(
      `[DemographicLearning] Fraud detection complete: ${flaggedResult.rows[0].flagged} user(s) flagged`
    );
  } catch (err) {
    // Non-fatal: log and continue — we'd rather run with dirty data than skip
    console.error("[DemographicLearning] detectAnomalousSignals error:", err.message);
  }
}

/**
 * Main entry point — runs the full weekly learning pipeline.
 */
async function runDemographicLearningJob(pool) {
  console.log("[DemographicLearning] === Starting weekly demographic learning job ===");
  const startTime = Date.now();

  // Step 0: Flag anomalous signals — these users are excluded from scoring
  await detectAnomalousSignals(pool);

  // Step 1: Seed occupation hierarchy from latest member data
  await seedOccupationHierarchy(pool);

  // Step 2: Recalculate all active user interest vectors + detect drift
  await recalculateAllUserVectors(pool);

  // Step 3: Learn occupation scores at all three hierarchy levels
  await learnScoresForDimension(pool, "occupation_exact");
  await learnScoresForDimension(pool, "occupation_category");
  await learnScoresForDimension(pool, "occupation_super");

  // Step 4: Learn age scores at all three levels
  await learnScoresForDimension(pool, "age_exact");
  await learnScoresForDimension(pool, "age_band");
  await learnScoresForDimension(pool, "age_life_stage");

  // Step 5: Learn location scores at all three levels
  await learnScoresForDimension(pool, "location_city_tier");
  await learnScoresForDimension(pool, "location_city");
  await learnScoresForDimension(pool, "location_area");

  // Step 6: Learn gender-category affinity indexes
  await learnGenderCategoryAffinity(pool);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `[DemographicLearning] === Weekly job completed in ${elapsed}s ===`,
  );
}

/**
 * Learn gender-category affinity indexes.
 * Compares per-gender engagement rates against platform-wide rates.
 * affinity_index = gender_rate / platform_rate
 *   1.0 = same as platform average
 *   1.4 = 40% more engagement than average
 *   0.6 = 40% less than average
 */
async function learnGenderCategoryAffinity(pool) {
  try {
    console.log("[DemographicLearning] Learning gender-category affinity indexes...");

    // Step 1: Platform-wide engagement rate per category
    const platformRatesResult = await pool.query(`
      SELECT
        v.category,
        COUNT(DISTINCT v.user_id)::float /
          NULLIF(
            (SELECT COUNT(*) FROM user_aqi_signals
             WHERE total_behavior_events >= $1),
          0) AS platform_rate
      FROM user_interest_vectors v
      JOIN user_aqi_signals s ON s.user_id = v.user_id
      WHERE s.total_behavior_events >= $1
        AND v.decayed_score > 10
      GROUP BY v.category
      HAVING COUNT(DISTINCT v.user_id) >= 20
    `, [MINIMUM_BEHAVIOR_EVENTS_TO_QUALIFY]);

    if (platformRatesResult.rows.length === 0) {
      console.log("[DemographicLearning] Not enough platform data yet for gender affinity");
      return;
    }

    const platformRateMap = {};
    for (const row of platformRatesResult.rows) {
      platformRateMap[row.category] = parseFloat(row.platform_rate);
    }

    // Step 2: Per-gender engagement rate per category
    const genderRatesResult = await pool.query(`
      SELECT
        m.gender,
        v.category,
        COUNT(DISTINCT v.user_id)::float /
          NULLIF(
            (SELECT COUNT(*) FROM members m2
             JOIN user_aqi_signals s2 ON s2.user_id = m2.id
             WHERE m2.gender = m.gender
               AND s2.total_behavior_events >= $1),
          0) AS gender_rate,
        COUNT(DISTINCT v.user_id) AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      JOIN user_interest_vectors v ON v.user_id = m.id
      WHERE s.total_behavior_events >= $1
        AND m.gender IS NOT NULL
        AND m.gender NOT IN ('Prefer not to say', 'Unknown', '')
        AND v.decayed_score > 10
      GROUP BY m.gender, v.category
      HAVING COUNT(DISTINCT v.user_id) >= 30
    `, [MINIMUM_BEHAVIOR_EVENTS_TO_QUALIFY]);

    let upserted = 0;

    for (const row of genderRatesResult.rows) {
      const platformRate = platformRateMap[row.category];
      if (!platformRate || platformRate === 0) continue;

      const genderRate = parseFloat(row.gender_rate);
      const affinityIndex = genderRate / platformRate;
      const sampleSize = parseInt(row.sample_size);

      const confidence =
        sampleSize >= 200 ? "high" :
        sampleSize >= 100 ? "medium" :
        sampleSize >= 30 ? "low" :
        "insufficient";

      if (confidence === "insufficient") continue;

      await pool.query(`
        INSERT INTO learned_gender_category_affinity
          (gender, category, affinity_index, sample_size, confidence_level, last_calculated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (gender, category) DO UPDATE SET
          affinity_index = EXCLUDED.affinity_index,
          sample_size = EXCLUDED.sample_size,
          confidence_level = EXCLUDED.confidence_level,
          last_calculated_at = NOW()
      `, [row.gender, row.category, affinityIndex, sampleSize, confidence]);

      upserted++;
    }

    console.log(
      `[DemographicLearning] Gender affinity: ${upserted} gender-category pairs learned`,
    );
  } catch (err) {
    console.error("[DemographicLearning] learnGenderCategoryAffinity error:", err.message);
  }
}

module.exports = {
  runDemographicLearningJob,
  learnScoresForDimension,
  seedOccupationHierarchy,
  recalculateAllUserVectors,
  learnGenderCategoryAffinity,
  detectAnomalousSignals,
};
