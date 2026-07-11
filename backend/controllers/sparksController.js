/**
 * sparksController.js
 *
 * Handles all Sparks API endpoints:
 *   GET  /api/sparks               — system sparks grouped by category
 *   GET  /api/sparks/search        — trigram similarity search
 *   GET  /members/me/sparks        — authenticated user's sparks
 *   POST /members/me/sparks        — add a spark to user's profile
 *   DELETE /members/me/sparks/:id  — remove a spark from user's profile
 *   POST /sparks/custom            — create a custom spark (with dedup check)
 */

// ── GET /api/sparks ──────────────────────────────────────────────────────────
/**
 * Returns all active system sparks grouped by category.
 * Within each category, sparks are sorted by usage_count DESC.
 */
const getSystemSparks = async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(`
      SELECT id, label, normalized_label, category, spark_type,
             requires_date_range, requires_location, usage_count
      FROM sparks
      WHERE is_system = true AND is_active = true
      ORDER BY category ASC, usage_count DESC
    `);

    // Group by category
    const grouped = {};
    const CATEGORY_ORDER = ['professional', 'social', 'activity', 'learning', 'travel'];

    for (const spark of result.rows) {
      if (!grouped[spark.category]) grouped[spark.category] = [];
      grouped[spark.category].push(spark);
    }

    // Build ordered array of categories
    const categories = CATEGORY_ORDER
      .filter(cat => grouped[cat])
      .map(cat => ({
        category: cat,
        sparks: grouped[cat],
      }));

    res.json({ success: true, categories });
  } catch (err) {
    console.error('[SparksController] getSystemSparks error:', err.message);
    res.status(500).json({ error: 'Failed to load sparks' });
  }
};

// ── GET /api/sparks/search ───────────────────────────────────────────────────
/**
 * Trigram similarity search on normalized_label.
 * Query params:
 *   q        {string} — required, 2+ characters
 *   category {string} — optional filter
 *
 * Returns up to 20 results ranked by similarity DESC, usage_count DESC.
 * Threshold: similarity >= 0.1 (low enough for partial word matching in short fields).
 */
const searchSparks = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const q = (req.query.q || '').trim().toLowerCase();
    const category = req.query.category || null;

    if (q.length < 2) {
      return res.json({ success: true, sparks: [] });
    }

    const params = [q];
    let categoryClause = '';
    if (category && ['professional','social','activity','learning','travel'].includes(category)) {
      params.push(category);
      categoryClause = `AND category = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        id, label, normalized_label, category, spark_type,
        requires_date_range, requires_location, usage_count,
        similarity(normalized_label, $1) AS sim
      FROM sparks
      WHERE is_active = true
        AND similarity(normalized_label, $1) >= 0.1
        ${categoryClause}
      ORDER BY sim DESC, usage_count DESC
      LIMIT 20
    `, params);

    res.json({ success: true, sparks: result.rows });
  } catch (err) {
    console.error('[SparksController] searchSparks error:', err.message);
    res.status(500).json({ error: 'Failed to search sparks' });
  }
};

// ── GET /members/me/sparks ───────────────────────────────────────────────────
/**
 * Returns the authenticated user's sparks with full spark details.
 */
const getUserSparks = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(`
      SELECT
        s.id, s.label, s.normalized_label, s.category, s.spark_type,
        s.requires_date_range, s.requires_location, s.usage_count,
        us.start_date, us.end_date, us.target_city, us.is_expired, us.added_at
      FROM user_sparks us
      JOIN sparks s ON s.id = us.spark_id
      WHERE us.user_id = $1
        AND us.is_expired = false
      ORDER BY us.added_at ASC
    `, [userId]);

    res.json({ success: true, sparks: result.rows });
  } catch (err) {
    console.error('[SparksController] getUserSparks error:', err.message);
    res.status(500).json({ error: 'Failed to load user sparks' });
  }
};

// ── POST /members/me/sparks ──────────────────────────────────────────────────
/**
 * Add a spark to the authenticated user's profile.
 * Body: { spark_id: BIGINT, start_date?: DATE, end_date?: DATE }
 *
 * - Max 5 active sparks per user.
 * - Travel sparks require both start_date and end_date.
 * - end_date must be >= start_date for travel sparks.
 * - Increments usage_count on the spark.
 */
