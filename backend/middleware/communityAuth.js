/**
 * communityAuth.js
 *
 * Middleware factory for role-gating community-management endpoints.
 *
 * Usage:
 *   const { requireCommunityRole } = require('../middleware/communityAuth');
 *
 *   router.post('/:communityId/hosts/invite',
 *     authMiddleware,
 *     requireCommunityRole(['owner']),
 *     CommunityHostsController.inviteHost
 *   );
 *
 * Authorization paths (same dual-path as communityAuthHelper):
 *   Path A — Community's own JWT (type='community', id === :communityId) → always allowed
 *   Path B — Member JWT with an active community_hosts row at required role
 *
 * On success: attaches req.communityRole and req.actingCommunityId for use in the controller.
 * On failure: returns 403.
 *
 * Requires: :communityId in req.params (set by Express route param).
 */

const { isAuthorizedForCommunity } = require('../utils/communityAuthHelper');

/**
 * Factory function. Pass an array of acceptable roles.
 * @param {string[]} allowedRoles  e.g. ['owner'] or ['owner', 'host', 'moderator']
 */
function requireCommunityRole(allowedRoles = ['owner', 'host', 'moderator']) {
  return async (req, res, next) => {
    try {
      const pool = req.app.locals.pool;
      const communityId = req.params.communityId;

      if (!communityId) {
        return res.status(400).json({ error: 'Missing communityId route parameter' });
      }

      const { authorized, actingCommunityId, role } = await isAuthorizedForCommunity(
        req,
        communityId,
        pool,
        allowedRoles
      );

      if (!authorized) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: allowedRoles,
          actual: null,
        });
      }

      // Attach for use in controller (avoids re-querying)
      req.actingCommunityId = actingCommunityId;
      req.communityRole = role;

      next();
    } catch (err) {
      console.error('[requireCommunityRole] Middleware error:', err.message);
      res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
}

module.exports = { requireCommunityRole };
