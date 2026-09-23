/**
 * verify_postponement_race_combinations.js
 *
 * Concurrency & race condition verification:
 * 1. Re-postponement vs 30-Day Indefinite Cap Cron:
 *    - Scenario A: Organizer sets new date right as cron sweeps -> cron atomically skips, buyer gets new date
 *    - Scenario B: Cron atomically claims row right as organizer re-postpones -> organizer update skips resolved row, refund proceeds
 * 2. Stale Window Guard (409 STALE_WINDOW):
 *    - Buyer submits decision with expected_deadline from Window 1 after organizer re-postponed to Window 2 -> rejected with 409 STALE_WINDOW
 */

require('dotenv').config();
const assert = require('assert');
const { createPool } = require('../config/db');
const {
  declarePostponement,
  setPostponementNewDate,
  processKeep,
  processOptOut,
  runIndefinitePostponementCap,
} = require('../services/eventPostponementService');

const pool = createPool();

const seedCommunity = async (ts) => {
  const res = await pool.query(
    `INSERT INTO communities (name, username, email, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, name`,
    [`Race Comm ${ts}`, `race_comm_${ts}`, `race_${ts}@test.com`]
  );
  return res.rows[0];
};

const seedMember = async (ts, label) => {
  const res = await pool.query(
    `INSERT INTO members (name, username, email, phone, dob, gender, interests, created_at)
     VALUES ($1, $2, $3, '9911111111', '1994-01-01', 'Male', '["music","art","travel"]', NOW())
     RETURNING id`,
    [`Race ${label}`, `race_${label}_${ts}`, `race_${label}_${ts}@test.com`]
  );
  return res.rows[0].id;
};

const seedEvent = async (communityId, ts, futureHours = 168) => {
  const start = new Date(Date.now() + futureHours * 3600 * 1000);
  const end   = new Date(start.getTime() + 3600 * 1000);
  const res = await pool.query(
    `INSERT INTO events (title, creator_id, community_id, event_type, event_date, start_datetime, end_datetime, created_at)
     VALUES ($1,$2,$2,'in-person',$3,$4,$5,NOW()) RETURNING id`,
    [`Race Event ${ts}`, communityId, start.toISOString().split('T')[0], start.toISOString(), end.toISOString()],
  );
  return res.rows[0].id;
};

const seedRegistrationWithPayment = async (eventId, memberId, amount, ts, label) => {
  const reg = await pool.query(
    `INSERT INTO event_registrations (event_id, member_id, registration_status, total_amount)
     VALUES ($1, $2, 'registered', $3)
     RETURNING id`,
    [eventId, memberId, amount]
  );
  const regId = reg.rows[0].id;

  const tt = await pool.query(
    `INSERT INTO ticket_types (event_id, name, base_price)
     VALUES ($1, 'General', $2)
     RETURNING id`,
    [eventId, amount]
  );

  await pool.query(
    `INSERT INTO registration_tickets (registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price)
     VALUES ($1, $2, 'General', 1, $3, $3)`,
    [regId, tt.rows[0].id, amount]
  );

  const orderId = `ord_race_${label}_${ts}`;
  const paymentId = `pay_race_${label}_${ts}`;
  await pool.query(
    `INSERT INTO razorpay_orders (razorpay_order_id, user_id, event_id, registration_id, amount_paise, currency, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'INR', 'paid', NOW())`,
    [orderId, memberId, eventId, regId, amount * 100]
  );
  await pool.query(
    `INSERT INTO razorpay_payments (razorpay_payment_id, razorpay_order_id, user_id, event_id, amount_paise, currency, status, webhook_verified, captured_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'INR', 'captured', true, NOW(), NOW())`,
    [paymentId, orderId, memberId, eventId, amount * 100]
  );

  return regId;
};

