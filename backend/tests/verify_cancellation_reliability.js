/**
 * verify_cancellation_reliability.js
 *
 * Verification suite for Step 1: Cancellation Reliability System.
 * Tests:
 *   1. Cancellation of an event with 0 attendees -> reason saved, 0 disruption rows.
 *   2. Cancellation with >=1 attendee & genuine reason -> 1 disruption row, genuine=true, not flagged.
 *   3. Cancellation with >=1 attendee & non-genuine reason -> genuine=false, count incremented.
 *   4. Cancellation with 'other' -> genuine=false, manual_review=true, flag triggers when non_genuine >= 2.
 */

require('dotenv').config();
const assert = require('assert');
const { Pool } = require('pg');
const { cancelEventWithRefunds } = require('../services/eventCancellationService');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const ts = Date.now();

async function createTestCommunity(name) {
  const res = await pool.query(
    `INSERT INTO communities (name, username, email, signup_status)
     VALUES ($1, $2, $3, 'completed')
     RETURNING id`,
    [name, `comm_${ts}_${Math.floor(Math.random()*10000)}`, `comm_${ts}_${Math.floor(Math.random()*10000)}@test.com`]
  );
  return res.rows[0].id;
}

async function createTestMember(name) {
  const res = await pool.query(
    `INSERT INTO members (name, username, email, phone, dob, gender, interests, signup_status)
     VALUES ($1, $2, $3, $4, '2000-01-01', 'Male', '["sports", "music", "tech"]'::jsonb, 'completed')
     RETURNING id`,
    [name, `mem_${ts}_${Math.floor(Math.random()*10000)}`, `mem_${ts}_${Math.floor(Math.random()*10000)}@test.com`, `98765${Math.floor(Math.random()*90000+10000)}`]
  );
  return res.rows[0].id;
}

async function createTestEvent(communityId, title) {
  const now = new Date();
  const start = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const res = await pool.query(
    `INSERT INTO events (
       title, creator_id, community_id, creator_type,
       event_date, start_datetime, end_datetime,
       is_published, status
     ) VALUES ($1, $2, $2, 'community', $3, $4, $5, true, 'published')
     RETURNING id`,
    [title, communityId, start.toISOString().split('T')[0], start.toISOString(), end.toISOString()]
  );
  return res.rows[0].id;
}

async function addRegistration(eventId, memberId, status = 'registered') {
  const res = await pool.query(
    `INSERT INTO event_registrations (event_id, member_id, registration_status, total_amount)
     VALUES ($1, $2, $3, 100.00)
     RETURNING id`,
    [eventId, memberId, status]
  );
  return res.rows[0].id;
}

