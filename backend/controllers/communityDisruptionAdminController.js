/**
 * communityDisruptionAdminController.js
 *
 * Admin controller for listing community disruptions needing review
 * and reclassifying disruption reasons.
 */

const { createPool } = require('../config/db');
const { recomputeCommunityReliability } = require('../services/communityReliabilityService');

const pool = createPool();

/**
 * GET /admin/community-disruptions?status=needs_review
 *
 * List community disruptions filtered by status:
 *   - 'needs_review': needs_manual_review = true AND reviewed_at IS NULL
 *   - 'reviewed': reviewed_at IS NULL
 *   - 'all': all disruptions
 */
const listDisruptions = async (req, res) => {
  const { status = 'needs_review', page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

  try {
    const conditions = [];
    const params = [];

    if (status === 'needs_review') {
      conditions.push('cd.needs_manual_review = true AND cd.reviewed_at IS NULL');
    } else if (status === 'reviewed') {
      conditions.push('cd.reviewed_at IS NOT NULL');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM community_disruptions cd ${where}`,
      params,
    );
    const total = countRes.rows[0].count;

    params.push(parseInt(pageSize, 10), offset);
    const query = `
      SELECT
        cd.id,
        cd.community_id,
        cd.event_id,
        cd.disruption_type,
        cd.attendee_count,
        cd.reason_category,
        cd.reason_text,
        cd.is_genuine,
        cd.needs_manual_review,
        cd.reviewed_by,
        cd.reviewed_at,
        cd.created_at,
        c.name as community_name,
        c.username as community_username,
        c.logo_url as community_logo,
        e.title as event_title,
        a.name as reviewer_name
      FROM community_disruptions cd
      JOIN communities c ON c.id = cd.community_id
      JOIN events e ON e.id = cd.event_id
      LEFT JOIN admins a ON a.id = cd.reviewed_by
      ${where}
      ORDER BY cd.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const dataRes = await pool.query(query, params);

    return res.json({
      success: true,
      disruptions: dataRes.rows,
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      totalPages: Math.ceil(total / parseInt(pageSize, 10)) || 1,
    });
  } catch (err) {
    console.error('[communityDisruptionAdminController.listDisruptions]', err);
    return res.status(500).json({ error: 'Failed to fetch disruptions' });
  }
};

/**
 * PATCH /admin/community-disruptions/:id/reclassify
 *
 * Reclassify a disruption as genuine or non-genuine.
 * Sets reviewed_by, reviewed_at, and triggers recomputation of community reliability.
 *
 * Body: { is_genuine: boolean, review_notes?: string }
 */
const reclassifyDisruption = async (req, res) => {
  const adminId = req.admin?.id;
  const { id } = req.params;
  const { is_genuine, review_notes } = req.body;

  if (typeof is_genuine !== 'boolean') {
    return res.status(400).json({ error: 'is_genuine (boolean) is required' });
  }

  try {
    const existing = await pool.query(
      `SELECT id, community_id FROM community_disruptions WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Disruption not found' });
    }

    const disruption = existing.rows[0];

    const updateRes = await pool.query(
      `UPDATE community_disruptions
       SET is_genuine = $1,
           needs_manual_review = false,
           reviewed_by = $2,
           reviewed_at = NOW(),
           reason_text = CASE 
             WHEN $3::text IS NOT NULL AND $3::text != '' 
             THEN COALESCE(reason_text || E'\n[Admin Note]: ' || $3::text, $3::text)
             ELSE reason_text 
           END
       WHERE id = $4
       RETURNING *`,
      [is_genuine, adminId || null, review_notes || null, id],
    );

    // Recompute community reliability metrics from source
    const reliability = await recomputeCommunityReliability(pool, disruption.community_id);

    return res.json({
      success: true,
      disruption: updateRes.rows[0],
      community_reliability: reliability,
    });
  } catch (err) {
    console.error('[communityDisruptionAdminController.reclassifyDisruption]', err);
    return res.status(500).json({ error: 'Failed to reclassify disruption' });
  }
};

module.exports = {
  listDisruptions,
  reclassifyDisruption,
};
