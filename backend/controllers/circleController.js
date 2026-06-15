/**
 * Circle Controller
 *
 * Handles the member-to-member "Circle" system — a mutual, request-based
 * connection (conceptually similar to LinkedIn connections).
 *
 * Follows remain unchanged for member→community/sponsor/venue flows.
 */

'use strict';

const { createPool } = require('../config/db');
const pushService = require('../services/pushService');
const { shouldSuppressNotifications } = require('../services/notificationService');

const pool = createPool();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a BIGINT pair is sorted so user_a_id < user_b_id (required by the
 * circles table CHECK constraint and UNIQUE index).
 * IDs from pg arrive as strings — parse to BigInt for correct numeric ordering.
 */
function sortedPair(idA, idB) {
  const a = BigInt(idA);
  const b = BigInt(idB);
  return a < b ? [idA, idB] : [idB, idA];
}

/**
 * Fetch minimal actor profile for push notification payloads.
 */
async function getMemberMeta(memberId) {
  const r = await pool.query(
    `SELECT name, username, profile_photo_url FROM members WHERE id = $1`,
    [memberId]
  );
  return r.rows[0] || {};
}

/**
 * Insert a circle_request_received notification for the receiver.
 */
async function notifyRequestReceived(senderId, receiverId) {
  if (shouldSuppressNotifications()) return;
  try {
    const actor = await getMemberMeta(senderId);
    console.log(`[circleController] Notifying ${receiverId} of circle request from ${senderId} (${actor.name})`);

    // Remove any prior circle_request_received notification from this sender
    // to this receiver (e.g. if they cancelled and re-requested)
    await pool.query(`
      DELETE FROM notifications
      WHERE actor_id = $1 AND actor_type = 'member'
        AND recipient_id = $2 AND recipient_type = 'member'
        AND type = 'circle_request_received'
    `, [senderId, receiverId]);

    await pool.query(`
      INSERT INTO notifications
        (recipient_id, recipient_type, actor_id, actor_type, type, payload, is_active, is_read, updated_at)
      VALUES ($1, 'member', $2, 'member', 'circle_request_received', $3, TRUE, FALSE, NOW())
    `, [
      receiverId,
      senderId,
      JSON.stringify({
        actorName: actor.name || null,
        actorUsername: actor.username || null,
        actorAvatar: actor.profile_photo_url || null,
      }),
    ]);

    await pushService.sendPushNotification(
      pool,
      receiverId,
      'member',
      '🔗 Circle Request',
      `${actor.name || 'Someone'} wants to connect with you`,
      { type: 'circle_request_received', actorId: senderId, actorType: 'member' }
    );

    console.log(`[circleController] ✅ circle_request_received notification sent to ${receiverId}`);
  } catch (e) {
    console.error('[circleController] Failed to send request-received notification:', e);
  }
}

/**
 * Insert a circle_request_accepted notification for the original sender.
 */
async function notifyRequestAccepted(acceptorId, originalSenderId) {
  if (shouldSuppressNotifications()) return;
  try {
    const actor = await getMemberMeta(acceptorId);
    console.log(`[circleController] Notifying ${originalSenderId} that ${acceptorId} (${actor.name}) accepted their request`);

    // Remove any prior accepted notification between this pair
    await pool.query(`
      DELETE FROM notifications
      WHERE actor_id = $1 AND actor_type = 'member'
        AND recipient_id = $2 AND recipient_type = 'member'
        AND type = 'circle_request_accepted'
    `, [acceptorId, originalSenderId]);

    await pool.query(`
      INSERT INTO notifications
        (recipient_id, recipient_type, actor_id, actor_type, type, payload, is_active, is_read, updated_at)
      VALUES ($1, 'member', $2, 'member', 'circle_request_accepted', $3, TRUE, FALSE, NOW())
    `, [
      originalSenderId,
      acceptorId,
      JSON.stringify({
        actorName: actor.name || null,
        actorUsername: actor.username || null,
        actorAvatar: actor.profile_photo_url || null,
      }),
    ]);

    await pushService.sendPushNotification(
      pool,
      originalSenderId,
      'member',
      '✅ Circle Request Accepted',
      `${actor.name || 'Someone'} accepted your circle request`,
      { type: 'circle_request_accepted', actorId: acceptorId, actorType: 'member' }
    );

    console.log(`[circleController] ✅ circle_request_accepted notification sent to ${originalSenderId}`);
  } catch (e) {
    console.error('[circleController] Failed to send request-accepted notification:', e);
  }
}

