/**
 * cleanup.js
 *
 * Removes all test data seeded by seedCommunityTestData.js.
 * Safe to run between test iterations.
 *
 * Run: npm run test:community:cleanup
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createPool } = require('../../config/db');
const path = require('path');
const fs = require('fs');

const pool = createPool();

const cleanup = async () => {
  console.log('\n🧹 Cleaning up community test data...\n');

  // Load IDs if available (for precise cleanup)
  let ids = null;
  const idsPath = path.join(__dirname, 'testIds.json');
  if (fs.existsSync(idsPath)) {
    ids = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
    console.log('  Using testIds.json for targeted cleanup:', ids);
  }

  // ── Fake Razorpay payments ────────────────────────────────────────────────
  const payResult = await pool.query(
    `DELETE FROM razorpay_payments WHERE razorpay_payment_id LIKE 'pay_test_%'`
  );
  console.log(`  🗑️  Razorpay payments removed: ${payResult.rowCount}`);

  // ── Event registrations for test members ─────────────────────────────────
  const regResult = await pool.query(
    `DELETE FROM event_registrations
     WHERE member_id IN (
       SELECT id FROM members WHERE email LIKE '%@snoospace.dev'
     )`
  );
  console.log(`  🗑️  Event registrations removed: ${regResult.rowCount}`);

  // ── Follow events ─────────────────────────────────────────────────────────
  if (ids) {
    const feResult = await pool.query(
      `DELETE FROM follow_events
       WHERE creator_id IN ($1, $2, $3)
          OR follower_id IN (
            SELECT id FROM members WHERE email LIKE '%@snoospace.dev'
          )`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Follow events removed: ${feResult.rowCount}`);

    const followsResult = await pool.query(
      `DELETE FROM follows WHERE following_id IN ($1, $2, $3)`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Follows removed: ${followsResult.rowCount}`);
  }

  // ── Behavior events for test communities ─────────────────────────────────
  if (ids) {
    const beResult = await pool.query(
      `DELETE FROM user_behavior_events WHERE user_id IN ($1, $2, $3)`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Behavior events removed: ${beResult.rowCount}`);
  }

  // ── Events ────────────────────────────────────────────────────────────────
  if (ids) {
    const evResult = await pool.query(
      `DELETE FROM events WHERE community_id IN ($1, $2, $3)`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Events removed: ${evResult.rowCount}`);
  }

  // ── Creator audience stats ────────────────────────────────────────────────
  if (ids) {
    const casResult = await pool.query(
      `DELETE FROM creator_audience_stats WHERE creator_id IN ($1, $2, $3)`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Creator audience stats removed: ${casResult.rowCount}`);
  }

  // ── AQI signals for test members ─────────────────────────────────────────
  const aqiResult = await pool.query(
    `DELETE FROM user_aqi_signals
     WHERE user_id IN (
       SELECT id FROM members WHERE email LIKE '%@snoospace.dev'
     )`
  );
  console.log(`  🗑️  AQI signals removed: ${aqiResult.rowCount}`);

  // ── Consent rows ──────────────────────────────────────────────────────────
  const consentSynthetic = await pool.query(
    `DELETE FROM user_privacy_consent WHERE user_id = 99999`
  );
  console.log(`  🗑️  Synthetic consent rows removed: ${consentSynthetic.rowCount}`);

  if (ids) {
    const consentComm = await pool.query(
      `DELETE FROM user_privacy_consent WHERE user_id IN ($1, $2, $3)`,
      [ids.communityA, ids.communityB, ids.communityC]
    );
    console.log(`  🗑️  Community consent rows removed: ${consentComm.rowCount}`);
  }

  // ── Test members ──────────────────────────────────────────────────────────
  const membResult = await pool.query(
    `DELETE FROM members WHERE email LIKE '%@snoospace.dev'`
  );
  console.log(`  🗑️  Test members removed: ${membResult.rowCount}`);

  // ── Test communities ──────────────────────────────────────────────────────
  const commResult = await pool.query(
    `DELETE FROM communities WHERE name LIKE 'Test Community%'`
  );
  console.log(`  🗑️  Test communities removed: ${commResult.rowCount}`);

  // Remove testIds.json
  if (fs.existsSync(idsPath)) {
    fs.unlinkSync(idsPath);
    console.log('  🗑️  testIds.json removed');
  }

  console.log('\n✅ Community test data cleaned up\n');
  await pool.end();
};

cleanup().catch((e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});
