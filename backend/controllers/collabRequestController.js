/**
 * Collab Request Controller
 *
 * Handles structured collab-intent objects between Community and Creator
 * (member) entities. Sponsors are out of scope for v1.
 *
 * Key endpoints:
 *   POST   /collab-requests                      — create a request
 *   POST   /collab-requests/:id/accept            — receiver accepts → opens chat
 *   POST   /collab-requests/:id/decline           — receiver declines
 *   POST   /collab-requests/:id/withdraw          — sender withdraws (pending only)
 *   GET    /collab-requests/received              — paginated inbox for current entity
 *   GET    /collab-requests/sent                  — paginated outbox for current entity
 *   POST   /collab-requests/:id/rate              — sender rates after acceptance
 *   GET    /collab-entities/:type/:id/reputation  — computed reputation for profiles
 */

const { createPool } = require('../config/db');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

const pool = createPool();

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES = ['community', 'member'];

const VALID_COLLAB_TYPES = [
  'event_partnership',
  'sponsorship',
  'cross_promo',
  'guest_collab',
  'custom',
];

const VALID_DECLINE_REASONS = [
  'not_right_fit',
  'different_focus_area',
  'timing_doesnt_work',
];

const PITCH_MAX_LEN = 300;
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve display info (name + avatar) for a community or member.
 * Returns { name, avatarUrl }.
 */
async function resolveEntityInfo(entityId, entityType) {
  if (entityType === 'community') {
    const r = await pool.query(
      `SELECT name, logo_url AS avatar_url FROM communities WHERE id = $1`,
      [entityId],
    );
    return r.rows[0]
      ? { name: r.rows[0].name, avatarUrl: r.rows[0].avatar_url }
      : { name: null, avatarUrl: null };
  }
  // member (creator)
  const r = await pool.query(
    `SELECT name, profile_photo_url AS avatar_url FROM members WHERE id = $1`,
    [entityId],
  );
  return r.rows[0]
    ? { name: r.rows[0].name, avatarUrl: r.rows[0].avatar_url }
    : { name: null, avatarUrl: null };
}

/**
 * Verify an entity exists in the DB.
 * Returns true if found, false otherwise.
 */
async function entityExists(entityId, entityType) {
  const table = entityType === 'community' ? 'communities' : 'members';
  const r = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [entityId]);
  return r.rows.length > 0;
}

/**
 * Create or return an existing DM conversation between two participants.
 * Canonical ordering: lower numeric ID first; ties broken by type string.
 * Mirrors the pattern in messageController.getOrCreateConversation.
 */
async function getOrCreateConversation(p1Id, p1Type, p2Id, p2Type) {
  const id1 = Number(p1Id);
  const id2 = Number(p2Id);
  let aId, aType, bId, bType;
  if (id1 < id2 || (id1 === id2 && p1Type < p2Type)) {
    aId = p1Id; aType = p1Type;
    bId = p2Id; bType = p2Type;
  } else {
    aId = p2Id; aType = p2Type;
    bId = p1Id; bType = p1Type;
  }

  const insert = await pool.query(
    `INSERT INTO conversations (participant1_id, participant1_type, participant2_id, participant2_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (participant1_id, participant1_type, participant2_id, participant2_type)
     DO NOTHING RETURNING id`,
    [aId, aType, bId, bType],
  );
  if (insert.rows[0]) return insert.rows[0].id;

  const existing = await pool.query(
    `SELECT id FROM conversations
     WHERE participant1_id = $1 AND participant1_type = $2
       AND participant2_id = $3 AND participant2_type = $4`,
    [aId, aType, bId, bType],
  );
  return existing.rows[0].id;
}

// ─── POST /collab-requests ────────────────────────────────────────────────────

/**
 * Create a collab request.
 * Sender is the authenticated entity. Receiver is specified in the body.
 *
 * Body: { receiver_id, receiver_type, collab_type, pitch_text, attachment_url? }
 */
