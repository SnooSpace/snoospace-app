/**
 * Community-Member Circle Controller
 *
 * Allows a Community to invite a Member to join its circle.
 * This is separate from the member↔member circle system because
 * the existing circles table uses members(id) FKs only.
 *
 * Routes:
 *   POST   /community-circles/invites                     sendInvite
 *   DELETE /community-circles/invites/:inviteId           cancelInvite
 *   PATCH  /community-circles/invites/:inviteId           respondToInvite (member accepts/declines)
 *   GET    /community-circles/status/:memberId            getStatusForCommunity  (community viewer)
 *   GET    /community-circles/member-status/:communityId  getStatusForMember     (member viewer)
 *   DELETE /community-circles/:memberId                   removeFromCircle
 */

'use strict';

const pushService = require('../services/pushService');
const { shouldSuppressNotifications } = require('../services/notificationService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCommunityMeta(pool, communityId) {
  const r = await pool.query(
    `SELECT name, username, logo_url FROM communities WHERE id = $1`,
    [communityId]
  );
  return r.rows[0] || {};
}

async function notifyMemberOfInvite(pool, communityId, memberId) {
  if (shouldSuppressNotifications()) return;
  try {
    const actor = await getCommunityMeta(pool, communityId);

    // Remove any prior invite notification from this community to this member
    await pool.query(`
      DELETE FROM notifications
      WHERE actor_id = $1 AND actor_type = 'community'
        AND recipient_id = $2 AND recipient_type = 'member'
        AND type = 'community_circle_invite'
    `, [communityId, memberId]);

    await pool.query(`
      INSERT INTO notifications
        (recipient_id, recipient_type, actor_id, actor_type, type, payload, is_active, is_read, updated_at)
      VALUES ($1, 'member', $2, 'community', 'community_circle_invite', $3, TRUE, FALSE, NOW())
    `, [
      memberId,
      communityId,
      JSON.stringify({
        actorName: actor.name || null,
        actorUsername: actor.username || null,
        actorAvatar: actor.logo_url || null,
      }),
    ]);

    await pushService.sendPushNotification(
      pool,
      memberId,
      'member',
      '🔗 Circle Invite',
      `${actor.name || 'A community'} invited you to their circle`,
      { type: 'community_circle_invite', actorId: communityId, actorType: 'community' }
    );
  } catch (e) {
    console.error('[communityCircleController] Failed to send invite notification:', e);
  }
}

