/**
 * Username Controller
 *
 * Endpoints:
 *   GET  /api/users/check          — legacy availability check (signup flow, no suggestions)
 *   POST /username                 — set username for authenticated user
 *   GET  /api/username/check       — NEW: debounced availability check with batched suggestions
 */

const { createPool } = require('../config/db');
const { generateCandidates, sanitizeBase, RESERVED_WORDS } = require('../services/username/suggestionEngine');

// Re-use a single pool instance (pattern matches rest of codebase)
const pool = createPool();

// ─── Tables that hold usernames ───────────────────────────────────────────────
const USERNAME_TABLES = ['members', 'communities', 'sponsors', 'venues'];

/**
 * Helper: check whether a lowercase username is taken across all user tables.
 * Uses UNION ALL so it hits the DB in a single round-trip.
 *
 * @param {string} lowerUsername - Already-lowercased username to check
 * @returns {Promise<boolean>}
 */
async function isUsernameTaken(lowerUsername) {
  // Check each table with EXISTS — stops at first hit, uses the lower() index
  for (const table of USERNAME_TABLES) {
    const { rows } = await pool.query(
      `SELECT 1 FROM ${table} WHERE lower(username) = $1 LIMIT 1`,
      [lowerUsername]
    );
    if (rows.length > 0) return true;
  }
  return false;
}

/**
 * Helper: batch-check a list of candidate usernames across all user tables.
 * Returns a Set of lowercased usernames that are already taken.
 *
 * @param {string[]} candidates
 * @returns {Promise<Set<string>>}
 */
async function batchGetTakenUsernames(candidates) {
  if (candidates.length === 0) return new Set();

  const unionQuery = USERNAME_TABLES.map(
    t => `SELECT lower(username) AS u FROM ${t} WHERE lower(username) = ANY($1::text[])`
  ).join(' UNION ALL ');

  const { rows } = await pool.query(
    `SELECT DISTINCT u FROM (${unionQuery}) AS combined`,
    [candidates]
  );
  return new Set(rows.map(r => r.u));
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: GET /api/username/check?u=<username>
// Debounce-friendly endpoint with batched suggestion generation.
// Protected by usernameCheckRateLimiter (applied in routes/index.js).
// ─────────────────────────────────────────────────────────────────────────────
const checkUsernameWithSuggestions = async (req, res) => {
  try {
    const raw = req.query.u;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'Missing username parameter' });
    }

    const desired = sanitizeBase(raw);

    if (desired.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (desired.length > 30) {
      return res.status(400).json({ error: 'Username must be at most 30 characters' });
    }

    // Reserved word — immediately unavailable, generate alternatives
    if (RESERVED_WORDS.includes(desired)) {
      return res.json({ available: false, suggestions: generateCandidates(desired) });
    }

    const taken = await isUsernameTaken(desired);

    if (!taken) {
      return res.json({ available: true, suggestions: [] });
    }

    // Username taken — batch-check all candidates in ONE query
    const candidates = generateCandidates(desired);
    if (candidates.length === 0) {
      return res.json({ available: false, suggestions: [] });
    }

    const takenSet = await batchGetTakenUsernames(candidates);
    const suggestions = candidates.filter(c => !takenSet.has(c)).slice(0, 5);

    return res.json({ available: false, suggestions });
  } catch (err) {
    console.error('[username-check] error:', err);
    return res.status(500).json({ error: 'Internal error checking username' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: GET /api/users/check  (used during signup — kept for backwards compat)
// Reads from req.query.username OR req.body.username to cover both call styles.
// ─────────────────────────────────────────────────────────────────────────────
const checkUsername = async (req, res) => {
  try {
    const username = req.query.username || req.body?.username;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots',
      });
    }

    const taken = await isUsernameTaken(username.toLowerCase());

    res.json({ available: !taken, username });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Set username for authenticated user
// ─────────────────────────────────────────────────────────────────────────────
const setUsername = async (req, res) => {
  try {
    const { username, userType, communityId } = req.body;
    const userId = communityId || req.user?.id;

    console.log('[setUsername] Request:', { username, userType, communityId, fallbackUserId: req.user?.id, finalUserId: userId });

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!username || !userType) {
      return res.status(400).json({ error: 'Username and userType are required' });
    }

    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots',
      });
    }

    const validUserTypes = ['member', 'community', 'sponsor', 'venue'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const taken = await isUsernameTaken(username.toLowerCase());
    if (taken) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const tableMap = { member: 'members', community: 'communities', sponsor: 'sponsors', venue: 'venues' };
    const tableName = tableMap[userType];

    console.log('[setUsername] Updating:', { tableName, username, userId });

    const result = await pool.query(
      `UPDATE ${tableName} SET username = $1 WHERE id = $2`,
      [username, userId]
    );

    console.log('[setUsername] Update result:', { rowCount: result.rowCount });

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, username, message: 'Username set successfully' });
  } catch (error) {
    console.error('Error setting username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  checkUsername,
  checkUsernameWithSuggestions,
  setUsername,
};