async function createRequest(req, res) {
  try {
    const senderId   = req.user.id;
    const senderType = req.user.type;

    // v1: only community and member entities may send requests
    if (!VALID_ENTITY_TYPES.includes(senderType)) {
      return res.status(403).json({
        error: 'Only community and member (creator) accounts can send collab requests',
      });
    }

    const { receiver_id, receiver_type, collab_type, pitch_text, attachment_url } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!receiver_id || !receiver_type) {
      return res.status(400).json({ error: 'receiver_id and receiver_type are required' });
    }
    if (!VALID_ENTITY_TYPES.includes(receiver_type)) {
      return res.status(400).json({
        error: `receiver_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
      });
    }
    if (!VALID_COLLAB_TYPES.includes(collab_type)) {
      return res.status(400).json({
        error: `collab_type must be one of: ${VALID_COLLAB_TYPES.join(', ')}`,
      });
    }
    if (!pitch_text || pitch_text.trim().length === 0) {
      return res.status(400).json({ error: 'pitch_text is required' });
    }
    if (pitch_text.trim().length > PITCH_MAX_LEN) {
      return res.status(400).json({
        error: `pitch_text must be ${PITCH_MAX_LEN} characters or fewer`,
      });
    }

    // ── Self-send guard ───────────────────────────────────────────────────────
    if (String(senderId) === String(receiver_id) && senderType === receiver_type) {
      return res.status(400).json({ error: 'Cannot send a collab request to yourself' });
    }

    // ── Creator-mode gate: sender ─────────────────────────────────────────────
    // auth middleware only populates { id, type, email } on req.user — the JWT
    // does not carry is_creator_mode_enabled, so we always need a DB lookup for
    // member senders. Community senders are always eligible; no lookup needed.
    if (senderType === 'member') {
      const senderRow = await pool.query(
        `SELECT is_creator_mode_enabled FROM members WHERE id = $1`,
        [senderId],
      );
      if (!senderRow.rows[0]?.is_creator_mode_enabled) {
        return res.status(403).json({
          error: 'Only creator-mode accounts can send collab requests. Enable creator mode in your profile settings.',
        });
      }
    }

    // ── Receiver exists + creator-mode gate ───────────────────────────────────
    // For member receivers: collapse existence check and creator-mode check into
    // one query. For community receivers: existence check only (always eligible).
    // NOTE: We intentionally do NOT re-validate receiver's creator-mode status in
    // accept/decline/withdraw — those are gated by ownership checks on the stored
    // request row, and retroactively invalidating pending requests when a user
    // later turns creator mode off is out of scope for v1.
    if (receiver_type === 'member') {
      const receiverRow = await pool.query(
        `SELECT id, is_creator_mode_enabled FROM members WHERE id = $1`,
        [receiver_id],
      );
      if (receiverRow.rows.length === 0) {
        return res.status(404).json({ error: 'Receiver not found' });
      }
      if (!receiverRow.rows[0].is_creator_mode_enabled) {
        return res.status(422).json({
          error: 'This member has not enabled creator mode and cannot receive collab requests.',
        });
      }
    } else {
      // receiver_type === 'community'
      const receiverOk = await entityExists(receiver_id, receiver_type);
      if (!receiverOk) {
        return res.status(404).json({ error: 'Receiver entity not found' });
      }
    }

    // ── Rate limit: max 10 pending requests sent per sender per day ───────────
    const dailyCount = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM collab_requests
       WHERE sender_id = $1 AND sender_type = $2
         AND status = 'pending'
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [senderId, senderType],
    );
    if (parseInt(dailyCount.rows[0].cnt, 10) >= 10) {
      return res.status(429).json({
        error: 'Daily request limit reached. You can send up to 10 pending requests per 24 hours.',
      });
    }

    // ── Duplicate guard: no two pending requests from same sender to same receiver ──
    const dupCheck = await pool.query(
      `SELECT id FROM collab_requests
       WHERE sender_id = $1 AND sender_type = $2
         AND receiver_id = $3 AND receiver_type = $4
         AND status = 'pending'
       LIMIT 1`,
      [senderId, senderType, receiver_id, receiver_type],
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'You already have a pending collab request to this entity',
        existing_request_id: dupCheck.rows[0].id,
      });
    }

    // ── Insert ────────────────────────────────────────────────────────────────
    const result = await pool.query(
      `INSERT INTO collab_requests
         (sender_id, sender_type, receiver_id, receiver_type, collab_type, pitch_text, attachment_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        senderId,
        senderType,
        receiver_id,
        receiver_type,
        collab_type,
        pitch_text.trim(),
        attachment_url || null,
      ],
    );
    const request = result.rows[0];

    // ── Notify receiver (non-fatal) ───────────────────────────────────────────
    try {
      const senderInfo = await resolveEntityInfo(senderId, senderType);
      await notificationService.createSimpleNotification(pool, {
        recipientId:   receiver_id,
        recipientType: receiver_type,
        actorId:       senderId,
        actorType:     senderType,
        type:          'collab_request_received',
        payload: {
          requestId:    request.id,
          senderName:   senderInfo.name,
          senderAvatar: senderInfo.avatarUrl,
          collabType:   collab_type,
          pitchPreview: pitch_text.trim().substring(0, 80),
        },
      });

      await pushService.sendPushNotification(
        pool,
        receiver_id,
        receiver_type,
        'New Collab Request 🤝',
        `${senderInfo.name || 'Someone'} sent you a collab request`,
        { type: 'collab_request_received', requestId: request.id },
      );
    } catch (notifErr) {
      console.error('[CollabRequests] createRequest: notification failed (non-fatal):', notifErr.message);
    }

    return res.status(201).json({ success: true, request });
  } catch (err) {
    console.error('[CollabRequests] createRequest error:', err);
    return res.status(500).json({ error: 'Failed to create collab request' });
  }
}

// ─── POST /collab-requests/:id/accept ────────────────────────────────────────

/**
 * Accept a request. Only the receiver may call this.
 * Side effects:
 *   1. Sets status = accepted, responded_at = now()
 *   2. Creates / retrieves a DM conversation between sender and receiver
 *   3. Seeds the conversation with the pitch_text as the opening context message
 *   4. Stores linked_chat_thread_id on the request row
 *   5. Notifies both parties
 */
async function acceptRequest(req, res) {
  const client = await pool.connect();
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock the request row
    const reqResult = await client.query(
      `SELECT * FROM collab_requests WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (reqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = reqResult.rows[0];

    // Only the receiver may accept
    if (String(request.receiver_id) !== String(userId) || request.receiver_type !== userType) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the receiver can accept this request' });
    }
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Request cannot be accepted (current status: ${request.status})`,
      });
    }

    // ── Create or retrieve the DM conversation ────────────────────────────────
    // Uses the canonical ordering helper — safe against race conditions.
    const convId = await getOrCreateConversation(
      request.sender_id,
      request.sender_type,
      request.receiver_id,
      request.receiver_type,
    );

    // ── Seed the conversation with the pitch as the opening message ───────────
    // Sender's pitch_text becomes the first visible message in the thread.
    const seedText = request.pitch_text;
    const seedMsg = await client.query(
      `INSERT INTO messages
         (conversation_id, sender_id, sender_type, message_text, message_type, metadata)
       VALUES ($1, $2, $3, $4, 'text', $5)
       RETURNING id, created_at`,
      [
        convId,
        request.sender_id,
        request.sender_type,
        seedText,
        JSON.stringify({
          source: 'collab_request',
          request_id: request.id,
          collab_type: request.collab_type,
        }),
      ],
    );
    await client.query(
      `UPDATE conversations SET last_message_at = $1 WHERE id = $2`,
      [seedMsg.rows[0].created_at, convId],
    );

    // ── Update the request row ────────────────────────────────────────────────
    const updated = await client.query(
      `UPDATE collab_requests
       SET status = 'accepted',
           responded_at = NOW(),
           linked_chat_thread_id = $2
       WHERE id = $1
       RETURNING *`,
      [id, convId],
    );

    await client.query('COMMIT');

    // ── Notify both parties (non-fatal) ──────────────────────────────────────
    try {
      const receiverInfo = await resolveEntityInfo(request.receiver_id, request.receiver_type);

      // Notify sender
      await notificationService.createSimpleNotification(pool, {
        recipientId:   request.sender_id,
        recipientType: request.sender_type,
        actorId:       request.receiver_id,
        actorType:     request.receiver_type,
        type:          'collab_request_accepted',
        payload: {
          requestId:      request.id,
          receiverName:   receiverInfo.name,
          receiverAvatar: receiverInfo.avatarUrl,
          collabType:     request.collab_type,
          chatThreadId:   convId,
        },
      });
      await pushService.sendPushNotification(
        pool,
        request.sender_id,
        request.sender_type,
        'Collab Request Accepted! 🎉',
        `${receiverInfo.name || 'Someone'} accepted your collab request`,
        { type: 'collab_request_accepted', requestId: request.id, chatId: String(convId) },
      );
    } catch (notifErr) {
      console.error('[CollabRequests] acceptRequest: notification failed (non-fatal):', notifErr.message);
    }

    return res.json({ success: true, request: updated.rows[0], chat_thread_id: convId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[CollabRequests] acceptRequest error:', err);
    return res.status(500).json({ error: 'Failed to accept collab request' });
  } finally {
    client.release();
  }
}

