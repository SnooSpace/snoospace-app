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
 * Main entry point — runs the full weekly learning pipeline.
 */
async function runDemographicLearningJob(pool) {
  console.log("[DemographicLearning] === Starting weekly demographic learning job ===");
  const startTime = Date.now();

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

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `[DemographicLearning] === Weekly job completed in ${elapsed}s ===`,
  );
}

module.exports = {
  runDemographicLearningJob,
  learnScoresForDimension,
  seedOccupationHierarchy,
  recalculateAllUserVectors,
};
