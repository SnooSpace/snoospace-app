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

    // ── Source A: creator_follows (members who used the creator-follow flow) ──
    let cfWhere = `cf.creator_id = $1 AND cf.is_dormant = false AND cf.is_superseded_by_circle = false`;
    if (type === "notable") cfWhere += ` AND cf.follower_type IN ('community', 'page')`;

    // ── Source B: follows table (communities/sponsors/venues via POST /follow) ──
    // Exclude member-type since members use creator_follows, not this path.
    let fWhere = `f.following_id = $1 AND f.following_type = 'member' AND f.follower_type != 'member' AND f.is_superseded_by_circle = false`;
    if (type === "notable") fWhere += ` AND f.follower_type IN ('community', 'page', 'sponsor', 'venue')`;

    const searchParam = search ? `%${search}%` : null;
    const searchClauseA = search ? ` AND (m.name ILIKE $2 OR m.username ILIKE $2 OR cm.name ILIKE $2)` : "";
    const searchClauseB = search ? ` AND (cm2.name ILIKE $2 OR sp.brand_name ILIKE $2 OR v.name ILIKE $2)` : "";

    const baseParams = searchParam ? [creatorId, searchParam] : [creatorId];

    const unionQuery = `
      WITH combined AS (
        -- Branch A: creator_follows rows (members + legacy community rows)
        SELECT
          cf.follower_id,
          cf.follower_type,
          cf.created_at,
          CASE
            WHEN cf.follower_type = 'member'    THEN m.name
            WHEN cf.follower_type = 'community' THEN cm.name
            ELSE NULL
          END AS name,
          CASE
            WHEN cf.follower_type = 'member'    THEN m.username
            WHEN cf.follower_type = 'community' THEN cm.username
            ELSE NULL
          END AS username,
          CASE
            WHEN cf.follower_type = 'member'    THEN m.profile_photo_url
            WHEN cf.follower_type = 'community' THEN cm.logo_url
            ELSE NULL
          END AS avatar_url,
          CASE
            WHEN cf.follower_type = 'member' THEN m.is_creator_mode_enabled
            ELSE false
          END AS is_creator,
          -- Annotate whether a community follower is in the creator's circle.
          -- community_member_circles tracks Community→Creator circle relationships.
          CASE
            WHEN cf.follower_type = 'community' AND cmc_a.community_id IS NOT NULL THEN true
            ELSE false
          END AS in_circle
        FROM creator_follows cf
        LEFT JOIN members      m    ON m.id  = cf.follower_id AND cf.follower_type = 'member'
        LEFT JOIN communities  cm   ON cm.id = cf.follower_id AND cf.follower_type = 'community'
        LEFT JOIN community_member_circles cmc_a
          ON cf.follower_type = 'community'
          AND cmc_a.community_id = cf.follower_id
          AND cmc_a.member_id = $1
        WHERE ${cfWhere}${searchClauseA}

        UNION ALL

        -- Branch B: general follows rows (community/sponsor/venue via POST /follow)
        SELECT
          f.follower_id,
          f.follower_type,
          f.created_at,
          CASE
            WHEN f.follower_type = 'community' THEN cm2.name
            WHEN f.follower_type = 'sponsor'   THEN sp.brand_name
            WHEN f.follower_type = 'venue'     THEN v.name
            ELSE NULL
          END AS name,
          CASE
            WHEN f.follower_type = 'community' THEN cm2.username
            WHEN f.follower_type = 'sponsor'   THEN sp.username
            ELSE NULL
          END AS username,
          CASE
            WHEN f.follower_type = 'community' THEN cm2.logo_url
            WHEN f.follower_type = 'sponsor'   THEN sp.logo_url
            WHEN f.follower_type = 'venue'     THEN v.logo_url
            ELSE NULL
          END AS avatar_url,
          false AS is_creator,
          CASE
            WHEN f.follower_type = 'community' AND cmc_b.community_id IS NOT NULL THEN true
            ELSE false
          END AS in_circle
        FROM follows f
        LEFT JOIN communities  cm2 ON cm2.id = f.follower_id AND f.follower_type = 'community'
        LEFT JOIN sponsors     sp   ON sp.id  = f.follower_id AND f.follower_type = 'sponsor'
        LEFT JOIN venues       v    ON v.id   = f.follower_id AND f.follower_type = 'venue'
        LEFT JOIN community_member_circles cmc_b
          ON f.follower_type = 'community'
          AND cmc_b.community_id = f.follower_id
          AND cmc_b.member_id = $1
        WHERE ${fWhere}${searchClauseB}
      )
      SELECT * FROM combined
      ORDER BY (follower_type != 'member') DESC, created_at DESC
      LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
    `;

    const countQuery = `
      SELECT (
        SELECT COUNT(*) FROM creator_follows cf
        LEFT JOIN members      m  ON m.id  = cf.follower_id AND cf.follower_type = 'member'
        LEFT JOIN communities cm  ON cm.id = cf.follower_id AND cf.follower_type = 'community'
        WHERE ${cfWhere}${searchClauseA}
      ) + (
        SELECT COUNT(*) FROM follows f
        LEFT JOIN communities cm2 ON cm2.id = f.follower_id AND f.follower_type = 'community'
        LEFT JOIN sponsors    sp   ON sp.id  = f.follower_id AND f.follower_type = 'sponsor'
        LEFT JOIN venues      v    ON v.id   = f.follower_id AND f.follower_type = 'venue'
        WHERE ${fWhere}${searchClauseB}
      ) AS total
    `;

    const queryParams = [...baseParams, limit, offset];

    const [followersResult, countResult] = await Promise.all([
      pool.query(unionQuery, queryParams),
      pool.query(countQuery, baseParams),
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
      is_creator: !!row.is_creator,
      in_circle: !!row.in_circle,
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
         WHERE follower_id = $1 AND creator_id = $2 AND is_dormant = false AND is_superseded_by_circle = false
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

// ─── DELETE /creators/me/followers/:followerId ────────────────────────────────
// Creator removes a specific follower (permanent row deletion, follower can re-follow).

async function removeFollower(req, res) {
  try {
    const pool = req.app.locals.pool;
    const creatorId = req.user?.id;
    const { followerId } = req.params;

    if (!creatorId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only the creator themselves can remove followers from their own list
    const creatorCheck = await pool.query(
      `SELECT is_creator_mode_enabled FROM members WHERE id = $1`,
      [creatorId]
    );
    if (!creatorCheck.rows[0]?.is_creator_mode_enabled) {
      return res.status(403).json({ error: "Creator Mode required" });
    }

    // Permanent delete of the follow row
    await pool.query(
      `DELETE FROM creator_follows WHERE follower_id = $1 AND creator_id = $2`,
      [followerId, creatorId]
    );

    // Return live follower count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM creator_follows
       WHERE creator_id = $1 AND is_dormant = false AND is_superseded_by_circle = false`,
      [creatorId]
    );
    const followerCount = parseInt(countResult.rows[0]?.count || 0, 10);

    return res.json({ success: true, follower_count: followerCount });
  } catch (err) {
    console.error("[CreatorFollowController] removeFollower error:", err.message);
    return res.status(500).json({ error: "Failed to remove follower" });
  }
}

module.exports = {
  followCreator,
  unfollowCreator,
  removeFollower,
  getCreatorFollowers,
  getFollowStatus,
};
