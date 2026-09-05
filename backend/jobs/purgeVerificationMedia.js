/**
 * Purge Verification Media Job
 *
 * Implements media retention policy for identity verifications:
 * - Destroys video and manual reference photo assets from Cloudinary for
 *   verifications reviewed 7+ days ago (status IN ('approved', 'rejected')).
 * - Leaves DB records, match scores, and URL pointers intact as audit log,
 *   stamping `media_purged_at = NOW()`.
 * - Never destroys discover scope photos (which are active profile photos).
 */

const { deleteVideo, deleteImage, extractPublicId } = require('../config/cloudinary');

/**
 * Run verification media purge job
 * @param {import('pg').Pool} pool - Database pool
 * @param {number} [limit=50] - Batch size limit
 * @returns {Promise<{ purgedCount: number }>}
 */
async function runVerificationMediaPurgeJob(pool, limit = 50) {
  if (!pool) return { purgedCount: 0 };
  console.log('[PurgeVerificationMedia] Running verification media retention cleanup...');

  try {
    const { rows } = await pool.query(
      `SELECT id, scope, video_storage_path, manual_reference_photo_url, status, reviewed_at
       FROM user_verifications
       WHERE status IN ('approved', 'rejected')
         AND reviewed_at < NOW() - INTERVAL '7 days'
         AND media_purged_at IS NULL
       ORDER BY reviewed_at ASC
       LIMIT $1`,
      [limit]
    );

    if (rows.length === 0) {
      console.log('[PurgeVerificationMedia] No eligible media to purge.');
      return { purgedCount: 0 };
    }

    console.log(`[PurgeVerificationMedia] Found ${rows.length} verification(s) eligible for media purge.`);
    let successCount = 0;

    for (const row of rows) {
      try {
        let videoPurged = false;
        let photoPurged = true; // default true if no photo to purge

        // 1. Destroy video asset in Cloudinary
        if (row.video_storage_path) {
          try {
            const res = await deleteVideo(row.video_storage_path);
            if (res.result === 'ok' || res.result === 'not found') {
              videoPurged = true;
            } else {
              console.warn(`[PurgeVerificationMedia] Unexpected video destroy result for verId ${row.id}:`, res);
            }
          } catch (err) {
            console.error(`[PurgeVerificationMedia] Failed to delete video for verId ${row.id}:`, err.message);
          }
        } else {
          // No video path recorded
          videoPurged = true;
        }

        // 2. Destroy manual reference photo (scope === 'plans' only)
        if (row.scope === 'plans' && row.manual_reference_photo_url) {
          photoPurged = false;
          const photoPublicId = extractPublicId(row.manual_reference_photo_url);
          if (photoPublicId) {
            try {
              const res = await deleteImage(photoPublicId);
              if (res.result === 'ok' || res.result === 'not found') {
                photoPurged = true;
              } else {
                console.warn(`[PurgeVerificationMedia] Unexpected photo destroy result for verId ${row.id}:`, res);
              }
            } catch (err) {
              console.error(`[PurgeVerificationMedia] Failed to delete manual reference photo for verId ${row.id}:`, err.message);
            }
          } else {
            console.warn(`[PurgeVerificationMedia] Could not extract public_id from photo URL for verId ${row.id}: ${row.manual_reference_photo_url}`);
            // If cannot extract public_id, allow video purge to proceed
            photoPurged = true;
          }
        }

        // 3. Mark row as purged if video and reference photo were successfully destroyed/not-found
        if (videoPurged && photoPurged) {
          await pool.query(
            `UPDATE user_verifications SET media_purged_at = NOW() WHERE id = $1`,
            [row.id]
          );
          successCount++;
        }
      } catch (rowErr) {
        console.error(`[PurgeVerificationMedia] Error processing verId ${row.id}:`, rowErr.message);
      }
    }

    console.log(`[PurgeVerificationMedia] Successfully purged media for ${successCount}/${rows.length} verification(s).`);
    return { purgedCount: successCount };
  } catch (err) {
    console.error('[PurgeVerificationMedia] Job failure:', err);
    throw err;
  }
}

module.exports = { runVerificationMediaPurgeJob };
