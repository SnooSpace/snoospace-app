const supabase = require("../supabase");

async function sendOtp(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(500).json({ error: "Server DB not ready" });
    }

    // If email already exists (in any role), block signup and ask to login
    const queries = [
      pool.query("SELECT 1 FROM members WHERE email = $1 LIMIT 1", [email]),
      pool.query("SELECT 1 FROM communities WHERE email = $1 LIMIT 1", [email]),
      pool.query("SELECT 1 FROM sponsors WHERE email = $1 LIMIT 1", [email]),
      pool.query("SELECT 1 FROM venues WHERE contact_email = $1 LIMIT 1", [email])
    ];
    const results = await Promise.allSettled(queries);
    const exists = results
      .filter(r => r.status === 'fulfilled')
      .some(r => r.value.rows.length > 0);

    if (exists) {
      return res.status(409).json({ error: "Account already exists. Please login instead." });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined
      }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "OTP sent to email", data });
  } catch (err) {
    console.error("/auth/send-otp error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to initiate signup" });
  }
}

async function loginStart(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const pool = req.app.locals.pool;
    if (!pool) {
      console.error("/auth/login/start error: pool is not initialized");
      return res.status(500).json({ error: "Server DB not ready" });
    }

    // Schema-safe existence checks to avoid 42703 when columns differ
    async function tableHasColumn(table, column) {
      const r = await pool.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
        [table, column]
      );
      return r.rows.length > 0;
    }

    async function existsIn(table, column) {
      try {
        const hasCol = await tableHasColumn(table, column);
        if (!hasCol) return false;
        const r = await pool.query(`SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`, [email]);
        return r.rows.length > 0;
      } catch (_) {
        return false;
      }
    }

    const checks = await Promise.all([
      existsIn('members', 'email'),
      existsIn('communities', 'email'),
      existsIn('sponsors', 'email'),
      existsIn('venues', 'contact_email')
    ]);
    const exists = checks.some(Boolean);

    if (!exists) {
      return res.status(404).json({ error: "Account doesn't exist. Please sign up." });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: undefined }
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Login code sent to email", data });
  } catch (err) {
    console.error("/auth/login/start error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to initiate login", message: err && err.message ? err.message : undefined, code: err && err.code ? err.code : undefined });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: "Email and token are required" });
    }

    console.log(`Attempting to verify OTP for email: ${email}`);
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      console.error("OTP verification error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log("OTP verified successfully");
    res.json({ message: "OTP verified successfully", data });
  } catch (err) {
    console.error("/auth/verify-otp error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to verify OTP", message: err && err.message ? err.message : undefined });
  }
}

async function refresh(req, res) {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required" });
    }
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    res.json({ message: 'refreshed', data });
  } catch (err) {
    console.error('/auth/refresh error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}

function callback(req, res) {
  const { access_token, refresh_token, error } = req.query;
  if (error) {
    return res.status(400).json({ error: "Authentication failed", details: error });
  }
  if (access_token) {
    res.send(`
      <html>
        <body>
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the app.</p>
          <script>
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
}

async function me(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { email } = req.user;
    const result = await pool.query("SELECT * FROM members WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member profile not found" });
    }
    res.json({ user: req.user, member: result.rows[0] });
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
}

// Validate token for multi-account switching
async function validateToken(req, res) {
  try {
    // Token already validated by authMiddleware
    // Just return user data to confirm it's valid
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const email = req.user?.email;

    if (!userId || !userType) {
      return res.status(401).json({ valid: false, error: 'Invalid user data' });
    }

    // Fetch fresh user data
    const tables = {
      member: 'members',
      community: 'communities',
      sponsor: 'sponsors',
      venue: 'venues'
    };

    const table = tables[userType];
    if (!table) {
      return res.status(400).json({ valid: false, error: 'Invalid user type' });
    }

    const result = await pool.query(`SELECT id, username FROM ${table} WHERE id = $1`, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    res.json({ 
      valid: true, 
      user: {
        id: userId,
        type: userType,
        email: email,
        username: result.rows[0].username
      }
    });
  } catch (err) {
    console.error('/auth/validate-token error:', err);
    res.status(500).json({ valid: false, error: 'Failed to validate token' });
  }
}

async function checkEmail(req, res) {
  try {
    const { email } = req.body || {};
    const pool = req.app.locals.pool;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
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
}

function parsePgTextArrayForAuth(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return [s];
  const inner = s.slice(1, -1);
  if (!inner) return [];
  return inner
    .split(',')
    .map(x => x.trim())
    .map(x => (x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x))
    .filter(Boolean);
}

async function getUserProfile(req, res) {
  try {
    // Prefer email from authenticated user if present
    const emailFromToken = req.user && req.user.email;
    const { email: emailFromBody } = req.body || {};
    const email = emailFromToken || emailFromBody;
    const pool = req.app.locals.pool;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const tables = [
      { table: 'members', role: 'member', column: 'email' },
      { table: 'communities', role: 'community', column: 'email' },
      { table: 'sponsors', role: 'sponsor', column: 'email' },
      { table: 'venues', role: 'venue', column: 'contact_email' }
    ];
    for (const { table, role, column } of tables) {
      const result = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1`, [email]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        if (role === 'member') {
          const normalized = {
            ...row,
            interests: typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests,
            pronouns: parsePgTextArrayForAuth(row.pronouns),
            location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location,
          };
          return res.json({ role, profile: normalized });
        }
        return res.json({ role, profile: row });
      }
    }
    res.status(404).json({ error: "User not found" });
  } catch (err) {
    console.error("/auth/get-user-profile error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
}

module.exports = { sendOtp, verifyOtp, callback, me, checkEmail, getUserProfile, loginStart, refresh, validateToken };


