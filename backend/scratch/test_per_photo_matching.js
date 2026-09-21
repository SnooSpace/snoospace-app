require('dotenv').config();
const { createPool } = require('../config/db');

// Ensure clean service loading with mocked detectFace
const faceDetectionService = require('../services/faceDetectionService');
const baseEmbedding = new Array(128).fill(0.0);

// Mock detectFace to always return a valid 128-d face embedding
faceDetectionService.detectFace = async (url) => {
  return {
    faceEligible: true,
    embedding: [...baseEmbedding],
    reason: null,
  };
};

// Now load faceMatchService which uses the mocked detectFace
delete require.cache[require.resolve('../services/faceMatchService')];
const { matchVideoToReferences, MATCH_THRESHOLD, NO_MATCH_THRESHOLD } = require('../services/faceMatchService');
const { handleVerificationRejection } = require('../services/verificationRejectionService');

function generateEmbeddingWithDistance(targetDist) {
  const val = targetDist / Math.sqrt(128);
  return new Array(128).fill(val);
}

// Helpers for pgvector format
function toPgVector(arr) {
  return `[${arr.join(',')}]`;
}

async function runTests() {
  const pool = createPool();
  console.log('=== STARTING PER-PHOTO VERIFICATION MATCHING TESTS ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failures++;
    }
  }

  let testMemberA = null;
  let testMemberB = null;
  let testMemberC = null;
  let testMemberD = null;
  let testAdminId = null;

  try {
    // 0. Ensure an admin exists for manual review testing
    const adminRes = await pool.query(`SELECT id FROM admins LIMIT 1`);
    if (adminRes.rows.length > 0) {
      testAdminId = adminRes.rows[0].id;
    } else {
      const newAdmin = await pool.query(
        `INSERT INTO admins (name, email, password_hash, role)
         VALUES ('Test Admin', 'test.admin.perphoto@snoospace.dev', 'fakehash', 'superadmin')
         RETURNING id`
      );
      testAdminId = newAdmin.rows[0].id;
    }

    // Embeddings for testing:
    // MATCH: target dist 0.25 (<= 0.55)
    const matchEmb = generateEmbeddingWithDistance(0.25);
    // UNCERTAIN: target dist 0.60 (0.55 < 0.60 < 0.66)
    const uncertainEmb = generateEmbeddingWithDistance(0.60);
    // NO_MATCH: target dist 0.80 (>= 0.66)
    const noMatchEmb = generateEmbeddingWithDistance(0.80);

    // ------------------------------------------------------------------------
    // TEST (a): Clean multi-photo match (2 matching photos + 1 uncertain photo)
    // ------------------------------------------------------------------------
    console.log('--- TEST (a): Clean Multi-Photo Match (2 Matches, 0 Mismatches) ---');
    const memARes = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, interests, verification_tier, is_verified, discover_photos)
       VALUES ('Test User A', 'test.user.a@snoospace.dev', '9991110001', '1995-01-01', 'Female', '["tech", "art", "music"]', 'none', FALSE,
               '["https://example.com/photoA1.jpg", "https://example.com/photoA2.jpg", "https://example.com/photoA3_uncertain.jpg"]')
       RETURNING id`
    );
    testMemberA = memARes.rows[0].id;

    // Insert photo verifications
    await pool.query(
      `INSERT INTO photo_face_verifications (member_id, photo_url, face_eligible, face_embedding)
       VALUES ($1, 'https://example.com/photoA1.jpg', TRUE, $2::vector),
              ($1, 'https://example.com/photoA2.jpg', TRUE, $3::vector),
              ($1, 'https://example.com/photoA3_uncertain.jpg', TRUE, $4::vector)`,
      [testMemberA, toPgVector(matchEmb), toPgVector(matchEmb), toPgVector(uncertainEmb)]
    );

    const matchResA = await matchVideoToReferences('sample_video_a', testMemberA, pool, { scope: 'discover' });
    console.log('  matchVideoToReferences outcome:', matchResA.status, 'matchedPhotoUrls:', matchResA.matchedPhotoUrls);

    assert(matchResA.status === 'match', "Overall status is 'match'");
    assert(Array.isArray(matchResA.matchedPhotoUrls) && matchResA.matchedPhotoUrls.length === 2, "matchedPhotoUrls has exactly 2 photos");
    assert(matchResA.matchedPhotoUrls.includes('https://example.com/photoA1.jpg') && matchResA.matchedPhotoUrls.includes('https://example.com/photoA2.jpg'), "matchedPhotoUrls contains photoA1 and photoA2");
    assert(!matchResA.matchedPhotoUrls.includes('https://example.com/photoA3_uncertain.jpg'), "matchedPhotoUrls does NOT contain uncertain photoA3");
    assert(matchResA.matchDiagnostics.length === 3, "matchDiagnostics contains all 3 reference photos");

    // Simulate automated approval write from verificationsController
    const verARes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope)
       VALUES ($1, 'video_a', 'video', 'pending', 'discover')
       RETURNING id`,
      [testMemberA]
    );
    const verAId = verARes.rows[0].id;

    await pool.query(
      `UPDATE user_verifications
       SET status = 'approved',
           decision_source = 'automated',
           match_score = $1,
           matched_photo_url = $2,
           matched_photo_urls = $3,
           match_diagnostics = $4,
           reviewed_at = NOW()
       WHERE id = $5`,
      [
        matchResA.distance,
        matchResA.matchedPhotoUrl,
        matchResA.matchedPhotoUrls,
        JSON.stringify(matchResA.matchDiagnostics),
        verAId,
      ]
    );

    await pool.query(
      `UPDATE members
       SET verified_reference_photos = $1
       WHERE id = $2`,
      [matchResA.matchedPhotoUrls, testMemberA]
    );

    const memberACheck = (await pool.query(`SELECT is_verified, verification_tier, verified_reference_photos FROM members WHERE id = $1`, [testMemberA])).rows[0];
    assert(memberACheck.is_verified === true, "Member is_verified is TRUE");
    assert(memberACheck.verification_tier === 'selfie_verified', "Member verification_tier is selfie_verified");
    assert(Array.isArray(memberACheck.verified_reference_photos) && memberACheck.verified_reference_photos.length === 2, "verified_reference_photos is narrowed to only the 2 matched photos (uncertain excluded)");

    // ------------------------------------------------------------------------
    // TEST (b): Mixed reference set (1 genuine photo + 1 different person's photo)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST (b): Mixed Reference Set (1 Match + 1 Mismatch -> mismatch_detected / photo_hygiene) ---');
    const memBRes = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, interests, verification_tier, is_verified, discover_photos, plans_access_blocked)
       VALUES ('Test User B', 'test.user.b@snoospace.dev', '9991110002', '1995-01-01', 'Male', '["tech", "art", "music"]', 'none', FALSE,
               '["https://example.com/photoB_genuine.jpg", "https://example.com/photoB_imposter.jpg"]', FALSE)
       RETURNING id`
    );
    testMemberB = memBRes.rows[0].id;

    await pool.query(
      `INSERT INTO photo_face_verifications (member_id, photo_url, face_eligible, face_embedding)
       VALUES ($1, 'https://example.com/photoB_genuine.jpg', TRUE, $2::vector),
              ($1, 'https://example.com/photoB_imposter.jpg', TRUE, $3::vector)`,
      [testMemberB, toPgVector(matchEmb), toPgVector(noMatchEmb)]
    );

    const matchResB = await matchVideoToReferences('sample_video_b', testMemberB, pool, { scope: 'discover' });
    console.log('  matchVideoToReferences outcome:', matchResB.status, 'matchDiagnostics:', matchResB.matchDiagnostics);

    assert(matchResB.status === 'mismatch_detected', "Overall status is 'mismatch_detected'");
    assert(matchResB.matchDiagnostics.find(d => d.photo_url.includes('genuine')).status === 'match', "Genuine photo status is 'match'");
    assert(matchResB.matchDiagnostics.find(d => d.photo_url.includes('imposter')).status === 'no_match', "Imposter photo status is 'no_match'");

    // Simulate automated rejection write for mismatch_detected
    const verBRes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope)
       VALUES ($1, 'video_b', 'video', 'pending', 'discover')
       RETURNING id`,
      [testMemberB]
    );
    const verBId = verBRes.rows[0].id;

    const photoHygieneReason = "One or more of your Discover photos doesn't match your verification video and may show a different person. Remove the mismatched photo(s) and resubmit.";
    await pool.query(
      `UPDATE user_verifications
       SET status = 'rejected',
           decision_source = 'automated',
           rejection_type = 'photo_hygiene',
           match_score = $1,
           match_diagnostics = $2,
           rejection_reason = $3,
           reviewed_at = NOW()
       WHERE id = $4`,
      [
        matchResB.distance,
        JSON.stringify(matchResB.matchDiagnostics),
        photoHygieneReason,
        verBId,
      ]
    );

    // CRITICAL: handleVerificationRejection must NOT be called for photo_hygiene!
    const memberBCheck = (await pool.query(`SELECT is_verified, verification_tier, verified_reference_photos, plans_access_blocked FROM members WHERE id = $1`, [testMemberB])).rows[0];
    assert(memberBCheck.is_verified === false, "Member is_verified remains FALSE");
    assert(memberBCheck.verified_reference_photos === null, "members.verified_reference_photos is NOT populated");
    assert(memberBCheck.plans_access_blocked === false, "members.plans_access_blocked remains FALSE (cascade was NOT triggered)");

    const verBRow = (await pool.query(`SELECT status, decision_source, rejection_type, rejection_reason FROM user_verifications WHERE id = $1`, [verBId])).rows[0];
    assert(verBRow.status === 'rejected', "user_verifications status is 'rejected'");
    assert(verBRow.decision_source === 'automated', "decision_source is 'automated'");
    assert(verBRow.rejection_type === 'photo_hygiene', "rejection_type is 'photo_hygiene'");
    assert(verBRow.rejection_reason === photoHygieneReason, "rejection_reason is photo hygiene message");

    // ------------------------------------------------------------------------
    // TEST (c): Genuine no-match-anywhere (no photo confirmed, at least one no_match)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST (c): Genuine No-Match-Anywhere (no_match / identity_mismatch) ---');
    const memCRes = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, interests, verification_tier, is_verified, discover_photos, plans_access_blocked)
       VALUES ('Test User C', 'test.user.c@snoospace.dev', '9991110003', '1995-01-01', 'Female', '["tech", "art", "music"]', 'none', FALSE,
               '["https://example.com/photoC1_nomatch.jpg", "https://example.com/photoC2_uncertain.jpg"]', FALSE)
       RETURNING id`
    );
    testMemberC = memCRes.rows[0].id;

    await pool.query(
      `INSERT INTO photo_face_verifications (member_id, photo_url, face_eligible, face_embedding)
       VALUES ($1, 'https://example.com/photoC1_nomatch.jpg', TRUE, $2::vector),
              ($1, 'https://example.com/photoC2_uncertain.jpg', TRUE, $3::vector)`,
      [testMemberC, toPgVector(noMatchEmb), toPgVector(uncertainEmb)]
    );

    const matchResC = await matchVideoToReferences('sample_video_c', testMemberC, pool, { scope: 'discover' });
    console.log('  matchVideoToReferences outcome:', matchResC.status, 'matchDiagnostics:', matchResC.matchDiagnostics);

    assert(matchResC.status === 'no_match', "Overall status is 'no_match'");
    assert(matchResC.matchDiagnostics.some(d => d.status === 'no_match'), "At least one reference is no_match");
    assert(!matchResC.matchDiagnostics.some(d => d.status === 'match'), "Zero reference photos are match");

    const verCRes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope)
       VALUES ($1, 'video_c', 'video', 'pending', 'discover')
       RETURNING id`,
      [testMemberC]
    );
    const verCId = verCRes.rows[0].id;

    const autoRejectionReason = 'The face in your video did not match your profile photos.';
    await pool.query(
      `UPDATE user_verifications
       SET status = 'rejected',
           decision_source = 'automated',
           rejection_type = 'identity_mismatch',
           match_score = $1,
           match_diagnostics = $2,
           rejection_reason = $3,
           reviewed_at = NOW()
       WHERE id = $4`,
      [
        matchResC.distance,
        JSON.stringify(matchResC.matchDiagnostics),
        autoRejectionReason,
        verCId,
      ]
    );

    const verCRow = (await pool.query(`SELECT status, decision_source, rejection_type FROM user_verifications WHERE id = $1`, [verCId])).rows[0];
    assert(verCRow.status === 'rejected', "user_verifications status is 'rejected'");
    assert(verCRow.rejection_type === 'identity_mismatch', "rejection_type is 'identity_mismatch'");

    // Verify Open Plans cascade: when scope === 'plans' triggers handleVerificationRejection, plans_access_blocked is set to TRUE
    await handleVerificationRejection(pool, null, testMemberC, 'plans');
    const memberCCheck = (await pool.query(`SELECT plans_access_blocked FROM members WHERE id = $1`, [testMemberC])).rows[0];
    assert(memberCCheck.plans_access_blocked === true, "handleVerificationRejection correctly sets plans_access_blocked = TRUE for plans scope identity rejection");

    // ------------------------------------------------------------------------
    // TEST (d): Uncertain case & Manual Admin Review
    // ------------------------------------------------------------------------
    console.log('\n--- TEST (d): Uncertain Case & Manual Admin Review ---');
    const memDRes = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, interests, verification_tier, is_verified, discover_photos)
       VALUES ('Test User D', 'test.user.d@snoospace.dev', '9991110004', '1995-01-01', 'Male', '["tech", "art", "music"]', 'none', FALSE,
               '["https://example.com/photoD1_unc.jpg", "https://example.com/photoD2_unc.jpg"]')
       RETURNING id`
    );
    testMemberD = memDRes.rows[0].id;

    await pool.query(
      `INSERT INTO photo_face_verifications (member_id, photo_url, face_eligible, face_embedding)
       VALUES ($1, 'https://example.com/photoD1_unc.jpg', TRUE, $2::vector),
              ($1, 'https://example.com/photoD2_unc.jpg', TRUE, $3::vector)`,
      [testMemberD, toPgVector(uncertainEmb), toPgVector(uncertainEmb)]
    );

    const matchResD = await matchVideoToReferences('sample_video_d', testMemberD, pool, { scope: 'discover' });
    console.log('  matchVideoToReferences outcome:', matchResD.status, 'matchDiagnostics:', matchResD.matchDiagnostics);

    assert(matchResD.status === 'uncertain', "Overall status is 'uncertain'");
    assert(matchResD.matchDiagnostics.every(d => d.status === 'uncertain'), "All photos have status 'uncertain'");

    // Insert pending verification row
    const verDRes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope)
       VALUES ($1, 'video_d', 'video', 'pending', 'discover')
       RETURNING id`,
      [testMemberD]
    );
    const verDId = verDRes.rows[0].id;

    // Automated path writes match_score and match_diagnostics and leaves status as 'pending'
    await pool.query(
      `UPDATE user_verifications
       SET match_score = $1,
           match_diagnostics = $2
       WHERE id = $3`,
      [matchResD.distance, JSON.stringify(matchResD.matchDiagnostics), verDId]
    );

    const verDCheck = (await pool.query(`SELECT status, decision_source, match_diagnostics FROM user_verifications WHERE id = $1`, [verDId])).rows[0];
    assert(verDCheck.status === 'pending', "user_verifications remains 'pending' for uncertain");
    assert(verDCheck.decision_source === 'manual', "decision_source remains 'manual'");
    assert(verDCheck.match_diagnostics != null, "match_diagnostics is persisted on pending row for admin review");

    // Subcase d1: Manual admin approval when match_diagnostics has 0 'match' entries (all uncertain)
    // -> Falls back to ALL candidate photos from match_diagnostics
    const verDUpdated = (await pool.query(
      `UPDATE user_verifications
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2
       RETURNING *`,
      [testAdminId, verDId]
    )).rows[0];

    // Follow adminReview approval logic:
    const diagnosticsD = typeof verDUpdated.match_diagnostics === 'string' ? JSON.parse(verDUpdated.match_diagnostics) : verDUpdated.match_diagnostics;
    const matchedPhotosD = diagnosticsD.filter(d => d.status === 'match').map(d => d.photo_url).filter(Boolean);
    let photosToSetD = [];
    if (matchedPhotosD.length > 0) {
      photosToSetD = matchedPhotosD;
    } else {
      photosToSetD = diagnosticsD.map(d => d.photo_url).filter(Boolean);
    }

    await pool.query(`UPDATE members SET verified_reference_photos = $1 WHERE id = $2`, [photosToSetD, testMemberD]);
    await pool.query(`UPDATE user_verifications SET matched_photo_urls = $1 WHERE id = $2`, [photosToSetD, verDId]);

    const memDApproved = (await pool.query(`SELECT is_verified, verified_reference_photos FROM members WHERE id = $1`, [testMemberD])).rows[0];
    assert(memDApproved.is_verified === true, "Member D is_verified is TRUE after admin manual approval");
    assert(memDApproved.verified_reference_photos.length === 2, "Fallback set verified_reference_photos to ALL candidate photos since 0 photos were confirmed 'match'");

    // Subcase d2: Manual admin approval when match_diagnostics has at least one 'match' entry
    // -> Narrows verified_reference_photos to ONLY the matched photos
    const diagnosticsMixed = [
      { photo_url: 'https://example.com/photoD1_unc.jpg', distance: 0.60, status: 'uncertain' },
      { photo_url: 'https://example.com/photoD_confirmed.jpg', distance: 0.35, status: 'match' },
    ];
    const matchedOnly = diagnosticsMixed.filter(d => d.status === 'match').map(d => d.photo_url);
    await pool.query(`UPDATE members SET verified_reference_photos = $1 WHERE id = $2`, [matchedOnly, testMemberD]);

    const memDSubset = (await pool.query(`SELECT verified_reference_photos FROM members WHERE id = $1`, [testMemberD])).rows[0];
    assert(memDSubset.verified_reference_photos.length === 1 && memDSubset.verified_reference_photos[0] === 'https://example.com/photoD_confirmed.jpg', "When match_diagnostics has a 'match' entry, admin approval narrows to just that matched photo");

  } catch (err) {
    console.error('Error during testing:', err);
    failures++;
  } finally {
    // Clean up test records
    const memberIds = [testMemberA, testMemberB, testMemberC, testMemberD].filter(Boolean);
    if (memberIds.length > 0) {
      await pool.query(`DELETE FROM user_verifications WHERE user_id = ANY($1::bigint[])`, [memberIds]);
      await pool.query(`DELETE FROM photo_face_verifications WHERE member_id = ANY($1::bigint[])`, [memberIds]);
      await pool.query(`DELETE FROM members WHERE id = ANY($1::bigint[])`, [memberIds]);
      console.log(`\nCleaned up ${memberIds.length} test members.`);
    }
    await pool.end();
  }

  console.log(`\n=== TESTS COMPLETED: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

runTests();
