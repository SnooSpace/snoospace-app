'use strict';

/**
 * computeReputationScores.js
 *
 * Hourly batch job: compute Bayesian-smoothed reputation scores for all users
 * who have received new attendee ratings since their last computation.
 *
 * Algorithm:
 *   1. Find users with reputation_pair_history rows newer than last_computed_at
 *   2. For each ratee: pull 180-day window of ratings
 *   3. Weight each rater→ratee pair by 1/sqrt(pair_count) to penalise repeat raters
 *   4. Cap any single rater's contribution to <= 40% of total weighted pool
 *   5. Bayesian smooth: (positive_weighted + k * prior) / (total_weighted + k)
 *      where k=5, prior=0.75 (mild positive prior — most open plan attendees self-select)
 *   6. Upsert user_reputation_scores
 *   7. Bust Redis cache for each updated user
 */

const { setUserReputation, deleteUserReputation } = require('../services/redisService');

// ── Tuning constants ──────────────────────────────────────────────────────────

const WINDOW_DAYS           = 180;  // trailing window for pair lookups
const BAYESIAN_K            = 5;    // smoothing weight (number of "ghost" observations)
const BAYESIAN_PRIOR        = 0.75; // prior probability of positive rating
const RATER_EXCLUSIVITY_CAP = 0.40; // max fraction of weighted pool from one rater
const MIN_RATINGS_THRESHOLD = 5;    // smoothed_score is NULL below this

// Rating → positive signal (1=positive, 0.5=neutral, 0=negative)
function ratingToSignal(rating) {
  switch (rating) {
    case 'absolutely': return 1.0;
    case 'probably':   return 1.0;
    case 'maybe':      return 0.5;
    case 'probably_not': return 0.0;
    case 'never_again':  return 0.0;
    default:             return 0.5;
  }
}

/**
 * runReputationJob(pool)
 * Main export — called by schedulerService.js on the hourly cron.
 * Accepts pool as argument to match established job pattern (computeRecommendations.js).
 */
async function runReputationJob(pool) {
  const jobStart = Date.now();
  console.log('[ReputationJob] ▶ Starting reputation computation...');

  try {
    // Step 1: find ratees who have new data since last computation
    const staleUsersResult = await pool.query(`
      SELECT DISTINCT rph.ratee_id AS user_id
      FROM reputation_pair_history rph
      LEFT JOIN user_reputation_scores urs ON urs.user_id = rph.ratee_id
      WHERE rph.created_at > COALESCE(urs.last_computed_at, '1970-01-01')
        AND rph.created_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
    `);

    const staleUsers = staleUsersResult.rows.map(r => r.user_id);
    console.log(`[ReputationJob] ${staleUsers.length} users need recomputation`);

    let updated = 0;
    let errors  = 0;

    for (const userId of staleUsers) {
      try {
        await computeForUser(pool, userId);
        updated++;
      } catch (err) {
        errors++;
        console.error(`[ReputationJob] Error computing user ${userId}:`, err.message);
      }
    }

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(2);
    console.log(`[ReputationJob] ✔ Done — updated=${updated} errors=${errors} in ${elapsed}s`);
  } catch (err) {
    console.error('[ReputationJob] Fatal error:', err.message);
    throw err;
  }
}

async function computeForUser(pool, userId) {
  // Step 2: fetch 180-day window of pair ratings for this ratee
  const pairsResult = await pool.query(`
    SELECT rater_id, rating, created_at
    FROM reputation_pair_history
    WHERE ratee_id = $1
      AND created_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
    ORDER BY created_at DESC
  `, [userId]);

  const pairs = pairsResult.rows;

  if (pairs.length === 0) {
    // Nothing in window — zero out score
    await pool.query(`
      INSERT INTO user_reputation_scores
        (user_id, raw_positive_weighted, raw_total_weighted, smoothed_score,
         total_raw_rating_count, last_computed_at)
      VALUES ($1, 0, 0, NULL, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        raw_positive_weighted  = 0,
        raw_total_weighted     = 0,
        smoothed_score         = NULL,
        total_raw_rating_count = 0,
        last_computed_at       = NOW()
    `, [userId]);

    await deleteUserReputation(userId);
    return;
  }

  // Step 3: group by rater and compute pair_count for weight decay
  const raterMap = {}; // rater_id → [{ signal, rating }]
  for (const row of pairs) {
    const raterId = String(row.rater_id);
    if (!raterMap[raterId]) raterMap[raterId] = [];
    raterMap[raterId].push({ signal: ratingToSignal(row.rating), rating: row.rating });
  }

  // Per-rater weight = 1 / sqrt(pair_count)
  let raterWeightedContribs = [];
  for (const [raterId, ratings] of Object.entries(raterMap)) {
    const pairCount = ratings.length;
    const weight    = 1 / Math.sqrt(pairCount);
    let posWeighted = 0;
    let totalWeight = 0;
    for (const { signal } of ratings) {
      posWeighted += signal * weight;
      totalWeight += weight;
    }
    raterWeightedContribs.push({ raterId, posWeighted, totalWeight });
  }

  // Step 4: exclusivity cap — single rater can't exceed 40% of total weighted pool
  let totalWeightedPool = raterWeightedContribs.reduce((s, r) => s + r.totalWeight, 0);
  for (const contrib of raterWeightedContribs) {
    const fraction = totalWeightedPool > 0 ? contrib.totalWeight / totalWeightedPool : 0;
    if (fraction > RATER_EXCLUSIVITY_CAP) {
      const cappedWeight = RATER_EXCLUSIVITY_CAP * totalWeightedPool;
      const ratio = cappedWeight / contrib.totalWeight;
      contrib.posWeighted  *= ratio;
      contrib.totalWeight   = cappedWeight;
    }
  }

  // Re-sum after capping
  let totalPositiveWeighted = 0;
  let totalWeighted         = 0;
  for (const contrib of raterWeightedContribs) {
    totalPositiveWeighted += contrib.posWeighted;
    totalWeighted         += contrib.totalWeight;
  }

  // Step 5: Bayesian smoothing
  const smoothedScore = (totalPositiveWeighted + BAYESIAN_K * BAYESIAN_PRIOR)
                       / (totalWeighted + BAYESIAN_K);

  const rawCount = pairs.length;

  // Step 6: upsert
  await pool.query(`
    INSERT INTO user_reputation_scores
      (user_id, raw_positive_weighted, raw_total_weighted, smoothed_score,
       total_raw_rating_count, last_computed_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      raw_positive_weighted  = EXCLUDED.raw_positive_weighted,
      raw_total_weighted     = EXCLUDED.raw_total_weighted,
      smoothed_score         = EXCLUDED.smoothed_score,
      total_raw_rating_count = EXCLUDED.total_raw_rating_count,
      last_computed_at       = NOW()
  `, [userId, totalPositiveWeighted, totalWeighted, smoothedScore, rawCount]);

  // Step 7: bust Redis cache — next API request will recompute from DB
  await deleteUserReputation(userId);

  // Also warm the cache immediately for hot users
  const MIN_RATINGS = MIN_RATINGS_THRESHOLD;
  let cacheData;
  if (rawCount < MIN_RATINGS) {
    cacheData = { status: 'building', label: 'Building reputation' };
  } else {
    const pct = Math.round(smoothedScore * 100);
    const bucket = rawCount < 20 ? '5-20' : rawCount < 50 ? '20-50' : '50+';
    cacheData = { status: 'active', percentage: pct, sample_size_bucket: bucket };
  }
  await setUserReputation(userId, cacheData);
}

module.exports = { runReputationJob };
