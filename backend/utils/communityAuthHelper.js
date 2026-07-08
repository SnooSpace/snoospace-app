/**
 * communityAuthHelper.js
 *
 * Shared utility for checking whether the current requester is authorized
 * to act on behalf of a specific Community, at a given minimum role.
 *
 * Two authorization paths:
 *   Path A — Community's own JWT (type='community', id === communityId)
 *             → Treated as owner-equivalent (bootstrapping path; no community_hosts row required)
 *
 *   Path B — Member JWT (type='member') with an active community_hosts row
 *             at or above the required role
 *
 * Returns:
 *   { authorized: true,  actingCommunityId: <BIGINT> }   on success
 *   { authorized: false }                                  on failure
 *
 * IMPORTANT: Always use `actingCommunityId` (not req.user.id) in SQL queries
 * that reference community_id or creator_id, so that a Member-host's ID is
 * never accidentally written into community-scoped rows.
 */

const ROLE_HIERARCHY = { owner: 3, host: 2, moderator: 1 };

/**
 * @param {Object}   req         - Express request (req.user must be set by authMiddleware)
 * @param {number|string} communityId - The community's DB id (from route param or body)
 * @param {Object}   pool        - pg Pool (req.app.locals.pool)
 * @param {string[]} minRoles    - Minimum acceptable roles, e.g. ['owner'] or ['owner','host','moderator']
 * @returns {Promise<{ authorized: boolean, actingCommunityId?: number, role?: string }>}
 */
async function isAuthorizedForCommunity(req, communityId, pool, minRoles = ['owner', 'host', 'moderator']) {
  if (!req.user || !communityId) return { authorized: false };

  const { id: userId, type: userType } = req.user;

  // Path A: Community's own JWT — always owner-equivalent for self-management
  if (userType === 'community' && String(userId) === String(communityId)) {
    return { authorized: true, actingCommunityId: Number(communityId), role: 'owner' };
  }

  // Path B: Member JWT with an active community_hosts row
  if (userType === 'member') {
    try {
      const result = await pool.query(
        `SELECT role FROM community_hosts
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'
         LIMIT 1`,
        [communityId, userId]
      );

      if (result.rows.length === 0) return { authorized: false };

      const memberRole = result.rows[0].role;
      const memberLevel = ROLE_HIERARCHY[memberRole] || 0;
      const minLevel = Math.min(...minRoles.map(r => ROLE_HIERARCHY[r] || 0));

      if (memberLevel >= minLevel) {
        return { authorized: true, actingCommunityId: Number(communityId), role: memberRole };
      }
    } catch (err) {
      console.error('[communityAuthHelper] DB error during authorization check:', err.message);
    }
    return { authorized: false };
  }

  // All other account types (sponsor, venue) cannot act as community hosts
  return { authorized: false };
}

module.exports = { isAuthorizedForCommunity };
