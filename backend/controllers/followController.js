const { createPool } = require("../config/db");

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
      return res.status(400).json({ error: "Following ID and type are required" });
    }

    // Validate following type
    const validTypes = ['member', 'community', 'sponsor', 'venue'];
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
      if (followerType === 'member') {
        const r = await pool.query('SELECT name, username, profile_photo_url FROM members WHERE id = $1', [followerId]);
        if (r.rows[0]) {
          actorName = r.rows[0].name || null;
          actorUsername = r.rows[0].username || null;
          actorAvatar = r.rows[0].profile_photo_url || null;
        }
      }
      await pool.query(
        `INSERT INTO notifications (recipient_id, recipient_type, actor_id, actor_type, type, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [followingId, followingType, followerId, followerType, 'follow', JSON.stringify({ actorName, actorUsername, actorAvatar })]
      );
    } catch (e) {
      // Non-fatal: do not block follow if notification fails
      console.error('Failed to create follow notification', e);
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
      return res.status(400).json({ error: "Following ID and type are required" });
    }

    // Remove follow
    const result = await pool.query(
      "DELETE FROM follows WHERE follower_id = $1 AND follower_type = $2 AND following_id = $3 AND following_type = $4",
      [followerId, followerType, followingId, followingType]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "Not following this entity" });
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
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

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
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset]);
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
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

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
      ORDER BY f.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [userId, userType, limit, offset]);
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
      return res.status(400).json({ error: "Following ID and type are required" });
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
const getFollowCounts = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    const followersQuery = `
      SELECT COUNT(*) as count 
      FROM follows 
      WHERE following_id = $1 AND following_type = $2
    `;

    const followingQuery = `
      SELECT COUNT(*) as count 
      FROM follows 
      WHERE follower_id = $1 AND follower_type = $2
    `;

    const [followersResult, followingResult] = await Promise.all([
      pool.query(followersQuery, [userId, userType]),
      pool.query(followingQuery, [userId, userType])
    ]);

    res.json({
      followers_count: parseInt(followersResult.rows[0].count),
      following_count: parseInt(followingResult.rows[0].count)
    });

  } catch (error) {
    console.error("Error getting follow counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  follow,
  unfollow,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getFollowCounts
};
