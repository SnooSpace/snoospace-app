/**
 * Face Match Service (Phase 2 & Phase 3 Scope-Aware)
 * 
 * Compares video frames extracted from a member's verification video against
 * reference photos (either multi-photo discover_photos or single manual reference photo).
 */

const { getTransformedUrl } = require('../config/cloudinary');
const { detectFace } = require('./faceDetectionService');

let faceapi;
try {
  require('@tensorflow/tfjs-node');
  faceapi = require('@vladmandic/face-api');
} catch (e) {
  faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
}

/**
 * Compute Euclidean distance between two 128-d descriptor vectors.
 * Smaller distance = higher similarity.
 * 
 * @param {number[]} desc1 
 * @param {number[]} desc2 
 * @returns {number}
 */
function computeEuclideanDistance(desc1, desc2) {
  if (faceapi && typeof faceapi.euclideanDistance === 'function') {
    return faceapi.euclideanDistance(desc1, desc2);
  }
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Parse an embedding vector from the database into a JavaScript number array.
 * pgvector returns string format: "[0.123, -0.456, ...]"
 * 
 * @param {string|number[]|Float32Array} raw 
 * @returns {number[]}
 */
function parseEmbedding(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Fallback in case of non-JSON format
      return raw.replace(/^\[|\]$/g, '').split(',').map(Number);
    }
  }
  return Array.from(raw);
}

/**
 * Perform video-to-reference face matching for a member's verification video.
 * 
 * @param {string} videoPublicId - Cloudinary public_id of the uploaded video
 * @param {number|string} memberId - ID of the member undergoing verification
 * @param {import('pg').Pool} pool - Database pool
 * @param {object} [options] - Options object
 * @param {'plans'|'discover'} [options.scope='discover'] - Verification scope
 * @param {string} [options.manualReferencePhotoUrl] - Manual reference photo URL for 'plans' scope
 * @returns {Promise<{
 *   status: 'match' | 'no_match' | 'uncertain' | 'no_face_in_video' | 'insufficient_references',
 *   distance?: number,
 *   matchedPhotoUrl?: string,
 *   referencePhotoUrls?: string[],
 *   framesAnalyzed?: number,
 *   reason?: string
 * }>}
 */
async function matchVideoToReferences(videoPublicId, memberId, pool, options = {}) {
  const scope = options.scope || 'discover';
  let referenceSet = [];

  if (scope === 'plans') {
    const manualUrl = options.manualReferencePhotoUrl;
    if (!manualUrl) {
      return { status: 'insufficient_references', reason: 'manual_reference_photo_url is missing' };
    }

    // Call detectFace directly on the manual reference photo
    let detection;
    try {
      detection = await detectFace(manualUrl);
    } catch (err) {
      console.warn(`[FaceMatchService] Manual reference detection error for "${manualUrl}":`, err.message);
      return { status: 'insufficient_references', reason: err.message };
    }

    if (!detection || !detection.faceEligible || !detection.embedding || detection.embedding.length !== 128) {
      return {
        status: 'insufficient_references',
        reason: detection?.reason || 'Face detection failed on manual reference photo',
      };
    }

    referenceSet = [{
      photo_url: manualUrl,
      embedding: detection.embedding,
    }];
  } else {
    // 1. Fetch member's current discover_photos
    const memberRes = await pool.query(
      `SELECT discover_photos FROM members WHERE id = $1`,
      [memberId]
    );
    if (memberRes.rows.length === 0) {
      return { status: 'insufficient_references' };
    }

    const rawPhotos = memberRes.rows[0].discover_photos;
    const currentPhotos = Array.isArray(rawPhotos)
      ? rawPhotos
      : (typeof rawPhotos === 'string' ? JSON.parse(rawPhotos || '[]') : []);

    if (!currentPhotos || currentPhotos.length === 0) {
      return { status: 'insufficient_references' };
    }

    // Query eligible reference photos that are still present in discover_photos
    const refRes = await pool.query(
      `SELECT photo_url, face_embedding
       FROM photo_face_verifications
       WHERE member_id = $1
         AND face_eligible = TRUE
         AND photo_url = ANY($2::text[])
         AND face_embedding IS NOT NULL`,
      [memberId, currentPhotos]
    );

    referenceSet = refRes.rows.map((row) => ({
      photo_url: row.photo_url,
      embedding: parseEmbedding(row.face_embedding),
    })).filter((r) => r.embedding.length === 128);

    // 2. Gating for discover scope: require at least 2 eligible reference photos
    if (referenceSet.length < 2) {
      return { status: 'insufficient_references' };
    }
  }

  // 3. Build 3 Cloudinary frame-extraction URLs at 10%, 50%, 90%
  const offsets = ['10p', '50p', '90p'];
  const frameUrls = offsets.map((offset) =>
    getTransformedUrl(videoPublicId, {
      resource_type: 'video',
      format: 'jpg',
      start_offset: offset,
    })
  );

  // 4. Run face detection on each frame URL
  const validFrames = [];
  for (const url of frameUrls) {
    try {
      const detection = await detectFace(url);
      if (detection && detection.faceEligible && detection.embedding && detection.embedding.length === 128) {
        validFrames.push(detection);
      }
    } catch (frameErr) {
      console.warn(`[FaceMatchService] Frame detection failed for "${url}":`, frameErr.message);
    }
  }

  // 5. If zero frames had an eligible face
  if (validFrames.length === 0) {
    return {
      status: 'no_face_in_video',
      referencePhotoUrls: referenceSet.map((r) => r.photo_url),
    };
  }

  // 6. Compute Euclidean distance across every valid frame x every reference photo
  let minDistance = Infinity;
  let bestMatchedPhotoUrl = null;

  for (const frame of validFrames) {
    for (const ref of referenceSet) {
      const dist = computeEuclideanDistance(frame.embedding, ref.embedding);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatchedPhotoUrl = ref.photo_url;
      }
    }
  }

  const roundedDistance = Number(minDistance.toFixed(4));

  // 7. Classify outcome based on distance thresholds
  // distance <= 0.55 -> match
  // distance >= 0.85 -> no_match
  // otherwise -> uncertain (manual review queue)
  let classification = 'uncertain';
  if (roundedDistance <= 0.55) {
    classification = 'match';
  } else if (roundedDistance >= 0.85) {
    classification = 'no_match';
  }

  return {
    status: classification,
    distance: roundedDistance,
    matchedPhotoUrl: bestMatchedPhotoUrl,
    referencePhotoUrls: referenceSet.map((r) => r.photo_url),
    framesAnalyzed: validFrames.length,
  };
}

module.exports = {
  matchVideoToReferences,
  computeEuclideanDistance,
};
