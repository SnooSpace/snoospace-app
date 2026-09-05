const { uploadImage } = require('../config/cloudinary');
const { detectFace } = require('../services/faceDetectionService');
const { getFaceDetectionMessage } = require('../config/faceDetectionMessages');

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

    const scope = (req.body.scope || 'discover').trim();
    if (!['plans', 'discover'].includes(scope)) {
      return res.status(400).json({ error: 'invalid_scope', message: 'scope must be plans or discover' });
    }

    const referencePhotoUrl = req.body.reference_photo_url ? req.body.reference_photo_url.trim() : null;

    // Pre-checks based on scope
    if (scope === 'plans') {
      if (!referencePhotoUrl) {
        return res.status(400).json({ error: 'reference_photo_required' });
      }

      // Synchronously check reference photo face eligibility (fail fast before Cloudinary upload)
      let detection;
      try {
        detection = await detectFace(referencePhotoUrl);
      } catch (err) {
        return res.status(400).json({
          error: 'reference_photo_not_eligible',
          reason: err.message || 'Failed to detect face on reference photo',
          message: getFaceDetectionMessage(err.message),
        });
      }

      if (!detection || !detection.faceEligible) {
        return res.status(400).json({
          error: 'reference_photo_not_eligible',
          reason: detection?.reason || 'no_face',
          message: getFaceDetectionMessage(detection?.reason),
        });
      }
    } else {
      // scope === 'discover': query photo_face_verifications joined against discover_photos for face_eligible = true count
      const memberRes = await pool.query(
        `SELECT discover_photos FROM members WHERE id = $1`,
        [userId]
      );
      const rawPhotos = memberRes.rows[0]?.discover_photos;
      const currentPhotos = Array.isArray(rawPhotos)
        ? rawPhotos
        : (typeof rawPhotos === 'string' ? JSON.parse(rawPhotos || '[]') : []);

      let eligibleCount = 0;
      if (currentPhotos.length > 0) {
        const eligibleRes = await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM photo_face_verifications
           WHERE member_id = $1
             AND face_eligible = TRUE
             AND photo_url = ANY($2::text[])`,
          [userId, currentPhotos]
        );
        eligibleCount = eligibleRes.rows[0]?.count || 0;
      }

      if (eligibleCount < 2) {
        return res.status(400).json({
          error: 'insufficient_reference_photos',
          eligibleCount,
          minimumRequired: 2,
        });
      }
    }

    // Check for existing pending or approved verification for this scope
    const existingR = await pool.query(
      `SELECT id, status FROM user_verifications WHERE user_id = $1 AND scope = $2 AND status IN ('pending', 'approved') LIMIT 1`,
      [userId, scope]
    );
    if (existingR.rows.length > 0) {
      return res.status(409).json({
        error: 'verification_exists',
        status: existingR.rows[0].status,
        message: `You already have a ${existingR.rows[0].status} verification for scope '${scope}'.`,
      });
    }

    // Upload to Cloudinary as video
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadResult = await uploadImage(b64, {
      folder: 'snoospace/verifications',
      resource_type: 'video',
    });

    // Insert verification record with scope and manual_reference_photo_url
    const insertR = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope, manual_reference_photo_url)
       VALUES ($1, $2, 'video', 'pending', $3, $4)
       RETURNING id, status, scope, submitted_at`,
      [userId, uploadResult.public_id, scope, scope === 'plans' ? referencePhotoUrl : null]
    );

    res.status(201).json({ verification: insertR.rows[0] });

    // Background automated face matching (fire-and-forget)
    ;(async () => {
      try {
        const { matchVideoToReferences } = require('../services/faceMatchService');
        const matchResult = await matchVideoToReferences(
          uploadResult.public_id,
          userId,
          pool,
          {
            scope,
            manualReferencePhotoUrl: scope === 'plans' ? referencePhotoUrl : undefined,
          }
        );

        const io = req.app.locals.io;
        const verId = insertR.rows[0].id;

        if (matchResult.status === 'match') {
          await pool.query(
            `UPDATE user_verifications
             SET status = 'approved',
                 decision_source = 'automated',
                 match_score = $1,
                 matched_photo_url = $2,
                 reviewed_at = NOW()
             WHERE id = $3`,
            [matchResult.distance, matchResult.matchedPhotoUrl, verId]
          );

          if (matchResult.referencePhotoUrls && matchResult.referencePhotoUrls.length > 0) {
            await pool.query(
              `UPDATE members
               SET verified_reference_photos = $1
               WHERE id = $2`,
              [matchResult.referencePhotoUrls, userId]
            );
          }

          // trg_sync_verification_badge trigger automatically updates members.is_verified, verified_at, and verification_tier
          const freshMem = await pool.query(
            `SELECT is_verified, verification_tier FROM members WHERE id = $1`,
            [userId]
          );
          if (io && freshMem.rows[0]) {
            io.to(`user_${userId}`).emit('verification_status_updated', {
              status: 'approved',
              tier: freshMem.rows[0].verification_tier,
              scope,
            });
          }
        } else if (matchResult.status === 'no_match') {
          await pool.query(
            `UPDATE user_verifications
             SET status = 'rejected',
                 decision_source = 'automated',
                 match_score = $1,
                 rejection_reason = 'The face in your video did not match your profile photos.',
                 reviewed_at = NOW()
             WHERE id = $2`,
            [matchResult.distance, verId]
          );

          const freshMem = await pool.query(
            `SELECT is_verified, verification_tier FROM members WHERE id = $1`,
            [userId]
          );
          if (io && freshMem.rows[0]) {
            io.to(`user_${userId}`).emit('verification_status_updated', {
              status: 'rejected',
              tier: freshMem.rows[0].verification_tier,
              scope,
            });
          }
        } else {
          // 'uncertain', 'no_face_in_video', or 'insufficient_references'
          // Leave row pending (decision_source defaults to 'manual')
          if (typeof matchResult.distance === 'number') {
            await pool.query(
              `UPDATE user_verifications SET match_score = $1 WHERE id = $2`,
              [matchResult.distance, verId]
            );
          }
        }
      } catch (err) {
        console.error('[verificationsController.submitVerification] Automated match error (non-fatal):', err);
      }
    })();
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
    const scope = (req.query.scope || '').trim();

    let query = `SELECT id, status, scope, manual_reference_photo_url, submitted_at, reviewed_at, rejection_reason
       FROM user_verifications
       WHERE user_id = $1`;
    const params = [userId];

    if (scope && ['plans', 'discover'].includes(scope)) {
      query += ` AND scope = $2`;
      params.push(scope);
    }

    query += ` ORDER BY submitted_at DESC LIMIT 1`;

    const result = await pool.query(query, params);

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
      `SELECT uv.id, uv.user_id, uv.status, uv.scope, uv.manual_reference_photo_url, uv.submitted_at, uv.video_storage_path,
              uv.match_score, uv.matched_photo_url,
              m.name as member_name, m.email as member_email, m.profile_photo_url as member_photo,
              m.discover_photos
       FROM user_verifications uv
       JOIN members m ON m.id = uv.user_id
       WHERE uv.status = 'pending'
       ORDER BY uv.submitted_at ASC`
    );

    const verifications = result.rows.map((row) => {
      let discoverPhotos = row.discover_photos;
      if (typeof discoverPhotos === 'string') {
        try {
          discoverPhotos = JSON.parse(discoverPhotos);
        } catch (e) {
          discoverPhotos = [];
        }
      }
      return {
        ...row,
        discover_photos: Array.isArray(discoverPhotos) ? discoverPhotos : [],
      };
    });

    res.json({ verifications });
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
