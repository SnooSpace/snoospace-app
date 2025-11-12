function parsePgTextArray(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return [trimmed];
  const inner = trimmed.substring(1, trimmed.length - 1);
  if (!inner) return [];
  return inner
    .split(',')
    .map((item) => item.trim())
    .map((item) => {
      // remove surrounding quotes if present
      const m = item.match(/^"(.*)"$/);
      return m ? m[1] : item;
    })
    .filter((s) => s.length > 0);
}

async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
  const { name, email, phone, dob, gender, location, interests, profile_photo_url } = req.body || {};
    if (!name || !email || !phone || !dob || !gender || !location || !Array.isArray(interests)) {
      return res.status(400).json({ error: "All fields are required: name, email, phone, dob, gender, location (JSONB), interests[]" });
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
    // Validate location is an object with at least city
    if (typeof location !== 'object' || location === null || !location.city) {
      return res.status(400).json({ error: "location must be an object with at least a city field" });
    }
    const result = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, location, interests, profile_photo_url)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
       ON CONFLICT (email) DO UPDATE SET
         name=EXCLUDED.name,
         phone=EXCLUDED.phone,
         dob=EXCLUDED.dob,
         gender=EXCLUDED.gender,
         location=EXCLUDED.location,
         interests=EXCLUDED.interests,
         profile_photo_url=COALESCE(EXCLUDED.profile_photo_url, members.profile_photo_url)
       RETURNING *`,
      [name, email, phone, dob, gender, JSON.stringify(location), JSON.stringify(interests), profile_photo_url || null]
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
      `SELECT id, name, email, phone, dob, gender, interests, username, bio, profile_photo_url, pronouns, location, created_at
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

    const profileData = {
      ...member,
      interests: JSON.parse(member.interests),
      follower_count: parseInt(followCounts.follower_count),
      following_count: parseInt(followCounts.following_count),
      pronouns: parsePgTextArray(member.pronouns),
      location: typeof member.location === 'string' ? JSON.parse(member.location) : member.location,
    };

    res.json({
      profile: profileData,
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
      `SELECT id, username, name as full_name, bio, profile_photo_url, created_at, interests, pronouns
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
      interests: typeof profile.interests === 'string' ? JSON.parse(profile.interests) : (profile.interests || []),
      pronouns: parsePgTextArray(profile.pronouns),
    });
  } catch (err) {
    console.error("/members/:id/public error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to load public profile" });
  }
}

async function patchProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { bio, phone, pronouns, interests, location } = req.body || {};

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (bio !== undefined) {
      const bioTrimmed = typeof bio === 'string' ? bio.trim() : null;
      if (bioTrimmed && bioTrimmed.length > 150) {
        return res.status(400).json({ error: "Bio must be 150 characters or less" });
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

    if (pronouns !== undefined) {
      if (pronouns === null) {
        updates.push(`pronouns = NULL`);
      } else if (Array.isArray(pronouns)) {
        if (pronouns.length > 10) {
          return res.status(400).json({ error: "Maximum 10 pronouns allowed" });
        }
        const sanitized = pronouns.filter(p => typeof p === 'string' && p.trim().length > 0 && p.trim().length <= 50);
        updates.push(`pronouns = $${paramIndex++}::text[]`);
        values.push(sanitized);
      } else if (typeof pronouns === 'string') {
        updates.push(`pronouns = $${paramIndex++}::text[]`);
        values.push([pronouns]);
      }
    }

    if (interests !== undefined) {
      if (!Array.isArray(interests)) {
        return res.status(400).json({ error: "Interests must be an array" });
      }
      if (interests.length > 20) {
        return res.status(400).json({ error: "Maximum 20 interests allowed" });
      }
      const sanitized = interests.filter(i => typeof i === 'string' && i.trim().length > 0 && i.trim().length <= 100);
      updates.push(`interests = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(sanitized));
    }

    if (location !== undefined) {
      if (location && typeof location === 'object') {
        const locCity = location.city ? String(location.city).trim().substring(0, 100) : null;
        const locState = location.state ? String(location.state).trim().substring(0, 100) : null;
        const locCountry = location.country ? String(location.country).trim().substring(0, 100) : null;
        const lat = location.lat != null ? parseFloat(location.lat) : null;
        const lng = location.lng != null ? parseFloat(location.lng) : null;
        
        const locationJson = JSON.stringify({ city: locCity, state: locState, country: locCountry, lat, lng });
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
    const query = `UPDATE members SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, bio, phone, pronouns, interests, location`;
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = result.rows[0];
    res.json({
      success: true,
      profile: {
        bio: member.bio,
        phone: member.phone,
        pronouns: parsePgTextArray(member.pronouns),
        interests: typeof member.interests === 'string' ? JSON.parse(member.interests) : member.interests,
        location: typeof member.location === 'string' ? JSON.parse(member.location) : member.location,
      },
    });
  } catch (err) {
    console.error("/members/profile PATCH error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

async function changeUsernameEndpoint(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
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
      `SELECT id FROM members WHERE username = $1 AND id <> $2 LIMIT 1`,
      [sanitized, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    await pool.query(
      `UPDATE members SET username = $1 WHERE id = $2`,
      [sanitized, userId]
    );

    res.json({ success: true, username: sanitized });
  } catch (err) {
    console.error("/members/username POST error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update username" });
  }
}

async function startEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
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
      `SELECT id FROM members WHERE email = $1 AND id <> $2 LIMIT 1`,
      [emailTrimmed, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const supabase = require("../supabase");
    // Use Supabase OTP to deliver a 6-digit code to the new email.
    // Allow sending to emails that are not yet registered by enabling shouldCreateUser.
    // This does NOT switch the authenticated user; we only use the OTP as proof of inbox control
    // before committing the new email to our members table.
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
    console.error("/members/email/change/start error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

async function verifyEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
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
      `UPDATE members SET email = $1 WHERE id = $2`,
      [emailTrimmed, userId]
    );

    res.json({ success: true, email: emailTrimmed });
  } catch (err) {
    console.error("/members/email/change/verify error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to verify email" });
  }
}

async function updateLocation(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || userType !== 'member') {
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
    const city = loc.city ? String(loc.city).trim().substring(0, 100) : null;
    const state = loc.state ? String(loc.state).trim().substring(0, 100) : null;
    const country = loc.country ? String(loc.country).trim().substring(0, 100) : null;
    const locationJson = JSON.stringify({ city, state, country, lat, lng });

    await pool.query(`UPDATE members SET location = $1::jsonb WHERE id = $2`, [locationJson, userId]);
    await pool.query(
      `INSERT INTO member_location_history (member_id, location) VALUES ($1, $2::jsonb)`,
      [userId, locationJson]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("/members/location POST error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to update location" });
  }
}

module.exports = { signup, getProfile, updatePhoto, searchMembers, getPublicMember, patchProfile, changeUsernameEndpoint, startEmailChange, verifyEmailChange, updateLocation };


