/**
 * Board Post Controller
 *
 * Manages the public collab marketplace ("Board") where community and
 * creator (member) entities can post open collab spots and receive join-
 * requests from eligible applicants.
 *
 * Endpoints:
 *   POST /board-posts                  — create a board post
 *   GET  /board-posts                  — list/browse posts (auth optional)
 *   POST /board-posts/:id/join         — submit a join-request for a post
 *   POST /board-posts/:id/close        — poster manually closes a post
 *
 * Board join-requests are stored as collab_requests rows with
 *   source = 'board', board_post_id = <post id>
 * so the existing accept/decline flow in collabRequestController.js handles
 * the accept side, including the board fill-check and bulk-decline logic
 * that runs BEFORE COMMIT inside the same transaction.
 *
 * The bulkDeclineRemaining helper is exported from this module and imported
 * by collabRequestController.js for use inside acceptRequest.
 */

'use strict';

const { createPool } = require('../config/db');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');

const pool = createPool();

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES  = ['community', 'member'];
const VALID_COLLAB_TYPES  = [
  'event_partnership',
  'sponsorship',
  'cross_promo',
  'guest_collab',
  'custom',
];

const TITLE_MAX_LEN       = 80;
const DESC_MAX_LEN        = 500;
const NOTE_MAX_LEN        = 150;   // optional join note, not stored in a dedicated column
const PAGE_SIZE_DEFAULT   = 20;
const PAGE_SIZE_MAX       = 50;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve display info (name + avatar) for a community or member.
 * Mirrors the identical helper in collabRequestController.
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
  const r = await pool.query(
    `SELECT name, profile_photo_url AS avatar_url FROM members WHERE id = $1`,
    [entityId],
  );
  return r.rows[0]
    ? { name: r.rows[0].name, avatarUrl: r.rows[0].avatar_url }
    : { name: null, avatarUrl: null };
}

// ─── Exported helper: bulkDeclineRemaining ───────────────────────────────────

/**
 * Bulk-decline all pending join-requests for a board post.
 *
 * IMPORTANT: this function must be called with a PoolClient (`client`) so it
 * participates in the caller's transaction (either acceptRequest's accept
 * transaction, or closePost's close transaction).  It must NOT be called with
 * the module-level pool, because then it runs outside the transaction and the
 * two commits are no longer atomic.
 *
 * After the UPDATE, fires non-fatal notifications to each declined sender.
 *
 * @param {PoolClient} client       — transactional client from pg
 * @param {string|number} postId    — board_posts.id
 * @param {string|number|null} [excludeRequestId=null] — optional request ID to explicitly exclude from bulk decline
 * @returns {Promise<void>}
 */
async function bulkDeclineRemaining(client, postId, excludeRequestId = null) {
  const params = [postId];
  let excludeClause = '';
  if (excludeRequestId != null) {
    params.push(excludeRequestId);
    excludeClause = `AND id != $${params.length}`;
  }

  const declined = await client.query(
    `UPDATE collab_requests
        SET status         = 'declined',
            decline_reason = 'position_filled',
            responded_at   = NOW()
      WHERE board_post_id  = $1
        AND status         = 'pending'
        ${excludeClause}
     RETURNING sender_id, sender_type, id AS request_id`,
    params,
  );

  if (declined.rows.length === 0) return;

  // Resolve the poster's info once for all notifications (poster = the receiver
  // in join-request rows, who is doing the "auto-decline").
  // Fetch from board_posts; we need poster_id + poster_type.
  const postRow = await pool.query(
    `SELECT poster_id, poster_type FROM board_posts WHERE id = $1`,
    [postId],
  );
  const poster = postRow.rows[0];
  let posterInfo = { name: null, avatarUrl: null };
  if (poster) {
    posterInfo = await resolveEntityInfo(poster.poster_id, poster.poster_type);
  }

  // Fire notifications for each declined sender — non-fatal per-item
  for (const row of declined.rows) {
    try {
      await notificationService.createSimpleNotification(pool, {
        recipientId:   row.sender_id,
        recipientType: row.sender_type,
        actorId:       poster?.poster_id   ?? 0,
        actorType:     poster?.poster_type ?? 'community',
        type:          'collab_request_declined',
        payload: {
          requestId:      row.request_id,
          receiverName:   posterInfo.name,
          receiverAvatar: posterInfo.avatarUrl,
          declineReason:  'position_filled',
        },
      });
    } catch (notifErr) {
      console.error(
        `[BoardPosts] bulkDeclineRemaining: notification failed for sender ${row.sender_id} (non-fatal):`,
        notifErr.message,
      );
    }
  }
}

