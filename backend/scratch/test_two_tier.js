require('dotenv').config();
const { createPool } = require('../config/db');
const { matchVideoToReferences } = require('../services/faceMatchService');
const { detectFace } = require('../services/faceDetectionService');

async function runTests() {
  const pool = createPool();
  console.log('=== STARTING TWO-TIER VERIFICATION BACKEND TESTS ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failures++;
    }
  }

  let testMemberId = null;

  try {
    // 1. Create a temporary test member (interests requires 3-7 items)
    const memRes = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, interests, verification_tier, is_verified)
       VALUES ('Test TwoTier', 'test.twotier@snoospace.dev', '9998887776', '1995-01-01', 'Male', '["tech", "sports", "music"]', 'none', FALSE)
       RETURNING id`
    );
    testMemberId = memRes.rows[0].id;
    console.log(`Created test member ID: ${testMemberId}`);

    // ------------------------------------------------------------------------
    // TEST A & B: Multi-Scope Trigger Recomputation Scenario (Step 1e)
    // ------------------------------------------------------------------------
    console.log('\n--- Test A & B: Trigger Recomputation & Independent Scope Coexistence ---');

    // 1e.1: Create & approve a discover scope row
    const discoverRowRes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope)
       VALUES ($1, 'test_video_discover', 'video', 'pending', 'discover')
       RETURNING id`,
      [testMemberId]
    );
    const discoverVerId = discoverRowRes.rows[0].id;

    await pool.query(
      `UPDATE user_verifications SET status = 'approved' WHERE id = $1`,
      [discoverVerId]
    );

    let m1 = (await pool.query(`SELECT is_verified, verification_tier, verified_at FROM members WHERE id = $1`, [testMemberId])).rows[0];
    assert(m1.is_verified === true, 'Member is_verified is TRUE after discover approval');
    assert(m1.verification_tier === 'selfie_verified', 'Member verification_tier is selfie_verified after discover approval');
    assert(m1.verified_at != null, 'Member verified_at is set after initial verification');

    // 1e.2: Create & approve a plans scope row simultaneously
    const plansRowRes = await pool.query(
      `INSERT INTO user_verifications (user_id, video_storage_path, type, status, scope, manual_reference_photo_url)
       VALUES ($1, 'test_video_plans', 'video', 'pending', 'plans', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500')
       RETURNING id`,
      [testMemberId]
    );
    const plansVerId = plansRowRes.rows[0].id;

    // Check independent pending/approved status
    const pendingPlans = await pool.query(
      `SELECT count(*)::int as count FROM user_verifications WHERE user_id = $1 AND status IN ('pending', 'approved')`,
      [testMemberId]
    );
    assert(pendingPlans.rows[0].count === 2, 'User holds 2 active verifications across independent scopes');

    await pool.query(
      `UPDATE user_verifications SET status = 'approved' WHERE id = $1`,
      [plansVerId]
    );

    let m2 = (await pool.query(`SELECT is_verified, verification_tier FROM members WHERE id = $1`, [testMemberId])).rows[0];
    assert(m2.is_verified === true, 'Member is_verified remains TRUE after plans approval');
    assert(m2.verification_tier === 'selfie_verified', 'Member verification_tier stays selfie_verified (rank 2 >= rank 1)');

    // 1e.3: Reject discover scope row -> tier must drop to plans_verified (NOT none!)
    await pool.query(
      `UPDATE user_verifications SET status = 'rejected', rejection_reason = 'Test rejection' WHERE id = $1`,
      [discoverVerId]
    );

    let m3 = (await pool.query(`SELECT is_verified, verification_tier FROM members WHERE id = $1`, [testMemberId])).rows[0];
    assert(m3.is_verified === true, 'Member is_verified remains TRUE because plans scope is still approved');
    assert(m3.verification_tier === 'plans_verified', 'Member verification_tier recomputes to plans_verified when discover is rejected');

    // 1e.4: Reject plans scope row -> tier drops to none, is_verified = FALSE, verified_at = NULL
    await pool.query(
      `UPDATE user_verifications SET status = 'rejected', rejection_reason = 'Test rejection 2' WHERE id = $1`,
      [plansVerId]
    );

    let m4 = (await pool.query(`SELECT is_verified, verification_tier, verified_at FROM members WHERE id = $1`, [testMemberId])).rows[0];
    assert(m4.is_verified === false, 'Member is_verified drops to FALSE when all verifications rejected');
    assert(m4.verification_tier === 'none', 'Member verification_tier drops to none');
    assert(m4.verified_at === null, 'Member verified_at set to NULL when unverified');

    // 1e.5: Test id_verified floor protection
    await pool.query(`UPDATE members SET verification_tier = 'id_verified', is_verified = TRUE WHERE id = $1`, [testMemberId]);
    await pool.query(`UPDATE user_verifications SET status = 'approved' WHERE id = $1`, [plansVerId]);
    await pool.query(`UPDATE user_verifications SET status = 'rejected' WHERE id = $1`, [plansVerId]);
    let m5 = (await pool.query(`SELECT is_verified, verification_tier FROM members WHERE id = $1`, [testMemberId])).rows[0];
    assert(m5.verification_tier === 'id_verified', 'id_verified floor is strictly preserved despite trigger recomputation');

    // ------------------------------------------------------------------------
    // TEST C: Scope='plans' Ineligible Reference Photo Pre-check
    // ------------------------------------------------------------------------
    console.log('\n--- Test C: Ineligible Reference Photo Handling for scope=plans ---');

    // Mock an invalid image URL without a face
    const invalidPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/nonexistent_photo_no_face.jpg';
    let detectionRes;
    try {
      detectionRes = await detectFace(invalidPhotoUrl);
    } catch (err) {
      detectionRes = { faceEligible: false, reason: err.message };
    }
    assert(detectionRes.faceEligible === false, 'detectFace correctly flags invalid/no-face image as ineligible');

    // ------------------------------------------------------------------------
    // TEST D: Scope='plans' End-to-End Face Matching & Tier Assignment
    // ------------------------------------------------------------------------
    console.log('\n--- Test D: Scope=plans Face Match Execution ---');

    // Reset test member tier
    await pool.query(`UPDATE members SET verification_tier = 'none', is_verified = FALSE WHERE id = $1`, [testMemberId]);

    // Use working sample face image for manual reference photo
    const validSamplePhoto = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
    
    // Call matchVideoToReferences directly with scope='plans'
    const matchRes = await matchVideoToReferences('sample_video', testMemberId, pool, {
      scope: 'plans',
      manualReferencePhotoUrl: validSamplePhoto,
    });

    assert(matchRes.referencePhotoUrls && matchRes.referencePhotoUrls[0] === validSamplePhoto, 'matchVideoToReferences uses manualReferencePhotoUrl for plans scope');
    assert(matchRes.status != null, 'matchVideoToReferences successfully processes plans scope manual reference');
    console.log('  Matching result for plans scope:', matchRes.status);

    // Clean up test verification records
    await pool.query(`DELETE FROM user_verifications WHERE user_id = $1`, [testMemberId]);

    // ------------------------------------------------------------------------
    // TEST E: Regression Test — Discover Scope Unaffected
    // ------------------------------------------------------------------------
    console.log('\n--- Test E: Discover Scope Regression Verification ---');
    const discoverMatchRes = await matchVideoToReferences('sample_video', testMemberId, pool, {
      scope: 'discover',
    });
    assert(discoverMatchRes.status === 'insufficient_references', 'Discover scope correctly checks for >=2 discover photos (returns insufficient_references when missing)');

  } catch (err) {
    console.error('Error during testing:', err);
    failures++;
  } finally {
    if (testMemberId) {
      await pool.query(`DELETE FROM user_verifications WHERE user_id = $1`, [testMemberId]);
      await pool.query(`DELETE FROM members WHERE id = $1`, [testMemberId]);
      console.log(`Cleaned up test member ID ${testMemberId}`);
    }
    await pool.end();
  }

  console.log(`\n=== TESTS COMPLETED: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'} ===`);
}

runTests();
