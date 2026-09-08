const { uploadVerificationDocument, getSignedDocumentUrl } = require('../services/communityDocumentStorage');

/**
 * Computes eligibility for a community to apply for verification.
 * 
 * Criteria:
 * 1. Primary head is a verified member (is_verified = true).
 * 2. Community age >= 14 days (created_at <= NOW() - 14 days).
 * 3. Activity gate: at least 1 active post by this community.
 */
async function computeEligibility(pool, communityId) {
  // 1. Primary head verification check (matches audit query)
  const headQuery = `
    SELECT 
      ch.id as head_id,
      ch.name as head_name,
      ch.is_primary,
      ch.member_id,
      ch.email,
      m.id as matched_member_id,
      m.name as matched_member_name,
      m.is_verified,
      m.verification_tier
    FROM community_heads ch
    LEFT JOIN members m ON (m.id = ch.member_id OR (ch.member_id IS NULL AND LOWER(m.email) = LOWER(ch.email)))
    WHERE ch.community_id = $1 AND ch.is_primary = true
    LIMIT 1
  `;
  const headRes = await pool.query(headQuery, [communityId]);
  const primaryHead = headRes.rows[0] || null;
  const hasVerifiedAdmin = !!(primaryHead && primaryHead.is_verified);
  const adminVerificationTier = primaryHead?.verification_tier || 'none';

  // 2. Age gate check (14 days minimum)
  const ageQuery = `
    SELECT 
      created_at,
      (created_at <= NOW() - INTERVAL '14 days') as meets_age,
      EXTRACT(DAY FROM (NOW() - created_at))::int as age_days
    FROM communities
    WHERE id = $1
  `;
  const ageRes = await pool.query(ageQuery, [communityId]);
  const ageData = ageRes.rows[0] || null;
  const meetsAgeRequirement = !!(ageData && ageData.meets_age);
  const communityAgeDays = ageData?.age_days ?? 0;

  // 3. Activity gate check (at least 1 active community post)
  const activityQuery = `
    SELECT EXISTS(
      SELECT 1 FROM posts
      WHERE author_id = $1 AND author_type = 'community' AND status = 'active'
    ) as meets_activity
  `;
  const actRes = await pool.query(activityQuery, [communityId]);
  const meetsActivityRequirement = !!actRes.rows[0]?.meets_activity;

  const eligible = hasVerifiedAdmin && meetsAgeRequirement && meetsActivityRequirement;

  return {
    hasVerifiedAdmin,
    adminVerificationTier,
    meetsAgeRequirement,
    communityAgeDays,
    meetsActivityRequirement,
    eligible,
  };
}