// ─── POST /board-posts ────────────────────────────────────────────────────────

/**
 * Create a new board post.
 *
 * Auth required. Only community accounts or creator-mode member accounts may
 * post.
 *
 * Body: { collab_type, title, description, spots_total }
 */
async function createPost(req, res) {
  try {
    const posterId   = req.user.id;
    const posterType = req.user.type;

    if (!VALID_ENTITY_TYPES.includes(posterType)) {
      return res.status(403).json({
        error: 'Only community and member (creator) accounts can create board posts',
      });
    }

    // Creator-mode gate for member posters
    if (posterType === 'member') {
      const row = await pool.query(
        `SELECT is_creator_mode_enabled FROM members WHERE id = $1`,
        [posterId],
      );
      if (!row.rows[0]?.is_creator_mode_enabled) {
        return res.status(403).json({
          error: 'Only creator-mode accounts can post to the board. Enable creator mode in your profile settings.',
        });
      }
    }

    const { collab_type, title, description, spots_total } = req.body;

    // ── Validate fields ───────────────────────────────────────────────────────
    if (!VALID_COLLAB_TYPES.includes(collab_type)) {
      return res.status(400).json({
        error: `collab_type must be one of: ${VALID_COLLAB_TYPES.join(', ')}`,
      });
    }
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (title.trim().length > TITLE_MAX_LEN) {
      return res.status(400).json({ error: `title must be ${TITLE_MAX_LEN} characters or fewer` });
    }
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'description is required' });
    }
    if (description.trim().length > DESC_MAX_LEN) {
      return res.status(400).json({ error: `description must be ${DESC_MAX_LEN} characters or fewer` });
    }
    const spotsNum = parseInt(spots_total, 10);
    if (!spots_total || isNaN(spotsNum) || spotsNum < 1 || !Number.isInteger(spotsNum)) {
      return res.status(400).json({ error: 'spots_total must be a positive integer (≥ 1)' });
    }

    const result = await pool.query(
      `INSERT INTO board_posts
         (poster_id, poster_type, collab_type, title, description, spots_total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [posterId, posterType, collab_type, title.trim(), description.trim(), spotsNum],
    );

    return res.status(201).json({ success: true, post: result.rows[0] });
  } catch (err) {
    console.error('[BoardPosts] createPost error:', err);
    return res.status(500).json({ error: 'Failed to create board post' });
  }
}

// ─── GET /board-posts ─────────────────────────────────────────────────────────

/**
 * Paginated board feed.
 *
 * Auth is optional. When a valid token is present (req.user populated by
 * an optional-auth wrapper in the route), `has_joined` is embedded per row.
 *
 * Query params: status?, collab_type?, page?, limit?
 */
async function listPosts(req, res) {
  try {
    const { status, collab_type } = req.query;
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = Math.min(parseInt(req.query.limit, 10) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const validStatuses = ['open', 'filled', 'closed', 'expired'];
    const resolvedStatus = validStatuses.includes(status) ? status : 'open';

    if (collab_type && !VALID_COLLAB_TYPES.includes(collab_type)) {
      return res.status(400).json({
        error: `collab_type must be one of: ${VALID_COLLAB_TYPES.join(', ')}`,
      });
    }

    // Caller identity for has_joined subquery (null when unauthenticated)
    const callerId   = req.user?.id   ?? null;
    const callerType = req.user?.type ?? null;

    // Fixed param layout:
    //   $1 = resolvedStatus
    //   $2 = callerId  (BIGINT | NULL)
    //   $3 = callerType (collab_entity_type | NULL — cast in SQL)
    //   $4 = limit
    //   $5 = offset
    // Optional collab_type filter appended as $6 when present.
    const baseParams = [resolvedStatus, callerId, callerType, limit, offset];
    let collabTypeClause = '';
    if (collab_type) {
      baseParams.push(collab_type);
      collabTypeClause = `AND p.collab_type = $6`;
    }

    const rows = await pool.query(
      `SELECT
         p.*,
         -- Poster identity
         CASE WHEN p.poster_type = 'community' THEN c.name     ELSE m.name              END AS poster_name,
         CASE WHEN p.poster_type = 'community' THEN c.logo_url ELSE m.profile_photo_url END AS poster_avatar_url,
         CASE WHEN p.poster_type = 'community' THEN c.username ELSE m.username           END AS poster_username,

         -- joined_status: the caller's join-request status for this post ('pending' | 'accepted' | 'declined' | 'withdrawn' | NULL)
         CASE
           WHEN $2::BIGINT IS NULL THEN NULL
           ELSE (
             SELECT cr.status FROM collab_requests cr
             WHERE cr.board_post_id = p.id
               AND cr.sender_id     = $2::BIGINT
               AND cr.sender_type   = $3::collab_entity_type
             ORDER BY cr.created_at DESC
             LIMIT 1
           )
         END AS joined_status,

         -- Poster reputation: response-time (avg hours, min 2 samples)
         (
           SELECT COUNT(*)
           FROM collab_requests rep
           WHERE rep.receiver_id = p.poster_id AND rep.receiver_type = p.poster_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_responses_counted,
         (
           SELECT AVG(EXTRACT(EPOCH FROM (rep.responded_at - rep.created_at)) / 3600)
           FROM collab_requests rep
           WHERE rep.receiver_id = p.poster_id AND rep.receiver_type = p.poster_type
             AND rep.responded_at IS NOT NULL
         ) AS cp_avg_response_hours_raw,

         -- Poster reputation: rating
         (
           SELECT COUNT(*)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = p.poster_id AND rat.ratee_type = p.poster_type
         ) AS cp_rating_count,
         (
           SELECT AVG(rat.stars)
           FROM collab_request_ratings rat
           WHERE rat.ratee_id = p.poster_id AND rat.ratee_type = p.poster_type
         ) AS cp_avg_rating_raw

       FROM board_posts p
       LEFT JOIN communities c ON p.poster_type = 'community' AND p.poster_id = c.id
       LEFT JOIN members     m ON p.poster_type = 'member'    AND p.poster_id = m.id
       WHERE p.status = $1
         ${collabTypeClause}
       ORDER BY p.created_at DESC
       LIMIT $4 OFFSET $5`,
      baseParams,
    );

    // Count query — only needs status + optional collab_type
    const countParams = [resolvedStatus];
    let countCollabTypeClause = '';
    if (collab_type) {
      countParams.push(collab_type);
      countCollabTypeClause = `AND collab_type = $2`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM board_posts
        WHERE status = $1 ${countCollabTypeClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const posts = rows.rows.map((row) => {
      const responsesCounted = parseInt(row.cp_responses_counted, 10) || 0;
      const ratingCount      = parseInt(row.cp_rating_count, 10) || 0;
      const avgResponseRaw   = row.cp_avg_response_hours_raw;
      const avgRatingRaw     = row.cp_avg_rating_raw;

      const poster = {
        id:                   row.poster_id,
        type:                 row.poster_type,
        display_name:         row.poster_name,
        avatar_url:           row.poster_avatar_url,
        username:             row.poster_username,
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

      const {
        cp_responses_counted, cp_avg_response_hours_raw,
        cp_rating_count, cp_avg_rating_raw,
        ...rest
      } = row;

      return { ...rest, poster };
    });

    return res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[BoardPosts] listPosts error:', err);
    return res.status(500).json({ error: 'Failed to fetch board posts' });
  }
}

// ─── POST /board-posts/:id/join ───────────────────────────────────────────────

/**
 * Submit a join-request for a board post.
 *
 * Auth required. The caller becomes the sender; the poster becomes the receiver
 * of a new collab_requests row with source='board'.
 *
 * Body: { note? }  — optional note (≤ 150 chars), stored as pitch_text.
 */
async function joinPost(req, res) {
  try {
    const senderId   = req.user.id;
    const senderType = req.user.type;

    if (!VALID_ENTITY_TYPES.includes(senderType)) {
      return res.status(403).json({
        error: 'Only community and member (creator) accounts can join board posts',
      });
    }

    // ── Creator-mode gate on the requester ────────────────────────────────────
    if (senderType === 'member') {
      const senderRow = await pool.query(
        `SELECT is_creator_mode_enabled FROM members WHERE id = $1`,
        [senderId],
      );
      if (!senderRow.rows[0]?.is_creator_mode_enabled) {
        return res.status(403).json({
          error: 'Only creator-mode accounts can join board posts. Enable creator mode in your profile settings.',
        });
      }
    }

    const { id: postId } = req.params;
    const { note } = req.body;

    // Validate optional note length
    if (note && note.trim().length > NOTE_MAX_LEN) {
      return res.status(400).json({
        error: `note must be ${NOTE_MAX_LEN} characters or fewer`,
      });
    }

    // ── Fetch and validate the post ───────────────────────────────────────────
    const postResult = await pool.query(
      `SELECT * FROM board_posts WHERE id = $1`,
      [postId],
    );
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board post not found' });
    }
    const post = postResult.rows[0];

    if (post.status !== 'open') {
      return res.status(409).json({
        error: `This post is no longer accepting applicants (status: ${post.status})`,
      });
    }
    if (post.spots_filled >= post.spots_total) {
      return res.status(409).json({ error: 'All spots for this post are filled' });
    }

    // ── Self-join guard ───────────────────────────────────────────────────────
    if (String(post.poster_id) === String(senderId) && post.poster_type === senderType) {
      return res.status(400).json({ error: 'Cannot join your own board post' });
    }

    // ── Creator-mode gate on the poster (member posters must still be creator-mode) ──
    if (post.poster_type === 'member') {
      const posterRow = await pool.query(
        `SELECT is_creator_mode_enabled FROM members WHERE id = $1`,
        [post.poster_id],
      );
      if (!posterRow.rows[0]?.is_creator_mode_enabled) {
        return res.status(422).json({
          error: 'The poster of this listing has disabled creator mode.',
        });
      }
    }

    // ── Insert collab_requests row ────────────────────────────────────────────
    // Duplicate is caught by the unique partial index uq_board_join_per_requester
    // and surfaces as a unique_violation (23505) which we map to 409.
    let joinRequest;
    try {
      const result = await pool.query(
        `INSERT INTO collab_requests
           (sender_id, sender_type, receiver_id, receiver_type,
            collab_type, pitch_text, source, board_post_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'board', $7)
         RETURNING *`,
        [
          senderId,
          senderType,
          post.poster_id,
          post.poster_type,
          post.collab_type,
          note ? note.trim() : null,
          post.id,
        ],
      );
      joinRequest = result.rows[0];
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        // Unique constraint violation — already applied
        return res.status(409).json({
          error: 'You have already applied to this board post',
        });
      }
      throw dbErr;
    }

    // ── Notify the poster (non-fatal) ─────────────────────────────────────────
    try {
      const senderInfo = await resolveEntityInfo(senderId, senderType);
      await notificationService.createSimpleNotification(pool, {
        recipientId:   post.poster_id,
        recipientType: post.poster_type,
        actorId:       senderId,
        actorType:     senderType,
        type:          'collab_request_received',
        payload: {
          requestId:    joinRequest.id,
          senderName:   senderInfo.name,
          senderAvatar: senderInfo.avatarUrl,
          collabType:   post.collab_type,
          pitchPreview: note ? note.trim().substring(0, 80) : null,
          boardPostId:  post.id,
          boardTitle:   post.title,
        },
      });

      await pushService.sendPushNotification(
        pool,
        post.poster_id,
        post.poster_type,
        'New Board Applicant 🤝',
        `${senderInfo.name || 'Someone'} applied to your board post "${post.title}"`,
        { type: 'collab_request_received', requestId: String(joinRequest.id), boardPostId: String(post.id) },
      );
    } catch (notifErr) {
      console.error('[BoardPosts] joinPost: notification failed (non-fatal):', notifErr.message);
    }

    return res.status(201).json({ success: true, request: joinRequest });
  } catch (err) {
    console.error('[BoardPosts] joinPost error:', err);
    return res.status(500).json({ error: 'Failed to join board post' });
  }
}

// ─── POST /board-posts/:id/close ─────────────────────────────────────────────

/**
 * Manually close a board post.
 *
 * Only the original poster may call this. Only open posts can be closed;
 * already filled/closed/expired posts return 409.
 *
 * Side effects (atomic — same transaction):
 *   1. All pending join-requests → status = 'declined', reason = 'position_filled'
 *   2. board_posts.status → 'closed', closed_at = NOW()
 */
async function closePost(req, res) {
  const client = await pool.connect();
  try {
    const userId   = req.user.id;
    const userType = req.user.type;
    const { id: postId } = req.params;

    await client.query('BEGIN');

    // Lock the post row to guard against concurrent closes
    const postResult = await client.query(
      `SELECT * FROM board_posts WHERE id = $1 FOR UPDATE`,
      [postId],
    );
    if (postResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Board post not found' });
    }
    const post = postResult.rows[0];

    // Only the poster may close
    if (String(post.poster_id) !== String(userId) || post.poster_type !== userType) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the poster can close this board post' });
    }

    if (post.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Post cannot be closed (current status: ${post.status})`,
      });
    }

    // Bulk-decline all pending join-requests (inside the same transaction)
    await bulkDeclineRemaining(client, post.id);

    // Flip the post to closed
    const updated = await client.query(
      `UPDATE board_posts
          SET status    = 'closed',
              closed_at = NOW()
        WHERE id = $1
       RETURNING *`,
      [post.id],
    );

    await client.query('COMMIT');

    return res.json({ success: true, post: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[BoardPosts] closePost error:', err);
    return res.status(500).json({ error: 'Failed to close board post' });
  } finally {
    client.release();
  }
}

