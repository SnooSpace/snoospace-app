/**
 * communityHosts.js — Routes for multi-host community management
 *
 * All routes require:
 *   - authMiddleware (validates JWT, sets req.user)
 *   - requireCommunityRole (validates caller is authorized for :communityId)
 *
 * Route prefix: /api  (mounted in routes/index.js)
 */

const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const { requireCommunityRole } = require('../middleware/communityAuth');
const ctrl = require('../controllers/communityHostsController');

// GET /api/communities/:communityId/hosts
// Any active host (owner / host / moderator) can view the host list
router.get(
  '/communities/:communityId/hosts',
  authMiddleware,
  requireCommunityRole(['owner', 'host', 'moderator']),
  ctrl.getHosts
);

// POST /api/communities/:communityId/hosts/invite
// Owner only
router.post(
  '/communities/:communityId/hosts/invite',
  authMiddleware,
  requireCommunityRole(['owner']),
  ctrl.inviteHost
);

// PATCH /api/communities/:communityId/hosts/:hostUserId/role
// Owner only — changes host or moderator role (never to 'owner')
router.patch(
  '/communities/:communityId/hosts/:hostUserId/role',
  authMiddleware,
  requireCommunityRole(['owner']),
  ctrl.updateHostRole
);

// DELETE /api/communities/:communityId/hosts/:hostUserId
// Owner removes anyone; any host removes themselves
router.delete(
  '/communities/:communityId/hosts/:hostUserId',
  authMiddleware,
  requireCommunityRole(['owner', 'host', 'moderator']),
  ctrl.removeHost
);

// POST /api/communities/:communityId/transfer-ownership
// Owner only — atomically flips owner row to a current host
router.post(
  '/communities/:communityId/transfer-ownership',
  authMiddleware,
  requireCommunityRole(['owner']),
  ctrl.transferOwnership
);

// GET /api/users/me/hosted-communities
// Any authenticated user (member) — returns their hosted communities for account switcher
router.get(
  '/users/me/hosted-communities',
  authMiddleware,
  ctrl.getMyHostedCommunities
);

module.exports = router;
