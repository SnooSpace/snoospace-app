const { createPool } = require("../config/db");
const {
  createFollowNotification,
  deactivateFollowNotification,
} = require("../services/notificationService");
const pushService = require("../services/pushService");

const pool = createPool();

// Follow a user/community/sponsor/venue
const follow = async (req, res) => {
  try {
    const { followingId, followingType } = req.body;
    const followerId = req.user?.id;
    const followerType = req.user?.type;

    if (!followerId || !followerType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!followingId || !followingType) {
      return res
        .status(400)
        .json({ error: "Following ID and type are required" });
    }

    // Validate following type
    const validTypes = ["member", "community", "sponsor", "venue"];
    if (!validTypes.includes(followingType)) {
      return res.status(400).json({ error: "Invalid following type" });
    }

    // Check if trying to follow self
    if (followerId === followingId && followerType === followingType) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    // Check if already following
    const existingFollow = await pool.query(
      "SELECT id FROM follows WHERE follower_id = $1 AND follower_type = $2 AND following_id = $3 AND following_type = $4",
      [followerId, followerType, followingId, followingType]
    );

    if (existingFollow.rows.length > 0) {
      return res.status(400).json({ error: "Already following this entity" });
    }

    // Block guard: members cannot follow each other if a block exists in either direction
    if (followerType === 'member' && followingType === 'member') {
      const blockCheck = await pool.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [followerId, followingId]
      );
      if (blockCheck.rows.length > 0) {
        return res.status(403).json({ error: 'user_blocked', message: "You can't follow this user." });
      }
    }

    // Add follow
    await pool.query(
      "INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, $2, $3, $4)",
      [followerId, followerType, followingId, followingType]
    );

    // Create follow notification for the recipient (the one being followed)
    try {
      // Try to fetch minimal actor profile for payload (best-effort)
      let actorName = null;
      let actorUsername = null;
      let actorAvatar = null;

      if (followerType === "member") {
        const r = await pool.query(
          "SELECT name, username, profile_photo_url FROM members WHERE id = $1",
          [followerId]
        );
        if (r.rows[0]) {
          actorName = r.rows[0].name || null;
          actorUsername = r.rows[0].username || null;
          actorAvatar = r.rows[0].profile_photo_url || null;
        }
      } else if (followerType === "community") {
        const r = await pool.query(
          "SELECT name, username, logo_url FROM communities WHERE id = $1",
          [followerId]
        );
        if (r.rows[0]) {
          actorName = r.rows[0].name || null;
          actorUsername = r.rows[0].username || null;
          actorAvatar = r.rows[0].logo_url || null;
        }
      } else if (followerType === "sponsor") {
        const r = await pool.query(
          "SELECT brand_name as name, username, logo_url FROM sponsors WHERE id = $1",
          [followerId]
        );
        if (r.rows[0]) {
          actorName = r.rows[0].name || null;
          actorUsername = r.rows[0].username || null;
          actorAvatar = r.rows[0].logo_url || null;
        }
      } else if (followerType === "venue") {
        const r = await pool.query(
          "SELECT name, username FROM venues WHERE id = $1",
          [followerId]
        );
        if (r.rows[0]) {
          actorName = r.rows[0].name || null;
          actorUsername = r.rows[0].username || null;
          actorAvatar = null; // venues don't have avatars
        }
      }
      // Use notification service with UPSERT to prevent duplicates
      await createFollowNotification(pool, {
        recipientId: followingId,
        recipientType: followingType,
        actorId: followerId,
        actorType: followerType,
        payload: { actorName, actorUsername, actorAvatar },
      });

      // Send push notification
      await pushService.sendPushNotification(
        pool,
        followingId,
        followingType,
        "New Follower 👤",
        `${actorName || "Someone"} started following you`,
        {
          type: "follow",
          actorId: followerId,
          actorType: followerType,
        }
      );
    } catch (e) {
      // Non-fatal: do not block follow if notification fails
      console.error("Failed to create follow notification", e);
    }

    res.json({ success: true, message: "Successfully followed" });
  } catch (error) {
    console.error("Error following:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unfollow a user/community/sponsor/venue
const unfollow = async (req, res) => {
  try {
    const { followingId, followingType } = req.body;
    const followerId = req.user?.id;
    const followerType = req.user?.type;

    if (!followerId || !followerType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!followingId || !followingType) {
      return res
        .status(400)
        .json({ error: "Following ID and type are required" });
    }

    // Remove follow
    const result = await pool.query(
      "DELETE FROM follows WHERE follower_id = $1 AND follower_type = $2 AND following_id = $3 AND following_type = $4",
      [followerId, followerType, followingId, followingType]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "Not following this entity" });
    }

    // Deactivate the follow notification (soft delete)
    try {
      await deactivateFollowNotification(pool, {
        recipientId: followingId,
        recipientType: followingType,
        actorId: followerId,
        actorType: followerType,
      });
    } catch (e) {
      // Non-fatal: do not block unfollow if notification deactivation fails
      console.error("Failed to deactivate follow notification", e);
    }

    res.json({ success: true, message: "Successfully unfollowed" });
  } catch (error) {
    console.error("Error unfollowing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get followers list
const getFollowers = async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const { page = 1, limit = 20, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const searchClause = search ? `
      AND (
        (f.follower_type = 'member' AND (m.name ILIKE $5 OR m.username ILIKE $5)) OR
        (f.follower_type = 'community' AND (c.name ILIKE $5 OR c.username ILIKE $5)) OR
        (f.follower_type = 'sponsor' AND (s.brand_name ILIKE $5 OR s.username ILIKE $5)) OR
        (f.follower_type = 'venue' AND (v.name ILIKE $5 OR v.username ILIKE $5))
      )
    ` : '';

    const params = [userId, userType, limit, offset];
    if (search) params.push(`%${search}%`);

    const query = `
      SELECT 
        f.*,
        CASE 
          WHEN f.follower_type = 'member' THEN m.name
          WHEN f.follower_type = 'community' THEN c.name
          WHEN f.follower_type = 'sponsor' THEN s.brand_name
          WHEN f.follower_type = 'venue' THEN v.name
        END as follower_name,
        CASE 
          WHEN f.follower_type = 'member' THEN m.username
          WHEN f.follower_type = 'community' THEN c.username
          WHEN f.follower_type = 'sponsor' THEN s.username
          WHEN f.follower_type = 'venue' THEN v.username
        END as follower_username,
        CASE 
          WHEN f.follower_type = 'member' THEN m.profile_photo_url
          WHEN f.follower_type = 'community' THEN c.logo_url
          WHEN f.follower_type = 'sponsor' THEN s.logo_url
          WHEN f.follower_type = 'venue' THEN NULL
        END as follower_photo_url
      FROM follows f
      LEFT JOIN members m ON f.follower_type = 'member' AND f.follower_id = m.id
      LEFT JOIN communities c ON f.follower_type = 'community' AND f.follower_id = c.id
      LEFT JOIN sponsors s ON f.follower_type = 'sponsor' AND f.follower_id = s.id
      LEFT JOIN venues v ON f.follower_type = 'venue' AND f.follower_id = v.id
      WHERE f.following_id = $1 AND f.following_type = $2
        ${searchClause}
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, params);
    res.json({ followers: result.rows });
  } catch (error) {
    console.error("Error getting followers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get following list
const getFollowing = async (req, res) => {
  try {
    const { userId, userType } = req.params;
    const { page = 1, limit = 20, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const searchClause = search ? `
      AND (
        (f.following_type = 'member' AND (m.name ILIKE $5 OR m.username ILIKE $5)) OR
        (f.following_type = 'community' AND (c.name ILIKE $5 OR c.username ILIKE $5)) OR
        (f.following_type = 'sponsor' AND (s.brand_name ILIKE $5 OR s.username ILIKE $5)) OR
        (f.following_type = 'venue' AND (v.name ILIKE $5 OR v.username ILIKE $5))
      )
    ` : '';

    const params = [userId, userType, limit, offset];
    if (search) params.push(`%${search}%`);

    const query = `
      SELECT 
        f.*,
        CASE 
          WHEN f.following_type = 'member' THEN m.name
          WHEN f.following_type = 'community' THEN c.name
          WHEN f.following_type = 'sponsor' THEN s.brand_name
          WHEN f.following_type = 'venue' THEN v.name
        END as following_name,
        CASE 
          WHEN f.following_type = 'member' THEN m.username
          WHEN f.following_type = 'community' THEN c.username
          WHEN f.following_type = 'sponsor' THEN s.username
          WHEN f.following_type = 'venue' THEN v.username
        END as following_username,
        CASE 
          WHEN f.following_type = 'member' THEN m.profile_photo_url
          WHEN f.following_type = 'community' THEN c.logo_url
          WHEN f.following_type = 'sponsor' THEN s.logo_url
          WHEN f.following_type = 'venue' THEN NULL
        END as following_photo_url
      FROM follows f
      LEFT JOIN members m ON f.following_type = 'member' AND f.following_id = m.id
      LEFT JOIN communities c ON f.following_type = 'community' AND f.following_id = c.id
      LEFT JOIN sponsors s ON f.following_type = 'sponsor' AND f.following_id = s.id
      LEFT JOIN venues v ON f.following_type = 'venue' AND f.following_id = v.id
      WHERE f.follower_id = $1 AND f.follower_type = $2
        ${searchClause}
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, params);
    res.json({ following: result.rows });
  } catch (error) {
    console.error("Error getting following:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Check follow status
const getFollowStatus = async (req, res) => {
  try {
    const { followingId, followingType } = req.query;
    const followerId = req.user?.id;
    const followerType = req.user?.type;

    if (!followerId || !followerType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!followingId || !followingType) {
      return res
        .status(400)
        .json({ error: "Following ID and type are required" });
    }

    const result = await pool.query(
      "SELECT id FROM follows WHERE follower_id = $1 AND follower_type = $2 AND following_id = $3 AND following_type = $4",
      [followerId, followerType, followingId, followingType]
    );

    res.json({ isFollowing: result.rows.length > 0 });
  } catch (error) {
    console.error("Error checking follow status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get follower/following counts
// Reads denormalized columns for member/community (O(1)).
// Falls back to COUNT(*) for sponsor/venue.
const getFollowCounts = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    let followers_count, following_count;

    if (userType === 'member') {
      const r = await pool.query(
        `SELECT follower_count, following_count FROM members WHERE id = $1`,
        [userId]
      );
      followers_count = parseInt(r.rows[0]?.follower_count ?? 0, 10);
      following_count = parseInt(r.rows[0]?.following_count ?? 0, 10);
    } else if (userType === 'community') {
      const r = await pool.query(
        `SELECT follower_count, following_count FROM communities WHERE id = $1`,
        [userId]
      );
      followers_count = parseInt(r.rows[0]?.follower_count ?? 0, 10);
      following_count = parseInt(r.rows[0]?.following_count ?? 0, 10);
    } else {
      // sponsor / venue: still live COUNT(*)
      const [followersResult, followingResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as count FROM follows WHERE following_id = $1 AND following_type = $2`,
          [userId, userType]
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1 AND follower_type = $2`,
          [userId, userType]
        ),
      ]);
      followers_count = parseInt(followersResult.rows[0].count, 10);
      following_count = parseInt(followingResult.rows[0].count, 10);
    }

    res.json({ followers_count, following_count });
  } catch (error) {
    console.error("Error getting follow counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get follower + following + post counts in a single round-trip.
// Reads denormalized columns for member/community (O(1) index lookup).
// post_count stays a live COUNT(*) — a separate post_count column
// can be added in a future migration if needed.
const getProfileCounts = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    const validTypes = ["member", "community", "sponsor", "venue"];
    if (!validTypes.includes(userType)) {
      return res.status(400).json({ error: "Invalid user type" });
    }

    let followers_count, following_count, post_count;
    let circle_count = 0;
    let creator_follower_count = 0;

    if (userType === 'member') {
      const r = await pool.query(
        `SELECT follower_count, following_count, circle_count,
                (SELECT COUNT(*) FROM creator_follows
                 WHERE creator_id = $1 AND is_dormant = false)::int AS creator_follower_count,
                (SELECT COUNT(*) FROM creator_follows
                 WHERE follower_id = $1 AND is_dormant = false)::int AS creator_following_count,
                (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'member')::int AS post_count
         FROM members WHERE id = $1`,
        [userId]
      );
      const row = r.rows[0];
      const communityFollowing    = parseInt(row?.following_count        ?? 0, 10);
      const creatorFollowing      = parseInt(row?.creator_following_count ?? 0, 10);
      followers_count        = parseInt(row?.follower_count         ?? 0, 10);
      following_count        = communityFollowing + creatorFollowing; // all entities this member follows
      post_count             = parseInt(row?.post_count             ?? 0, 10);
      circle_count           = parseInt(row?.circle_count           ?? 0, 10);
      creator_follower_count = parseInt(row?.creator_follower_count ?? 0, 10);
    } else if (userType === 'community') {
      const r = await pool.query(
        `SELECT follower_count, following_count,
                (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'community')::int
                + (SELECT COUNT(*) FROM opportunities WHERE creator_id = $1::text AND creator_type = 'community' AND status != 'closed')::int AS post_count
         FROM communities WHERE id = $1`,
        [userId]
      );
      const row = r.rows[0];
      followers_count = parseInt(row?.follower_count  ?? 0, 10);
      following_count = parseInt(row?.following_count ?? 0, 10);
      post_count      = parseInt(row?.post_count      ?? 0, 10);
    } else {
      // sponsor / venue: live COUNT(*)
      const result = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = $2) AS followers_count,
          (SELECT COUNT(*) FROM follows WHERE follower_id  = $1 AND follower_type  = $2) AS following_count,
          (SELECT COUNT(*) FROM posts   WHERE author_id    = $1 AND author_type    = $2) AS post_count`,
        [userId, userType]
      );
      const row = result.rows[0];
      followers_count = parseInt(row.followers_count, 10);
      following_count = parseInt(row.following_count, 10);
      post_count      = parseInt(row.post_count,      10);
    }

    res.json({ followers_count, following_count, post_count, circle_count, creator_follower_count });
  } catch (error) {
    console.error("Error getting profile counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  follow,
  unfollow,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getFollowCounts,
  getProfileCounts,
};
