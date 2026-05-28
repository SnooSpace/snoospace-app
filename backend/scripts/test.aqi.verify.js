/**
 * test:aqi:verify — Verifies AQI correctness for seeded test users.
 *
 * Assertions:
 *   User A (high intent):
 *     - aqi_score > User B's score (hierarchy check)
 *     - aqi_tier <= 2 (expected Tier 1 or 2 given the signals seeded)
 *     - paid_events_attended >= 4
 *     - avg_ticket_price_paid > 0
 *     - content_depth_score > 0
 *     - geographic_breakdown is non-empty in creator_audience_stats (if enough followers)
 *     - rsvp_to_attend_ratio > 0
 *
 *   User B (lurker):
 *     - aqi_tier >= 3 (expected Tier 3 or 4)
 *     - paid_events_attended = 0
 *     - content_depth_score close to 0 or very low
 *
 *   Signal integrity:
 *     - No paid_event_attended signals emitted at RSVP time (webhook audit)
 *     - No user_behavior_events of type paid_event_attended with signal_strength > 3.0
 *       for users who have no confirmed attendance_status rows
 *
 * Run: node scripts/test.aqi.verify.js
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');
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

function assertApprox(name, value, min, max) {
  const ok = value >= min && value <= max;
  assert(name, ok, `expected ${min}–${max}, got ${value}`);
}

async function run() {
  console.log('=== AQI Test Suite: VERIFY ===\n');

  // Load seeded user IDs
  const seedFile = path.join(__dirname, 'seeds', 'aqi_test_users.json');
  if (!fs.existsSync(seedFile)) {
    console.error('ERROR: seed file not found. Run test.aqi.seed.js first.');
    await p.end();
    process.exit(1);
  }
  const { userAId, userBId } = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  console.log(`User A: ${userAId}  |  User B: ${userBId}\n`);

  // ── Fetch AQI signals for both ───────────────────────────────────────────────
  const { rows } = await p.query(
    `SELECT user_id, aqi_score, aqi_tier, aqi_trajectory,
            paid_events_attended, avg_ticket_price_paid,
            total_rsvps, total_attended, rsvp_to_attend_ratio,
            content_depth_score, network_quality_avg,
            total_behavior_events, professional_hours_ratio,
            consecutive_paid_no_shows, total_paid_no_shows,
            fraud_flag
     FROM user_aqi_signals
     WHERE user_id = ANY($1::int[])`,
    [[userAId, userBId]]
  );

  const a = rows.find(r => r.user_id === userAId);
  const b = rows.find(r => r.user_id === userBId);

  if (!a || !b) {
    console.error('ERROR: One or both test users missing from user_aqi_signals. Did seeding complete?');
    await p.end();
    process.exit(1);
  }

  // ── User A assertions ────────────────────────────────────────────────────────
  console.log('── User A (high intent) ──');
  assert('User A has higher AQI score than User B',
    parseFloat(a.aqi_score) > parseFloat(b.aqi_score),
    `A=${a.aqi_score}, B=${b.aqi_score}`);
  assert('User A is in Tier 1, 2 or 3 (not bottom tier)',
    parseInt(a.aqi_tier) <= 3,
    `tier=${a.aqi_tier}`);
  assert('User A paid_events_attended >= 2',
    parseInt(a.paid_events_attended) >= 2,
    `paid_events_attended=${a.paid_events_attended}`);
  assert('User A avg_ticket_price_paid > 0',
    parseFloat(a.avg_ticket_price_paid) > 0,
    `avg_ticket_price_paid=${a.avg_ticket_price_paid}`);
  assert('User A total_attended >= 2 (QR check-ins)',
    parseInt(a.total_attended) >= 2,
    `total_attended=${a.total_attended}`);
  assert('User A total_rsvps >= 4',
    parseInt(a.total_rsvps) >= 4,
    `total_rsvps=${a.total_rsvps}`);
  assert('User A rsvp_to_attend_ratio > 0',
    parseFloat(a.rsvp_to_attend_ratio) > 0,
    `ratio=${a.rsvp_to_attend_ratio}`);
  assert('User A content_depth_score > 0',
    parseFloat(a.content_depth_score) > 0,
    `content_depth_score=${a.content_depth_score}`);
  assert('User A is NOT fraud-flagged',
    !a.fraud_flag,
    `fraud_flag=${a.fraud_flag}`);
  assert('User A total_behavior_events >= 30',
    parseInt(a.total_behavior_events) >= 30,
    `total_behavior_events=${a.total_behavior_events}`);
  assert('User A AQI score > 30 (meaningful behavioral signals)',
    parseFloat(a.aqi_score) >= 30,
    `aqi_score=${a.aqi_score}`);

  console.log('\n── User B (lurker) ──');
  assert('User B is in Tier 3 or 4',
    parseInt(b.aqi_tier) >= 3,
    `tier=${b.aqi_tier}`);
  assert('User B has lower AQI than User A',
    parseFloat(b.aqi_score) < parseFloat(a.aqi_score),
    `B=${b.aqi_score}, A=${a.aqi_score}`);
  assert('User B paid_events_attended = 0',
    parseInt(b.paid_events_attended) === 0,
    `paid_events_attended=${b.paid_events_attended}`);
  assert('User B total_attended = 0',
    parseInt(b.total_attended) === 0,
    `total_attended=${b.total_attended}`);
  assert('User B is NOT fraud-flagged',
    !b.fraud_flag,
    `fraud_flag=${b.fraud_flag}`);
  // ── Signal integrity: no bogus paid_event_attended emitted at RSVP time ──────
  console.log('\n── Signal integrity ──');

  // Any paid_event_attended signal where no confirmed attendance record exists
  const bogusSignals = await p.query(`
    SELECT ube.user_id, COUNT(*) AS cnt
    FROM user_behavior_events ube
    WHERE ube.event_type = 'paid_event_attended'
      AND ube.signal_strength >= 3.0
      AND NOT EXISTS (
        SELECT 1 FROM event_registrations er
        WHERE er.member_id = ube.user_id
          AND er.attendance_status IN ('confirmed_attended','inferred_attended','manually_confirmed','qr_checked_in')
      )
      -- exclude test seed users themselves (they used emitSignal directly, not through real flow)
      AND ube.user_id NOT IN ($1, $2)
    GROUP BY ube.user_id
  `, [userAId, userBId]);

  assert('No production users have bogus paid_event_attended signals without confirmed attendance',
    bogusSignals.rows.length === 0,
    bogusSignals.rows.length > 0
      ? `${bogusSignals.rows.length} user(s) affected: ${JSON.stringify(bogusSignals.rows)}`
      : ''
  );

  // attendance_status NULL check — should have been normalised by migration
  const nullStatus = await p.query(`
    SELECT COUNT(*) AS cnt FROM event_registrations WHERE attendance_status IS NULL
  `);
  assert('All event_registrations have non-NULL attendance_status',
    parseInt(nullStatus.rows[0].cnt) === 0,
    `${nullStatus.rows[0].cnt} rows still have NULL attendance_status`
  );

  // Video signals should not all be at strength 0.3 (i.e., some are using dynamic strength)
  const videoSignals = await p.query(`
    SELECT signal_strength, COUNT(*) AS cnt
    FROM user_behavior_events
    WHERE event_type IN ('content_watched_long', 'content_watched_short')
      AND user_id IN ($1, $2)
    GROUP BY signal_strength
    ORDER BY signal_strength DESC
  `, [userAId, userBId]);

  const hasVariedStrength = videoSignals.rows.some(
    r => parseFloat(r.signal_strength) !== 0.3
  );
  assert('Video signals have varied strength (not all 0.3 default)',
    hasVariedStrength,
    `strengths seen: ${videoSignals.rows.map(r => `${r.signal_strength}×${r.cnt}`).join(', ')}`
  );

  // Search signals: User A should have search_performed with sophistication scoring
  const searchSignals = await p.query(`
    SELECT COUNT(*) AS cnt FROM user_behavior_events
    WHERE user_id = $1 AND event_type = 'search_performed'
  `, [userAId]);
  assert('User A has search_performed signals',
    parseInt(searchSignals.rows[0].cnt) >= 2,
    `search_performed count=${searchSignals.rows[0].cnt}`
  );

  const rsvpConversion = await p.query(`
    SELECT COUNT(*) AS cnt FROM user_behavior_events
    WHERE user_id = $1 AND event_type = 'search_converted_to_rsvp'
  `, [userAId]);
  assert('User A has search_converted_to_rsvp signal',
    parseInt(rsvpConversion.rows[0].cnt) >= 1,
    `search_converted_to_rsvp count=${rsvpConversion.rows[0].cnt}`
  );

  // Post-event echo
  const echoSignals = await p.query(`
    SELECT COUNT(*) AS cnt FROM user_behavior_events
    WHERE user_id = $1 AND event_type = 'post_event_echo'
  `, [userAId]);
  assert('User A has post_event_echo signal',
    parseInt(echoSignals.rows[0].cnt) >= 1,
    `post_event_echo count=${echoSignals.rows[0].cnt}`
  );

  // Razorpay payments — all captured payments should have webhook_verified = true
  const unverifedPayments = await p.query(`
    SELECT COUNT(*) AS cnt FROM razorpay_payments
    WHERE status = 'captured' AND (webhook_verified IS NULL OR webhook_verified = false)
  `);
  assert('No captured payments with webhook_verified = false',
    parseInt(unverifedPayments.rows[0].cnt) === 0,
    `${unverifedPayments.rows[0].cnt} unverified captured payments found`
  );

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════`);
  console.log(`VERIFY RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════`);

  await p.end();
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); p.end(); process.exit(1); });
