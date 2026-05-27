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

    // DIAGNOSTIC: First check if token exists at all (ignoring expiry)
    const diagnosticResult = await pool.query(
      `SELECT id, user_id, user_type, device_id, expires_at, 
              expires_at > NOW() as is_valid,
              NOW() as current_time
       FROM sessions 
       WHERE refresh_token = $1`,
      [refreshToken]
    );

    if (diagnosticResult.rows.length === 0) {
      console.error(
        "[Auth] ❌ REFRESH FAILED: Token not found in database at all"
      );
      console.error(
        "[Auth] Token preview:",
        refreshToken.substring(0, 16) + "..."
      );
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const diagnosticSession = diagnosticResult.rows[0];
    console.log("[Auth] 🔍 Session found for token:", {
      sessionId: diagnosticSession.id,
      userId: diagnosticSession.user_id,
      userType: diagnosticSession.user_type,
      deviceId: diagnosticSession.device_id?.substring(0, 8) + "...",
      expiresAt: diagnosticSession.expires_at,
      currentTime: diagnosticSession.current_time,
      isValid: diagnosticSession.is_valid,
    });

    if (!diagnosticSession.is_valid) {
      console.error("[Auth] ❌ REFRESH FAILED: Session EXPIRED");
      console.error("[Auth] Expired at:", diagnosticSession.expires_at);
      console.error("[Auth] Current time:", diagnosticSession.current_time);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    // Find session by refresh token only (device_id not required for refresh)
    // Refresh tokens are 64-character hex strings (256-bit entropy) - secure without device binding
    // This fixes token loss when signup creates session with different device_id than app uses
    const result = await pool.query(
      `SELECT * FROM sessions 
       WHERE refresh_token = $1 AND expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      // This shouldn't happen now, but keep as safety net
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
 * Find all accounts across all tables by email.
 * Single UNION ALL query — one round-trip instead of four sequential awaits.
 */
async function findAccountsByEmail(pool, email) {
  const emailLower = email.toLowerCase().trim();

  const result = await pool.query(
    `SELECT id, 'member'    AS type, name,           username, profile_photo_url AS avatar, email
     FROM members    WHERE LOWER(email)         = $1
     UNION ALL
     SELECT id, 'community' AS type, name,           username, logo_url           AS avatar, email
     FROM communities WHERE LOWER(email)         = $1
     UNION ALL
     SELECT id, 'sponsor'   AS type, brand_name,     username, logo_url           AS avatar, email
     FROM sponsors   WHERE LOWER(email)         = $1
     UNION ALL
     SELECT id, 'venue'     AS type, name,           username, NULL::text         AS avatar, contact_email AS email
     FROM venues     WHERE LOWER(contact_email)  = $1`,
    [emailLower]
  );

  return result.rows;
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
 * Classify a device into a price tier for AQI demographic signal.
 * Uses brand + model name pattern matching.
 * Tiers: ultra_premium | premium | mid | budget | other
 */
function classifyDeviceTier(brand, modelName) {
  if (!brand) return 'other';

  const b = brand.toLowerCase();
  const m = (modelName || '').toLowerCase();

  if (b === 'apple') {
    // Pro/Max models: iPhone 12 Pro and above
    if (m.match(/iphone\s*(1[2-9]|[2-9]\d)\s*(pro|max)/)) return 'ultra_premium';
    if (m.match(/iphone\s*(1[2-9]|[2-9]\d)/)) return 'premium'; // iPhone 12+
    if (m.match(/iphone\s*(1[0-1])/)) return 'mid';              // iPhone X, 11
    return 'mid'; // older iPhones
  }

  if (b === 'samsung') {
    if (m.match(/galaxy\s*(s|z|fold|flip)\s*(2[0-9]|1[5-9])/)) return 'premium'; // S20+, Z Fold
    if (m.match(/galaxy\s*a\s*(5[0-9]|[6-9]\d)/)) return 'mid'; // A50+
    if (m.match(/galaxy\s*a/)) return 'mid';
    return 'budget';
  }

  if (b === 'oneplus') {
    if (m.match(/oneplus\s*(1[0-9]|[2-9]\d)/)) return 'premium'; // OnePlus 10+
    if (m.includes('pro') || m.includes('ultra')) return 'mid';
    return 'mid';
  }

  if (b === 'google') {
    if (m.match(/pixel\s*[7-9]/)) return 'premium';
    return 'mid';
  }

  // Budget-dominant brands
  if (['xiaomi', 'redmi', 'poco', 'realme', 'vivo', 'oppo', 'itel', 'tecno', 'infinix'].includes(b)) {
    if (m.includes('ultra') || m.includes('pro max')) return 'mid';
    if (m.includes('pro') || m.includes('plus')) return 'mid';
    return 'budget';
  }

  return 'other';
}

/**
 * Resolve which of the user's devices is the "primary" device based on usage
 * duration across all sessions, then sync the result to user_aqi_signals.
 *
 * Logic:
 *   1. Query all member sessions for this user that have device info
 *   2. Compute a usage_score per session:
 *        usage_score = duration_days × recency_weight
 *        recency_weight = 1.0 if active in last 90 days, 0.5 if 90–365 days, 0.2 if older
 *   3. Group sessions by device_brand + device_tier (same device may have multiple sessions
 *      due to reinstalls or token refreshes)
 *   4. The brand+tier combination with the highest total usage_score wins
 *   5. If the current login device is within 15% of the winner, prefer the current device
 *      (avoids micro-swings between devices used roughly equally)
 *   6. Writes the winning device info to user_aqi_signals
 */
async function resolvePrimaryDeviceAndSync(pool, userId, currentPlatform, currentBrand, currentModel, currentTier) {
  // Always register the current session's device info first (brand/model/tier may be null
  // in older sessions that predate this feature)
  await pool.query(
    `UPDATE sessions
     SET device_brand = COALESCE(device_brand, $3),
         device_model = COALESCE(device_model, $4)
     WHERE user_id = $1 AND user_type = 'member'
       AND device_id = (
         SELECT device_id FROM sessions
         WHERE user_id = $1 AND user_type = 'member'
         ORDER BY last_used_at DESC LIMIT 1
       )`,
    [userId, 'member', currentBrand, currentModel],
  );

  // Query all sessions with known device info
  const { rows } = await pool.query(
    `SELECT
       device_brand,
       device_tier,
       device_platform,
       device_model,
       GREATEST(
         EXTRACT(EPOCH FROM (last_used_at - created_at)) / 86400,
         0
       ) AS duration_days,
       CASE
         WHEN last_used_at > NOW() - INTERVAL '90 days'  THEN 1.0
         WHEN last_used_at > NOW() - INTERVAL '365 days' THEN 0.5
         ELSE 0.2
       END AS recency_weight
     FROM sessions
     WHERE user_id = $1
       AND user_type = 'member'
       AND device_brand IS NOT NULL
       AND device_tier   IS NOT NULL
       AND device_tier   != 'other'`,
    [userId],
  );

  if (rows.length === 0) {
    // No sessions with known device — write current device as a starting point
    if (currentBrand || currentPlatform) {
      await pool.query(
        `UPDATE user_aqi_signals
         SET device_platform  = COALESCE($2, device_platform),
             device_brand     = COALESCE($3, device_brand),
             device_model_raw = COALESCE($4, device_model_raw),
             device_tier      = COALESCE($5, device_tier)
         WHERE user_id = $1`,
        [userId, currentPlatform, currentBrand, currentModel, currentTier],
      );
    }
    return;
  }

  // Group and aggregate usage_score by (device_brand, device_tier)
  const scoreMap = {};
  for (const row of rows) {
    const key = `${row.device_brand}::${row.device_tier}`;
    if (!scoreMap[key]) {
      scoreMap[key] = {
        brand: row.device_brand,
        tier: row.device_tier,
        platform: row.device_platform,
        model: row.device_model,
        totalScore: 0,
      };
    }
    scoreMap[key].totalScore += parseFloat(row.duration_days) * parseFloat(row.recency_weight);
  }

  // Find the dominant device (highest total usage score)
  let dominant = null;
  for (const entry of Object.values(scoreMap)) {
    if (!dominant || entry.totalScore > dominant.totalScore) {
      dominant = entry;
    }
  }

  // Find current device's score in the map
  const currentKey = `${currentBrand}::${currentTier}`;
  const currentScore = scoreMap[currentKey]?.totalScore || 0;

  // If current device is within 15% of dominant, prefer current (the live, known device)
  const primaryDevice = (currentScore >= dominant.totalScore * 0.85 && currentBrand)
    ? { brand: currentBrand, tier: currentTier, platform: currentPlatform, model: currentModel }
    : dominant;

  // Log a device change event if the primary device shifted (for analysis)
  const { rows: existing } = await pool.query(
    `SELECT device_brand, device_tier FROM user_aqi_signals WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  const prevBrand = existing[0]?.device_brand;
  const prevTier  = existing[0]?.device_tier;
  if (prevBrand && prevBrand !== primaryDevice.brand) {
    console.log(
      `[Auth] 📱 Device shift detected for user ${userId}:`,
      `${prevBrand}(${prevTier}) → ${primaryDevice.brand}(${primaryDevice.tier})`,
      `based on ${dominant.totalScore.toFixed(1)} usage-days`,
    );
  }

  // Sync dominant device to AQI signals
  await pool.query(
    `UPDATE user_aqi_signals
     SET device_platform  = $2,
         device_brand     = $3,
         device_model_raw = COALESCE($4, device_model_raw),
         device_tier      = $5
     WHERE user_id = $1`,
    [userId, primaryDevice.platform, primaryDevice.brand, primaryDevice.model, primaryDevice.tier],
  );
}

/**
 * Create session in database
 * @param {Object} deviceInfo - Optional device info { platform, osVersion, deviceModel, deviceBrand, isPhysicalDevice }
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
  const platform      = deviceInfo.platform      || null;
  const osVersion     = deviceInfo.osVersion     || null;
  const deviceModel   = deviceInfo.deviceModel   || null;
  const deviceBrand   = deviceInfo.deviceBrand   || null;
  const isPhysical    = deviceInfo.isPhysicalDevice !== false; // treat null as physical

  // Classify device tier — used for AQI demographic signal
  const deviceTier = classifyDeviceTier(deviceBrand, deviceModel);

  // Upsert session (replace existing session for same user+device)
  const result = await pool.query(
    `INSERT INTO sessions (user_id, user_type, device_id, access_token, refresh_token, expires_at, platform, os_version, device_model, device_brand, device_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, user_type, device_id)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       last_used_at = NOW(),
       platform     = COALESCE(EXCLUDED.platform, sessions.platform),
       os_version   = COALESCE(EXCLUDED.os_version, sessions.os_version),
       device_model = COALESCE(EXCLUDED.device_model, sessions.device_model),
       device_brand = COALESCE(EXCLUDED.device_brand, sessions.device_brand),
       device_tier  = COALESCE(EXCLUDED.device_tier, sessions.device_tier)
     RETURNING *`,
    [userId, userType, deviceId, accessToken, refreshToken, expiresAt,
     platform, osVersion, deviceModel, deviceBrand, deviceTier],
  );

  // Sync primary device into user_aqi_signals (member only, non-blocking).
  // Uses duration-weighted device resolution: if the user registered on an iPhone
  // but has used a different phone for longer, the longer-used device wins.
  // Duration = last_used_at - created_at per session (proxy for usage time).
  // Simulators/emulators are excluded to avoid polluting the signal.
  if (userType === 'member' && isPhysical) {
    resolvePrimaryDeviceAndSync(pool, userId, platform, deviceBrand, deviceModel, deviceTier)
      .catch(err => console.error('[Auth] primary device AQI sync failed:', err.message));
  }

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