// ─── GET /board-posts/mine ──────────────────────────────────────────────────────

/**
 * Returns the calling entity's own board posts (as poster), each annotated
 * with request counts grouped by status.
 *
 * Response shape per post:
 *   { id, title, collab_type, status, spots_total, spots_filled,
 *     pending_count, accepted_count, declined_count, created_at, expires_at }
 *
 * A single aggregation query handles counts across all the poster's posts
 * so the total DB round-trips is 2 (posts + counts), not N+1.
 */
async function myPosts(req, res) {
  try {
    const posterId   = req.user.id;
    const posterType = req.user.type;

    if (!VALID_ENTITY_TYPES.includes(posterType)) {
      return res.status(403).json({
        error: 'Only community and member (creator) accounts can access board posts',
      });
    }

    // Fetch all the poster's own posts, newest first
    const postsResult = await pool.query(
      `SELECT id, title, collab_type, status, spots_total, spots_filled,
              created_at, expires_at, closed_at
         FROM board_posts
        WHERE poster_id = $1 AND poster_type = $2
        ORDER BY created_at DESC`,
      [posterId, posterType],
    );

    if (postsResult.rows.length === 0) {
      return res.json({ posts: [] });
    }

    const postIds = postsResult.rows.map(p => p.id);

    // One aggregation query across all the poster's posts:
    // counts grouped by (board_post_id, status) for pending/accepted/declined.
    // board_post_id IS NOT NULL scoping means only board-sourced rows are counted.
    const countsResult = await pool.query(
      `SELECT board_post_id,
              status,
              COUNT(*) AS cnt
         FROM collab_requests
        WHERE board_post_id = ANY($1::BIGINT[])
          AND status IN ('pending', 'accepted', 'declined')
        GROUP BY board_post_id, status`,
      [postIds],
    );

    // Build a lookup: postId -> { pending_count, accepted_count, declined_count }
    const countsByPost = {};
    for (const row of countsResult.rows) {
      const pid = String(row.board_post_id);
      if (!countsByPost[pid]) {
        countsByPost[pid] = { pending_count: 0, accepted_count: 0, declined_count: 0 };
      }
      if (row.status === 'pending')  countsByPost[pid].pending_count  = parseInt(row.cnt, 10);
      if (row.status === 'accepted') countsByPost[pid].accepted_count = parseInt(row.cnt, 10);
      if (row.status === 'declined') countsByPost[pid].declined_count = parseInt(row.cnt, 10);
    }

    const posts = postsResult.rows.map(post => ({
      ...post,
      ...(countsByPost[String(post.id)] || { pending_count: 0, accepted_count: 0, declined_count: 0 }),
    }));

    return res.json({ posts });
  } catch (err) {
    console.error('[BoardPosts] myPosts error:', err);
    return res.status(500).json({ error: 'Failed to fetch your board posts' });
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createPost,
  listPosts,
  myPosts,
  joinPost,
  closePost,
  // Exported for use by collabRequestController.acceptRequest — must be called
  // with a PoolClient inside the accept transaction, BEFORE COMMIT.
  bulkDeclineRemaining,
};
