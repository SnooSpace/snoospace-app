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
      pool.query("SELECT 1 FROM venues WHERE contact_email = $1 LIMIT 1", [
        email,
      ]),
    ];
    const results = await Promise.allSettled(queries);
    const exists = results
      .filter((r) => r.status === "fulfilled")
      .some((r) => r.value.rows.length > 0);

    if (exists) {
      return res
        .status(409)
        .json({ error: "Account already exists. Please login instead." });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
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
    const { email: inputEmail, username: inputUsername } = req.body || {};
    const pool = req.app.locals.pool;

    if (!pool) {
      console.error("/auth/login/start error: pool is not initialized");
      return res.status(500).json({ error: "Server DB not ready" });
    }

    // Determine if input is email or username
    let email = inputEmail;
    let usernameProvided = inputUsername;
    let loginViaUsername = false;
    let targetAccount = null; // The specific account when logging in via username

    // If email looks like a username (no @ symbol), treat it as username
    if (email && !email.includes("@")) {
      usernameProvided = email;
      email = null;
    }

    // If username is provided, look up the associated email AND account info
    if (usernameProvided && !email) {
      const usernameLower = usernameProvided.toLowerCase().trim();
      loginViaUsername = true;

      // Search all user tables for this username - include account details
      const queries = await Promise.all([
        pool.query(
          "SELECT id, 'member' as type, name, username, profile_photo_url as avatar, email FROM members WHERE LOWER(username) = $1 LIMIT 1",
          [usernameLower]
        ),
        pool.query(
          "SELECT id, 'community' as type, name, username, logo_url as avatar, email FROM communities WHERE LOWER(username) = $1 LIMIT 1",
          [usernameLower]
        ),
        pool.query(
          "SELECT id, 'sponsor' as type, brand_name as name, username, logo_url as avatar, email FROM sponsors WHERE LOWER(username) = $1 LIMIT 1",
          [usernameLower]
        ),
        pool.query(
          "SELECT id, 'venue' as type, name, username, logo_url as avatar, contact_email as email FROM venues WHERE LOWER(username) = $1 LIMIT 1",
          [usernameLower]
        ),
      ]);

      // Find the first matching account
      for (const result of queries) {
        if (result.rows.length > 0 && result.rows[0].email) {
          targetAccount = result.rows[0];
          email = result.rows[0].email;
          break;
        }
      }

      if (!email) {
        return res
          .status(404)
          .json({ error: "No account found with this username." });
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Email or username is required" });
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
        const r = await pool.query(
          `SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`,
          [email]
        );
        return r.rows.length > 0;
      } catch (_) {
        return false;
      }
    }

    const checks = await Promise.all([
      existsIn("members", "email"),
      existsIn("communities", "email"),
      existsIn("sponsors", "email"),
      existsIn("venues", "contact_email"),
    ]);
    const exists = checks.some(Boolean);

    if (!exists) {
      return res
        .status(404)
        .json({ error: "Account doesn't exist. Please sign up." });
    }

    console.log(
      "[Auth] Sending login OTP to:",
      email,
      "viaUsername:",
      loginViaUsername
    );
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: undefined },
    });

    if (error) return res.status(400).json({ error: error.message });

    // Return the email and login method info so frontend can handle appropriately
    res.json({
      message: "Login code sent to email",
      email,
      loginViaUsername,
      targetAccount, // Only set when logging in via username - allows direct login
      data,
    });
  } catch (err) {
    console.error(
      "/auth/login/start error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({
      error: "Failed to initiate login",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
    });
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

    // Log the Supabase user ID for debugging multi-account issues
    const supabaseUserId = data?.user?.id;
    const supabaseUserEmail = data?.user?.email;
    console.log("[OTP Verify] ✅ OTP verified successfully");
    console.log("[OTP Verify] Supabase user returned:", {
      userId: supabaseUserId,
      email: supabaseUserEmail,
      requestedEmail: email,
      emailMatch: supabaseUserEmail === email,
    });

    if (supabaseUserEmail !== email) {
      console.error(
        "[OTP Verify] ⚠️ EMAIL MISMATCH: Supabase returned different email!"
      );
      console.error(
        "[OTP Verify] This could indicate linked accounts or session reuse"
      );
    }

    res.json({ message: "OTP verified successfully", data });
  } catch (err) {
    console.error(
      "/auth/verify-otp error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({
      error: "Failed to verify OTP",
      message: err && err.message ? err.message : undefined,
    });
  }
}