// ─── POST /collab-requests/:id/decline ───────────────────────────────────────

/**
 * Decline a request. Only the receiver may call this.
 * Body: { decline_reason? } — must be a valid decline_reason_type enum value.
 */
async function declineRequest(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id }   = req.params;
    const { decline_reason } = req.body;

    if (decline_reason && !VALID_DECLINE_REASONS.includes(decline_reason)) {
      return res.status(400).json({
        error: `decline_reason must be one of: ${VALID_DECLINE_REASONS.join(', ')}`,
      });
    }

    const reqResult = await pool.query(
      `SELECT * FROM collab_requests WHERE id = $1`,
      [id],
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = reqResult.rows[0];

    if (String(request.receiver_id) !== String(userId) || request.receiver_type !== userType) {
      return res.status(403).json({ error: 'Only the receiver can decline this request' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({
        error: `Request cannot be declined (current status: ${request.status})`,
      });
    }

    const updated = await pool.query(
      `UPDATE collab_requests
       SET status = 'declined',
           responded_at = NOW(),
           decline_reason = $2
       WHERE id = $1
       RETURNING *`,
      [id, decline_reason || null],
    );

    // Notify sender (non-fatal)
    try {
      const receiverInfo = await resolveEntityInfo(request.receiver_id, request.receiver_type);
      await notificationService.createSimpleNotification(pool, {
        recipientId:   request.sender_id,
        recipientType: request.sender_type,
        actorId:       request.receiver_id,
        actorType:     request.receiver_type,
        type:          'collab_request_declined',
        payload: {
          requestId:      request.id,
          receiverName:   receiverInfo.name,
          receiverAvatar: receiverInfo.avatarUrl,
          collabType:     request.collab_type,
          declineReason:  decline_reason || null,
        },
      });
    } catch (notifErr) {
      console.error('[CollabRequests] declineRequest: notification failed (non-fatal):', notifErr.message);
    }

    return res.json({ success: true, request: updated.rows[0] });
  } catch (err) {
    console.error('[CollabRequests] declineRequest error:', err);
    return res.status(500).json({ error: 'Failed to decline collab request' });
  }
}

// ─── POST /collab-requests/:id/withdraw ──────────────────────────────────────

/**
 * Withdraw a pending request. Only the sender may call this.
 * Only allowed while status = 'pending'. No chat is ever opened.
 */
async function withdrawRequest(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id }   = req.params;

    const reqResult = await pool.query(
      `SELECT * FROM collab_requests WHERE id = $1`,
      [id],
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = reqResult.rows[0];

    if (String(request.sender_id) !== String(userId) || request.sender_type !== userType) {
      return res.status(403).json({ error: 'Only the sender can withdraw this request' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({
        error: `Only pending requests can be withdrawn (current status: ${request.status})`,
      });
    }

    const updated = await pool.query(
      `UPDATE collab_requests
       SET status = 'withdrawn'
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return res.json({ success: true, request: updated.rows[0] });
  } catch (err) {
    console.error('[CollabRequests] withdrawRequest error:', err);
    return res.status(500).json({ error: 'Failed to withdraw collab request' });
  }
}

/**
 * Paginated inbox: requests where current entity is the receiver.
 * Each request embeds a `counterpart` object (the sender) with
 * reputation stats — eliminates N+1 /reputation calls on the list screen.
 * Query params: status?, page?, limit?
 */
async function getReceivedRequests(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;

    if (!VALID_ENTITY_TYPES.includes(userType)) {
      return res.status(403).json({ error: 'Only community and member accounts can access requests' });
    }

    const { status } = req.query;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const validStatuses = ['pending', 'accepted', 'declined', 'withdrawn', 'expired'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const params = [userId, userType];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `AND r.status = $${params.length}`;
    }
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT
         r.*,
         -- Sender (counterpart) identity columns
         CASE WHEN r.sender_type = 'community' THEN c_s.name    ELSE m_s.name   END AS sender_name,
         CASE WHEN r.sender_type = 'community' THEN c_s.logo_url ELSE m_s.profile_photo_url END AS sender_avatar_url,
         CASE WHEN r.sender_type = 'community' THEN c_s.username ELSE m_s.username END AS sender_username,
         CASE WHEN r.sender_type = 'member'    THEN m_s.is_creator_mode_enabled ELSE NULL END AS sender_is_creator,

         -- Counterpart reputation: response-time (avg hours, min 2 samples)
         (
           SELECT COUNT(*)
           FROM collab_requests rep
           WHERE rep.receiver_id = r.sender_id
             AND rep.receiver_type = r.sender_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_responses_counted,
         (
           SELECT AVG(EXTRACT(EPOCH FROM (rep.responded_at - rep.created_at)) / 3600)
           FROM collab_requests rep
           WHERE rep.receiver_id = r.sender_id
             AND rep.receiver_type = r.sender_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_avg_response_hours_raw,

         -- Counterpart reputation: rating
         (
           SELECT COUNT(*)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = r.sender_id AND rat.ratee_type = r.sender_type
         ) AS cp_rating_count,
         (
           SELECT AVG(rat.stars)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = r.sender_id AND rat.ratee_type = r.sender_type
         ) AS cp_avg_rating_raw

       FROM collab_requests r
       LEFT JOIN communities c_s ON r.sender_type = 'community' AND r.sender_id = c_s.id
       LEFT JOIN members     m_s ON r.sender_type = 'member'    AND r.sender_id = m_s.id
       WHERE r.receiver_id = $1 AND r.receiver_type = $2
         ${statusClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = [userId, userType];
    let countStatusClause = '';
    if (status) {
      countParams.push(status);
      countStatusClause = `AND status = $${countParams.length}`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM collab_requests
       WHERE receiver_id = $1 AND receiver_type = $2
         ${countStatusClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Shape each row: pull out counterpart reputation into a nested object.
    const requests = result.rows.map((row) => {
      const responsesCounted = parseInt(row.cp_responses_counted, 10) || 0;
      const ratingCount      = parseInt(row.cp_rating_count, 10) || 0;
      const avgResponseRaw   = row.cp_avg_response_hours_raw;
      const avgRatingRaw     = row.cp_avg_rating_raw;

      const counterpart = {
        id:                   row.sender_id,
        type:                 row.sender_type,
        is_creator_mode_enabled: row.sender_is_creator ?? null,
        display_name:         row.sender_name,
        avatar_url:           row.sender_avatar_url,
        username:             row.sender_username,
        reputation: {
          avg_response_hours: responsesCounted >= 2 && avgResponseRaw != null
            ? parseFloat(parseFloat(avgResponseRaw).toFixed(1))
            : null,
          responses_counted:  responsesCounted,
          avg_rating:         ratingCount > 0 && avgRatingRaw != null
            ? parseFloat(parseFloat(avgRatingRaw).toFixed(2))
            : null,
          rating_count:       ratingCount,
        },
      };

      // Strip the raw counterpart columns from the top-level row
      const {
        cp_responses_counted, cp_avg_response_hours_raw,
        cp_rating_count, cp_avg_rating_raw,
        sender_name, sender_avatar_url, sender_username, sender_is_creator,
        ...rest
      } = row;

      return { ...rest, counterpart };
    });

    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[CollabRequests] getReceivedRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch received requests' });
  }
}


// ─── GET /collab-requests/sent ────────────────────────────────────────────────

/**
 * Paginated outbox: requests where current entity is the sender.
 * Each request embeds a `counterpart` object (the receiver) with
 * reputation stats — eliminates N+1 /reputation calls on the list screen.
 * Query params: status?, page?, limit?
 */
async function getSentRequests(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;

    if (!VALID_ENTITY_TYPES.includes(userType)) {
      return res.status(403).json({ error: 'Only community and member accounts can access requests' });
    }

    const { status } = req.query;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const validStatuses = ['pending', 'accepted', 'declined', 'withdrawn', 'expired'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const params = [userId, userType];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `AND r.status = $${params.length}`;
    }
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT
         r.*,
         -- Receiver (counterpart) identity columns
         CASE WHEN r.receiver_type = 'community' THEN c_r.name    ELSE m_r.name   END AS receiver_name,
         CASE WHEN r.receiver_type = 'community' THEN c_r.logo_url ELSE m_r.profile_photo_url END AS receiver_avatar_url,
         CASE WHEN r.receiver_type = 'community' THEN c_r.username ELSE m_r.username END AS receiver_username,
         CASE WHEN r.receiver_type = 'member'    THEN m_r.is_creator_mode_enabled ELSE NULL END AS receiver_is_creator,

         -- Counterpart reputation: response-time (avg hours, min 2 samples)
         (
           SELECT COUNT(*)
           FROM collab_requests rep
           WHERE rep.receiver_id = r.receiver_id
             AND rep.receiver_type = r.receiver_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_responses_counted,
         (
           SELECT AVG(EXTRACT(EPOCH FROM (rep.responded_at - rep.created_at)) / 3600)
           FROM collab_requests rep
           WHERE rep.receiver_id = r.receiver_id
             AND rep.receiver_type = r.receiver_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_avg_response_hours_raw,

         -- Counterpart reputation: rating
         (
           SELECT COUNT(*)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = r.receiver_id AND rat.ratee_type = r.receiver_type
         ) AS cp_rating_count,
         (
           SELECT AVG(rat.stars)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = r.receiver_id AND rat.ratee_type = r.receiver_type
         ) AS cp_avg_rating_raw

       FROM collab_requests r
       LEFT JOIN communities c_r ON r.receiver_type = 'community' AND r.receiver_id = c_r.id
       LEFT JOIN members     m_r ON r.receiver_type = 'member'    AND r.receiver_id = m_r.id
       WHERE r.sender_id = $1 AND r.sender_type = $2
         ${statusClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = [userId, userType];
    let countStatusClause = '';
    if (status) {
      countParams.push(status);
      countStatusClause = `AND status = $${countParams.length}`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM collab_requests
       WHERE sender_id = $1 AND sender_type = $2
         ${countStatusClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Shape each row: pull out counterpart reputation into a nested object.
    const requests = result.rows.map((row) => {
      const responsesCounted = parseInt(row.cp_responses_counted, 10) || 0;
      const ratingCount      = parseInt(row.cp_rating_count, 10) || 0;
      const avgResponseRaw   = row.cp_avg_response_hours_raw;
      const avgRatingRaw     = row.cp_avg_rating_raw;

      const counterpart = {
        id:                   row.receiver_id,
        type:                 row.receiver_type,
        is_creator_mode_enabled: row.receiver_is_creator ?? null,
        display_name:         row.receiver_name,
        avatar_url:           row.receiver_avatar_url,
        username:             row.receiver_username,
        reputation: {
          avg_response_hours: responsesCounted >= 2 && avgResponseRaw != null
            ? parseFloat(parseFloat(avgResponseRaw).toFixed(1))
            : null,
          responses_counted:  responsesCounted,
          avg_rating:         ratingCount > 0 && avgRatingRaw != null
            ? parseFloat(parseFloat(avgRatingRaw).toFixed(2))
            : null,
          rating_count:       ratingCount,
        },
      };

      // Strip the raw counterpart columns from the top-level row
      const {
        cp_responses_counted, cp_avg_response_hours_raw,
        cp_rating_count, cp_avg_rating_raw,
        receiver_name, receiver_avatar_url, receiver_username, receiver_is_creator,
        ...rest
      } = row;

      return { ...rest, counterpart };
    });

    return res.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[CollabRequests] getSentRequests error:', err);
    return res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
}


// ─── POST /collab-requests/:id/rate ──────────────────────────────────────────

/**
 * Rate a completed (accepted) request. Requester (sender) only. One rating per request.
 * Body: { stars } — integer 1–5.
 */
async function rateRequest(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id }   = req.params;
    const { stars } = req.body;

    if (!stars || !Number.isInteger(Number(stars)) || Number(stars) < 1 || Number(stars) > 5) {
      return res.status(400).json({ error: 'stars must be an integer between 1 and 5' });
    }

    const reqResult = await pool.query(
      `SELECT * FROM collab_requests WHERE id = $1`,
      [id],
    );
    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = reqResult.rows[0];

    // Only the original sender (requester) may rate
    if (String(request.sender_id) !== String(userId) || request.sender_type !== userType) {
      return res.status(403).json({ error: 'Only the original requester can rate this request' });
    }

    // Rating only allowed on accepted requests
    if (request.status !== 'accepted') {
      return res.status(409).json({
        error: `Ratings are only allowed for accepted requests (current status: ${request.status})`,
      });
    }

    // Check for existing rating (409 if already rated)
    const dupCheck = await pool.query(
      `SELECT id FROM collab_request_ratings WHERE request_id = $1`,
      [id],
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You have already rated this request' });
    }

    const result = await pool.query(
      `INSERT INTO collab_request_ratings
         (request_id, rater_id, rater_type, ratee_id, ratee_type, stars)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        userId,
        userType,
        request.receiver_id,
        request.receiver_type,
        Number(stars),
      ],
    );

    return res.status(201).json({ success: true, rating: result.rows[0] });
  } catch (err) {
    console.error('[CollabRequests] rateRequest error:', err);
    return res.status(500).json({ error: 'Failed to submit rating' });
  }
}

// ─── GET /collab-entities/:type/:id/reputation ───────────────────────────────

/**
 * Compute and return reputation for a given entity.
 *
 * Returns:
 *   {
 *     avg_response_hours: number | null,  — null if < 2 responded requests
 *     responses_counted:  number,
 *     avg_rating:         number | null,  — null if no ratings
 *     rating_count:       number
 *   }
 */
async function getReputation(req, res) {
  try {
    const { type, id } = req.params;

    if (!VALID_ENTITY_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
      });
    }

    // Verify entity exists
    const exists = await entityExists(id, type);
    if (!exists) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // ── Response time: avg hours to respond, min 2 data points ───────────────
    const responseResult = await pool.query(
      `SELECT
         COUNT(*) AS responses_counted,
         AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) / 3600) AS avg_response_hours
       FROM collab_requests
       WHERE receiver_id = $1
         AND receiver_type = $2
         AND responded_at IS NOT NULL`,
      [id, type],
    );
    const responsesCounted = parseInt(responseResult.rows[0].responses_counted, 10);
    const avgResponseRaw   = responseResult.rows[0].avg_response_hours;

    // Only surface the value once the receiver has ≥ 2 responded requests
    const avgResponseHours = responsesCounted >= 2
      ? (avgResponseRaw !== null ? parseFloat(parseFloat(avgResponseRaw).toFixed(1)) : null)
      : null;

    // ── Ratings: avg stars + count — no minimum threshold ────────────────────
    const ratingResult = await pool.query(
      `SELECT
         COUNT(*) AS rating_count,
         AVG(stars) AS avg_rating
       FROM collab_request_ratings
       WHERE ratee_id = $1 AND ratee_type = $2`,
      [id, type],
    );
    const ratingCount = parseInt(ratingResult.rows[0].rating_count, 10);
    const avgRatingRaw = ratingResult.rows[0].avg_rating;
    const avgRating    = ratingCount > 0
      ? parseFloat(parseFloat(avgRatingRaw).toFixed(2))
      : null;

    return res.json({
      avg_response_hours: avgResponseHours,
      responses_counted:  responsesCounted,
      avg_rating:         avgRating,
      rating_count:       ratingCount,
    });
  } catch (err) {
    console.error('[CollabRequests] getReputation error:', err);
    return res.status(500).json({ error: 'Failed to fetch reputation' });
  }
}

