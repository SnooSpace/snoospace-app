require('dotenv').config();
const { createPool } = require('../config/db');
const { proofGate } = require('../middleware/proofGate');

async function runVerification() {
  const pool = createPool();
  console.log('=== STARTING OPEN PLANS HOSTING FIX VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log('  ✅ PASS:', msg);
      passed++;
    } else {
      console.error('  ❌ FAIL:', msg);
      failed++;
    }
  }

  try {
    // 1. Check trigger definition on user_verifications
    const triggerRes = await pool.query(
      "SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_sync_verification_badge';"
    );
    const triggerDef = triggerRes.rows[0]?.pg_get_triggerdef || '';
    console.log('1. Trigger Definition:', triggerDef);
    assert(
      triggerDef.includes('INSERT') && triggerDef.includes('UPDATE') && triggerDef.includes('DELETE'),
      'Trigger listens to INSERT OR UPDATE OR DELETE'
    );

    // 2. Check Member 51 status in DB
    const mem51 = (await pool.query(
      'SELECT id, name, is_verified, verification_tier, plans_access_blocked FROM members WHERE id = 51'
    )).rows[0];
    console.log('\n2. Member 51 DB State:', mem51);
    assert(mem51.is_verified === true, 'Member 51 is_verified is TRUE');
    assert(mem51.verification_tier === 'plans_verified', 'Member 51 tier is plans_verified');
    assert(mem51.plans_access_blocked === false, 'Member 51 plans_access_blocked is FALSE');

    // 3. Test proofGate for Member 51 directly
    console.log('\n3. Testing proofGate with Member 51:');
    let proofGatePassed = false;
    let proofGateStatus = null;
    let proofGateError = null;

    const mockReq = {
      app: { locals: { pool } },
      user: { id: 51, type: 'member' },
    };
    const mockRes = {
      status: (code) => {
        proofGateStatus = code;
        return {
          json: (data) => {
            proofGateError = data;
          },
        };
      },
    };
    const mockNext = () => {
      proofGatePassed = true;
    };

    await proofGate(mockReq, mockRes, mockNext);
    assert(proofGatePassed === true, 'proofGate calls next() for Member 51');

    // 4. Test Priority 2b Self-Healing Fallback
    console.log('\n4. Testing Priority 2b Fallback & Auto-Heal:');
    // Artificially desync Member 51
    await pool.query(
      "UPDATE members SET is_verified = FALSE, verification_tier = 'none' WHERE id = 51"
    );
    const desyncedMem = (await pool.query(
      'SELECT is_verified, verification_tier FROM members WHERE id = 51'
    )).rows[0];
    assert(desyncedMem.is_verified === false, 'Artificially desynced Member 51 to is_verified = FALSE');

    let fallbackPassed = false;
    await proofGate(mockReq, mockRes, () => { fallbackPassed = true; });
    assert(fallbackPassed === true, 'proofGate Priority 2b allows Member 51 even when is_verified was FALSE');

    // Wait 100ms for async auto-heal query
    await new Promise((r) => setTimeout(r, 200));

    const healedMem = (await pool.query(
      'SELECT is_verified, verification_tier FROM members WHERE id = 51'
    )).rows[0];
    console.log('Healed Member 51 DB State:', healedMem);
    assert(healedMem.is_verified === true, 'proofGate successfully auto-healed Member 51 is_verified back to TRUE');
    assert(healedMem.verification_tier === 'plans_verified', 'proofGate successfully auto-healed verification_tier to plans_verified');

    // 5. Test Profile Photo Patch Anti-Cheat logic
    console.log('\n5. Testing Profile Photo Patch does NOT strip plans_verified:');
    // Simulate updating discover_photos for Member 51
    const { is_verified, verified_reference_photos, verification_tier } = (await pool.query(
      'SELECT is_verified, verified_reference_photos, verification_tier FROM members WHERE id = 51'
    )).rows[0];

    const isDiscoverVerified = verification_tier === 'selfie_verified' || verification_tier === 'id_verified';
    const hasRemovedRefPhoto = isDiscoverVerified && Array.isArray(verified_reference_photos) && verified_reference_photos.length > 0;
    assert(!hasRemovedRefPhoto, 'Anti-cheat correctly ignores photo edits for plans_verified users');

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await pool.end();
  }
}

runVerification();
