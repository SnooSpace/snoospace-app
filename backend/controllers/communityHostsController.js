/**
 * communityHostsController.js
 *
 * Handles all host-management actions for Communities.
 * 
 * Routes (see routes/communityHosts.js):
 *   GET    /api/communities/:communityId/hosts
 *   POST   /api/communities/:communityId/hosts/invite
 *   PATCH  /api/communities/:communityId/hosts/:hostUserId/role
 *   DELETE /api/communities/:communityId/hosts/:hostUserId
 *   POST   /api/communities/:communityId/transfer-ownership
 *   GET    /api/users/me/hosted-communities
 *
 * Auth pattern:
 *   - req.actingCommunityId is set by requireCommunityRole middleware (never use req.user.id as communityId)
 *   - req.communityRole is the caller's role ('owner' | 'host' | 'moderator')
 *   - For /hosted-communities, only authMiddleware is needed (any authenticated member/community)
 */

const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeAuditLog(pool, { communityId, actorUserId, action, targetUserId = null, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO community_host_audit_log (community_id, actor_user_id, action, target_user_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [communityId, actorUserId, action, targetUserId || null, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Non-blocking — audit failure should never break the action
    console.error('[communityHosts] Audit log write failed:', err.message);
  }
}

async function notifyHost(pool, { recipientMemberId, actorMemberId, type, communityId, communityName }) {
  if (notificationService.shouldSuppressNotifications()) return;
  try {
    const messages = {
      host_invited:             { title: 'You\'ve been added as a Host', body: `You're now a Host of ${communityName}` },
      host_removed:             { title: 'Host access removed', body: `You've been removed as a Host of ${communityName}` },
      ownership_transferred_to: { title: 'You\'re now the Owner', body: `Ownership of ${communityName} was transferred to you` },
      ownership_transferred_all:{ title: 'Ownership transferred', body: `Ownership of ${communityName} has been transferred` },
    };
    const msg = messages[type] || { title: 'Community update', body: communityName };

    await notificationService.createSimpleNotification(pool, {
      recipientId:   recipientMemberId,
      recipientType: 'member',
      actorId:       actorMemberId || null,
      actorType:     actorMemberId ? 'member' : null,
      type:          `community_${type}`,
      payload: {
        title: msg.title,
        message: msg.body,
        communityId,
        communityName,
        referenceType: 'community',
        referenceId: communityId,
      },
    });

    await pushService.sendPushNotification(pool, recipientMemberId, 'member', msg.title, msg.body, {
      type: `community_${type}`,
      communityId,
    });
  } catch (err) {
    console.error('[communityHosts] Notification error:', err.message);
  }
}

// ─── GET /api/communities/:communityId/hosts ──────────────────────────────────

const getHosts = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId } = req.params;

    const result = await pool.query(
      `SELECT
         ch.id,
         ch.community_id,
         ch.user_id,
         ch.role,
         ch.status,
         ch.invited_by,
         ch.created_at,
         ch.updated_at,
         m.name,
         m.username,
         m.profile_photo_url AS avatar_url,
         inv.name    AS invited_by_name,
         inv.username AS invited_by_username
       FROM community_hosts ch
       JOIN members m ON m.id = ch.user_id
       LEFT JOIN members inv ON inv.id = ch.invited_by
       WHERE ch.community_id = $1 AND ch.status = 'active'
       ORDER BY
         CASE ch.role WHEN 'owner' THEN 1 WHEN 'host' THEN 2 WHEN 'moderator' THEN 3 END,
         ch.created_at ASC`,
      [communityId]
    );

    res.json({ hosts: result.rows });
  } catch (err) {
    console.error('[communityHosts.getHosts]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── POST /api/communities/:communityId/hosts/invite ─────────────────────────

const inviteHost = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId } = req.params;
    const { userId: targetUserId, role: invitedRole } = req.body;

    // Validate role — 'owner' is never assignable via invite
    if (!targetUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!['host', 'moderator'].includes(invitedRole)) {
      return res.status(400).json({
        error: 'role must be "host" or "moderator". Use transfer-ownership to assign an owner.',
      });
    }

    // Confirm target is a Member
    const memberCheck = await pool.query(
      `SELECT id, name, username FROM members WHERE id = $1 LIMIT 1`,
      [targetUserId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const targetMember = memberCheck.rows[0];

    // Reject if already an active host
    const existing = await pool.query(
      `SELECT id, status FROM community_hosts WHERE community_id = $1 AND user_id = $2 LIMIT 1`,
      [communityId, targetUserId]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'active') {
      return res.status(409).json({ error: 'This member is already an active host of this community' });
    }

    // Resolve actorId (Community JWT has no member row, so actor may be null for Path A)
    const actorMemberId = req.user.type === 'member' ? req.user.id : null;

    // Upsert host row (re-activate if previously revoked)
    await pool.query(
      `INSERT INTO community_hosts (community_id, user_id, role, invited_by, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by, updated_at = NOW()`,
      [communityId, targetUserId, invitedRole, actorMemberId]
    );

    // Fetch community name for notification
    const commResult = await pool.query(`SELECT name FROM communities WHERE id = $1`, [communityId]);
    const communityName = commResult.rows[0]?.name || 'the community';

    await writeAuditLog(pool, {
      communityId,
      actorUserId: actorMemberId || communityId, // best effort
      action: 'host_invited',
      targetUserId,
      metadata: { role: invitedRole },
    });

    // Fire-and-forget notification to invited member
    notifyHost(pool, {
      recipientMemberId: targetUserId,
      actorMemberId,
      type: 'host_invited',
      communityId: Number(communityId),
      communityName,
    });

    res.json({
      success: true,
      host: {
        community_id: Number(communityId),
        user_id: Number(targetUserId),
        role: invitedRole,
        status: 'active',
        name: targetMember.name,
        username: targetMember.username,
      },
    });
  } catch (err) {
    console.error('[communityHosts.inviteHost]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── PATCH /api/communities/:communityId/hosts/:hostUserId/role ───────────────

const updateHostRole = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId, hostUserId } = req.params;
    const { role: newRole } = req.body;

    if (!['host', 'moderator'].includes(newRole)) {
      return res.status(400).json({
        error: 'role must be "host" or "moderator". Use transfer-ownership to change owner.',
      });
    }

    // Fetch current row
    const current = await pool.query(
      `SELECT role FROM community_hosts WHERE community_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [communityId, hostUserId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'No active host row found for this member' });
    }
    const fromRole = current.rows[0].role;

    await pool.query(
      `UPDATE community_hosts SET role = $1, updated_at = NOW()
       WHERE community_id = $2 AND user_id = $3 AND status = 'active'`,
      [newRole, communityId, hostUserId]
    );

    const actorMemberId = req.user.type === 'member' ? req.user.id : null;
    await writeAuditLog(pool, {
      communityId,
      actorUserId: actorMemberId || communityId,
      action: 'role_changed',
      targetUserId: hostUserId,
      metadata: { from_role: fromRole, to_role: newRole },
    });

    res.json({ success: true, user_id: Number(hostUserId), role: newRole });
  } catch (err) {
    console.error('[communityHosts.updateHostRole]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── DELETE /api/communities/:communityId/hosts/:hostUserId ──────────────────

const removeHost = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId, hostUserId } = req.params;
    const requesterId = req.user.id;
    const requesterType = req.user.type;

    // Fetch the target's current row
    const targetRow = await pool.query(
      `SELECT role FROM community_hosts WHERE community_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [communityId, hostUserId]
    );
    if (targetRow.rows.length === 0) {
      return res.status(404).json({ error: 'No active host row found for this member' });
    }
    const targetRole = targetRow.rows[0].role;

    // Guard: an Owner cannot self-delete (must transfer ownership first)
    const isSelfRemoval = requesterType === 'member' && String(requesterId) === String(hostUserId);
    if (isSelfRemoval && targetRole === 'owner') {
      return res.status(409).json({
        error: 'You are the sole Owner and cannot remove yourself. Transfer ownership first.',
        code: 'OWNER_SELF_REMOVAL',
      });
    }

    // Authorization: self-removal OR owner removing someone else
    // (requireCommunityRole(['owner','host','moderator']) on the route is the coarse guard;
    //  here we enforce that only an owner can remove *others*)
    const isOwner = req.communityRole === 'owner' || requesterType === 'community';
    if (!isSelfRemoval && !isOwner) {
      return res.status(403).json({ error: 'Only an Owner can remove other hosts' });
    }

    await pool.query(
      `UPDATE community_hosts SET status = 'revoked', updated_at = NOW()
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, hostUserId]
    );

    const actorMemberId = requesterType === 'member' ? requesterId : null;
    await writeAuditLog(pool, {
      communityId,
      actorUserId: actorMemberId || communityId,
      action: 'host_removed',
      targetUserId: hostUserId,
      metadata: { removed_role: targetRole, self_removal: isSelfRemoval },
    });

    // Notify removed member (unless it was a self-removal)
    if (!isSelfRemoval) {
      const commResult = await pool.query(`SELECT name FROM communities WHERE id = $1`, [communityId]);
      notifyHost(pool, {
        recipientMemberId: Number(hostUserId),
        actorMemberId,
        type: 'host_removed',
        communityId: Number(communityId),
        communityName: commResult.rows[0]?.name || 'the community',
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[communityHosts.removeHost]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── POST /api/communities/:communityId/transfer-ownership ───────────────────

const transferOwnership = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId } = req.params;
    const { newOwnerUserId } = req.body;

    if (!newOwnerUserId) {
      return res.status(400).json({ error: 'newOwnerUserId is required' });
    }

    const currentOwnerId = req.user.type === 'member' ? req.user.id : null;

    // Validate target is an active host (not just any member)
    const targetRow = await pool.query(
      `SELECT role FROM community_hosts
       WHERE community_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [communityId, newOwnerUserId]
    );
    if (targetRow.rows.length === 0) {
      return res.status(400).json({
        error: 'The target user must be an active host of this community before receiving ownership',
      });
    }

    // Run as single transaction: demote current owner → promote target
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Demote current owner (if it's a Member-owner; Community account has no row to demote)
      if (currentOwnerId) {
        await client.query(
          `UPDATE community_hosts SET role = 'host', updated_at = NOW()
           WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
          [communityId, currentOwnerId]
        );
      }

      // Promote target to owner
      await client.query(
        `UPDATE community_hosts SET role = 'owner', updated_at = NOW()
         WHERE community_id = $1 AND user_id = $2 AND status = 'active'`,
        [communityId, newOwnerUserId]
      );

      // Audit inside the transaction so it rolls back on failure
      await client.query(
        `INSERT INTO community_host_audit_log (community_id, actor_user_id, action, target_user_id, metadata)
         VALUES ($1, $2, 'ownership_transferred', $3, $4)`,
        [
          communityId,
          currentOwnerId || communityId,
          newOwnerUserId,
          JSON.stringify({ from_user_id: currentOwnerId, to_user_id: newOwnerUserId }),
        ]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Notify all active hosts of the transfer (fire-and-forget, outside transaction)
    try {
      const commResult = await pool.query(`SELECT name FROM communities WHERE id = $1`, [communityId]);
      const communityName = commResult.rows[0]?.name || 'the community';

      const allHosts = await pool.query(
        `SELECT user_id FROM community_hosts WHERE community_id = $1 AND status = 'active'`,
        [communityId]
      );

      for (const { user_id } of allHosts.rows) {
        if (String(user_id) === String(newOwnerUserId)) {
          // Tell the new owner specifically
          notifyHost(pool, {
            recipientMemberId: Number(user_id),
            actorMemberId: currentOwnerId,
            type: 'ownership_transferred_to',
            communityId: Number(communityId),
            communityName,
          });
        } else if (!currentOwnerId || String(user_id) !== String(currentOwnerId)) {
          // Notify all other hosts (not the actor)
          notifyHost(pool, {
            recipientMemberId: Number(user_id),
            actorMemberId: currentOwnerId,
            type: 'ownership_transferred_all',
            communityId: Number(communityId),
            communityName,
          });
        }
      }
    } catch (notifErr) {
      console.error('[communityHosts.transferOwnership] Notification error (non-fatal):', notifErr.message);
    }

    res.json({ success: true, new_owner_user_id: Number(newOwnerUserId) });
  } catch (err) {
    console.error('[communityHosts.transferOwnership]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── GET /api/users/me/hosted-communities ────────────────────────────────────
// Powers the "Hosting" section of the account switcher.
// Returns all communities where the current Member has an active host row.

const getMyHostedCommunities = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Only Members have host rows; a Community account managing itself doesn't need this
    if (!userId || userType !== 'member') {
      return res.json({ communities: [] });
    }

    const result = await pool.query(
      `SELECT
         ch.community_id,
         ch.role,
         ch.created_at AS host_since,
         c.name,
         c.username,
         c.logo_url,
         c.bio,
         c.community_type
       FROM community_hosts ch
       JOIN communities c ON c.id = ch.community_id
       WHERE ch.user_id = $1 AND ch.status = 'active'
       ORDER BY
         CASE ch.role WHEN 'owner' THEN 1 WHEN 'host' THEN 2 WHEN 'moderator' THEN 3 END,
         ch.created_at ASC`,
      [userId]
    );

    res.json({ communities: result.rows });
  } catch (err) {
    console.error('[communityHosts.getMyHostedCommunities]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getHosts,
  inviteHost,
  updateHostRole,
  removeHost,
  transferOwnership,
  getMyHostedCommunities,
};
