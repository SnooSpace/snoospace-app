/**
 * test:aqi:decay — Verifies that AQI scores decay correctly for inactive users.
 *
 * What this tests:
 *   1. User A (seeded, active) should NOT have dormancy_adjustment_applied = true
 *      because they just received signals.
 *
 *   2. We temporarily backdate User B's last_active_at to 100 days ago,
 *      trigger the AQI recalculation, and verify their score is penalised.
 *
 *   3. We then restore User B's last_active_at and verify the penalty lifts
 *      after a fresh signal is emitted.
 *
 * This tests the dormancy decay path in calculateAqi() without requiring
 * us to wait 60 real days.
 *
 * Run: node scripts/test.aqi.decay.js
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { recalculateAqiAsync, emitSignal } = require('../utils/signalEmitter');
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

async function getAqi(userId) {
  const { rows } = await p.query(
    `SELECT aqi_score, aqi_tier, aqi_trajectory, dormancy_adjustment_applied, last_active_at
     FROM user_aqi_signals WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

async function run() {
  console.log('=== AQI Test Suite: DECAY ===\n');

  const seedFile = path.join(__dirname, 'seeds', 'aqi_test_users.json');
  if (!fs.existsSync(seedFile)) {
    console.error('ERROR: seed file not found. Run test.aqi.seed.js first.');
    await p.end();
    process.exit(1);
  }
  const { userAId, userBId } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  console.log(`User A: ${userAId}  |  User B: ${userBId}\n`);

  // ── Part 1: Active user (User A) should not have dormancy penalty ─────────────
  console.log('── Part 1: Active user has no dormancy penalty ──');
  const aBefore = await getAqi(userAId);
  assert('User A dormancy_adjustment_applied = false',
    !aBefore?.dormancy_adjustment_applied,
    `dormancy_adjustment_applied=${aBefore?.dormancy_adjustment_applied}`
  );

  // ── Part 2: Backdate User B's last_active_at to 100 days ago ─────────────────
  console.log('\n── Part 2: Dormant user gets score penalty ──');

  const bBefore = await getAqi(userBId);
  const scoreBefore = parseFloat(bBefore?.aqi_score) || 0;
  console.log(`  User B score before backdating: ${scoreBefore}`);

  // Backdate to 100 days ago to trigger dormancy path
  await p.query(
    `UPDATE user_aqi_signals
     SET last_active_at = NOW() - INTERVAL '100 days'
     WHERE user_id = $1`,
    [userBId]
  );

  // Trigger recalculation — this should apply the dormancy multiplier
  await recalculateAqiAsync(p, userBId);
  await new Promise(r => setTimeout(r, 800));

  const bAfter = await getAqi(userBId);
  const scoreAfter = parseFloat(bAfter?.aqi_score) || 0;
  console.log(`  User B score after backdating (100d inactive): ${scoreAfter}`);
  console.log(`  dormancy_adjustment_applied: ${bAfter?.dormancy_adjustment_applied}`);

  assert('Dormant user score is penalised (decay multiplier applied)',
    scoreAfter < scoreBefore,
    `before=${scoreBefore}, after=${scoreAfter} — expected score to decrease`
  );
  assert('Dormant user has dormancy_adjustment_applied = true',
    bAfter?.dormancy_adjustment_applied === true,
    `dormancy_adjustment_applied=${bAfter?.dormancy_adjustment_applied}`
  );

  // ── Part 3: Restore — fresh signal lifts dormancy flag ───────────────────────
  console.log('\n── Part 3: Fresh signal lifts dormancy penalty ──');

  // Reset last_active_at to now
  await p.query(
    `UPDATE user_aqi_signals
     SET last_active_at = NOW()
     WHERE user_id = $1`,
    [userBId]
  );

  // Emit a new signal — this should reset dormancy_adjustment_applied
  await emitSignal(p, {
    userId:    userBId,
    userType:  'member',
    eventType: 'post_like',
    category:  null,
    metadata:  { test: 'decay_recovery' },
  });
  await new Promise(r => setTimeout(r, 200));
  await recalculateAqiAsync(p, userBId);
  await new Promise(r => setTimeout(r, 800));

  const bRestored = await getAqi(userBId);
  const scoreRestored = parseFloat(bRestored?.aqi_score) || 0;
  console.log(`  User B score after recovery signal: ${scoreRestored}`);
  console.log(`  dormancy_adjustment_applied: ${bRestored?.dormancy_adjustment_applied}`);

  assert('User B score recovers after fresh signal (dormancy lifted)',
    scoreRestored > scoreAfter,
    `after_decay=${scoreAfter}, after_recovery=${scoreRestored} — expected recovery`
  );
  assert('dormancy_adjustment_applied cleared after fresh signal',
    !bRestored?.dormancy_adjustment_applied,
    `dormancy_adjustment_applied=${bRestored?.dormancy_adjustment_applied}`
  );

  // ── Part 4: Trajectory test — score increase = Stable or Rising ──────────────
  console.log('\n── Part 4: Trajectory reflects direction ──');

  // Re-fetch User A's trajectory (should be Stable or Rising given fresh signals)
  const aFinal = await getAqi(userAId);
  assert('User A trajectory is not Declining (active user)',
    aFinal?.aqi_trajectory !== 'Declining',
    `trajectory=${aFinal?.aqi_trajectory}`
  );

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════`);
  console.log(`DECAY RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════`);

  await p.end();
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); p.end(); process.exit(1); });
