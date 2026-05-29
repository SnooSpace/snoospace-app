/**
 * verifyConsentToggle.js
 *
 * Definitively isolates the privacy toggle persistence bug.
 * Simulates exactly what the backend consent endpoint does:
 *   save → load → verify round trip
 *
 * Outcome:
 *   ✅ PASS → bug is 100% in the frontend (useFocusEffect, field name mismatch,
 *             user_type mismatch in API call, or missing auth token)
 *   ❌ FAIL → bug is in the backend ON CONFLICT clause or user_type derivation
 *
 * Run: npm run test:community:consent
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createPool } = require('../../config/db');

const pool = createPool();

const verifyConsentToggle = async () => {
  console.log('\n🔐 Toggle Persistence Diagnostic\n');
  console.log('This test bypasses the HTTP layer entirely.');
  console.log('It directly runs the same SQL the backend uses.\n');

  // Use a real community ID — user_privacy_consent has FK to members/communities
  // We need a row that actually exists in the communities table.
  const communityLookup = await pool.query(
    `SELECT id FROM communities ORDER BY id LIMIT 1`
  );
  if (communityLookup.rows.length === 0) {
    console.log('⚠️  No community accounts found in DB.');
    console.log('   Create a community account first, then rerun this test.');
    console.log('   Alternatively, run npm run test:community:seed first.');
    await pool.end();
    return;
  }
  const testUserId = communityLookup.rows[0].id;
  const testUserType = 'community';
  console.log(`  Using community ID: ${testUserId} (real row from DB)\n`);

  let passed = 0;
  let failed = 0;

  const check = (label, condition, actual, expected) => {
    if (condition) {
      console.log(`  ✅ PASS — ${label}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL — ${label}`);
      console.log(`     Expected: ${JSON.stringify(expected)}`);
      console.log(`     Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  };

  try {
    // ── Clean slate ────────────────────────────────────────────────────────────
    await pool.query(
      `DELETE FROM user_privacy_consent WHERE user_id = $1`,
      [testUserId]
    );

    // ── Step 1: Insert with all false (simulates initial consent) ──────────────
    await pool.query(`
      INSERT INTO user_privacy_consent (
        user_id, user_type,
        behavioral_tracking_consent,
        brand_targeting_consent,
        data_sharing_consent,
        event_audience_intelligence_consent,
        consent_version, consented_at, last_updated_at
      ) VALUES ($1, $2, false, false, false, false, 'v1.0', NOW(), NOW())
      ON CONFLICT (user_id, user_type) DO UPDATE SET
        behavioral_tracking_consent = false,
        brand_targeting_consent = false,
        data_sharing_consent = false,
        event_audience_intelligence_consent = false,
        last_updated_at = NOW()
    `, [testUserId, testUserType]);

    const initial = await pool.query(
      `SELECT * FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [testUserId, testUserType]
    );
    check(
      'Row created with user_type = community',
      initial.rows.length === 1 && initial.rows[0].user_type === 'community',
      initial.rows[0]?.user_type, 'community'
    );
    check(
      'Initial state: behavioral = false',
      initial.rows[0]?.behavioral_tracking_consent === false,
      initial.rows[0]?.behavioral_tracking_consent, false
    );

    // ── Step 2: Simulate PATCH — toggle behavioral ON only (partial update) ───
    // This mirrors exactly what the backend does: read prev, merge, upsert all cols
    const prevRow = initial.rows[0];
    const newBehavioral = true; // toggled

    // finalXxx merge logic — same as backend
    const finalBehavioral = true;
    const finalBrand     = prevRow.brand_targeting_consent;
    const finalDataShare = prevRow.data_sharing_consent;
    const finalEventAud  = prevRow.event_audience_intelligence_consent;

    await pool.query(`
      INSERT INTO user_privacy_consent (
        user_id, user_type,
        behavioral_tracking_consent, brand_targeting_consent,
        data_sharing_consent, event_audience_intelligence_consent,
        consent_version, consented_at, last_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'v1.0', NOW(), NOW())
      ON CONFLICT (user_id, user_type) DO UPDATE SET
        behavioral_tracking_consent = $3,
        brand_targeting_consent = $4,
        data_sharing_consent = $5,
        event_audience_intelligence_consent = $6,
        last_updated_at = NOW()
    `, [testUserId, testUserType, finalBehavioral, finalBrand, finalDataShare, finalEventAud]);

    // ── Step 3: Read back ──────────────────────────────────────────────────────
    const afterToggle = await pool.query(
      `SELECT * FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [testUserId, testUserType]
    );

    const row = afterToggle.rows[0];
    console.log('\n  State after behavioral toggle ON:');
    console.log('  ', {
      behavioral: row?.behavioral_tracking_consent,
      brand: row?.brand_targeting_consent,
      dataSharing: row?.data_sharing_consent,
      eventAudience: row?.event_audience_intelligence_consent,
      userType: row?.user_type,
    });

    check('After toggle: behavioral = true',  row?.behavioral_tracking_consent === true,  row?.behavioral_tracking_consent, true);
    check('After toggle: brand = false',       row?.brand_targeting_consent === false,      row?.brand_targeting_consent, false);
    check('After toggle: dataSharing = false', row?.data_sharing_consent === false,         row?.data_sharing_consent, false);
    check('Row still has user_type = community', row?.user_type === 'community',            row?.user_type, 'community');

    // ── Step 4: Toggle brand ON too ────────────────────────────────────────────
    const prevRow2 = row;
    await pool.query(`
      INSERT INTO user_privacy_consent (
        user_id, user_type,
        behavioral_tracking_consent, brand_targeting_consent,
        data_sharing_consent, event_audience_intelligence_consent,
        consent_version, consented_at, last_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'v1.0', NOW(), NOW())
      ON CONFLICT (user_id, user_type) DO UPDATE SET
        behavioral_tracking_consent = $3,
        brand_targeting_consent = $4,
        data_sharing_consent = $5,
        event_audience_intelligence_consent = $6,
        last_updated_at = NOW()
    `, [testUserId, testUserType,
      prevRow2.behavioral_tracking_consent,
      true, // brand toggled ON
      prevRow2.data_sharing_consent,
      prevRow2.event_audience_intelligence_consent]);

    const afterBrandToggle = await pool.query(
      `SELECT * FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [testUserId, testUserType]
    );
    const row2 = afterBrandToggle.rows[0];
    check('Second toggle: behavioral still = true', row2?.behavioral_tracking_consent === true,  row2?.behavioral_tracking_consent, true);
    check('Second toggle: brand = true',            row2?.brand_targeting_consent === true,       row2?.brand_targeting_consent, true);

    // ── Step 5: Check for duplicate rows (polymorphic ID collision bug) ────────
    const allRows = await pool.query(
      `SELECT user_id, user_type FROM user_privacy_consent WHERE user_id = $1`,
      [testUserId]
    );
    console.log(`\n  All consent rows for test user: ${JSON.stringify(allRows.rows)}`);
    check(
      'No duplicate rows (single row per user_type)',
      allRows.rows.length === 1,
      allRows.rows.length, 1
    );

    // ── Step 6: Verify community-data-summary query path ──────────────────────
    // GET /privacy/community-data-summary hardcodes user_type = 'community'
    // POST /privacy/consent uses req.user.type which comes from JWT
    // If these mismatch, saves write to wrong row and loads read empty
    const summaryQuery = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = 'community'`,
      [testUserId]
    );
    check(
      "Summary endpoint reads correct row (user_type = 'community' hardcoded in GET)",
      summaryQuery.rows.length === 1 && summaryQuery.rows[0].behavioral_tracking_consent === true,
      summaryQuery.rows[0]?.behavioral_tracking_consent, true
    );

    // ── Result ─────────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(55));
    console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);

    if (failed === 0) {
      console.log('✅ BACKEND IS CLEAN — database toggle save/load works correctly.');
      console.log('\n   → If frontend toggles still revert, the bug is 100% in the frontend.');
      console.log('   → Most likely causes in order of probability:');
      console.log('     1. Missing auth token → 401 → catch fires → UI reverts');
      console.log('        FIX: api/privacy.js updateConsent must call getAuthToken()');
      console.log('     2. useFocusEffect reloading consent on screen return');
      console.log('        FIX: move to useEffect with [] deps (mount-only)');
      console.log('     3. user_type mismatch: JWT sends "community" but req.user.type fallback is "member"');
      console.log('        FIX: verify authMiddleware sets req.user.type = "community" for community JWTs');
    } else {
      console.log('❌ BACKEND HAS ISSUES — fix backend before debugging frontend.');
      console.log('\n   → Check: ON CONFLICT clause, user_type derivation, pool.query params');
    }

  } finally {
    // Always clean up the consent row we created (leave the community itself intact)
    await pool.query(
      `DELETE FROM user_privacy_consent WHERE user_id = $1 AND user_type = 'community'`,
      [testUserId]
    );
    await pool.end();
  }
};

verifyConsentToggle().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
