/**
 * verify_admin_reclassification.js
 *
 * Verification suite for Step 3: Admin Surfacing & "Other" Reclassification.
 * Tests:
 *   1. Cancellation with 'other' creates community_disruption row with needs_manual_review=true, is_genuine=false.
 *   2. Postponement with 'other' creates second disruption row -> community hits 2 non-genuine strikes -> cancellation_flagged = true.
 *   3. listDisruptions endpoint lists pending disruptions with community name and event title.
 *   4. reclassifyDisruption with is_genuine = true updates row (reviewed_by, reviewed_at, needs_manual_review=false).
 *   5. Automatic reliability recalculation triggers: non_genuine count drops to 1, cancellation_flagged dynamically resets to false.
 *   6. Verification that communityVerification query surfaces total_disruptions_90d = 2, non_genuine_cancellation_count = 1, cancellation_flagged = false.
 *   7. Reclassification of second disruption confirms non-genuine -> queue becomes empty for needs_review.
 */

require('dotenv').config();
const assert = require('assert');
const { Pool } = require('pg');
const { cancelEventWithRefunds } = require('../services/eventCancellationService');
const { declarePostponement } = require('../services/eventPostponementService');
const { listDisruptions, reclassifyDisruption } = require('../controllers/communityDisruptionAdminController');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const ts = Date.now();

async function createTestAdmin() {
  const res = await pool.query(
    `INSERT INTO admins (email, password_hash, name, role, is_active)
     VALUES ($1, 'testhash', 'Admin Reclassification Tester', 'superadmin', true)
     RETURNING id`,
    [`admin_${ts}_${Math.floor(Math.random()*10000)}@test.com`]
  );
  return res.rows[0].id;
}

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
  const start = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
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

async function addRegistration(eventId, memberId) {
  const res = await pool.query(
    `INSERT INTO event_registrations (event_id, member_id, registration_status, total_amount)
     VALUES ($1, $2, 'registered', 100.00)
     RETURNING id`,
    [eventId, memberId]
  );
  return res.rows[0].id;
}

// Mock express req/res
function mockReqRes(options = {}) {
  const req = {
    query: options.query || {},
    params: options.params || {},
    body: options.body || {},
    admin: options.admin || { id: 1 },
    app: { get: () => pool },
  };
  let responseData = null;
  let responseStatus = 200;
  const res = {
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
  };
  return {
    req,
    res,
    getStatus: () => responseStatus,
    getData: () => responseData,
  };
}

