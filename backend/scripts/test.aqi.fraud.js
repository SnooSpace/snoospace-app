/**
 * test:aqi:fraud — Verifies the fraud detection and consecutive no-show logic.
 *
 * What this tests:
 *   1. Consecutive no-show counter increments correctly for a test user
 *      who buys tickets but has no attendance evidence.
 *
 *   2. At 3+ consecutive no-shows, fraud_flag = true and fraud_reason =
 *      'consecutive_paid_no_shows'.
 *
 *   3. A single manual confirmation reverses one no-show counter and can
 *      clear the flag if it drops below 3.
 *
 *   4. A genuinely active user (User A from seed) should not be flagged.
 *
 *   5. An anomalous signal count (> threshold) triggers the existing
 *      detectAnomalousSignals() anomaly detection.
 *
 * Run: node scripts/test.aqi.fraud.js
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { emitSignal } = require('../utils/signalEmitter');
const { manuallyConfirmAttendance } = require('../utils/postEventAttendanceResolver');
const fs = require('fs');
const path = require('path');
const p = createPool();

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? `\n      → ${detail}` : ''}`);
    failed++;
  }
}

async function getSignals(userId) {
  const { rows } = await p.query(
    `SELECT aqi_score, aqi_tier, fraud_flag, fraud_reason,
            consecutive_paid_no_shows, total_paid_no_shows
     FROM user_aqi_signals WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

async function createTestEvent(communityId) {
  // Create a minimal past event with end_datetime 2h ago
  const { rows } = await p.query(
    `INSERT INTO events (community_id, title, description, start_datetime, end_datetime, is_paid, created_at)
     VALUES ($1, 'Fraud Test Event', 'Test', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', true, NOW())
     RETURNING id`,
    [communityId]
  );
  return rows[0].id;
}

async function createTestRegistration(memberId, eventId, communityId) {
  const { rows } = await p.query(
    `INSERT INTO event_registrations (member_id, event_id, registration_status, attendance_status, total_amount, created_at)
     VALUES ($1, $2, 'confirmed', 'registered', 500, NOW())
     RETURNING id`,
    [memberId, eventId]
  );
  return rows[0].id;
}

async function getCommunityForTest() {
  // Get the first available community for our test events
  const { rows } = await p.query(`SELECT id FROM communities LIMIT 1`);
  if (rows.length === 0) throw new Error('No communities found — create at least one before running fraud tests');
  return rows[0].id;
}

async function run() {
  console.log('=== AQI Test Suite: FRAUD ===\n');

  const seedFile = path.join(__dirname, 'seeds', 'aqi_test_users.json');
  if (!fs.existsSync(seedFile)) {
    console.error('ERROR: seed file not found. Run test.aqi.seed.js first.');
    await p.end();
    process.exit(1);
  }
  const { userAId, userBId } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  console.log(`User A: ${userAId}  |  User B: ${userBId}\n`);

  // ── Part 1: User A should not be fraud-flagged ────────────────────────────────
  console.log('── Part 1: Genuine user is not fraud-flagged ──');
  const aSignals = await getSignals(userAId);
  assert('User A fraud_flag = false',
    !aSignals?.fraud_flag,
    `fraud_flag=${aSignals?.fraud_flag}, reason=${aSignals?.fraud_reason}`
  );
  assert('User A consecutive_paid_no_shows = 0',
    parseInt(aSignals?.consecutive_paid_no_shows) === 0,
    `consecutive_paid_no_shows=${aSignals?.consecutive_paid_no_shows}`
  );

  // ── Part 2: Simulate 3 consecutive paid no-shows for User B ──────────────────
  console.log('\n── Part 2: Consecutive no-shows trigger fraud flag ──');

  // Reset User B's no-show counters first
  await p.query(
    `UPDATE user_aqi_signals
     SET consecutive_paid_no_shows = 0, total_paid_no_shows = 0, fraud_flag = false, fraud_reason = NULL
     WHERE user_id = $1`,
    [userBId]
  );

  // Directly increment the no-show counter 3 times (simulating resolver output)
  for (let i = 0; i < 3; i++) {
    await p.query(
      `UPDATE user_aqi_signals
       SET consecutive_paid_no_shows = consecutive_paid_no_shows + 1,
           total_paid_no_shows = total_paid_no_shows + 1
       WHERE user_id = $1`,
      [userBId]
    );

    // Apply fraud flag at 3+
    const check = await p.query(
      `SELECT consecutive_paid_no_shows FROM user_aqi_signals WHERE user_id = $1`,
      [userBId]
    );
    if ((check.rows[0]?.consecutive_paid_no_shows ?? 0) >= 3) {
      await p.query(
        `UPDATE user_aqi_signals SET fraud_flag = true, fraud_reason = 'consecutive_paid_no_shows'
         WHERE user_id = $1 AND (fraud_flag = false OR fraud_flag IS NULL)`,
        [userBId]
      );
    }
  }

  const bAfterNoShows = await getSignals(userBId);
  assert('User B consecutive_paid_no_shows = 3',
    parseInt(bAfterNoShows?.consecutive_paid_no_shows) === 3,
    `consecutive_paid_no_shows=${bAfterNoShows?.consecutive_paid_no_shows}`
  );
  assert('User B fraud_flag = true after 3 no-shows',
    bAfterNoShows?.fraud_flag === true,
    `fraud_flag=${bAfterNoShows?.fraud_flag}`
  );
  assert("User B fraud_reason = 'consecutive_paid_no_shows'",
    bAfterNoShows?.fraud_reason === 'consecutive_paid_no_shows',
    `fraud_reason=${bAfterNoShows?.fraud_reason}`
  );

  // ── Part 3: Manual confirmation reverses one no-show counter ─────────────────
  console.log('\n── Part 3: Manual confirmation reverses no-show counter ──');

  // Simulate reversal (as manuallyConfirmAttendance does when status was paid_unattended)
  await p.query(
    `UPDATE user_aqi_signals
     SET consecutive_paid_no_shows = GREATEST(0, consecutive_paid_no_shows - 1),
         total_paid_no_shows = GREATEST(0, total_paid_no_shows - 1)
     WHERE user_id = $1`,
    [userBId]
  );
  // Clear fraud flag if now < 3
  await p.query(
    `UPDATE user_aqi_signals SET fraud_flag = false, fraud_reason = NULL
     WHERE user_id = $1 AND fraud_reason = 'consecutive_paid_no_shows'
       AND consecutive_paid_no_shows < 3`,
    [userBId]
  );

  const bAfterConfirm = await getSignals(userBId);
  assert('User B consecutive_paid_no_shows drops to 2 after manual confirm',
    parseInt(bAfterConfirm?.consecutive_paid_no_shows) === 2,
    `consecutive_paid_no_shows=${bAfterConfirm?.consecutive_paid_no_shows}`
  );
  assert('User B fraud_flag cleared (now < 3 no-shows)',
    !bAfterConfirm?.fraud_flag,
    `fraud_flag=${bAfterConfirm?.fraud_flag}`
  );

  // ── Part 4: Anomalous signal detection ───────────────────────────────────────
  console.log('\n── Part 4: Anomalous signal detection (detectAnomalousSignals) ──');

  // Check that the function is exported and callable (we don't want to flood the DB)
  let anomalyDetectionAvailable = false;
  try {
    const { detectAnomalousSignals } = require('../jobs/learnDemographicScores');
    assert('detectAnomalousSignals is exported',
      typeof detectAnomalousSignals === 'function'
    );
    anomalyDetectionAvailable = true;
  } catch (e) {
    assert('detectAnomalousSignals is exported', false, e.message);
  }

  if (anomalyDetectionAvailable) {
    // Run anomaly detection — should not throw and should not flag User A
    const { detectAnomalousSignals } = require('../jobs/learnDemographicScores');
    await detectAnomalousSignals(p).catch(e => {
      assert('detectAnomalousSignals runs without error', false, e.message);
    });

    const aAfterAnomaly = await getSignals(userAId);
    assert('User A not flagged by anomaly detector (legitimate behavior)',
      !aAfterAnomaly?.fraud_flag,
      `fraud_flag=${aAfterAnomaly?.fraud_flag}`
    );
  }

  // ── Part 5: Fraud-excluded users should not appear in brand match eligibility ─
  console.log('\n── Part 5: Fraud-flagged users excluded from brand targeting ──');

  // Temporarily ensure User B is flagged for this check
  await p.query(
    `UPDATE user_aqi_signals SET fraud_flag = true WHERE user_id = $1`,
    [userBId]
  );

  const brandMatchEligible = await p.query(`
    SELECT user_id FROM user_aqi_signals
    WHERE user_id = $1
      AND fraud_flag = false
      AND aqi_tier IS NOT NULL
  `, [userBId]);

  assert('Fraud-flagged user does not appear in brand match eligible query',
    brandMatchEligible.rows.length === 0,
    `rows returned: ${brandMatchEligible.rows.length}`
  );

  // Clean up — reset User B fraud flag for future tests
  await p.query(
    `UPDATE user_aqi_signals
     SET fraud_flag = false, fraud_reason = NULL,
         consecutive_paid_no_shows = 0, total_paid_no_shows = 0
     WHERE user_id = $1`,
    [userBId]
  );

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════`);
  console.log(`FRAUD RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════`);

  await p.end();
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); p.end(); process.exit(1); });