// ---------------------------------------------------------------------------
// GET /communities/verification/eligibility
// ---------------------------------------------------------------------------
async function getVerificationEligibility(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Forbidden: Community access only' });
    }

    const eligibility = await computeEligibility(pool, userId);
    return res.json(eligibility);
  } catch (err) {
    console.error('[communityVerificationController.getVerificationEligibility]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// POST /communities/verification/apply
// ---------------------------------------------------------------------------
async function applyVerification(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Forbidden: Community access only' });
    }

    const tier = (req.body?.tier || '').trim();
    if (!['community_verified', 'registered_org'].includes(tier)) {
      return res.status(400).json({
        error: 'invalid_tier',
        message: 'tier must be either "community_verified" or "registered_org"',
      });
    }

    // Tier B requires a document file (PDF up to 10MB)
    if (tier === 'registered_org') {
      if (!req.file) {
        return res.status(400).json({
          error: 'document_required',
          message: 'A PDF document is required for registered organization verification',
        });
      }
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          error: 'invalid_document_type',
          message: 'Only PDF documents are allowed',
        });
      }
    }

    // 1. Server-side eligibility re-check (never trust client alone)
    const eligibility = await computeEligibility(pool, userId);
    if (!eligibility.eligible) {
      return res.status(403).json({
        error: 'ineligible',
        eligibility,
        message: 'Community does not meet verification eligibility requirements',
      });
    }

    // 2. Deduplication check: cannot have duplicate pending/approved for this tier
    const existingCheck = await pool.query(
      `SELECT id, status, tier
       FROM community_verifications
       WHERE community_id = $1 AND tier = $2 AND status IN ('pending', 'approved')
       LIMIT 1`,
      [userId, tier]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'already_submitted',
        message: `A verification request for tier "${tier}" is already ${existingCheck.rows[0].status}`,
      });
    }

    // 3. Document storage upload (for Tier B)
    let documentStoragePath = null;
    if (tier === 'registered_org' && req.file) {
      try {
        documentStoragePath = await uploadVerificationDocument(
          userId,
          req.file.buffer,
          req.file.originalname
        );
      } catch (uploadErr) {
        console.error('[communityVerificationController.applyVerification] Storage upload failed:', uploadErr);
        return res.status(500).json({
          error: 'storage_upload_failed',
          message: uploadErr.message || 'Failed to upload verification document to storage',
        });
      }
    }

    // 4. Insert submission into community_verifications
    const insertResult = await pool.query(
      `INSERT INTO community_verifications (
         community_id, tier, status, document_storage_path
       ) VALUES ($1, $2, 'pending', $3)
       RETURNING *`,
      [userId, tier, documentStoragePath]
    );

    const createdVerification = insertResult.rows[0];

    return res.status(201).json({ verification: createdVerification });
  } catch (err) {
    console.error('[communityVerificationController.applyVerification]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /communities/verification/status
// ---------------------------------------------------------------------------
async function getVerificationStatus(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: 'Forbidden: Community access only' });
    }

    const tierParam = (req.query?.tier || '').trim();
    let query = `
      SELECT id, community_id, tier, status, document_storage_path, submitted_at, reviewed_at, rejection_reason
      FROM community_verifications
      WHERE community_id = $1
    `;
    const params = [userId];

    if (tierParam && ['community_verified', 'registered_org'].includes(tierParam)) {
      params.push(tierParam);
      query += ` AND tier = $${params.length}`;
    }

    query += ` ORDER BY submitted_at DESC, id DESC LIMIT 1`;

    const result = await pool.query(query, params);

    return res.json({ verification: result.rows[0] || null });
  } catch (err) {
    console.error('[communityVerificationController.getVerificationStatus]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /communities/admin/verifications (Admin protected)
// ---------------------------------------------------------------------------
async function adminGetAll(req, res) {
  try {
    const pool = req.app.locals.pool;

    const statusParam = (req.query?.status || 'pending').trim().toLowerCase();
    const tierParam = (req.query?.tier || 'all').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query?.page || '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query?.limit || '20', 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (['pending', 'approved', 'rejected'].includes(statusParam)) {
      params.push(statusParam);
      conditions.push(`cv.status = $${params.length}`);
    }

    if (['community_verified', 'registered_org'].includes(tierParam)) {
      params.push(tierParam);
      conditions.push(`cv.tier = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Order: pending uses ASC (FIFO oldest first); historical/all uses DESC (newest first)
    const orderClause = statusParam === 'pending'
      ? 'ORDER BY cv.submitted_at ASC, cv.id ASC'
      : 'ORDER BY cv.submitted_at DESC, cv.id DESC';

    // Total count query
    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM community_verifications cv
       JOIN communities c ON c.id = cv.community_id
       ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    // Data query
    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const dataResult = await pool.query(
      `SELECT 
         cv.id,
         cv.community_id,
         cv.tier,
         cv.status,
         cv.document_storage_path,
         cv.submitted_at,
         cv.reviewed_at,
         cv.reviewed_by,
         cv.rejection_reason,
         c.name as community_name,
         c.username as community_username,
         c.logo_url as community_logo,
         c.category as community_category
       FROM community_verifications cv
       JOIN communities c ON c.id = cv.community_id
       ${whereClause}
       ${orderClause}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json({
      verifications: dataResult.rows,
      total,
      page,
      pageSize: limit,
      totalPages,
    });
  } catch (err) {
    console.error('[communityVerificationController.adminGetAll]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// PATCH /communities/admin/verifications/:id (Admin protected)
// ---------------------------------------------------------------------------
async function adminReview(req, res) {
  try {
    const pool = req.app.locals.pool;
    const verId = parseInt(req.params.id, 10);
    const { status, rejection_reason } = req.body || {};

    if (isNaN(verId)) {
      return res.status(400).json({ error: 'invalid_id', message: 'Verification ID must be a valid integer' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'status must be either "approved" or "rejected"',
      });
    }

    if (status === 'rejected' && (!rejection_reason || !rejection_reason.trim())) {
      return res.status(400).json({
        error: 'rejection_reason_required',
        message: 'rejection_reason is required when rejecting a verification',
      });
    }

    const updateResult = await pool.query(
      `UPDATE community_verifications
       SET status = $1,
           reviewed_at = NOW(),
           reviewed_by = $2,
           rejection_reason = $3
       WHERE id = $4
       RETURNING *`,
      [status, req.admin.id, rejection_reason ? rejection_reason.trim() : null, verId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const updatedVer = updateResult.rows[0];
    const communityId = updatedVer.community_id;

    // trg_sync_community_verification_badge trigger automatically recomputes
    // communities.verification_status and communities.community_verification_tier.
    // Fetch fresh communities row to confirm the updated state.
    const freshComm = await pool.query(
      `SELECT id, name, verification_status, community_verification_tier
       FROM communities
       WHERE id = $1`,
      [communityId]
    );

    const io = req.app.locals.io;
    if (io && freshComm.rows[0]) {
      io.to(`community_${communityId}`).emit('community_verification_status_updated', {
        status: updatedVer.status,
        tier: freshComm.rows[0].community_verification_tier,
        verification_status: freshComm.rows[0].verification_status,
      });
    }

    return res.json({
      verification: updatedVer,
      community: freshComm.rows[0],
    });
  } catch (err) {
    console.error('[communityVerificationController.adminReview]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /communities/admin/verifications/:id/document (Admin protected)
// ---------------------------------------------------------------------------
async function adminGetDocumentUrl(req, res) {
  try {
    const pool = req.app.locals.pool;
    const verId = parseInt(req.params.id, 10);

    if (isNaN(verId)) {
      return res.status(400).json({ error: 'invalid_id', message: 'Verification ID must be a valid integer' });
    }

    const result = await pool.query(
      `SELECT id, document_storage_path, tier, status
       FROM community_verifications
       WHERE id = $1`,
      [verId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    const ver = result.rows[0];
    if (!ver.document_storage_path) {
      return res.status(404).json({
        error: 'no_document',
        message: 'This verification submission has no attached document (Tier A)',
      });
    }

    const signedUrl = await getSignedDocumentUrl(ver.document_storage_path);

    return res.json({ url: signedUrl });
  } catch (err) {
    console.error('[communityVerificationController.adminGetDocumentUrl]', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
}

module.exports = {
  getVerificationEligibility,
  applyVerification,
  getVerificationStatus,
  adminGetAll,
  adminReview,
  adminGetDocumentUrl,
};
