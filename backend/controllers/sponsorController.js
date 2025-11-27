async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, logo_url, bio, category, email, phone, interests } = req.body || {};
    
    console.log('Sponsor signup request body:', req.body);
    
    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Required fields: name, email, phone" });
    }
    
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Phone must be exactly 10 digits" });
    }
    
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: "At least one interest is required" });
    }
    
    // Validate interests array
    if (interests.length === 1 && interests[0] === 'Open to All') {
      // This is valid - "Open to All" is allowed as a single item
    } else if (interests.length < 3) {
      return res.status(400).json({ error: "interests must include at least 3 items, or select 'Open to All'" });
    }
    
    // Get user_id from authenticated user (optional for now)
    const user_id = req.user?.id || null;
    
    console.log('Creating sponsor with user_id:', user_id);
    
    const result = await pool.query(
      `INSERT INTO sponsors (user_id, brand_name, logo_url, bio, category, email, phone, interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (email) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         brand_name = EXCLUDED.brand_name,
         logo_url = EXCLUDED.logo_url,
         bio = EXCLUDED.bio,
         category = EXCLUDED.category,
         phone = EXCLUDED.phone,
         interests = EXCLUDED.interests
       RETURNING *`,
      [user_id, name, logo_url || null, bio || null, category || null, email, phone, JSON.stringify(interests)]
    );
    
    console.log('Sponsor created successfully:', result.rows[0]);
    res.json({ sponsor: result.rows[0] });
  } catch (err) {
    console.error("/sponsors/signup error:", err);
    res.status(500).json({
      error: "Failed to signup sponsor",
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
    });
  }
}

module.exports = { signup };

async function updateLogo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { logo_url } = req.body || {};
    if (!userId || userType !== 'sponsor') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!logo_url) {
      return res.status(400).json({ error: 'logo_url is required' });
    }
    const r = await pool.query('UPDATE sponsors SET logo_url = $1 WHERE id = $2 RETURNING id, logo_url', [logo_url, userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Sponsor not found' });
    res.json({ success: true, logo_url: r.rows[0].logo_url });
  } catch (err) {
    console.error('/sponsors/profile/logo error:', err);
    res.status(500).json({ error: 'Failed to update logo' });
  }
}

module.exports.updateLogo = updateLogo;

async function startEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'sponsor') {
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

    // Check if email is in use across all user roles
    const { isEmailInUse } = require("../middleware/validators");
    const emailExists = await isEmailInUse(pool, emailTrimmed, 'sponsors', userId);
    if (emailExists) {
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
    console.error("/sponsors/email/change/start error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

async function verifyEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'sponsor') {
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
      `UPDATE sponsors SET email = $1 WHERE id = $2`,
      [emailTrimmed, userId]
    );

    // Return the new access token so the frontend can update its stored token
    const newAccessToken = data?.session?.access_token;
    res.json({ 
      success: true, 
      email: emailTrimmed,
      accessToken: newAccessToken 
    });
  } catch (err) {
    console.error("/sponsors/email/change/verify error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to verify email" });
  }
}

module.exports.startEmailChange = startEmailChange;
module.exports.verifyEmailChange = verifyEmailChange;

async function searchSponsors(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.query || req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    if (q.length < 2) {
      return res.json({ results: [], nextOffset: offset, hasMore: false });
    }

    const likeParam = `%${q}%`;
    // Sponsors don't have follow relationships yet, so we don't check is_following
    const query = `SELECT s.id, s.username, s.brand_name as name, s.bio, s.logo_url, s.category,
                          false AS is_following
                   FROM sponsors s
                   WHERE (LOWER(s.username) LIKE LOWER($1) OR LOWER(s.brand_name) LIKE LOWER($1))
                   ORDER BY s.brand_name ASC
                   LIMIT $2 OFFSET $3`;
    const params = [likeParam, limit, offset];
    
    const r = await pool.query(query, params);

    const results = r.rows.map(row => ({
      id: row.id,
      username: row.username,
      name: row.name,
      brand_name: row.name, // Also include as 'brand_name' for compatibility
      full_name: row.name, // For compatibility with frontend
      bio: row.bio,
      logo_url: row.logo_url,
      category: row.category,
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error("/sponsors/search error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to search sponsors" });
  }
}

module.exports.searchSponsors = searchSponsors;