// ─── GET /collab-requests/:id ─────────────────────────────────────────────────

/**
 * Get a single request by ID. Only sender or receiver may view it.
 */
async function getRequestById(req, res) {
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id }   = req.params;

    const result = await pool.query(
      `SELECT
         r.*,
         -- sender info
         CASE WHEN r.sender_type = 'community' THEN c_s.name   ELSE m_s.name   END AS sender_name,
         CASE WHEN r.sender_type = 'community' THEN c_s.logo_url ELSE m_s.profile_photo_url END AS sender_avatar_url,
         CASE WHEN r.sender_type = 'community' THEN c_s.username ELSE m_s.username END AS sender_username,
         -- receiver info
         CASE WHEN r.receiver_type = 'community' THEN c_r.name   ELSE m_r.name   END AS receiver_name,
         CASE WHEN r.receiver_type = 'community' THEN c_r.logo_url ELSE m_r.profile_photo_url END AS receiver_avatar_url,
         CASE WHEN r.receiver_type = 'community' THEN c_r.username ELSE m_r.username END AS receiver_username
       FROM collab_requests r
       LEFT JOIN communities c_s ON r.sender_type   = 'community' AND r.sender_id   = c_s.id
       LEFT JOIN members     m_s ON r.sender_type   = 'member'    AND r.sender_id   = m_s.id
       LEFT JOIN communities c_r ON r.receiver_type = 'community' AND r.receiver_id = c_r.id
       LEFT JOIN members     m_r ON r.receiver_type = 'member'    AND r.receiver_id = m_r.id
       WHERE r.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const request = result.rows[0];

    // Access check: only sender or receiver
    const isSender   = String(request.sender_id)   === String(userId) && request.sender_type   === userType;
    const isReceiver = String(request.receiver_id)  === String(userId) && request.receiver_type === userType;
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Not authorized to view this request' });
    }

    return res.json({ request });
  } catch (err) {
    console.error('[CollabRequests] getRequestById error:', err);
    return res.status(500).json({ error: 'Failed to fetch request' });
  }
}

module.exports = {
  createRequest,
  acceptRequest,
  declineRequest,
  withdrawRequest,
  getReceivedRequests,
  getSentRequests,
  rateRequest,
  getReputation,
  getRequestById,
};
