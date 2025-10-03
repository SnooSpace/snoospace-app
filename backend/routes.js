// routes.js
const express = require("express");
const supabase = require("./supabase");

const router = express.Router();

// Auth middleware to validate Supabase access token
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request for use in route handlers
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check if email exists in any user table
router.post("/auth/check-email", async (req, res) => {
  try {
    const { email } = req.body || {};
    const pool = req.app.locals.pool;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check in all user tables
    const queries = [
      pool.query("SELECT email FROM members WHERE email = $1", [email]),
      pool.query("SELECT email FROM communities WHERE email = $1", [email]),
      pool.query("SELECT email FROM sponsors WHERE email = $1", [email]),
      pool.query("SELECT email FROM venues WHERE contact_email = $1", [email])
    ];

    const results = await Promise.all(queries);
    const exists = results.some(result => result.rows.length > 0);

    res.json({ exists });
  } catch (err) {
    console.error("/auth/check-email error:", err);
    res.status(500).json({ error: "Failed to check email" });
  }
});

// Get user profile and role
router.post("/auth/get-user-profile", async (req, res) => {
  try {
    const { email } = req.body || {};
    const pool = req.app.locals.pool;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check in all user tables to find the user's role
    const queries = [
      { table: 'members', role: 'member' },
      { table: 'communities', role: 'community' },
      { table: 'sponsors', role: 'sponsor' },
      { table: 'venues', role: 'venue' }
    ];

    for (const { table, role } of queries) {
      let emailColumn = 'email';
      if (table === 'venues') {
        emailColumn = 'contact_email';
      }

      const result = await pool.query(
        `SELECT * FROM ${table} WHERE ${emailColumn} = $1`,
        [email]
      );

      if (result.rows.length > 0) {
        return res.json({
          role,
          profile: result.rows[0]
        });
      }
    }

    res.status(404).json({ error: "User not found" });
  } catch (err) {
    console.error("/auth/get-user-profile error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// DB health check
router.get("/db/health", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const r = await pool.query("SELECT 1 as ok");
    res.json({ status: "ok", result: r.rows[0] });
  } catch (err) {
    console.error("/db/health error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      status: "error",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
      hint: err && err.hint ? err.hint : undefined,
    });
  }
});

// Create members table manually
router.post("/db/create-members-table", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        dob DATE NOT NULL,
        gender TEXT NOT NULL,
        city TEXT NOT NULL,
        interests JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Enforce CHECK constraints
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT phone_10_digits CHECK (phone ~ '^\\d{10}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT gender_allowed CHECK (gender IN ('Male','Female','Non-binary'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE members ADD CONSTRAINT interests_len CHECK (
          jsonb_typeof(interests) = 'array' AND jsonb_array_length(interests) BETWEEN 3 AND 7
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    res.json({ status: "ok", message: "members table created successfully" });
  } catch (err) {
    console.error("/db/create-members-table error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      status: "error",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
    });
  }
});

/**
 * Send OTP to email
 * Body: { email }
 */
router.post("/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Force OTP code delivery instead of magic link
  const { data, error } = await supabase.auth.signInWithOtp({ 
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: undefined // Disable magic link redirect
    }
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "OTP sent to email", data });
});

/**
 * Verify OTP and log in
 * Body: { email, token }
 */
router.post("/auth/verify-otp", async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: "Email and token are required" });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "OTP verified successfully", data });
});

/**
 * Handle magic link redirects (fallback)
 */
router.get("/auth/callback", (req, res) => {
  const { access_token, refresh_token, error } = req.query;
  
  if (error) {
    return res.status(400).json({ error: "Authentication failed", details: error });
  }
  
  if (access_token) {
    // Return success page or redirect to app
    res.send(`
      <html>
        <body>
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the app.</p>
          <script>
            // Optional: send token back to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'AUTH_SUCCESS', access_token: '${access_token}' }, '*');
            }
          </script>
        </body>
      </html>
    `);
  } else {
    res.status(400).json({ error: "No access token received" });
  }
});

