async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, hourly_price, daily_price, conditions, logo_url } = req.body || {};
    
    // Validate required fields
    if (!name || !address || !city || !contact_name || !contact_email || !contact_phone || capacity_max === undefined || capacity_max === null) {
      return res.status(400).json({ error: "All fields are required: name, address, city, contact_name, contact_email, contact_phone, capacity_max" });
    }
    
    // Validate that at least one pricing type is provided
    if (!price_per_head && !hourly_price && !daily_price) {
      return res.status(400).json({ error: "At least one pricing type is required: price_per_head, hourly_price, or daily_price" });
    }
    
    if (!/^\d{10}$/.test(contact_phone)) {
      return res.status(400).json({ error: "contact_phone must be 10 digits" });
    }
    
    // Set capacity_min to 0 if not provided, and validate capacity relationship
    const finalCapacityMin = capacity_min || 0;
    if (finalCapacityMin >= capacity_max) {
      return res.status(400).json({ error: "capacity_min must be less than capacity_max" });
    }
    
    // No longer using supabase_user_id - we use email as login credential
    // and backend-generated id as account identity
    console.log('[VenueSignup] Creating venue for email:', contact_email);
    
    // Simple INSERT - no supabase_user_id, allow multiple accounts per email
    const result = await pool.query(
      `INSERT INTO venues (name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, hourly_price, daily_price, conditions, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [name, address, city, contact_name, contact_email, contact_phone, finalCapacityMin, capacity_max, price_per_head || 0, hourly_price || 0, daily_price || 0, conditions || null, logo_url || null]
    );
    res.json({ venue: result.rows[0] });
  } catch (err) {
    console.error("/venues/signup error:", err);
    res.status(500).json({ error: "Failed to signup venue" });
  }
}

module.exports = { signup };

async function updateLogo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { logo_url } = req.body || {};
    if (!userId || userType !== 'venue') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!logo_url) {
      return res.status(400).json({ error: 'logo_url is required' });
    }
    const r = await pool.query('UPDATE venues SET logo_url = $1 WHERE id = $2 RETURNING id, logo_url', [logo_url, userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Venue not found' });
    res.json({ success: true, logo_url: r.rows[0].logo_url });
  } catch (err) {
    console.error('/venues/profile/logo error:', err);
    res.status(500).json({ error: 'Failed to update logo' });
  }
}

module.exports.updateLogo = updateLogo;

async function startEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'venue') {
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
    const emailExists = await isEmailInUse(pool, emailTrimmed, 'venues', userId);
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
    console.error("/venues/email/change/start error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

async function verifyEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'venue') {
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
      `UPDATE venues SET contact_email = $1 WHERE id = $2`,
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
    console.error("/venues/email/change/verify error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to verify email" });
  }
}

module.exports.startEmailChange = startEmailChange;
module.exports.verifyEmailChange = verifyEmailChange;

async function searchVenues(req, res) {
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
    // Venues don't have follow relationships yet, so we don't check is_following
    const query = `SELECT v.id, v.username, v.name, v.city, v.logo_url,
                          false AS is_following
                   FROM venues v
                   WHERE (LOWER(v.username) LIKE LOWER($1) OR LOWER(v.name) LIKE LOWER($1) OR LOWER(v.city) LIKE LOWER($1))
                   ORDER BY v.name ASC
                   LIMIT $2 OFFSET $3`;
    const params = [likeParam, limit, offset];
    
    const r = await pool.query(query, params);

    const results = r.rows.map(row => ({
      id: row.id,
      username: row.username,
      name: row.name,
      full_name: row.name, // For compatibility with frontend
      city: row.city,
      logo_url: row.logo_url,
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error("/venues/search error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to search venues" });
  }
}

module.exports.searchVenues = searchVenues;