// ---------------------------------------------------------------------------
// POST /community-circles/invites — Community sends invite to member
// ---------------------------------------------------------------------------
const sendInvite = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.user?.id;
    const userType = req.user?.type;

    if (!communityId || userType !== 'community') {
      return res.status(401).json({ error: 'Community authentication required' });
    }

    const { member_id } = req.body;
    if (!member_id) return res.status(400).json({ error: 'member_id is required' });

    // Verify target is a member
    const memberCheck = await pool.query(`SELECT id FROM members WHERE id = $1`, [member_id]);
    if (memberCheck.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    // Already in circle?
    const circleCheck = await pool.query(
      `SELECT 1 FROM community_member_circles WHERE community_id = $1 AND member_id = $2 LIMIT 1`,
      [communityId, member_id]
    );
    if (circleCheck.rows.length > 0) {
      return res.status(409).json({ error: 'already_in_circle', message: 'This member is already in your circle.' });
    }

    // Upsert invite (re-activate cancelled/declined ones)
    const upsertResult = await pool.query(`
      INSERT INTO community_member_circle_invites (community_id, member_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (community_id, member_id) DO UPDATE
        SET status = CASE
              WHEN community_member_circle_invites.status IN ('declined', 'cancelled') THEN 'pending'
              ELSE community_member_circle_invites.status
            END,
            updated_at = NOW()
      RETURNING id, status
    `, [communityId, member_id]);

    const row = upsertResult.rows[0];
    if (row.status !== 'pending') {
      return res.status(409).json({ error: 'invite_already_pending', message: 'An invite is already pending.' });
    }

    // Send notification (best-effort)
    notifyMemberOfInvite(pool, communityId, member_id);

    return res.json({ success: true, invite_id: row.id });
  } catch (err) {
    console.error('[communityCircleController.sendInvite]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /community-circles/invites/:inviteId — Community cancels invite
// ---------------------------------------------------------------------------
const cancelInvite = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.user?.id;
    const userType = req.user?.type;

    if (!communityId || userType !== 'community') {
      return res.status(401).json({ error: 'Community authentication required' });
    }

    const { inviteId } = req.params;

    const inviteRes = await pool.query(
      `SELECT * FROM community_member_circle_invites WHERE id = $1`, [inviteId]
    );
    if (inviteRes.rows.length === 0) return res.status(404).json({ error: 'Invite not found' });

    const invite = inviteRes.rows[0];
    if (String(invite.community_id) !== String(communityId)) {
      return res.status(403).json({ error: 'You can only cancel invites you sent' });
    }
    if (invite.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending invites can be cancelled', current_status: invite.status });
    }

    await pool.query(
      `UPDATE community_member_circle_invites SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [inviteId]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[communityCircleController.cancelInvite]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /community-circles/invites/:inviteId — Member accepts or declines
// ---------------------------------------------------------------------------
const respondToInvite = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const memberId = req.user?.id;
    const userType = req.user?.type;

    if (!memberId || userType !== 'member') {
      return res.status(401).json({ error: 'Member authentication required' });
    }

    const { inviteId } = req.params;
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }

    const inviteRes = await pool.query(
      `SELECT * FROM community_member_circle_invites WHERE id = $1`, [inviteId]
    );
    if (inviteRes.rows.length === 0) return res.status(404).json({ error: 'Invite not found' });

    const invite = inviteRes.rows[0];
    if (String(invite.member_id) !== String(memberId)) {
      return res.status(403).json({ error: 'You are not the recipient of this invite' });
    }
    if (invite.status !== 'pending') {
      return res.status(409).json({ error: 'This invite is no longer pending', current_status: invite.status });
    }

    await pool.query(
      `UPDATE community_member_circle_invites SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, inviteId]
    );

    if (status === 'accepted') {
      await pool.query(
        `INSERT INTO community_member_circles (community_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [invite.community_id, memberId]
      );
      // Supersede standard follows between the community and member in either direction
      await pool.query(
        `UPDATE follows
         SET is_superseded_by_circle = true
         WHERE (follower_id = $1 AND follower_type = 'community' AND following_id = $2 AND following_type = 'member')
            OR (follower_id = $2 AND follower_type = 'member' AND following_id = $1 AND following_type = 'community')`,
        [invite.community_id, memberId]
      ).catch((e) => console.warn('[communityCircleController] follows supersede (accept):', e?.message));
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.error('[communityCircleController.respondToInvite]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /community-circles/status/:memberId — Status from community's POV
// Returns: { status: 'none' | 'pending_outgoing' | 'in_circle', invite_id? }
// ---------------------------------------------------------------------------
const getStatusForCommunity = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const communityId = req.user?.id;
    const userType = req.user?.type;

    if (!communityId || userType !== 'community') {
      return res.status(401).json({ error: 'Community authentication required' });
    }

    const { memberId } = req.params;

    // Check circle first
    const circleRes = await pool.query(
      `SELECT 1 FROM community_member_circles WHERE community_id = $1 AND member_id = $2 LIMIT 1`,
      [communityId, memberId]
    );
    if (circleRes.rows.length > 0) return res.json({ status: 'in_circle' });

    // Check pending invite
    const inviteRes = await pool.query(
      `SELECT id, status FROM community_member_circle_invites
       WHERE community_id = $1 AND member_id = $2 AND status = 'pending' LIMIT 1`,
      [communityId, memberId]
    );
    if (inviteRes.rows.length > 0) {
      return res.json({ status: 'pending_outgoing', invite_id: inviteRes.rows[0].id });
    }

    return res.json({ status: 'none' });
  } catch (err) {
    console.error('[communityCircleController.getStatusForCommunity]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /community-circles/member-status/:communityId — Status from member's POV
// Returns: { status: 'none' | 'pending_invite' | 'in_circle', invite_id? }
// ---------------------------------------------------------------------------
const getStatusForMember = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const memberId = req.user?.id;
    const userType = req.user?.type;

    if (!memberId || userType !== 'member') {
      return res.status(401).json({ error: 'Member authentication required' });
    }

    const { communityId } = req.params;

    // Check circle
    const circleRes = await pool.query(
      `SELECT 1 FROM community_member_circles WHERE community_id = $1 AND member_id = $2 LIMIT 1`,
      [communityId, memberId]
    );
    if (circleRes.rows.length > 0) return res.json({ status: 'in_circle' });

    // Check pending invite
    const inviteRes = await pool.query(
      `SELECT id FROM community_member_circle_invites
       WHERE community_id = $1 AND member_id = $2 AND status = 'pending' LIMIT 1`,
      [communityId, memberId]
    );
    if (inviteRes.rows.length > 0) {
      return res.json({ status: 'pending_invite', invite_id: inviteRes.rows[0].id });
    }

    return res.json({ status: 'none' });
  } catch (err) {
    console.error('[communityCircleController.getStatusForMember]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /community-circles/:memberId — Community removes member from circle
// ---------------------------------------------------------------------------
const removeFromCircle = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let communityId, memberId;

    if (userType === 'community') {
      communityId = userId;
      memberId = req.params.memberId;
    } else if (userType === 'member') {
      memberId = userId;
      communityId = req.params.memberId;
    } else {
      return res.status(403).json({ error: 'Unauthorized user type' });
    }

    const deleteResult = await pool.query(
      `DELETE FROM community_member_circles WHERE community_id = $1 AND member_id = $2`,
      [communityId, memberId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'This member/community is not in the circle' });
    }

    // Also clean up the accepted invite row so re-invites work cleanly
    await pool.query(
      `UPDATE community_member_circle_invites
       SET status = 'cancelled', updated_at = NOW()
       WHERE community_id = $1 AND member_id = $2 AND status = 'accepted'`,
      [communityId, memberId]
    );

    // Re-activate or permanently delete standard follows
    const alsoUnfollow = req.body?.also_unfollow === true;
    if (alsoUnfollow) {
      await pool.query(
        `DELETE FROM follows
         WHERE (follower_id = $1 AND follower_type = 'community' AND following_id = $2 AND following_type = 'member')
            OR (follower_id = $2 AND follower_type = 'member' AND following_id = $1 AND following_type = 'community')`,
        [communityId, memberId]
      ).catch((e) => console.warn('[communityCircleController] follows delete:', e?.message));
    } else {
      await pool.query(
        `UPDATE follows
         SET is_superseded_by_circle = false
         WHERE (follower_id = $1 AND follower_type = 'community' AND following_id = $2 AND following_type = 'member')
            OR (follower_id = $2 AND follower_type = 'member' AND following_id = $1 AND following_type = 'community')`,
        [communityId, memberId]
      ).catch((e) => console.warn('[communityCircleController] follows restore:', e?.message));
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[communityCircleController.removeFromCircle]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /community-circles/:communityId/members — List community's circle members
// ---------------------------------------------------------------------------
const getCircleMembers = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { communityId } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const searchClause = search ? `AND (m.name ILIKE $4 OR m.username ILIKE $4)` : '';
    const params = [communityId, limit, offset];
    if (search) params.push(`%${search}%`);

    const result = await pool.query(`
      SELECT
        m.id AS member_id,
        m.id AS id,
        m.name,
        m.username,
        m.profile_photo_url,
        m.profile_photo_url AS avatar_url,
        m.is_creator_mode_enabled,
        cc.created_at AS connected_since
      FROM community_member_circles cc
      JOIN members m ON m.id = cc.member_id
      WHERE cc.community_id = $1
        ${searchClause}
      ORDER BY cc.created_at DESC
      LIMIT $2 OFFSET $3
    `, params);

    return res.json({ members: result.rows });
  } catch (err) {
    console.error('[communityCircleController.getCircleMembers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  sendInvite,
  cancelInvite,
  respondToInvite,
  getStatusForCommunity,
  getStatusForMember,
  removeFromCircle,
  getCircleMembers,
};