// Protected route example - get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { email } = req.user;
    
    // Get member profile from database
    const result = await pool.query(
      "SELECT * FROM members WHERE email = $1",
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member profile not found" });
    }
    
    res.json({ 
      user: req.user,
      member: result.rows[0]
    });
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// Community signup
router.post("/communities/signup", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, bio, email, phone, requirements } = req.body || {};
    
    // Required fields validation
    if (!name || !bio || !email || !phone || !requirements) {
      return res.status(400).json({ error: "All fields are required: name, bio, email, phone, requirements" });
    }
    
    // Phone validation
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    
    const result = await pool.query(
      `INSERT INTO communities (name, bio, email, phone, requirements)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         requirements = EXCLUDED.requirements
       RETURNING *`,
      [name, bio, email, phone, requirements]
    );
    
    res.json({ community: result.rows[0] });
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
});

// Sponsor signup
router.post("/sponsors/signup", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { brandName, bio, email, phone, requirements } = req.body || {};
    
    // Required fields validation
    if (!brandName || !bio || !email || !phone || !requirements) {
      return res.status(400).json({ error: "All fields are required: brandName, bio, email, phone, requirements" });
    }
    
    // Phone validation
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    
    const result = await pool.query(
      `INSERT INTO sponsors (brand_name, bio, email, phone, requirements)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         brand_name = EXCLUDED.brand_name,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         requirements = EXCLUDED.requirements
       RETURNING *`,
      [brandName, bio, email, phone, requirements]
    );
    
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
});

// Venue signup
router.post("/venues/signup", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions } = req.body || {};
    
    // Required fields validation
    if (!name || !address || !city || !contact_name || !contact_email || !contact_phone || !capacity_min || !capacity_max || !price_per_head) {
      return res.status(400).json({ error: "All fields are required: name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head" });
    }
    
    // Phone validation
    if (!/^\d{10}$/.test(contact_phone)) {
      return res.status(400).json({ error: "contact_phone must be 10 digits" });
    }
    
    // Capacity validation
    if (capacity_min >= capacity_max) {
      return res.status(400).json({ error: "capacity_min must be less than capacity_max" });
    }
    
    const result = await pool.query(
      `INSERT INTO venues (name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (contact_email) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         capacity_min = EXCLUDED.capacity_min,
         capacity_max = EXCLUDED.capacity_max,
         price_per_head = EXCLUDED.price_per_head,
         conditions = EXCLUDED.conditions
       RETURNING *`,
      [name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions || null]
    );
    
    res.json({ venue: result.rows[0] });
  } catch (err) {
    console.error("/venues/signup error:", err);
    res.status(500).json({ error: "Failed to signup venue" });
  }
});

module.exports = router;

// Member signup
router.post("/members/signup", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, email, phone, dob, gender, city, interests } = req.body || {};
    // Required
    if (!name || !email || !phone || !dob || !gender || !city || !Array.isArray(interests)) {
      return res.status(400).json({ error: "All fields are required: name, email, phone, dob, gender, city, interests[]" });
    }
    // Phone: exactly 10 digits
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    // Gender: allowed values
    const allowedGenders = ["Male", "Female", "Non-binary"];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({ error: "gender must be one of: Male, Female, Non-binary" });
    }
    // Interests: min 3, max 7
    if (interests.length < 3 || interests.length > 7) {
      return res.status(400).json({ error: "interests must include between 3 and 7 items" });
    }
    const result = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, city, interests)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (email) DO UPDATE SET
         name=EXCLUDED.name,
         phone=EXCLUDED.phone,
         dob=EXCLUDED.dob,
         gender=EXCLUDED.gender,
         city=EXCLUDED.city,
         interests=EXCLUDED.interests
       RETURNING *`,
      [name, email, phone, dob, gender, city, JSON.stringify(interests)]
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
});