const addUserSpark = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { spark_id, start_date, end_date, target_city } = req.body || {};

    if (!spark_id) {
      return res.status(400).json({ error: 'spark_id is required' });
    }

    // Verify spark exists and is active
    const sparkResult = await pool.query(
      'SELECT id, requires_date_range, requires_location, is_active FROM sparks WHERE id = $1',
      [spark_id]
    );
    if (sparkResult.rows.length === 0 || !sparkResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Spark not found or inactive' });
    }

    const spark = sparkResult.rows[0];

    // Travel sparks require date range
    if (spark.requires_date_range) {
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Travel sparks require start_date and end_date' });
      }
      if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'end_date must be on or after start_date' });
      }
    }

    // Location sparks require target_city
    if (spark.requires_location && !target_city?.trim()) {
      return res.status(400).json({ error: 'This spark requires a target city' });
    }

    // Check user spark count (max 5 active)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_sparks WHERE user_id = $1 AND is_expired = false',
      [userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= 5) {
      return res.status(400).json({ error: 'Maximum 5 sparks allowed. Remove one to add another.' });
    }

    // Check if already added
    const existingResult = await pool.query(
      'SELECT spark_id FROM user_sparks WHERE user_id = $1 AND spark_id = $2',
      [userId, spark_id]
    );
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Spark already added to your profile' });
    }

    // Insert user_spark
    await pool.query(`
      INSERT INTO user_sparks (user_id, spark_id, start_date, end_date, target_city)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      spark_id,
      spark.requires_date_range ? start_date : null,
      spark.requires_date_range ? end_date   : null,
      spark.requires_location   ? (target_city?.trim() ?? null) : null,
    ]);

    // Increment usage count
    await pool.query(
      'UPDATE sparks SET usage_count = usage_count + 1 WHERE id = $1',
      [spark_id]
    );

    res.json({ success: true, message: 'Spark added' });
  } catch (err) {
    console.error('[SparksController] addUserSpark error:', err.message);
    res.status(500).json({ error: 'Failed to add spark' });
  }
};

// ── DELETE /members/me/sparks/:sparkId ──────────────────────────────────────
/**
 * Remove a spark from the authenticated user's profile.
 * Decrements usage_count (clamped to 0).
 */
const removeUserSpark = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sparkId } = req.params;
    if (!sparkId) {
      return res.status(400).json({ error: 'sparkId is required' });
    }

    const result = await pool.query(
      'DELETE FROM user_sparks WHERE user_id = $1 AND spark_id = $2 RETURNING spark_id',
      [userId, sparkId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spark not found on your profile' });
    }

    // Decrement usage count (clamp to 0)
    await pool.query(
      'UPDATE sparks SET usage_count = GREATEST(0, usage_count - 1) WHERE id = $1',
      [sparkId]
    );

    res.json({ success: true, message: 'Spark removed' });
  } catch (err) {
    console.error('[SparksController] removeUserSpark error:', err.message);
    res.status(500).json({ error: 'Failed to remove spark' });
  }
};

// ── POST /sparks/custom ──────────────────────────────────────────────────────
/**
 * Create a custom spark (user-generated).
 *
 * Body: { label: string, category: string, force?: boolean }
 *
 * Flow:
 *  1. Normalize label → normalized_label
 *  2. Run trigram similarity (threshold 0.4) against all existing sparks
 *  3. If similar sparks found AND force !== true → return suggestions, don't create
 *  4. If force === true (user confirmed) OR no similar sparks → create the spark
 *  5. Also insert into user_sparks for the calling user
 */
const createCustomSpark = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { label, category, force = false, start_date, end_date, target_city } = req.body || {};

    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'label is required' });
    }

    const VALID_CATEGORIES = ['professional','social','activity','learning','travel'];
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const trimmedLabel = label.trim();
    if (trimmedLabel.length < 3 || trimmedLabel.length > 60) {
      return res.status(400).json({ error: 'Spark label must be 3–60 characters' });
    }

    const normalizedLabel = trimmedLabel.toLowerCase();

    // Step 1: Check for similar sparks
    const similarResult = await pool.query(`
      SELECT id, label, category, requires_date_range, requires_location,
             similarity(normalized_label, $1) AS sim
      FROM sparks
      WHERE is_active = true
        AND similarity(normalized_label, $1) >= 0.4
      ORDER BY sim DESC
      LIMIT 3
    `, [normalizedLabel]);

    if (similarResult.rows.length > 0 && !force) {
      return res.status(200).json({
        success: false,
        action: 'suggest',
        suggestions: similarResult.rows,
        message: 'Similar sparks already exist. Did you mean one of these?',
      });
    }

    // Check user spark count (max 5 active)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_sparks WHERE user_id = $1 AND is_expired = false',
      [userId]
    );
    if (parseInt(countResult.rows[0].count, 10) >= 5) {
      return res.status(400).json({ error: 'Maximum 5 sparks allowed. Remove one to add another.' });
    }

    // Travel sparks require date range
    const requiresDateRange = category === 'travel';
    if (requiresDateRange) {
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Travel sparks require start_date and end_date' });
      }
      if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ error: 'end_date must be on or after start_date' });
      }
    }

    // Step 2: Create the spark
    const newSpark = await pool.query(`
      INSERT INTO sparks (label, normalized_label, category, requires_date_range, requires_location, is_system, created_by, usage_count)
      VALUES ($1, $2, $3, $4, false, false, $5, 1)
      RETURNING id, label, category, requires_date_range, requires_location
    `, [trimmedLabel, normalizedLabel, category, requiresDateRange, userId]);

    const createdSpark = newSpark.rows[0];

    // Step 3: Add to user_sparks
    await pool.query(`
      INSERT INTO user_sparks (user_id, spark_id, start_date, end_date, target_city)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [
      userId,
      createdSpark.id,
      requiresDateRange ? start_date : null,
      requiresDateRange ? end_date : null,
      null, // custom sparks don't have requires_location
    ]);

    res.status(201).json({ success: true, spark: createdSpark });
  } catch (err) {
    console.error('[SparksController] createCustomSpark error:', err.message);
    res.status(500).json({ error: 'Failed to create custom spark' });
  }
};

module.exports = {
  getSystemSparks,
  searchSparks,
  getUserSparks,
  addUserSpark,
  removeUserSpark,
  createCustomSpark,
};
