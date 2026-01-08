const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

// JWT secret - should be in .env
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = "30d"; // Extended from 7d to 30d
const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_EXPIRES_DAYS = 90; // Extended from 30 to 90 days

/**
 * Generate a cryptographically secure refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

/**
 * Generate access token (JWT)
 */
function generateAccessToken(userId, userType, email) {
  return jwt.sign(
    {
      sub: `${userType}_${userId}`,
      userId: userId,
      userType: userType,
      email: email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Send OTP to email
 * Uses Supabase for OTP delivery only
 */
async function sendOtp(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    console.log("[Auth] Sending OTP to:", email);

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // Allow new emails
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      console.error("[Auth] OTP send error:", error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log("[Auth] OTP sent successfully to:", email);
    res.json({ message: "OTP sent to email", data });
  } catch (err) {
    console.error("[Auth] sendOtp error:", err.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

/**
 * Verify OTP and return matching accounts
 *
 * If 0 accounts: Return { accounts: [], requiresAccountCreation: true }
 * If 1 account: Auto-create session, return session + user
 * If multiple accounts: Return account list for picker
 */
async function verifyOtp(req, res) {
  try {
    const { email, token, deviceId, deviceInfo } = req.body;
    if (!email || !token) {
      return res
        .status(400)
        .json({ error: "Email and OTP token are required" });
    }

    console.log("[Auth] Verifying OTP for:", email);

    // Verify with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      console.error("[Auth] OTP verification failed:", error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log("[Auth] OTP verified successfully for:", email);

    // Find all accounts with this email across all tables
    const pool = req.app.locals.pool;
    const accounts = await findAccountsByEmail(pool, email);

    console.log("[Auth] Found", accounts.length, "accounts for email:", email);

    // Decision logic based on account count
    if (accounts.length === 0) {
      // No accounts - user needs to create one
      return res.json({
        emailVerified: true,
        accounts: [],
        requiresAccountCreation: true,
        email: email,
      });
    }

    if (accounts.length === 1) {
      // Exactly 1 account - auto-login (seamless migration)
      const account = accounts[0];
      console.log(
        "[Auth] Auto-login to single account:",
        account.id,
        account.type
      );

      // Create session if deviceId provided
      if (deviceId) {
        const session = await createSession(
          pool,
          account.id,
          account.type,
          deviceId,
          email,
          deviceInfo || {}
        );
        return res.json({
          emailVerified: true,
          accounts: [account],
          autoLogin: true,
          session: session,
          user: account,
        });
      }

      return res.json({
        emailVerified: true,
        accounts: [account],
        autoLogin: true,
      });
    }

    // Multiple accounts - return picker
    console.log("[Auth] Multiple accounts found, returning picker");
    return res.json({
      emailVerified: true,
      accounts: accounts,
      requiresAccountSelection: true,
    });
  } catch (err) {
    console.error("[Auth] verifyOtp error:", err.message);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
}

/**
 * Create session for a specific account
 * Called after account selection or during auto-login
 */
async function createSessionEndpoint(req, res) {
  try {
    const { userId, userType, deviceId, email, deviceInfo } = req.body;

    if (!userId || !userType || !deviceId) {
      return res
        .status(400)
        .json({ error: "userId, userType, and deviceId are required" });
    }

    const pool = req.app.locals.pool;

    // Verify account exists
    const account = await getAccountById(pool, userId, userType);
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    console.log("[Auth] Creating session for:", userType, userId);

    // Create session
    const session = await createSession(
      pool,
      userId,
      userType,
      deviceId,
      email || account.email,
      deviceInfo || {}
    );

    res.json({
      session: session,
      user: account,
    });
  } catch (err) {
    console.error("[Auth] createSession error:", err.message);
    res.status(500).json({ error: "Failed to create session" });
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken, deviceId } = req.body;

    console.log("[Auth] refreshToken called with:", {
      tokenLength: refreshToken?.length,
      tokenPreview: refreshToken
        ? `${refreshToken.substring(0, 16)}...${refreshToken.substring(
            refreshToken.length - 8
          )}`
        : "null",
      deviceId: deviceId?.substring(0, 8) + "...",
      isHex: refreshToken ? /^[0-9a-f]+$/i.test(refreshToken) : false,
    });

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const pool = req.app.locals.pool;

    // Find session by refresh token only (device_id not required for refresh)
    // Refresh tokens are 64-character hex strings (256-bit entropy) - secure without device binding
    // This fixes token loss when signup creates session with different device_id than app uses
    const result = await pool.query(
      `SELECT * FROM sessions 
       WHERE refresh_token = $1 AND expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const session = result.rows[0];
    console.log(
      "[Auth] Refreshing token for:",
      session.user_type,
      session.user_id
    );

    // Get user email for new token
    const account = await getAccountById(
      pool,
      session.user_id,
      session.user_type
    );
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(
      session.user_id,
      session.user_type,
      account.email
    );

    // IMPORTANT: Do NOT rotate refresh token to prevent auth failures
    // If the app closes before saving the new token, the old token would become invalid
    // causing users to be logged out unexpectedly
    const newRefreshToken = session.refresh_token; // Keep the same refresh token
    const newExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    await pool.query(
      `UPDATE sessions 
       SET access_token = $1, expires_at = $2, last_used_at = NOW()
       WHERE id = $3`,
      [newAccessToken, newExpiresAt, session.id]
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[Auth] refreshToken error:", err.message);
    res.status(500).json({ error: "Failed to refresh token" });
  }
}

/**
 * Logout - delete session for specific account
 */
async function logout(req, res) {
  try {
    const { userId, userType, deviceId } = req.body;

    if (!userId || !userType || !deviceId) {
      return res
        .status(400)
        .json({ error: "userId, userType, and deviceId are required" });
    }

    const pool = req.app.locals.pool;

    console.log(
      "[Auth] Logging out:",
      userType,
      userId,
      "from device:",
      deviceId
    );

    await pool.query(
      `DELETE FROM sessions 
       WHERE user_id = $1 AND user_type = $2 AND device_id = $3`,
      [userId, userType, deviceId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[Auth] logout error:", err.message);
    res.status(500).json({ error: "Failed to logout" });
  }
}

/**
 * Get all sessions for a device
 * Useful for restoring multi-account state on app launch
 */
async function getDeviceSessions(req, res) {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT s.*, 
        CASE 
          WHEN s.user_type = 'member' THEN (SELECT name FROM members WHERE id = s.user_id)
          WHEN s.user_type = 'community' THEN (SELECT name FROM communities WHERE id = s.user_id)
          WHEN s.user_type = 'sponsor' THEN (SELECT brand_name FROM sponsors WHERE id = s.user_id)
          WHEN s.user_type = 'venue' THEN (SELECT name FROM venues WHERE id = s.user_id)
        END as name,
        CASE 
          WHEN s.user_type = 'member' THEN (SELECT username FROM members WHERE id = s.user_id)
          WHEN s.user_type = 'community' THEN (SELECT username FROM communities WHERE id = s.user_id)
          WHEN s.user_type = 'sponsor' THEN (SELECT username FROM sponsors WHERE id = s.user_id)
          WHEN s.user_type = 'venue' THEN (SELECT username FROM venues WHERE id = s.user_id)
        END as username,
        CASE 
          WHEN s.user_type = 'member' THEN (SELECT profile_photo_url FROM members WHERE id = s.user_id)
          WHEN s.user_type = 'community' THEN (SELECT logo_url FROM communities WHERE id = s.user_id)
          WHEN s.user_type = 'sponsor' THEN (SELECT logo_url FROM sponsors WHERE id = s.user_id)
          WHEN s.user_type = 'venue' THEN (SELECT logo_url FROM venues WHERE id = s.user_id)
        END as avatar
       FROM sessions s
       WHERE s.device_id = $1 AND s.expires_at > NOW()
       ORDER BY s.last_used_at DESC`,
      [deviceId]
    );

    // Filter out expired/invalid sessions
    const validSessions = result.rows.filter((s) => s.name);

    res.json({ sessions: validSessions });
  } catch (err) {
    console.error("[Auth] getDeviceSessions error:", err.message);
    res.status(500).json({ error: "Failed to get sessions" });
  }
}

/**
 * Validate token - for auth middleware compatibility
 */
async function validateToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.substring(7);
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({ valid: false, error: "Invalid token" });
  }

  res.json({ valid: true, user: decoded });
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Find all accounts across all tables by email
 */
async function findAccountsByEmail(pool, email) {
  const emailLower = email.toLowerCase().trim();
  const accounts = [];

  // Members
  const members = await pool.query(
    `SELECT id, 'member' as type, name, username, profile_photo_url as avatar, email
     FROM members WHERE LOWER(email) = $1`,
    [emailLower]
  );
  accounts.push(...members.rows);

  // Communities
  const communities = await pool.query(
    `SELECT id, 'community' as type, name, username, logo_url as avatar, email
     FROM communities WHERE LOWER(email) = $1`,
    [emailLower]
  );
  accounts.push(...communities.rows);

  // Sponsors
  const sponsors = await pool.query(
    `SELECT id, 'sponsor' as type, brand_name as name, username, logo_url as avatar, email
     FROM sponsors WHERE LOWER(email) = $1`,
    [emailLower]
  );
  accounts.push(...sponsors.rows);

  // Venues
  const venues = await pool.query(
    `SELECT id, 'venue' as type, name, username, logo_url as avatar, contact_email as email
     FROM venues WHERE LOWER(contact_email) = $1`,
    [emailLower]
  );
  accounts.push(...venues.rows);

  return accounts;
}

/**
 * Get account by ID and type
 */
async function getAccountById(pool, userId, userType) {
  let query;
  switch (userType) {
    case "member":
      query = `SELECT id, 'member' as type, name, username, email, profile_photo_url as avatar 
               FROM members WHERE id = $1`;
      break;
    case "community":
      query = `SELECT id, 'community' as type, name, username, email, logo_url as avatar 
               FROM communities WHERE id = $1`;
      break;
    case "sponsor":
      query = `SELECT id, 'sponsor' as type, brand_name as name, username, email, logo_url as avatar 
               FROM sponsors WHERE id = $1`;
      break;
    case "venue":
      query = `SELECT id, 'venue' as type, name, username, contact_email as email, logo_url as avatar 
               FROM venues WHERE id = $1`;
      break;
    default:
      return null;
  }

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
}

/**
 * Create session in database
 * @param {Object} deviceInfo - Optional device info { platform, osVersion, deviceModel }
 */
async function createSession(
  pool,
  userId,
  userType,
  deviceId,
  email,
  deviceInfo = {}
) {
  const accessToken = generateAccessToken(userId, userType, email);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  // Extract device info
  const platform = deviceInfo.platform || null;
  const osVersion = deviceInfo.osVersion || null;
  const deviceModel = deviceInfo.deviceModel || null;

  // Upsert session (replace existing session for same user+device)
  const result = await pool.query(
    `INSERT INTO sessions (user_id, user_type, device_id, access_token, refresh_token, expires_at, platform, os_version, device_model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, user_type, device_id) 
     DO UPDATE SET 
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       last_used_at = NOW(),
       platform = COALESCE(EXCLUDED.platform, sessions.platform),
       os_version = COALESCE(EXCLUDED.os_version, sessions.os_version),
       device_model = COALESCE(EXCLUDED.device_model, sessions.device_model)
     RETURNING *`,
    [
      userId,
      userType,
      deviceId,
      accessToken,
      refreshToken,
      expiresAt,
      platform,
      osVersion,
      deviceModel,
    ]
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
    sessionId: result.rows[0].id,
  };
}

// Export for use in middleware
module.exports = {
  sendOtp,
  verifyOtp,
  createSessionEndpoint,
  refreshToken,
  logout,
  getDeviceSessions,
  validateToken,
  verifyAccessToken,
  generateAccessToken,
  createSession, // Export for use by signup controllers
};
