const { uploadImage } = require('../config/cloudinary');

const ALLOWED_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

// ---------------------------------------------------------------------------
// POST /verifications
// ---------------------------------------------------------------------------
async function submitVerification(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'A video file is required' });
    }
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only mp4, mov, and webm video files are allowed' });
    }

    // Check for existing pending or approved verification
    const existingR = await pool.query(
      `SELECT id, status FROM user_verifications WHERE user_id = $1 AND status IN ('pending', 'approved') LIMIT 1`,
      [userId]
    );
    if (existingR.rows.length > 0) {
      return res.status(409).json({
        error: 'verification_exists',
        status: existingR.rows[0].status,
        message: `You already have a ${existingR.rows[0].status} verification.`,
      });
    }

    // Upload to Cloudinary as video
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadResult = await uploadImage(b64, {
      folder: 'snoospace/verifications',
      resource_type: 'video',
    });

    // Insert verification record
    const insertR = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status)
       VALUES ($1, $2, 'video', 'pending')
       RETURNING id, status, submitted_at`,
      [userId, uploadResult.public_id]
    );

    res.status(201).json({ verification: insertR.rows[0] });
  } catch (err) {
    console.error('[verificationsController.submitVerification]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /verifications/me
// ---------------------------------------------------------------------------
async function getMyVerification(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, status, submitted_at, reviewed_at, rejection_reason
       FROM user_verifications
       WHERE user_id = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId]
    );

    res.json({ verification: result.rows[0] || null });
  } catch (err) {
    console.error('[verificationsController.getMyVerification]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /verifications/admin  (adminAuthMiddleware — req.admin set)
// ---------------------------------------------------------------------------
async function adminGetAll(req, res) {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT uv.id, uv.user_id, uv.status, uv.submitted_at, uv.video_storage_path,
              m.name as member_name, m.email as member_email, m.profile_photo_url as member_photo
       FROM user_verifications uv
       JOIN members m ON m.id = uv.user_id
       WHERE uv.status = 'pending'
       ORDER BY uv.submitted_at ASC`
    );

    res.json({ verifications: result.rows });
  } catch (err) {
    console.error('[verificationsController.adminGetAll]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// PATCH /verifications/admin/:verId  (adminAuthMiddleware — req.admin set)
// ---------------------------------------------------------------------------
async function adminReview(req, res) {
  try {
    const pool = req.app.locals.pool;
    const verId = parseInt(req.params.verId, 10);
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }
    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({ error: 'rejection_reason is required when rejecting' });
    }

    const result = await pool.query(
      `UPDATE user_verifications
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2, rejection_reason = $3
       WHERE id = $4
       RETURNING *`,
      [status, req.admin.id, rejection_reason || null, verId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Verification not found' });

    // trg_sync_verification_badge trigger automatically updates members.is_verified + members.verified_at
    res.json({ verification: result.rows[0] });
  } catch (err) {
    console.error('[verificationsController.adminReview]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { submitVerification, getMyVerification, adminGetAll, adminReview };