// ---------------------------------------------------------------------------
// POST /circles/requests — Send a circle request
// ---------------------------------------------------------------------------
const sendCircleRequest = async (req, res) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'Authentication required' });

    const { receiver_id } = req.body;
    if (!receiver_id) return res.status(400).json({ error: 'receiver_id is required' });
    if (senderId === receiver_id) return res.status(400).json({ error: 'Cannot send a request to yourself' });

    // Verify receiver exists and is a member
    const memberCheck = await pool.query(`SELECT id FROM members WHERE id = $1`, [receiver_id]);
    if (memberCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Block guard — check in both directions
    const blockCheck = await pool.query(`
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1
    `, [senderId, receiver_id]);
    if (blockCheck.rows.length > 0) {
      return res.status(403).json({ error: 'user_blocked', message: "You can't connect with this user." });
    }

    // Already in circle?
    const [ua, ub] = sortedPair(senderId, receiver_id);
    const circleCheck = await pool.query(
      `SELECT 1 FROM circles WHERE user_a_id = $1 AND user_b_id = $2`, [ua, ub]
    );
    if (circleCheck.rows.length > 0) {
      return res.status(409).json({ error: 'already_in_circle', message: 'You are already in each other\'s circle.' });
    }

    // ------------------------------------------------------------------
    // Check for a reverse pending request from receiver→sender.
    // If one exists, auto-resolve into a circle (simultaneous requests).
    // ------------------------------------------------------------------
    const reverseRequest = await pool.query(`
      SELECT id FROM circle_requests
      WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
    `, [receiver_id, senderId]);

    if (reverseRequest.rows.length > 0) {
      // Auto-accept: update reverse request + insert circle
      await pool.query(
        `UPDATE circle_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [reverseRequest.rows[0].id]
      );
      await pool.query(
        `INSERT INTO circles (user_a_id, user_b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ua, ub]
      );
      // Notify both parties
      await notifyRequestAccepted(senderId, receiver_id);
      return res.json({ success: true, auto_accepted: true, message: 'Mutual request — you are now in each other\'s circle.' });
    }

    // ------------------------------------------------------------------
    // UPSERT: Insert a new request, or re-activate a previously
    // declined/cancelled one. Reject if a pending row already exists
    // (which means sender already has an open request — shouldn't happen
    // in normal UI flow, but guard against double-tap / race conditions).
    // ------------------------------------------------------------------
    const upsertResult = await pool.query(`
      INSERT INTO circle_requests (sender_id, receiver_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (sender_id, receiver_id) DO UPDATE
        SET status = CASE
              WHEN circle_requests.status IN ('declined', 'cancelled') THEN 'pending'
              ELSE circle_requests.status   -- keep 'pending' / 'accepted' unchanged
            END,
            updated_at = NOW()
      RETURNING id, status
    `, [senderId, receiver_id]);

    const row = upsertResult.rows[0];

    if (row.status !== 'pending') {
      // The existing row was 'pending' — already open
      return res.status(409).json({ error: 'request_already_pending', message: 'A circle request is already pending.' });
    }

    // Fire notification (best-effort)
    notifyRequestReceived(senderId, receiver_id);

    return res.json({ success: true, request_id: row.id });
  } catch (err) {
    console.error('[circleController.sendCircleRequest]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /circles/requests/:id — Accept or decline an incoming request
// ---------------------------------------------------------------------------
const respondToCircleRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { id } = req.params;
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }

    // Fetch the request — only the receiver can respond
    const requestRes = await pool.query(
      `SELECT * FROM circle_requests WHERE id = $1`, [id]
    );
    if (requestRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const request = requestRes.rows[0];
    if (request.receiver_id !== userId) {
      return res.status(403).json({ error: 'You are not the recipient of this request' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'This request is no longer pending', current_status: request.status });
    }

    // Update status
    await pool.query(
      `UPDATE circle_requests SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );

    if (status === 'accepted') {
      const [ua, ub] = sortedPair(request.sender_id, request.receiver_id);
      await pool.query(
        `INSERT INTO circles (user_a_id, user_b_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ua, ub]
      );
      // Notify sender their request was accepted
      await notifyRequestAccepted(userId, request.sender_id);
    }

    return res.json({ success: true, status });
  } catch (err) {
    console.error('[circleController.respondToCircleRequest]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /circles/requests/:id — Cancel a request you sent
// ---------------------------------------------------------------------------
const cancelCircleRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { id } = req.params;

    const requestRes = await pool.query(
      `SELECT * FROM circle_requests WHERE id = $1`, [id]
    );
    if (requestRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const request = requestRes.rows[0];
    if (request.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only cancel requests you sent' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be cancelled', current_status: request.status });
    }

    await pool.query(
      `UPDATE circle_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[circleController.cancelCircleRequest]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /circles/requests/incoming — List pending requests received
// ---------------------------------------------------------------------------
const getIncomingRequests = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT
        cr.id,
        cr.sender_id,
        cr.created_at,
        m.name AS sender_name,
        m.username AS sender_username,
        m.profile_photo_url AS sender_avatar
      FROM circle_requests cr
      JOIN members m ON m.id = cr.sender_id
      WHERE cr.receiver_id = $1
        AND cr.status = 'pending'
      ORDER BY cr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[circleController.getIncomingRequests]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /circles/requests/outgoing — List pending requests sent
// ---------------------------------------------------------------------------
const getOutgoingRequests = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT
        cr.id,
        cr.receiver_id,
        cr.created_at,
        m.name AS receiver_name,
        m.username AS receiver_username,
        m.profile_photo_url AS receiver_avatar
      FROM circle_requests cr
      JOIN members m ON m.id = cr.receiver_id
      WHERE cr.sender_id = $1
        AND cr.status = 'pending'
      ORDER BY cr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[circleController.getOutgoingRequests]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /circles — List your circle members (paginated)
// ---------------------------------------------------------------------------
const getCircleMembers = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const searchClause = search ? `AND (m.name ILIKE $4 OR m.username ILIKE $4)` : '';
    const params = [userId, userId, limit, ...(search ? [`%${search}%`] : []), offset];

    // Re-index offset param position based on whether search is present
    const offsetParam = search ? 5 : 4;

    const result = await pool.query(`
      SELECT
        c.id AS circle_id,
        c.created_at AS connected_since,
        m.id AS member_id,
        m.name,
        m.username,
        m.profile_photo_url
      FROM circles c
      JOIN members m ON m.id = CASE
        WHEN c.user_a_id = $1 THEN c.user_b_id
        ELSE c.user_a_id
      END
      WHERE (c.user_a_id = $1 OR c.user_b_id = $2)
        ${searchClause}
      ORDER BY c.created_at DESC
      LIMIT $3 OFFSET $${offsetParam}
    `, params);

    return res.json({ members: result.rows });
  } catch (err) {
    console.error('[circleController.getCircleMembers]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /circles/:userId/status — Relationship status with a given user
// Returns: none | pending_outgoing | pending_incoming | in_circle
// ---------------------------------------------------------------------------
const getCircleStatus = async (req, res) => {
  try {
    const myId = req.user?.id;
    if (!myId) return res.status(401).json({ error: 'Authentication required' });

    const { userId } = req.params;
    if (myId === userId) return res.json({ status: 'self' });

    const [ua, ub] = sortedPair(myId, userId);

    // Check circle first (most common case after connection)
    const circleRes = await pool.query(
      `SELECT 1 FROM circles WHERE user_a_id = $1 AND user_b_id = $2`, [ua, ub]
    );
    if (circleRes.rows.length > 0) return res.json({ status: 'in_circle' });

    // Check pending requests
    const requestRes = await pool.query(`
      SELECT sender_id, receiver_id, id, status
      FROM circle_requests
      WHERE ((sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1))
        AND status = 'pending'
      LIMIT 1
    `, [myId, userId]);

    if (requestRes.rows.length > 0) {
      const req2 = requestRes.rows[0];
      const status = req2.sender_id === myId ? 'pending_outgoing' : 'pending_incoming';
      return res.json({ status, request_id: req2.id });
    }

    return res.json({ status: 'none' });
  } catch (err) {
    console.error('[circleController.getCircleStatus]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /circles/:userId — Remove a person from your circle (mutual removal)
// Also cleans up the accepted circle_requests row so re-requests work cleanly.
// ---------------------------------------------------------------------------
const removeFromCircle = async (req, res) => {
  try {
    const myId = req.user?.id;
    if (!myId) return res.status(401).json({ error: 'Authentication required' });

    const { userId } = req.params;
    if (myId === userId) return res.status(400).json({ error: 'Cannot remove yourself' });

    const [ua, ub] = sortedPair(myId, userId);

    // Delete the circle row (trigger will decrement circle_count for both)
    const deleteResult = await pool.query(
      `DELETE FROM circles WHERE user_a_id = $1 AND user_b_id = $2`, [ua, ub]
    );
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'You are not in a circle with this user' });
    }

    // Also delete the accepted circle_requests row(s) in either direction
    // so that getCircleStatus returns 'none' and re-requests are allowed.
    await pool.query(`
      DELETE FROM circle_requests
      WHERE ((sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1))
        AND status = 'accepted'
    `, [myId, userId]);

    return res.json({ success: true });
  } catch (err) {
    console.error('[circleController.removeFromCircle]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /circles/requests/count — Pending incoming request count (for badge)
// ---------------------------------------------------------------------------
const getIncomingRequestCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const result = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM circle_requests
      WHERE receiver_id = $1 AND status = 'pending'
    `, [userId]);

    return res.json({ count: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('[circleController.getIncomingRequestCount]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  sendCircleRequest,
  respondToCircleRequest,
  cancelCircleRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getCircleMembers,
  getCircleStatus,
  removeFromCircle,
  getIncomingRequestCount,
};
