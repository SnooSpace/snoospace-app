/**
 * communityReliabilityService.js
 *
 * Centralized service for community cancellation and postponement reliability scoring.
 * Evaluates disruptions over a rolling 90-day window across BOTH cancellations and postponements,
 * and synchronizes communities.non_genuine_cancellation_count and communities.cancellation_flagged.
 */

/**
 * Recomputes community disruption metrics and flags from source disruptions.
 *
 * Flagging rule:
 *   cancellation_flagged = true if trailing 90 days has:
 *     - >= 2 non-genuine disruptions, OR
 *     - >= 3 total disruptions (genuine + non-genuine)
 *
 * @param {import('pg').Pool} pool
 * @param {number|string} communityId
 * @returns {Promise<{
 *   total_disruptions_90d: number,
 *   non_genuine_90d: number,
 *   cancellation_flagged: boolean,
 *   non_genuine_cancellation_count: number
 * }>}
 */
const recomputeCommunityReliability = async (pool, communityId) => {
  if (!communityId) return null;

  const metricsRes = await pool.query(
    `SELECT
       COUNT(*)::int AS total_disruptions_90d,
       COUNT(*) FILTER (WHERE is_genuine = false)::int AS non_genuine_90d
     FROM community_disruptions
     WHERE community_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'`,
    [communityId],
  );

  const { total_disruptions_90d = 0, non_genuine_90d = 0 } = metricsRes.rows[0] || {};
  const shouldBeFlagged = non_genuine_90d >= 2 || total_disruptions_90d >= 3;

  await pool.query(
    `UPDATE communities
     SET non_genuine_cancellation_count = $1,
         cancellation_flagged = $2
     WHERE id = $3`,
    [non_genuine_90d, shouldBeFlagged, communityId],
  );

  console.log(
    `[CommunityReliabilityService] Community ${communityId} disruptions 90d: non_genuine=${non_genuine_90d}, total=${total_disruptions_90d} -> cancellation_flagged=${shouldBeFlagged}`,
  );

  return {
    total_disruptions_90d,
    non_genuine_90d,
    cancellation_flagged: shouldBeFlagged,
    non_genuine_cancellation_count: non_genuine_90d,
  };
};

module.exports = {
  recomputeCommunityReliability,
};
