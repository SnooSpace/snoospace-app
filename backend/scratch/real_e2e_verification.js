/**
 * Real E2E verification test for:
 * 1. notifications table schema check (VARCHAR vs TEXT)
 * 2. Scenarios (a) through (d) running the ACTUAL handleVerificationRejection service
 *    and database triggers with DEDICATED test accounts, printing verbatim BEFORE and AFTER states.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const { handleVerificationRejection } = require('../services/verificationRejectionService');
const { proofGate } = require('../middleware/proofGate');

const RUN_TAG = `test_${Date.now()}`;

async function runE2ETest() {
  console.log(`\n============================================================`);
  console.log(`STARTING E2E REJECTION CASCADE & PROVISIONAL ACCESS TEST`);
  console.log(`RUN TAG: ${RUN_TAG}`);
  console.log(`============================================================\n`);

  const createdMemberIds = [];
  const createdPlanIds = [];
  const createdNotifIds = [];

  try {
    // ── 0. Schema check: notifications.type ──────────────────────────────────
    console.log(`>>> CHECK 1: ACTUAL COLUMN DEFINITION FOR notifications.type IN DB`);
    const colInfo = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notifications' AND column_name = 'type'
    `);
    console.log(JSON.stringify(colInfo.rows, null, 2));

    // ── Create dedicated test users ──────────────────────────────────────────
    console.log(`\n>>> SEEDING DEDICATED TEST ACCOUNTS`);
    const userRes1 = await pool.query(`
      INSERT INTO members (name, email, phone, dob, gender, interests, is_verified, plans_access_blocked)
      VALUES ($1, $2, '9999000001', '2000-01-01', 'Male', '["tech","art","music"]', false, false)
      RETURNING id, name, email, is_verified, plans_access_blocked
    `, [`TestHost_${RUN_TAG}`, `${RUN_TAG}_host@snoospace.test`]);
    const hostUser = userRes1.rows[0];
    createdMemberIds.push(hostUser.id);

    const userRes2 = await pool.query(`
      INSERT INTO members (name, email, phone, dob, gender, interests, is_verified, plans_access_blocked)
      VALUES ($1, $2, '9999000002', '2000-01-01', 'Female', '["tech","art","sports"]', false, false)
      RETURNING id, name, email, is_verified, plans_access_blocked
    `, [`TestReq_${RUN_TAG}`, `${RUN_TAG}_req@snoospace.test`]);
    const reqUser = userRes2.rows[0];
    createdMemberIds.push(reqUser.id);

    console.log('Seeded Member 1 (Host):', hostUser);
    console.log('Seeded Member 2 (Requester/Attendee):', reqUser);

    // ── SCENARIO (a): First-time Plans submission -> provisional access ──────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (a): First-time Plans submission -> provisional access`);
    console.log(`------------------------------------------------------------`);

    // Helper to simulate proofGate invocation
    async function testProofGate(userId) {
      let allowed = false;
      let blockedResponse = null;
      const req = {
        app: { locals: { pool } },
        user: { id: userId, type: 'member' }
      };
      const res = {
        status(code) {
          return {
            json(payload) {
              blockedResponse = { statusCode: code, payload };
              return blockedResponse;
            }
          };
        }
      };
      const next = () => { allowed = true; };
      await proofGate(req, res, next);
      return { allowed, blockedResponse };
    }

    // Before any verification submitted:
    const gateBefore = await testProofGate(hostUser.id);
    console.log('proofGate before verification submission:', gateBefore);

    // Insert pending plans verification
    const verRes = await pool.query(`
      INSERT INTO user_verifications (user_id, video_storage_path, scope, status)
      VALUES ($1, 'test_storage/v.mp4', 'plans', 'pending')
      RETURNING id, user_id, scope, status, created_at
    `, [hostUser.id]);
    console.log('Inserted pending verification row:', verRes.rows[0]);

    // After pending submission:
    const gateAfter = await testProofGate(hostUser.id);
    console.log('proofGate after pending submission (PROVISIONAL ACCESS):', gateAfter);

    // ── SCENARIO (b): Rejection blocks access even with new pending ──────────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (b): Rejection cascade sets plans_access_blocked=true`);
    console.log(`------------------------------------------------------------`);

    // Setup: hostUser has a pending request on a dummy plan hosted by reqUser
    const otherPlanRes = await pool.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, status)
      VALUES ($1, $2, 'cafe', 'free', 'everyone', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', 'active')
      RETURNING id, title, created_by, status
    `, [reqUser.id, `Other Plan ${RUN_TAG}`]);
    const otherPlan = otherPlanRes.rows[0];
    createdPlanIds.push(otherPlan.id);

    await pool.query(`
      INSERT INTO open_plan_requests (plan_id, requester_id, status)
      VALUES ($1, $2, 'pending')
    `, [otherPlan.id, hostUser.id]);

    console.log('State BEFORE handleVerificationRejection:');
    const memberBeforeB = await pool.query(
      `SELECT id, name, is_verified, plans_access_blocked FROM members WHERE id = $1`,
      [hostUser.id]
    );
    console.log('Member row before rejection:', memberBeforeB.rows[0]);

    const reqBeforeB = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2`,
      [otherPlan.id, hostUser.id]
    );
    console.log('Pending request made by host before rejection:', reqBeforeB.rows[0]);

    // EXECUTE ACTUAL SERVICE
    console.log('\n>>> CALLING REAL handleVerificationRejection(pool, null, hostUser.id, "plans")...');
    await handleVerificationRejection(pool, null, hostUser.id, 'plans');

    console.log('\nState AFTER handleVerificationRejection:');
    const memberAfterB = await pool.query(
      `SELECT id, name, is_verified, plans_access_blocked FROM members WHERE id = $1`,
      [hostUser.id]
    );
    console.log('Member row after rejection (plans_access_blocked should be true):', memberAfterB.rows[0]);

    const reqAfterB = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2`,
      [otherPlan.id, hostUser.id]
    );
    console.log('Join request made by host after rejection (should be declined):', reqAfterB.rows[0]);

    // Resubmission attempt: insert a NEW pending verification
    await pool.query(`
      INSERT INTO user_verifications (user_id, video_storage_path, scope, status)
      VALUES ($1, 'test_storage/v2.mp4', 'plans', 'pending')
    `, [hostUser.id]);

    const gateResub = await testProofGate(hostUser.id);
    console.log('proofGate with new pending verification while blocked=TRUE:', gateResub);

    // ── SCENARIO (c): Approval clears plans_access_blocked via trigger ───────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (c): Approval clears plans_access_blocked via trigger 088`);
    console.log(`------------------------------------------------------------`);

    const latestVer = await pool.query(`
      SELECT id FROM user_verifications WHERE user_id = $1 AND status = 'pending' ORDER BY id DESC LIMIT 1
    `, [hostUser.id]);

    console.log(`Updating verification #${latestVer.rows[0].id} to 'approved'...`);
    await pool.query(`
      UPDATE user_verifications
      SET status = 'approved', reviewed_at = NOW()
      WHERE id = $1
    `, [latestVer.rows[0].id]);

    const memberAfterC = await pool.query(
      `SELECT id, name, is_verified, verification_tier, plans_access_blocked FROM members WHERE id = $1`,
      [hostUser.id]
    );
    console.log('Member row after approval trigger:', memberAfterC.rows[0]);

    const gateAfterApproval = await testProofGate(hostUser.id);
    console.log('proofGate after approval (Full Verified Access):', gateAfterApproval);

    // ── SCENARIO (d1): Host with 0 accepted attendees rejected ───────────────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (d1): Host rejected with 0 accepted attendees -> plan cancelled + takedown notification`);
    console.log(`------------------------------------------------------------`);

    // Reset hostUser to unblocked for this scenario
    await pool.query(`UPDATE members SET is_verified = false, plans_access_blocked = false WHERE id = $1`, [hostUser.id]);

    // Create plan with 0 accepted attendees (reqUser has a pending request)
    const planD1Res = await pool.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, status)
      VALUES ($1, $2, 'sports', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 'active')
      RETURNING id, title, created_by, status
    `, [hostUser.id, `D1 Plan ${RUN_TAG}`]);
    const planD1 = planD1Res.rows[0];
    createdPlanIds.push(planD1.id);

    await pool.query(`
      INSERT INTO open_plan_requests (plan_id, requester_id, status)
      VALUES ($1, $2, 'pending')
    `, [planD1.id, reqUser.id]);

    console.log('Plan D1 BEFORE rejection:', planD1);
    const reqD1Before = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1`,
      [planD1.id]
    );
    console.log('Requesters on Plan D1 BEFORE rejection:', reqD1Before.rows);

    // Call service on host
    console.log('\n>>> CALLING REAL handleVerificationRejection(pool, null, hostUser.id, "plans")...');
    await handleVerificationRejection(pool, null, hostUser.id, 'plans');

    const planD1After = await pool.query(
      `SELECT id, title, status FROM open_plans WHERE id = $1`,
      [planD1.id]
    );
    console.log('Plan D1 AFTER rejection (status should be cancelled):', planD1After.rows[0]);

    const notifD1 = await pool.query(`
      SELECT id, recipient_id, recipient_type, actor_id, actor_type, type, payload
      FROM notifications
      WHERE recipient_id = $1 AND type = 'plan_host_ver_takedown'
      ORDER BY id DESC LIMIT 1
    `, [reqUser.id]);
    if (notifD1.rows[0]) createdNotifIds.push(notifD1.rows[0].id);
    console.log('Notification inserted for pending requester:', notifD1.rows[0]);

    // ── SCENARIO (d2): Host with accepted attendees rejected ─────────────────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (d2): Host rejected with accepted attendees -> plan NOT cancelled, attendees notified`);
    console.log(`------------------------------------------------------------`);

    // Reset hostUser
    await pool.query(`UPDATE members SET is_verified = false, plans_access_blocked = false WHERE id = $1`, [hostUser.id]);

    // Create plan with 1 accepted attendee (reqUser is approved)
    const planD2Res = await pool.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, status)
      VALUES ($1, $2, 'food', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 'active')
      RETURNING id, title, created_by, status
    `, [hostUser.id, `D2 Plan ${RUN_TAG}`]);
    const planD2 = planD2Res.rows[0];
    createdPlanIds.push(planD2.id);

    await pool.query(`
      INSERT INTO open_plan_requests (plan_id, requester_id, status)
      VALUES ($1, $2, 'approved')
    `, [planD2.id, reqUser.id]);

    console.log('Plan D2 BEFORE rejection:', planD2);
    const reqD2Before = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1`,
      [planD2.id]
    );
    console.log('Requesters on Plan D2 BEFORE rejection:', reqD2Before.rows);

    // Call service on host
    console.log('\n>>> CALLING REAL handleVerificationRejection(pool, null, hostUser.id, "plans")...');
    await handleVerificationRejection(pool, null, hostUser.id, 'plans');

    const planD2After = await pool.query(
      `SELECT id, title, status FROM open_plans WHERE id = $1`,
      [planD2.id]
    );
    console.log('Plan D2 AFTER rejection (status should remain active):', planD2After.rows[0]);

    const notifD2 = await pool.query(`
      SELECT id, recipient_id, recipient_type, actor_id, actor_type, type, payload
      FROM notifications
      WHERE recipient_id = $1 AND type = 'plan_host_ver_failed'
      ORDER BY id DESC LIMIT 1
    `, [reqUser.id]);
    if (notifD2.rows[0]) createdNotifIds.push(notifD2.rows[0].id);
    console.log('Notification inserted for approved attendee:', notifD2.rows[0]);

    // ── SCENARIO (d3): Attendee with accepted attendance rejected ────────────
    console.log(`\n------------------------------------------------------------`);
    console.log(`SCENARIO (d3): Attendee rejected -> host notified, request status untouched`);
    console.log(`------------------------------------------------------------`);

    // Reset reqUser
    await pool.query(`UPDATE members SET is_verified = false, plans_access_blocked = false WHERE id = $1`, [reqUser.id]);

    // Create plan hosted by hostUser, where reqUser is an approved attendee
    const planD3Res = await pool.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, status)
      VALUES ($1, $2, 'games', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 'active')
      RETURNING id, title, created_by, status
    `, [hostUser.id, `D3 Plan ${RUN_TAG}`]);
    const planD3 = planD3Res.rows[0];
    createdPlanIds.push(planD3.id);

    await pool.query(`
      INSERT INTO open_plan_requests (plan_id, requester_id, status)
      VALUES ($1, $2, 'approved')
    `, [planD3.id, reqUser.id]);

    console.log('Plan D3 BEFORE attendee rejection:', planD3);
    const reqD3Before = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2`,
      [planD3.id, reqUser.id]
    );
    console.log('Attendance request BEFORE attendee rejection:', reqD3Before.rows[0]);

    // Call service on ATTENDEE (reqUser)
    console.log('\n>>> CALLING REAL handleVerificationRejection(pool, null, reqUser.id, "plans")...');
    await handleVerificationRejection(pool, null, reqUser.id, 'plans');

    const reqD3After = await pool.query(
      `SELECT plan_id, requester_id, status FROM open_plan_requests WHERE plan_id = $1 AND requester_id = $2`,
      [planD3.id, reqUser.id]
    );
    console.log('Attendance request AFTER attendee rejection (status should still be approved):', reqD3After.rows[0]);

    const notifD3 = await pool.query(`
      SELECT id, recipient_id, recipient_type, actor_id, actor_type, type, payload
      FROM notifications
      WHERE recipient_id = $1 AND type = 'plan_attendee_ver_failed'
      ORDER BY id DESC LIMIT 1
    `, [hostUser.id]);
    if (notifD3.rows[0]) createdNotifIds.push(notifD3.rows[0].id);
    console.log('Notification inserted for host regarding attendee:', notifD3.rows[0]);

    console.log(`\n============================================================`);
    console.log(`ALL SCENARIOS EXECUTED SUCCESSFULLY AGAINST REAL SERVICES`);
    console.log(`============================================================`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    console.log('\n>>> CLEANING UP ALL TEST DATA...');
    try {
      if (createdNotifIds.length > 0) {
        await pool.query(`DELETE FROM notifications WHERE id = ANY($1)`, [createdNotifIds]);
      }
      if (createdMemberIds.length > 0) {
        await pool.query(`DELETE FROM notifications WHERE recipient_id = ANY($1) OR actor_id = ANY($1)`, [createdMemberIds]);
        await pool.query(`DELETE FROM user_verifications WHERE user_id = ANY($1)`, [createdMemberIds]);
      }
      if (createdPlanIds.length > 0) {
        await pool.query(`DELETE FROM open_plan_requests WHERE plan_id = ANY($1)`, [createdPlanIds]);
        await pool.query(`DELETE FROM open_plans WHERE id = ANY($1)`, [createdPlanIds]);
      }
      if (createdMemberIds.length > 0) {
        await pool.query(`DELETE FROM open_plan_requests WHERE requester_id = ANY($1)`, [createdMemberIds]);
        await pool.query(`DELETE FROM members WHERE id = ANY($1)`, [createdMemberIds]);
      }
      console.log('Cleanup complete. No test data remains in the database.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await pool.end();
  }
}

runE2ETest();
