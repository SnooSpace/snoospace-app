/**
 * Creator Follow Controller
 *
 * Handles the one-way content-interest follow relationship between
 * any member/community/page and a Creator Mode member.
 *
 * Routes:
 *   POST   /creators/:creatorId/follow         followCreator
 *   DELETE /creators/:creatorId/follow         unfollowCreator
 *   GET    /creators/:creatorId/followers      getCreatorFollowers
 *   GET    /creators/:creatorId/follow-status  getFollowStatus
 */

const {
  createCreatorFollowNotification,
} = require("../services/notificationService");

// ─── POST /creators/:creatorId/follow ────────────────────────────────────────

async function followCreator(req, res) {
  try {
    const pool = req.app.locals.pool;
    const followerId = req.user?.id;
    const followerType = req.user?.type || "member";
    const creatorId = req.params.creatorId;

    if (!followerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Self-follow guard
    if (String(followerId) === String(creatorId)) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    // Validate target is a Creator
    const creatorCheck = await pool.query(
      `SELECT id, is_creator_mode_enabled FROM members WHERE id = $1`,
      [creatorId]
    );
    if (creatorCheck.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    if (!creatorCheck.rows[0].is_creator_mode_enabled) {
      return res
        .status(403)
        .json({ error: "not_a_creator", message: "This member is not in Creator Mode." });
    }

    // Guard: Circle members already receive content — no need to follow
    if (followerType === "member") {
      const minId = Math.min(Number(followerId), Number(creatorId));
      const maxId = Math.max(Number(followerId), Number(creatorId));
      const circleCheck = await pool.query(
        `SELECT 1 FROM circles WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`,
        [minId, maxId]
      );
      if (circleCheck.rows.length > 0) {
        return res.status(400).json({
          error: "already_in_circle",
          message: "Circle members already receive this creator's content.",
        });
      }
    }

    // Upsert: INSERT or un-dormant existing row
    await pool.query(
      `INSERT INTO creator_follows (follower_id, follower_type, creator_id, is_dormant, created_at)
       VALUES ($1, $2, $3, false, now())
       ON CONFLICT (follower_id, creator_id)
       DO UPDATE SET is_dormant = false, created_at = now()`,
      [followerId, followerType, creatorId]
    );

    // Fetch updated follower count
    const countResult = await pool.query(
      `SELECT creator_follower_count FROM members WHERE id = $1`,
      [creatorId]
    );
    const followerCount = parseInt(
      countResult.rows[0]?.creator_follower_count || 0,
      10
    );

    // Fire notification — non-fatal
    try {
      await createCreatorFollowNotification(pool, {
        creatorId,
        followerId,
        followerType,
      });
    } catch (notifErr) {
      console.warn(
        "[CreatorFollowController] Notification failed (non-fatal):",
        notifErr?.message
      );
    }

    return res.json({ followed: true, follower_count: followerCount });
  } catch (err) {
    console.error("[CreatorFollowController] followCreator error:", err.message);
    return res.status(500).json({ error: "Failed to follow creator" });
  }
}

// ─── DELETE /creators/:creatorId/follow ──────────────────────────────────────

async function unfollowCreator(req, res) {
  try {
    const pool = req.app.locals.pool;
    const followerId = req.user?.id;
    const creatorId = req.params.creatorId;

    if (!followerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Permanent delete — unfollow is a real removal, not dormancy
    await pool.query(
      `DELETE FROM creator_follows WHERE follower_id = $1 AND creator_id = $2`,
      [followerId, creatorId]
    );

    // Fetch updated follower count
    const countResult = await pool.query(
      `SELECT creator_follower_count FROM members WHERE id = $1`,
      [creatorId]
    );
    const followerCount = parseInt(
      countResult.rows[0]?.creator_follower_count || 0,
      10
    );

    return res.json({ followed: false, follower_count: followerCount });
  } catch (err) {
    console.error("[CreatorFollowController] unfollowCreator error:", err.message);
    return res.status(500).json({ error: "Failed to unfollow creator" });
  }
}

// ─── GET /creators/:creatorId/followers ──────────────────────────────────────

async function getCreatorFollowers(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { id: authUserId } = req.user || {};
    const creatorId = req.params.creatorId;

    if (!authUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const type = req.query.type || "all"; // 'all' | 'notable'
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    let whereClause = `cf.creator_id = $1 AND cf.is_dormant = false`;
    if (type === "notable") {
      whereClause += ` AND cf.follower_type IN ('community', 'page')`;
    }

    const params = [creatorId, limit, offset];
    if (search) {
      whereClause += ` AND (m.name ILIKE $4 OR m.username ILIKE $4 OR c.name ILIKE $4)`;
      params.push(`%${search}%`);
    }

    let countWhereClause = `cf.creator_id = $1 AND cf.is_dormant = false`;
    if (type === "notable") {
      countWhereClause += ` AND cf.follower_type IN ('community', 'page')`;
    }

    const countParams = [creatorId];
    if (search) {
      countWhereClause += ` AND (m.name ILIKE $2 OR m.username ILIKE $2 OR c.name ILIKE $2)`;
      countParams.push(`%${search}%`);
    }

    // Order: notable followers first, then members by most recent
    const orderClause =
      type === "notable"
        ? `cf.created_at DESC`
        : `(cf.follower_type != 'member') DESC, cf.created_at DESC`;

    // Join members for member-type followers, communities for community-type followers
    // We use a union-style query via CASE to get the right name/avatar
    const query = `
      SELECT
        cf.follower_id,
        cf.follower_type,
        cf.created_at,
        CASE
          WHEN cf.follower_type = 'member'
            THEN m.name
          WHEN cf.follower_type = 'community'
            THEN c.name
          ELSE NULL
        END AS name,
        CASE
          WHEN cf.follower_type = 'member'
            THEN m.username
          ELSE NULL
        END AS username,
        CASE
          WHEN cf.follower_type = 'member'
            THEN m.profile_photo_url
          WHEN cf.follower_type = 'community'
            THEN c.logo_url
          ELSE NULL
        END AS avatar_url
      FROM creator_follows cf
      LEFT JOIN members m
        ON m.id = cf.follower_id AND cf.follower_type = 'member'
      LEFT JOIN communities c
        ON c.id = cf.follower_id AND cf.follower_type = 'community'
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM creator_follows cf
      LEFT JOIN members m
        ON m.id = cf.follower_id AND cf.follower_type = 'member'
      LEFT JOIN communities c
        ON c.id = cf.follower_id AND cf.follower_type = 'community'
      WHERE ${countWhereClause}
    `;


    const [followersResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    const followers = followersResult.rows.map((row) => ({
      id: row.follower_id,
      follower_type: row.follower_type,
      name: row.name || "Unknown",
      username: row.username || null,
      avatar_url: row.avatar_url || null,
      created_at: row.created_at,
      is_notable: row.follower_type !== "member",
    }));

    return res.json({
      followers,
      total,
      page,
      limit,
      hasMore: offset + followers.length < total,
    });
  } catch (err) {
    console.error("[CreatorFollowController] getCreatorFollowers error:", err.message);
    return res.status(500).json({ error: "Failed to get creator followers" });
  }
}

// ─── GET /creators/:creatorId/follow-status ──────────────────────────────────

async function getFollowStatus(req, res) {
  try {
    const pool = req.app.locals.pool;
    const followerId = req.user?.id;
    const creatorId = req.params.creatorId;

    if (!followerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const [followResult, circleResult] = await Promise.all([
      pool.query(
        `SELECT 1 FROM creator_follows
         WHERE follower_id = $1 AND creator_id = $2 AND is_dormant = false
         LIMIT 1`,
        [followerId, creatorId]
      ),
      pool.query(
        `SELECT 1 FROM circles
         WHERE user_a_id = $1 AND user_b_id = $2
         LIMIT 1`,
        [
          Math.min(Number(followerId), Number(creatorId)),
          Math.max(Number(followerId), Number(creatorId)),
        ]
      ),
    ]);

    return res.json({
      is_following: followResult.rows.length > 0,
      is_in_circle: circleResult.rows.length > 0,
    });
  } catch (err) {
    console.error("[CreatorFollowController] getFollowStatus error:", err.message);
    return res.status(500).json({ error: "Failed to get follow status" });
  }
}

module.exports = {
  followCreator,
  unfollowCreator,
  getCreatorFollowers,
  getFollowStatus,
};