async function runTests() {
  console.log('===============================================================');
  console.log('  STEP 3: ADMIN SURFACING & RECLASSIFICATION VERIFICATION SUITE');
  console.log('===============================================================');

  const adminId = await createTestAdmin();
  const communityId = await createTestCommunity(`Admin Test Community ${ts}`);
  const memberId = await createTestMember(`Admin Test Member ${ts}`);
  console.log(`Created test admin: ${adminId}, community: ${communityId}, member: ${memberId}`);

  // Create two events with 1 attendee each
  const event1Id = await createTestEvent(communityId, `Disrupted Event 1 ${ts}`);
  await addRegistration(event1Id, memberId);

  const event2Id = await createTestEvent(communityId, `Disrupted Event 2 ${ts}`);
  await addRegistration(event2Id, memberId);

  // ── [Test 1] Cancel Event 1 with 'other' ──────────────────────────────────
  console.log('\n[ Test 1 ] Cancel Event 1 with reason "other"');
  const cancelRes = await cancelEventWithRefunds(
    pool,
    event1Id,
    communityId,
    'community',
    { reason_category: 'other', reason_text: 'Had an unforeseen issue' }
  );
  assert.strictEqual(cancelRes.success, true);
  assert.strictEqual(cancelRes.disruption_recorded, true);

  const commAfterCancel = await pool.query('SELECT cancellation_flagged, non_genuine_cancellation_count FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(commAfterCancel.rows[0].cancellation_flagged, false, 'Should not be flagged after 1 non-genuine disruption');
  assert.strictEqual(commAfterCancel.rows[0].non_genuine_cancellation_count, 1, 'non_genuine_cancellation_count should be 1');
  console.log('  ✔ Strike 1 recorded, unflagged');

  // ── [Test 2] Postpone Event 2 with 'other' ────────────────────────────────
  console.log('\n[ Test 2 ] Postpone Event 2 with reason "other" (triggers flag >= 2)');
  const postponeRes = await declarePostponement(
    pool,
    event2Id,
    communityId,
    'community',
    { reason_category: 'other', reason_text: 'Another unexplained change' }
  );
  assert.strictEqual(postponeRes.success, true);

  const commAfterPostpone = await pool.query('SELECT cancellation_flagged, non_genuine_cancellation_count FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(commAfterPostpone.rows[0].cancellation_flagged, true, 'Should BE FLAGGED after 2 non-genuine disruptions');
  assert.strictEqual(commAfterPostpone.rows[0].non_genuine_cancellation_count, 2, 'non_genuine_cancellation_count should be 2');
  console.log('  ✔ Strike 2 recorded, community cancellation_flagged = true');

  // ── [Test 3] Admin listDisruptions endpoint ───────────────────────────────
  console.log('\n[ Test 3 ] Admin listDisruptions endpoint with status=needs_review');
  const { req: listReq, res: listRes, getData: getListData } = mockReqRes({
    query: { status: 'needs_review' },
  });
  await listDisruptions(listReq, listRes);
  const listResult = getListData();
  assert.strictEqual(listResult.success, true);
  assert(Array.isArray(listResult.disruptions), 'disruptions should be an array');

  // Find our 2 disruptions
  const d1 = listResult.disruptions.find(d => d.event_id == event1Id);
  const d2 = listResult.disruptions.find(d => d.event_id == event2Id);
  assert(d1, 'Event 1 disruption must be in the queue');
  assert(d2, 'Event 2 disruption must be in the queue');
  assert.strictEqual(d1.disruption_type, 'cancellation');
  assert.strictEqual(d2.disruption_type, 'postponement');
  assert.strictEqual(d1.needs_manual_review, true);
  assert.strictEqual(d1.is_genuine, false);
  assert.strictEqual(d1.event_title, `Disrupted Event 1 ${ts}`, 'Event title joined correctly');
  assert.strictEqual(d1.community_name, `Admin Test Community ${ts}`, 'Community name joined correctly');
  console.log('  ✔ Both disruptions listed with proper joins and status=needs_review');

  // ── [Test 4] Admin reclassify Disruption 1 as Genuine ─────────────────────
  console.log('\n[ Test 4 ] Admin reclassify Disruption 1 as Genuine (is_genuine: true)');
  const { req: patchReq, res: patchRes, getData: getPatchData } = mockReqRes({
    params: { id: d1.id },
    body: { is_genuine: true, review_notes: 'Verified emergency documentation' },
    admin: { id: adminId },
  });
  await reclassifyDisruption(patchReq, patchRes);
  const patchResult = getPatchData();
  assert.strictEqual(patchResult.success, true);
  assert.strictEqual(patchResult.disruption.is_genuine, true);
  assert.strictEqual(patchResult.disruption.needs_manual_review, false);
  assert(patchResult.disruption.reason_text.includes('Verified emergency documentation'), 'Review note appended to reason_text');
  console.log('  ✔ Disruption 1 successfully marked as genuine');

  // ── [Test 5] Dynamic Reliability Recalculation Verification ──────────────
  console.log('\n[ Test 5 ] Verify dynamic community reliability unflagging after reclassification');
  const commAfterReclass = await pool.query('SELECT cancellation_flagged, non_genuine_cancellation_count FROM communities WHERE id = $1', [communityId]);
  assert.strictEqual(commAfterReclass.rows[0].non_genuine_cancellation_count, 1, 'non_genuine count dropped back to 1');
  assert.strictEqual(commAfterReclass.rows[0].cancellation_flagged, false, 'cancellation_flagged dynamically cleared back to false!');
  console.log('  ✔ Community dynamically UNFLAGGED (non_genuine count: 1, cancellation_flagged: false)');

  // ── [Test 6] Verification Query (adminGetAll surfacing) ───────────────────
  console.log('\n[ Test 6 ] Verify communityVerification query surfaces total_disruptions_90d and flags');
  const adminGetQuery = `
    SELECT
      c.id, c.name, c.cancellation_flagged, c.non_genuine_cancellation_count,
      (
        SELECT COUNT(*)
        FROM community_disruptions cd
        WHERE cd.community_id = c.id
          AND cd.created_at >= NOW() - INTERVAL '90 days'
      )::int AS total_disruptions_90d
    FROM communities c
    WHERE c.id = $1
  `;
  const adminGetRes = await pool.query(adminGetQuery, [communityId]);
  const row = adminGetRes.rows[0];
  assert.strictEqual(row.cancellation_flagged, false);
  assert.strictEqual(row.non_genuine_cancellation_count, 1);
  assert.strictEqual(row.total_disruptions_90d, 2, 'Total disruptions (1 cancel + 1 postpone) is 2');
  console.log(`  ✔ Community context query returned: total_disruptions_90d = ${row.total_disruptions_90d}, non_genuine = ${row.non_genuine_cancellation_count}, flagged = ${row.cancellation_flagged}`);

  // ── [Test 7] Confirm Disruption 2 as Non-Genuine ──────────────────────────
  console.log('\n[ Test 7 ] Admin confirms Disruption 2 as Non-Genuine');
  const { req: patch2Req, res: patch2Res, getData: getPatch2Data } = mockReqRes({
    params: { id: d2.id },
    body: { is_genuine: false, review_notes: 'Host confirmed unexcused date change' },
    admin: { id: adminId },
  });
  await reclassifyDisruption(patch2Req, patch2Res);
  const patch2Result = getPatch2Data();
  assert.strictEqual(patch2Result.success, true);
  assert.strictEqual(patch2Result.disruption.is_genuine, false);
  assert.strictEqual(patch2Result.disruption.needs_manual_review, false);

  // Check that the queue is now empty for needs_review
  const { req: list2Req, res: list2Res, getData: getList2Data } = mockReqRes({
    query: { status: 'needs_review' },
  });
  await listDisruptions(list2Req, list2Res);
  const list2Result = getList2Data();
  const remainingInQueue = list2Result.disruptions.filter(d => d.community_id == communityId);
  assert.strictEqual(remainingInQueue.length, 0, 'No more pending review disruptions for this community');
  console.log('  ✔ Queue cleared of pending reviews for community');

  console.log('\n===============================================================');
  console.log('  ALL STEP 3 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('===============================================================');

  await pool.end();
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  pool.end();
  process.exit(1);
});
