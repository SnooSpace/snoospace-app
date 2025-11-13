async function signup(req, res) {
  try {
    console.log('Community signup request received:', req.body);
    const pool = req.app.locals.pool;
    const { 
      name, 
      logo_url,
      bio,
      category,
      location,
      email,
      phone,
      secondary_phone,
      sponsor_types,
      heads
    } = req.body || {};
    
    // Get user_id from authenticated user (optional for now)
    const user_id = req.user?.id || null;

    console.log('Validation check:', {
      name: !!name,
      category: !!category,
      location: !!location,
      email: !!email,
      phone: !!phone,
      sponsor_types: Array.isArray(sponsor_types),
      sponsor_types_value: sponsor_types
    });
    
    if (!name || !category || !email || !phone || !Array.isArray(sponsor_types)) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ error: "Required: name, category, email, phone, sponsor_types[]" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    if (secondary_phone && !/^\d{10}$/.test(secondary_phone)) {
      return res.status(400).json({ error: "secondary_phone must be 10 digits if provided" });
    }
    // Validate location if provided (location is optional - can be null if user skipped)
    if (location !== null && location !== undefined) {
      if (typeof location !== 'object' || !location.address) {
        return res.status(400).json({ error: "location must be an object with at least address field if provided" });
      }
    }
    // Allow "Open to All" as a single item, otherwise require minimum 3 items (no maximum)
    if (sponsor_types.length === 1 && sponsor_types[0] === 'Open to All') {
      // This is valid - "Open to All" is allowed as a single item
    } else if (sponsor_types.length < 3) {
      return res.status(400).json({ error: "sponsor_types must include at least 3 items, or select 'Open to All'" });
    }
    // Heads: expect array of up to 3 with one primary
    console.log('Heads validation:', {
      heads: heads,
      isArray: Array.isArray(heads),
      length: heads?.length
    });
    
    if (!Array.isArray(heads) || heads.length === 0) {
      console.log('Heads validation failed - not array or empty');
      return res.status(400).json({ error: "heads[] required: at least one head with name and is_primary" });
    }
    const primaryHeads = heads.filter(h => h && h.is_primary);
    console.log('Primary heads found:', primaryHeads.length);
    if (primaryHeads.length !== 1) {
      console.log('Heads validation failed - not exactly one primary head');
      return res.status(400).json({ error: "Exactly one primary head is required" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Prepare location JSONB (can be null if user skipped location)
      const locationJson = location ? JSON.stringify(location) : null;
      const communityResult = await client.query(
        `INSERT INTO communities (user_id, name, logo_url, bio, category, location, email, phone, secondary_phone, sponsor_types)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)
         ON CONFLICT (email) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           name=EXCLUDED.name,
           logo_url=EXCLUDED.logo_url,
           bio=EXCLUDED.bio,
           category=EXCLUDED.category,
           location=EXCLUDED.location,
           phone=EXCLUDED.phone,
           secondary_phone=EXCLUDED.secondary_phone,
           sponsor_types=EXCLUDED.sponsor_types
         RETURNING *`,
        [user_id, name, logo_url || null, bio || null, category, locationJson, email, phone, secondary_phone || null, JSON.stringify(sponsor_types)]
      );
      const community = communityResult.rows[0];

      // Clear existing heads and insert provided ones
      await client.query('DELETE FROM community_heads WHERE community_id = $1', [community.id]);
      for (const h of heads) {
        if (!h || !h.name) continue;
        await client.query(
          `INSERT INTO community_heads (community_id, name, email, phone, profile_pic_url, is_primary)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [community.id, h.name, h.email || null, h.phone || null, h.profile_pic_url || null, !!h.is_primary]
        );
      }

      await client.query('COMMIT');
      res.json({ community });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("/communities/signup error:", err);
    res.status(500).json({
      error: "Failed to signup community",
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
    });
  }
}

async function getProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get community profile
    const communityResult = await pool.query(
      `SELECT id, name, email, phone, category, location, username, bio, logo_url, sponsor_types, created_at
       FROM communities WHERE id = $1`,
      [userId]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const community = communityResult.rows[0];

    // Get all community heads
    const headsResult = await pool.query(
      `SELECT id, name, email, phone, profile_pic_url, is_primary, created_at
       FROM community_heads
       WHERE community_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    );

    const heads = headsResult.rows.map(head => ({
      id: head.id,
      name: head.name,
      email: head.email,
      phone: head.phone,
      profile_pic_url: head.profile_pic_url,
      is_primary: head.is_primary,
      created_at: head.created_at,
    }));

    // Get follower/following counts
    const followCountsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'community') as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') as following_count`,
      [userId]
    );

    const followCounts = followCountsResult.rows[0];

    // Get user's posts
    const postsResult = await pool.query(
      `SELECT id, caption, image_urls, like_count, comment_count, created_at
       FROM posts 
       WHERE author_id = $1 AND author_type = 'community'
       ORDER BY created_at DESC
       LIMIT 6`,
      [userId]
    );

    const posts = postsResult.rows.map(post => ({
      ...post,
      image_urls: typeof post.image_urls === 'string' ? JSON.parse(post.image_urls) : post.image_urls
    }));

    const profileData = {
      ...community,
      sponsor_types: typeof community.sponsor_types === 'string' ? JSON.parse(community.sponsor_types) : community.sponsor_types,
      follower_count: parseInt(followCounts.follower_count),
      following_count: parseInt(followCounts.following_count),
      location: typeof community.location === 'string' ? JSON.parse(community.location) : community.location,
      heads: heads,
    };

    res.json({
      profile: profileData,
      posts
    });

  } catch (error) {
    console.error("Error getting community profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function patchProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { bio, phone, category, sponsor_types, location } = req.body || {};

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (bio !== undefined) {
      const bioTrimmed = typeof bio === 'string' ? bio.trim() : null;
      if (bioTrimmed && bioTrimmed.length > 500) {
        return res.status(400).json({ error: "Bio must be 500 characters or less" });
      }
      updates.push(`bio = $${paramIndex++}`);
      values.push(bioTrimmed || null);
    }

    if (phone !== undefined) {
      const phoneTrimmed = typeof phone === 'string' ? phone.trim() : '';
      if (phoneTrimmed && !/^\d{10}$/.test(phoneTrimmed)) {
        return res.status(400).json({ error: "Phone must be 10 digits" });
      }
      updates.push(`phone = $${paramIndex++}`);
      values.push(phoneTrimmed || null);
    }

    if (category !== undefined) {
      const categoryTrimmed = typeof category === 'string' ? category.trim() : null;
      if (categoryTrimmed && categoryTrimmed.length > 100) {
        return res.status(400).json({ error: "Category must be 100 characters or less" });
      }
      updates.push(`category = $${paramIndex++}`);
      values.push(categoryTrimmed || null);
    }

    if (sponsor_types !== undefined) {
      if (!Array.isArray(sponsor_types)) {
        return res.status(400).json({ error: "Sponsor types must be an array" });
      }
      // Allow "Open to All" as a single item, otherwise require minimum 3 items
      if (sponsor_types.length === 1 && sponsor_types[0] === 'Open to All') {
        // Valid
      } else if (sponsor_types.length < 3) {
        return res.status(400).json({ error: "sponsor_types must include at least 3 items, or select 'Open to All'" });
      }
      const sanitized = sponsor_types.filter(s => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= 100);
      updates.push(`sponsor_types = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(sanitized));
    }

    if (location !== undefined) {
      if (location && typeof location === 'object') {
        const locAddress = location.address ? String(location.address).trim().substring(0, 200) : null;
        const locState = location.state ? String(location.state).trim().substring(0, 100) : null;
        const locCountry = location.country ? String(location.country).trim().substring(0, 100) : null;
        const lat = location.lat != null ? parseFloat(location.lat) : null;
        const lng = location.lng != null ? parseFloat(location.lng) : null;
        
        const locationJson = JSON.stringify({ address: locAddress, state: locState, country: locCountry, lat, lng });
        updates.push(`location = $${paramIndex++}::jsonb`);
        values.push(locationJson);
      } else if (location === null) {
        updates.push(`location = NULL`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE communities SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, bio, phone, category, sponsor_types, location`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const community = result.rows[0];
    res.json({
      success: true,
      profile: {
        bio: community.bio,
        phone: community.phone,
        category: community.category,
        sponsor_types: typeof community.sponsor_types === 'string' ? JSON.parse(community.sponsor_types) : community.sponsor_types,
        location: typeof community.location === 'string' ? JSON.parse(community.location) : community.location,
      },
    });
  } catch (err) {
    console.error("/communities/profile PATCH error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

async function searchCommunities(req, res) {
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
      `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category,
              (SELECT 1 FROM follows f
                 WHERE f.follower_id = $2 AND f.follower_type = 'member'
                   AND f.following_id = c.id AND f.following_type = 'community'
                 LIMIT 1) IS NOT NULL AS is_following
       FROM communities c
       WHERE (LOWER(c.username) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
         AND c.id <> $2
       ORDER BY c.name ASC
       LIMIT $3 OFFSET $4`,
      [likeParam, userId, limit, offset]
    );

    const results = r.rows.map(row => ({
      id: row.id,
      username: row.username,
      name: row.name,
      bio: row.bio,
      logo_url: row.logo_url,
      category: row.category,
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error("/communities/search error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to search communities" });
  }
}

async function getPublicCommunity(req, res) {
  try {
    const pool = req.app.locals.pool;
    const authUserId = req.user?.id;
    const userType = req.user?.type;
    const targetId = req.params.id;

    if (!authUserId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const communityR = await pool.query(
      `SELECT id, username, name, bio, logo_url, category, created_at, sponsor_types, location
       FROM communities
       WHERE id = $1`,
      [targetId]
    );
    if (communityR.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }
    const profile = communityR.rows[0];

    // Get all community heads
    const headsResult = await pool.query(
      `SELECT id, name, email, phone, profile_pic_url, is_primary, created_at
       FROM community_heads
       WHERE community_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [targetId]
    );

    const heads = headsResult.rows.map(head => ({
      id: head.id,
      name: head.name,
      email: head.email,
      phone: head.phone,
      profile_pic_url: head.profile_pic_url,
      is_primary: head.is_primary,
      created_at: head.created_at,
    }));

    const countsR = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'community') AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') AS following_count,
         (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'community') AS posts_count`,
      [targetId]
    );
    const counts = countsR.rows[0];

    const isFollowingR = await pool.query(
      `SELECT 1 FROM follows 
       WHERE follower_id = $1 AND follower_type = 'member'
         AND following_id = $2 AND following_type = 'community'
       LIMIT 1`,
      [authUserId, targetId]
    );

    res.json({
      id: profile.id,
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      logo_url: profile.logo_url,
      category: profile.category,
      created_at: profile.created_at,
      posts_count: parseInt(counts.posts_count || 0, 10),
      followers_count: parseInt(counts.followers_count || 0, 10),
      following_count: parseInt(counts.following_count || 0, 10),
      is_following: isFollowingR.rows.length > 0,
      sponsor_types: typeof profile.sponsor_types === 'string' ? JSON.parse(profile.sponsor_types) : (profile.sponsor_types || []),
      location: typeof profile.location === 'string' ? JSON.parse(profile.location) : profile.location,
      heads: heads,
    });
  } catch (err) {
    console.error("/communities/:id/public error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to load public profile" });
  }
}

async function changeUsernameEndpoint(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { username } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: "Username is required" });
    }

    const sanitized = username.toLowerCase().trim();
    if (!/^[a-z0-9._]{3,30}$/.test(sanitized)) {
      return res.status(400).json({ error: "Username must be 3-30 characters, lowercase letters, numbers, and underscores only" });
    }

    const existing = await pool.query(
      `SELECT id FROM communities WHERE username = $1 AND id <> $2 LIMIT 1`,
      [sanitized, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    await pool.query(
      `UPDATE communities SET username = $1 WHERE id = $2`,
      [sanitized, userId]
    );

    res.json({ success: true, username: sanitized });
  } catch (err) {
    console.error("/communities/username POST error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update username" });
  }
}

async function startEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const existing = await pool.query(
      `SELECT id FROM communities WHERE email = $1 AND id <> $2 LIMIT 1`,
      [emailTrimmed, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const supabase = require("../supabase");
    const { data, error } = await supabase.auth.signInWithOtp({
      email: emailTrimmed,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("/communities/email/change/start error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

async function verifyEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const supabase = require("../supabase");
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: emailTrimmed,
      token: otp,
      type: "email",
    });

    if (error) {
      return res.status(400).json({ error: error.message || "Invalid OTP" });
    }

    await pool.query(
      `UPDATE communities SET email = $1 WHERE id = $2`,
      [emailTrimmed, userId]
    );

    res.json({ success: true, email: emailTrimmed });
  } catch (err) {
    console.error("/communities/email/change/verify error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to verify email" });
  }
}

async function updateLocation(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }
    const body = req.body || {};
    const loc = body.location;
    if (!loc || typeof loc !== 'object') {
      return res.status(400).json({ error: "location object is required" });
    }
    const lat = loc.lat != null ? parseFloat(loc.lat) : null;
    const lng = loc.lng != null ? parseFloat(loc.lng) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng are required numeric values" });
    }
    const address = loc.address ? String(loc.address).trim().substring(0, 200) : null;
    const state = loc.state ? String(loc.state).trim().substring(0, 100) : null;
    const country = loc.country ? String(loc.country).trim().substring(0, 100) : null;
    const locationJson = JSON.stringify({ address, state, country, lat, lng });

    await pool.query(`UPDATE communities SET location = $1::jsonb WHERE id = $2`, [locationJson, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("/communities/location POST error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update location" });
  }
}

async function updateLogo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { logo_url } = req.body || {};
    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!logo_url) {
      return res.status(400).json({ error: 'logo_url is required' });
    }
    const r = await pool.query('UPDATE communities SET logo_url = $1 WHERE id = $2 RETURNING id, logo_url', [logo_url, userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Community not found' });
    res.json({ success: true, logo_url: r.rows[0].logo_url });
  } catch (err) {
    console.error('/communities/profile/logo error:', err);
    res.status(500).json({ error: 'Failed to update logo' });
  }
}

module.exports = { 
  signup, 
  getProfile, 
  patchProfile, 
  searchCommunities, 
  getPublicCommunity, 
  changeUsernameEndpoint, 
  startEmailChange, 
  verifyEmailChange, 
  updateLocation, 
  updateLogo 
};