async function run() {
  console.log('\n===============================================================');
  console.log('  POSTPONEMENT RACE COMBINATIONS & STALE WINDOW VERIFICATION   ');
  console.log('===============================================================\n');

  const ts = Date.now();
  const comm = await seedCommunity(ts);

  // ── TEST 1: Re-postponement vs 30-Day Cron (Scenario A: Organizer sets date first) ──
  console.log('[ Race Test 1 ] 30-day cron vs Organizer sets new date (Date set first)');
  const ev1 = await seedEvent(comm.id, ts + 1);
  const mem1 = await seedMember(ts, 'm1');
  await seedRegistrationWithPayment(ev1, mem1, 500, ts + 1, 'm1');

  await declarePostponement(pool, ev1, comm.id, 'community');
  // Backdate postponement to 35 days ago (eligible for 30-day cap)
  await pool.query(`UPDATE events SET postponed_at = NOW() - INTERVAL '35 days' WHERE id = $1`, [ev1]);

  // Organizer sets a new date right before cron claims
  const newDate1 = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  await setPostponementNewDate(pool, ev1, newDate1.toISOString(), comm.name, 'Race Event 1');

  // Now run the 30-day cron
  await runIndefinitePostponementCap(pool);

  // Verification: decision must NOT be auto-refunded, must remain pending with opt-out deadline
  const dec1 = await pool.query(`SELECT decision, new_date_set_at, opt_out_deadline FROM event_postponement_decisions WHERE event_id = $1`, [ev1]);
  assert.strictEqual(dec1.rows[0].decision, 'pending', 'Decision remains pending for the new date');
  assert(dec1.rows[0].new_date_set_at !== null, 'new_date_set_at is populated');
  assert(dec1.rows[0].opt_out_deadline !== null, 'opt_out_deadline is populated');

  const refundCheck1 = await pool.query(`SELECT COUNT(*)::int as c FROM refund_requests WHERE event_id = $1`, [ev1]);
  assert.strictEqual(refundCheck1.rows[0].c, 0, 'No refund created because date was set');
  console.log('  ✓ PASS: Setting new date cleanly prevented 30-day cron from refunding active postponement\n');

  // ── TEST 2: Re-postponement vs 30-Day Cron (Scenario B: Cron claims row first) ──
  console.log('[ Race Test 2 ] 30-day cron vs Organizer sets new date (Cron claims first)');
  const ev2 = await seedEvent(comm.id, ts + 2);
  const mem2 = await seedMember(ts, 'm2');
  await seedRegistrationWithPayment(ev2, mem2, 500, ts + 2, 'm2');

  await declarePostponement(pool, ev2, comm.id, 'community');
  await pool.query(`UPDATE events SET postponed_at = NOW() - INTERVAL '35 days' WHERE id = $1`, [ev2]);

  // Run cron first (claims the row)
  await runIndefinitePostponementCap(pool);

  // Now organizer attempts to set a date after cron resolved it
  const newDate2 = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const setResult = await setPostponementNewDate(pool, ev2, newDate2.toISOString(), comm.name, 'Race Event 2');

  // Verification: 0 decisions updated because it was already claimed by indefinite cap
  assert.strictEqual(setResult.decisions_updated, 0, 'setPostponementNewDate updated 0 decisions');
  const dec2 = await pool.query(`SELECT decision FROM event_postponement_decisions WHERE event_id = $1`, [ev2]);
  assert.strictEqual(dec2.rows[0].decision, 'auto_refunded_indefinite_cap', 'Decision remains auto_refunded_indefinite_cap');
  console.log('  ✓ PASS: Cron claim prevented organizer from overwriting already-refunded decision\n');

  // ── TEST 3: Stale Window Guard (409 STALE_WINDOW on Keep) ────────────────────
  console.log('[ Race Test 3 ] Stale Window Guard: Keep ticket with superseded deadline');
  const ev3 = await seedEvent(comm.id, ts + 3);
  const mem3 = await seedMember(ts, 'm3');
  await seedRegistrationWithPayment(ev3, mem3, 500, ts + 3, 'm3');

  await declarePostponement(pool, ev3, comm.id, 'community');

  // First date announced (Window 1)
  const windowDate1 = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await setPostponementNewDate(pool, ev3, windowDate1.toISOString(), comm.name, 'Race Event 3');

  const decRow1 = (await pool.query(`SELECT id, opt_out_deadline FROM event_postponement_decisions WHERE event_id = $1`, [ev3])).rows[0];
  const oldDeadline = decRow1.opt_out_deadline;

  // Organizer changes date again (Window 2 - resets window forward)
  await new Promise(r => setTimeout(r, 50));
  const windowDate2 = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  await setPostponementNewDate(pool, ev3, windowDate2.toISOString(), comm.name, 'Race Event 3');

  // Buyer attempts to submit "keep" with oldDeadline (Window 1)
  try {
    await processKeep(pool, decRow1.id, mem3, oldDeadline);
    assert.fail('Should have rejected stale window with STALE_WINDOW error');
  } catch (err) {
    assert.strictEqual(err.code, 'STALE_WINDOW', 'Error code is STALE_WINDOW');
    assert.strictEqual(err.statusCode, 409, 'Status code is 409 Conflict');
    console.log('  ✓ PASS: processKeep correctly returned 409 STALE_WINDOW when window was superseded\n');
  }

  // ── TEST 4: Stale Window Guard (409 STALE_WINDOW on Opt-Out) ─────────────────
  console.log('[ Race Test 4 ] Stale Window Guard: Opt-out refund with superseded deadline');
  const ev4 = await seedEvent(comm.id, ts + 4);
  const mem4 = await seedMember(ts, 'm4');
  await seedRegistrationWithPayment(ev4, mem4, 500, ts + 4, 'm4');

  await declarePostponement(pool, ev4, comm.id, 'community');

  // First date announced (Window 1)
  await setPostponementNewDate(pool, ev4, windowDate1.toISOString(), comm.name, 'Race Event 4');
  const decRow4 = (await pool.query(`SELECT id, opt_out_deadline FROM event_postponement_decisions WHERE event_id = $1`, [ev4])).rows[0];
  const oldDeadline4 = decRow4.opt_out_deadline;

  // Organizer changes date again (Window 2)
  await new Promise(r => setTimeout(r, 50));
  await setPostponementNewDate(pool, ev4, windowDate2.toISOString(), comm.name, 'Race Event 4');

  // Buyer attempts to submit "opt-out" with oldDeadline4
  try {
    await processOptOut(pool, decRow4.id, mem4, oldDeadline4);
    assert.fail('Should have rejected stale opt-out with STALE_WINDOW error');
  } catch (err) {
    assert.strictEqual(err.code, 'STALE_WINDOW', 'Error code is STALE_WINDOW');
    assert.strictEqual(err.statusCode, 409, 'Status code is 409 Conflict');
    console.log('  ✓ PASS: processOptOut correctly returned 409 STALE_WINDOW when window was superseded\n');
  }

  // ── TEST 5: Subsequent Submission with Updated Deadline Succeeds ─────────────
  console.log('[ Race Test 5 ] Successful decision submission with matching current deadline');
  const decRowUpdated = (await pool.query(`SELECT id, opt_out_deadline FROM event_postponement_decisions WHERE event_id = $1`, [ev4])).rows[0];
  const currentDeadline = decRowUpdated.opt_out_deadline;

  const keepRes = await processKeep(pool, decRowUpdated.id, mem4, currentDeadline);
  assert.strictEqual(keepRes.success, true, 'processKeep succeeds with current deadline');
  assert.strictEqual(keepRes.decision, 'kept_ticket', 'Decision set to kept_ticket');
  console.log('  ✓ PASS: Subsequent submission with fresh deadline succeeds smoothly\n');

  console.log('===============================================================');
  console.log('  ALL 5 RACE COMBINATION & STALE WINDOW TESTS PASSED!          ');
  console.log('===============================================================\n');

  await pool.end();
}

run().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
