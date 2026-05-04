/**
 * Community Health Score Calculator
 *
 * Recalculates and persists the community_health_scores record
 * for a given community. Called:
 *   1. Immediately after any new fraud flag is inserted
 *   2. At the start of the weekly learning job for all communities with open flags
 *
 * Scoring rules:
 *   - Any high flag    → 'restricted',   brand_match_multiplier = 0.0
 *   - 2+ medium flags  → 'under_review', brand_match_multiplier = 0.5
 *   - 1 medium flag    → 'under_review', brand_match_multiplier = 0.75
 *   - No active flags  → 'healthy',      brand_match_multiplier = 1.0
 *
 * Only flags from the last 90 days and unresolved are counted.
 */

const recalculateCommunityHealthScore = async (pool, communityId) => {
  try {
    const flagResult = await pool.query(`
      SELECT severity, COUNT(*) AS count
      FROM community_fraud_signals
      WHERE community_id = $1
        AND resolved = false
        AND flagged_at >= NOW() - INTERVAL '90 days'
      GROUP BY severity
    `, [communityId]);

    const flags = flagResult.rows;

    const highFlags = parseInt(flags.find(f => f.severity === 'high')?.count ?? 0);
    const mediumFlags = parseInt(flags.find(f => f.severity === 'medium')?.count ?? 0);
    const lowFlags = parseInt(flags.find(f => f.severity === 'low')?.count ?? 0);

    let healthStatus, brandMatchMultiplier;

    if (highFlags >= 1) {
      healthStatus = 'restricted';
      brandMatchMultiplier = 0.0;
    } else if (mediumFlags >= 2) {
      healthStatus = 'under_review';
      brandMatchMultiplier = 0.5;
    } else if (mediumFlags === 1) {
      healthStatus = 'under_review';
      brandMatchMultiplier = 0.75;
    } else {
      healthStatus = 'healthy';
      brandMatchMultiplier = 1.0;
    }

    await pool.query(`
      INSERT INTO community_health_scores
        (community_id, health_status, active_flag_count,
         medium_flag_count, high_flag_count,
         brand_match_multiplier, last_calculated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (community_id) DO UPDATE SET
        health_status = EXCLUDED.health_status,
        active_flag_count = EXCLUDED.active_flag_count,
        medium_flag_count = EXCLUDED.medium_flag_count,
        high_flag_count = EXCLUDED.high_flag_count,
        brand_match_multiplier = EXCLUDED.brand_match_multiplier,
        last_calculated_at = NOW()
    `, [
      communityId,
      healthStatus,
      highFlags + mediumFlags + lowFlags,
      mediumFlags,
      highFlags,
      brandMatchMultiplier,
    ]);

    console.log(`[CommunityHealth] Community ${communityId}: ${healthStatus} (multiplier: ${brandMatchMultiplier})`);
    return { healthStatus, brandMatchMultiplier };
  } catch (err) {
    console.error('[CommunityHealth] recalculateCommunityHealthScore error:', err.message);
    return { healthStatus: 'healthy', brandMatchMultiplier: 1.0 };
  }
};

module.exports = { recalculateCommunityHealthScore };
