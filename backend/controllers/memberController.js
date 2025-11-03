async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
  const { name, email, phone, dob, gender, city, interests, profile_photo_url } = req.body || {};
    if (!name || !email || !phone || !dob || !gender || !city || !Array.isArray(interests)) {
      return res.status(400).json({ error: "All fields are required: name, email, phone, dob, gender, city, interests[]" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    const allowedGenders = ["Male", "Female", "Non-binary"];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({ error: "gender must be one of: Male, Female, Non-binary" });
    }
    if (interests.length < 3 || interests.length > 7) {
      return res.status(400).json({ error: "interests must include between 3 and 7 items" });
    }
    const result = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, city, interests, profile_photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       ON CONFLICT (email) DO UPDATE SET
         name=EXCLUDED.name,
         phone=EXCLUDED.phone,
         dob=EXCLUDED.dob,
         gender=EXCLUDED.gender,
         city=EXCLUDED.city,
         interests=EXCLUDED.interests,
         profile_photo_url=COALESCE(EXCLUDED.profile_photo_url, members.profile_photo_url)
       RETURNING *`,
      [name, email, phone, dob, gender, city, JSON.stringify(interests), profile_photo_url || null]
    );
    res.json({ member: result.rows[0] });
  } catch (err) {
    console.error("/members/signup error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      error: "Failed to signup member",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
      hint: err && err.hint ? err.hint : undefined,
      position: err && err.position ? err.position : undefined,
    });
  }
}

async function getProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get member profile
    const memberResult = await pool.query(
      `SELECT id, name, email, phone, dob, gender, city, interests, username, bio, profile_photo_url, created_at
       FROM members WHERE id = $1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = memberResult.rows[0];

    // Get follower/following counts
    const followCountsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'member') as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') as following_count`,
      [userId]
    );

    const followCounts = followCountsResult.rows[0];

    // Get user's posts
    const postsResult = await pool.query(
      `SELECT id, caption, image_urls, like_count, comment_count, created_at
       FROM posts 
       WHERE author_id = $1 AND author_type = 'member'
       ORDER BY created_at DESC
       LIMIT 6`,
      [userId]
    );

    const posts = postsResult.rows.map(post => ({
      ...post,
      image_urls: JSON.parse(post.image_urls)
    }));

    res.json({
      profile: {
        ...member,
        interests: JSON.parse(member.interests),
        follower_count: parseInt(followCounts.follower_count),
        following_count: parseInt(followCounts.following_count)
      },
      posts
    });

  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function updatePhoto(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { photo_url } = req.body || {};

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!photo_url) {
      return res.status(400).json({ error: "photo_url is required" });
    }

    const r = await pool.query(
      `UPDATE members SET profile_photo_url = $1 WHERE id = $2 RETURNING id, profile_photo_url`,
      [photo_url, userId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json({ success: true, profile_photo_url: r.rows[0].profile_photo_url });
  } catch (err) {
    console.error("/members/profile/photo error:", err);
    res.status(500).json({ error: "Failed to update photo" });
  }
}

async function searchMembers(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.query || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    if (q.length < 2) {
      return res.json({ results: [], nextOffset: offset, hasMore: false });
    }

    const likeParam = `%${q}%`;
    const r = await pool.query(
      `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
              (SELECT 1 FROM follows f
                 WHERE f.follower_id = $2 AND f.follower_type = 'member'
                   AND f.following_id = m.id AND f.following_type = 'member'
                 LIMIT 1) IS NOT NULL AS is_following
       FROM members m
       WHERE (LOWER(m.username) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
         AND m.id <> $2
       ORDER BY m.name ASC
       LIMIT $3 OFFSET $4`,
      [likeParam, userId, limit, offset]
    );

    const results = r.rows.map(row => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      bio: row.bio,
      profile_photo_url: row.profile_photo_url,
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error("/members/search error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to search members" });
  }
}

async function getPublicMember(req, res) {
  try {
    const pool = req.app.locals.pool;
    const authUserId = req.user?.id;
    const userType = req.user?.type;
    const targetId = req.params.id;

    if (!authUserId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const memberR = await pool.query(
      `SELECT id, username, name as full_name, bio, profile_photo_url, created_at
       FROM members
       WHERE id = $1`,
      [targetId]
    );
    if (memberR.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    const profile = memberR.rows[0];

    const countsR = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'member') AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') AS following_count,
         (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'member') AS posts_count`,
      [targetId]
    );
    const counts = countsR.rows[0];

    const isFollowingR = await pool.query(
      `SELECT 1 FROM follows 
       WHERE follower_id = $1 AND follower_type = 'member'
         AND following_id = $2 AND following_type = 'member'
       LIMIT 1`,
      [authUserId, targetId]
    );

    res.json({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      bio: profile.bio,
      profile_photo_url: profile.profile_photo_url,
      created_at: profile.created_at,
      posts_count: parseInt(counts.posts_count || 0, 10),
      followers_count: parseInt(counts.followers_count || 0, 10),
      following_count: parseInt(counts.following_count || 0, 10),
      is_following: isFollowingR.rows.length > 0,
    });
  } catch (err) {
    console.error("/members/:id/public error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to load public profile" });
  }
}

module.exports = { signup, getProfile, updatePhoto, searchMembers, getPublicMember };