async function refresh(req, res) {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required" });
    }
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    res.json({ message: "refreshed", data });
  } catch (err) {
    console.error("/auth/refresh error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
}

function callback(req, res) {
  const { access_token, refresh_token, error } = req.query;
  if (error) {
    return res
      .status(400)
      .json({ error: "Authentication failed", details: error });
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
    const result = await pool.query("SELECT * FROM members WHERE email = $1", [
      email,
    ]);
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
      return res.status(401).json({ valid: false, error: "Invalid user data" });
    }

    // Fetch fresh user data
    const tables = {
      member: "members",
      community: "communities",
      sponsor: "sponsors",
      venue: "venues",
    };

    const table = tables[userType];
    if (!table) {
      return res.status(400).json({ valid: false, error: "Invalid user type" });
    }

    const result = await pool.query(
      `SELECT id, username FROM ${table} WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        id: userId,
        type: userType,
        email: email,
        username: result.rows[0].username,
      },
    });
  } catch (err) {
    console.error("/auth/validate-token error:", err);
    res.status(500).json({ valid: false, error: "Failed to validate token" });
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
      pool.query("SELECT 1 FROM members WHERE email = $1", [email]),
      pool.query("SELECT 1 FROM communities WHERE email = $1", [email]),
      pool.query("SELECT 1 FROM sponsors WHERE email = $1", [email]),
      pool.query("SELECT 1 FROM venues WHERE contact_email = $1", [email]),
    ];
    const results = await Promise.all(queries);
    const exists = results.some((result) => result.rows.length > 0);
    res.json({ exists });
  } catch (err) {
    console.error("/auth/check-email error:", err);
    res.status(500).json({ error: "Failed to check email" });
  }
}

function parsePgTextArrayForAuth(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return [s];
  const inner = s.slice(1, -1);
  if (!inner) return [];
  return inner
    .split(",")
    .map((x) => x.trim())
    .map((x) => (x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1) : x))
    .filter(Boolean);
}

async function getUserProfile(req, res) {
  try {
    const pool = req.app.locals.pool;

    // PRIORITY 1: Use user ID and type from authenticated token (most reliable)
    const userIdFromToken = req.user?.id;
    const userTypeFromToken = req.user?.type;

    // PRIORITY 2: Fallback to email if no token user data
    const emailFromToken = req.user?.email;
    const { email: emailFromBody } = req.body || {};
    const email = emailFromToken || emailFromBody;

    // If we have user ID and type from token, use those directly (fixes multi-account same-email issue)
    if (userIdFromToken && userTypeFromToken) {
      const tableMap = {
        member: { table: "members", role: "member" },
        community: { table: "communities", role: "community" },
        sponsor: { table: "sponsors", role: "sponsor" },
        venue: { table: "venues", role: "venue" },
      };

      const config = tableMap[userTypeFromToken];
      if (config) {
        const result = await pool.query(
          `SELECT * FROM ${config.table} WHERE id = $1`,
          [userIdFromToken]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          if (config.role === "member") {
            const normalized = {
              ...row,
              interests:
                typeof row.interests === "string"
                  ? JSON.parse(row.interests)
                  : row.interests,
              pronouns: parsePgTextArrayForAuth(row.pronouns),
              location:
                typeof row.location === "string"
                  ? JSON.parse(row.location)
                  : row.location,
            };
            return res.json({ role: config.role, profile: normalized });
          }
          return res.json({ role: config.role, profile: row });
        }
      }
    }

    // Fallback: lookup by email (legacy behavior)
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const tables = [
      { table: "members", role: "member", column: "email" },
      { table: "communities", role: "community", column: "email" },
      { table: "sponsors", role: "sponsor", column: "email" },
      { table: "venues", role: "venue", column: "contact_email" },
    ];
    for (const { table, role, column } of tables) {
      const result = await pool.query(
        `SELECT * FROM ${table} WHERE ${column} = $1`,
        [email]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        if (role === "member") {
          const normalized = {
            ...row,
            interests:
              typeof row.interests === "string"
                ? JSON.parse(row.interests)
                : row.interests,
            pronouns: parsePgTextArrayForAuth(row.pronouns),
            location:
              typeof row.location === "string"
                ? JSON.parse(row.location)
                : row.location,
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

module.exports = {
  sendOtp,
  verifyOtp,
  callback,
  me,
  checkEmail,
  getUserProfile,
  loginStart,
  refresh,
  validateToken,
};