async function runTests() {
  console.log('===============================================================');
  console.log('  CANCELLATION RELIABILITY SYSTEM VERIFICATION SUITE');
  console.log('===============================================================');

  const communityId = await createTestCommunity(`Reliability Test Community ${ts}`);
  const memberId = await createTestMember(`Reliability Buyer ${ts}`);

  console.log(`\nCreated test community: ${communityId}, member: ${memberId}`);

  // ── [Test 1] 0 Attendees Cancellation ─────────────────────────────────────
  console.log('\n[ Test 1 ] Cancel event with 0 attendees: reason saved, 0 disruption rows');
  const event1Id = await createTestEvent(communityId, `Event Zero Attendees ${ts}`);

  const res1 = await cancelEventWithRefunds(
    pool,
    event1Id,
    communityId,
    'community',
    { reason_category: 'personal_emergency', reason_text: 'Host fell ill' }
  );

  assert.strictEqual(res1.success, true, 'cancelEventWithRefunds returned success');
  assert.strictEqual(res1.attendee_count, 0, 'attendee_count is 0');
  assert.strictEqual(res1.disruption_recorded, false, 'disruption_recorded is false');

  const ev1Check = await pool.query('SELECT is_cancelled, cancellation_reason FROM events WHERE id = $1', [event1Id]);
  assert.strictEqual(ev1Check.rows[0].is_cancelled, true, 'events.is_cancelled is true');
  assert.strictEqual(ev1Check.rows[0].cancellation_reason, 'personal_emergency', 'events.cancellation_reason saved');

  const dis1Check = await pool.query('SELECT COUNT(*)::int as count FROM community_disruptions WHERE event_id = $1', [event1Id]);
  assert.strictEqual(dis1Check.rows[0].count, 0, '0 disruption rows created for 0-attendee event');

  const comm1Check = await pool.query('SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(comm1Check.rows[0].non_genuine_cancellation_count, 0, 'non_genuine_cancellation_count unchanged (0)');
  assert.strictEqual(comm1Check.rows[0].cancellation_flagged, false, 'cancellation_flagged is false');
  console.log('  ✓ PASS: Zero-attendee cancellation bypassed disruption logging cleanly');

  // ── [Test 2] Genuine Cancellation (weather_safety) with >=1 attendee ─────
  console.log('\n[ Test 2 ] Cancel event with >=1 attendee and genuine reason (weather_safety)');
  const event2Id = await createTestEvent(communityId, `Event Weather Genuine ${ts}`);
  await addRegistration(event2Id, memberId, 'registered');

  const res2 = await cancelEventWithRefunds(
    pool,
    event2Id,
    communityId,
    'community',
    { reason_category: 'weather_safety', reason_text: 'Cyclone warning' }
  );

  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.attendee_count, 1, 'attendee_count is 1');
  assert.strictEqual(res2.disruption_recorded, true, 'disruption_recorded is true');

  const dis2Check = await pool.query('SELECT * FROM community_disruptions WHERE event_id = $1', [event2Id]);
  assert.strictEqual(dis2Check.rows.length, 1, '1 disruption row created');
  assert.strictEqual(dis2Check.rows[0].is_genuine, true, 'is_genuine = true for weather_safety');
  assert.strictEqual(dis2Check.rows[0].needs_manual_review, false, 'needs_manual_review = false');
  assert.strictEqual(dis2Check.rows[0].reason_category, 'weather_safety');
  assert.strictEqual(dis2Check.rows[0].reason_text, 'Cyclone warning');

  const comm2Check = await pool.query('SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(comm2Check.rows[0].non_genuine_cancellation_count, 0, 'non_genuine_cancellation_count remained 0');
  assert.strictEqual(comm2Check.rows[0].cancellation_flagged, false, 'cancellation_flagged remained false');
  console.log('  ✓ PASS: Genuine cancellation recorded with is_genuine=true without incrementing non_genuine count');

  // ── [Test 3] Non-Genuine Cancellation (change_of_plans) with >=1 attendee ─
  console.log('\n[ Test 3 ] Cancel event with non-genuine reason (change_of_plans)');
  const event3Id = await createTestEvent(communityId, `Event Non-Genuine ${ts}`);
  await addRegistration(event3Id, memberId, 'registered');

  const res3 = await cancelEventWithRefunds(
    pool,
    event3Id,
    communityId,
    'community',
    { reason_category: 'change_of_plans' }
  );

  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.disruption_recorded, true);

  const dis3Check = await pool.query('SELECT * FROM community_disruptions WHERE event_id = $1', [event3Id]);
  assert.strictEqual(dis3Check.rows.length, 1);
  assert.strictEqual(dis3Check.rows[0].is_genuine, false, 'is_genuine = false for change_of_plans');
  assert.strictEqual(dis3Check.rows[0].needs_manual_review, false);

  const comm3Check = await pool.query('SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(comm3Check.rows[0].non_genuine_cancellation_count, 1, 'non_genuine_cancellation_count incremented to 1');
  assert.strictEqual(comm3Check.rows[0].cancellation_flagged, false, 'cancellation_flagged is still false (threshold is >= 2)');
  console.log('  ✓ PASS: Non-genuine cancellation incremented non_genuine_cancellation_count to 1');

  // ── [Test 4] Second Non-Genuine Cancellation ('other') triggers Flag ──────
  console.log('\n[ Test 4 ] Cancel event with reason "other" -> needs_manual_review=true & triggers cancellation_flagged');
  const event4Id = await createTestEvent(communityId, `Event Other Flag ${ts}`);
  await addRegistration(event4Id, memberId, 'registered');

  const res4 = await cancelEventWithRefunds(
    pool,
    event4Id,
    communityId,
    'community',
    { reason_category: 'other', reason_text: 'Equipment not ready' }
  );

  assert.strictEqual(res4.success, true);
  assert.strictEqual(res4.disruption_recorded, true);

  const dis4Check = await pool.query('SELECT * FROM community_disruptions WHERE event_id = $1', [event4Id]);
  assert.strictEqual(dis4Check.rows.length, 1);
  assert.strictEqual(dis4Check.rows[0].is_genuine, false, 'is_genuine = false for other');
  assert.strictEqual(dis4Check.rows[0].needs_manual_review, true, 'needs_manual_review = true for other');
  assert.strictEqual(dis4Check.rows[0].reason_text, 'Equipment not ready');

  const comm4Check = await pool.query('SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(comm4Check.rows[0].non_genuine_cancellation_count, 2, 'non_genuine_cancellation_count is now 2');
  assert.strictEqual(comm4Check.rows[0].cancellation_flagged, true, 'cancellation_flagged is now TRUE (>= 2 non-genuine in 90 days)');
  console.log('  ✓ PASS: "Other" marked for manual review and second non-genuine disruption triggered cancellation_flagged=true');

  console.log('\n===============================================================');
  console.log('  ALL 4 CANCELLATION RELIABILITY TESTS PASSED CLEANLY!  ');
  console.log('===============================================================');

  await pool.end();
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  pool.end().finally(() => process.exit(1));
});
