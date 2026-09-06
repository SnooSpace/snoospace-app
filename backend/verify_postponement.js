/**
 * verify_postponement.js
 *
 * Verification suite for the event postponement system.
 *
 * Tests:
 *   1. Schema — new columns and table exist
 *   2. Declare postponement — flags, decision rows, payout_hold
 *   3. Set new date — opt_out_deadline, push
 *   4. Alice opts out explicitly within window → refund_request created
 *   5. Bob keeps explicitly → no refund, decision resolved
 *   6. payout_hold stays true while Carol is still pending
 *   7. Cron window expiry → Carol auto-kept, payout_hold released
 *   8. Re-postponement: change date twice → window resets
 *   9. Indefinite cap (30-day) → auto-refund for pending, payout_hold released
 *  10. Already-postponed guard
 *  11. Cancelled event cannot be postponed
 *  12. Window-closed guard on opt-out
 *
 * Run: node verify_postponement.js
 */

require('dotenv').config();
const { createPool } = require('./config/db');
const {
  declarePostponement,
  setPostponementNewDate,
  processOptOut,
  processKeep,
  checkAndReleasePayoutHold,
  runPostponementWindowExpiry,
  runIndefinitePostponementCap,
} = require('./services/eventPostponementService');

const pool = createPool();

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}
function assertClose(actual, expected, label, tol = 0.01) {
  const ok = Math.abs(Number(actual) - Number(expected)) <= tol;
  if (ok) { console.log(`  ✓ ${label} (got ${actual})`); passed++; }
  else { console.error(`  ✗ FAIL: ${label} — expected ${expected}, got ${actual}`); failed++; }
}

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedCommunity(ts) {
  const r = await pool.query(
    `INSERT INTO communities (name, username, email, created_at) VALUES ($1,$2,$3,NOW()) RETURNING id`,
    [`Postpone Test Org ${ts}`, `postpone_org_${ts}`, `postpone_${ts}@t.com`],
  );
  return r.rows[0].id;
}

async function seedMember(ts, n) {
  const r = await pool.query(
    `INSERT INTO members (name, username, email, phone, dob, gender, interests, created_at)
     VALUES ($1,$2,$3,'9911111111','1994-01-01','Male','["music","art","travel"]',NOW())
     RETURNING id`,
    [`Mem${n}_${ts}`, `mem${n}_${ts}`, `mem${n}_${ts}@t.com`],
  );
  return r.rows[0].id;
}

async function seedEvent(communityId, ts, futureHours = 168) {
  const start = new Date(Date.now() + futureHours * 3600 * 1000);
  const end   = new Date(start.getTime() + 3600 * 1000);
  const r = await pool.query(
    `INSERT INTO events (title, creator_id, community_id, event_type, event_date, start_datetime, end_datetime, created_at)
     VALUES ($1,$2,$2,'in-person',$3,$4,$5,NOW()) RETURNING id`,
    [`Postpone Test Event ${ts}`, communityId, start.toISOString().split('T')[0], start.toISOString(), end.toISOString()],
  );
  return r.rows[0].id;
}

async function seedRegistrationWithPayment(eventId, memberId, amount, ts, suffix) {
  const reg = await pool.query(
    `INSERT INTO event_registrations (event_id, member_id, registration_status, total_amount, discount_amount)
     VALUES ($1,$2,'registered',$3,0) RETURNING id`,
    [eventId, memberId, amount],
  );
  const regId = reg.rows[0].id;

  const tt = await pool.query(
    `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sold_count)
     VALUES ($1,'General',$2,100,0) RETURNING id`, [eventId, amount],
  );
  await pool.query(
    `INSERT INTO registration_tickets (registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price)
     VALUES ($1,$2,'General',1,$3,$3)`, [regId, tt.rows[0].id, amount],
  );

  const orderId = `order_postpone_${suffix}_${ts}`;
  const payId   = `pay_postpone_${suffix}_${ts}`;
  await pool.query(
    `INSERT INTO razorpay_orders (razorpay_order_id, user_id, event_id, registration_id, amount_paise, currency, status, created_at)
     VALUES ($1,$2,$3,$4,$5,'INR','paid',NOW())`,
    [orderId, memberId, eventId, regId, Math.round(amount * 100)],
  );
  await pool.query(
    `INSERT INTO razorpay_payments (razorpay_payment_id, razorpay_order_id, user_id, event_id, amount_paise, currency, status, webhook_verified, captured_at, created_at)
     VALUES ($1,$2,$3,$4,$5,'INR','captured',true,NOW(),NOW())`,
    [payId, orderId, memberId, eventId, Math.round(amount * 100)],
  );

  return regId;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  POSTPONEMENT SYSTEM VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ts = Date.now();

  // Seed data
  let communityId, aliceId, bobId, carolId, eventId, capEventId;
  let aliceRegId, bobRegId, carolRegId;
  let aliceDecId, bobDecId, carolDecId;

  try {
    communityId = await seedCommunity(ts);
    aliceId     = await seedMember(ts, 'alice');
    bobId       = await seedMember(ts, 'bob');
    carolId     = await seedMember(ts, 'carol');
    eventId     = await seedEvent(communityId, ts);
    aliceRegId  = await seedRegistrationWithPayment(eventId, aliceId, 500, ts, 'alice');
    bobRegId    = await seedRegistrationWithPayment(eventId, bobId,   400, ts, 'bob');
    carolRegId  = await seedRegistrationWithPayment(eventId, carolId, 300, ts, 'carol');
    console.log(`  [Seed] eventId=${eventId}, alice=${aliceRegId}, bob=${bobRegId}, carol=${carolRegId}\n`);
  } catch (e) {
    console.error('SEED FAILED:', e.message);
    await pool.end();
    process.exit(1);
  }

  // ── [1] Schema ──────────────────────────────────────────────────────────────
  console.log('[ 1 ] Schema — new columns and table');
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='events' AND column_name IN ('is_postponed','postponed_at','original_start_datetime')
  `);
  assert(cols.rows.find(r => r.column_name === 'is_postponed'),            'events.is_postponed exists');
  assert(cols.rows.find(r => r.column_name === 'postponed_at'),            'events.postponed_at exists');
  assert(cols.rows.find(r => r.column_name === 'original_start_datetime'), 'events.original_start_datetime exists');
  const tableExists = await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='event_postponement_decisions')`);
  assert(tableExists.rows[0].exists, 'event_postponement_decisions table exists');

  // ── [2] Declare postponement ────────────────────────────────────────────────
  console.log('\n[ 2 ] Declare postponement — flags, decision rows, payout_hold');
  const summary = await declarePostponement(pool, eventId, communityId, 'community');
  assert(summary.success === true,          'declarePostponement returns success=true');
  assert(summary.decision_rows_created === 3, '3 decision rows created');
  assert(summary.payout_hold_set === true,   'payout_hold_set=true in response');

  const ev = await pool.query(`SELECT is_postponed, postponed_at, original_start_datetime, payout_hold FROM events WHERE id=$1`, [eventId]);
  assert(ev.rows[0].is_postponed === true,            'events.is_postponed = true');
  assert(ev.rows[0].postponed_at !== null,            'events.postponed_at populated');
  assert(ev.rows[0].original_start_datetime !== null, 'events.original_start_datetime snapshotted');
  assert(ev.rows[0].payout_hold === true,              'events.payout_hold = true');

  const decisions = await pool.query(
    `SELECT id, registration_id, member_id, decision, new_date_set_at, opt_out_deadline
     FROM event_postponement_decisions WHERE event_id=$1 ORDER BY registration_id`, [eventId],
  );
  assert(decisions.rows.length === 3,                         '3 rows in event_postponement_decisions');
  assert(decisions.rows.every(d => d.decision === 'pending'), 'all decisions = pending');
  assert(decisions.rows.every(d => d.new_date_set_at === null), 'new_date_set_at NULL before date is set');

  // Debug: log what IDs we're looking for vs what came back
  console.log('  [debug] looking for regIds:', aliceRegId, bobRegId, carolRegId);
  console.log('  [debug] decision rows regIds:', decisions.rows.map(d => d.registration_id + '(' + typeof d.registration_id + ')').join(', '));

  const aliceDec = decisions.rows.find(d => String(d.registration_id) === String(aliceRegId));
  const bobDec   = decisions.rows.find(d => String(d.registration_id) === String(bobRegId));
  const carolDec = decisions.rows.find(d => String(d.registration_id) === String(carolRegId));
  aliceDecId = aliceDec?.id;
  bobDecId   = bobDec?.id;
  carolDecId = carolDec?.id;
  assert(aliceDec != null, 'Alice decision row found');
  assert(bobDec   != null, 'Bob decision row found');
  assert(carolDec != null, 'Carol decision row found');
  if (!aliceDecId || !bobDecId || !carolDecId) {
    console.error('  Cannot continue without all 3 decision IDs');
    await pool.end(); process.exit(1);
  }

  // ── [3] Set new date — starts 72h window ───────────────────────────────────
  console.log('\n[ 3 ] Set new date — opt_out_deadline set, push sent');
  const newStart = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days from now
  const dateResult = await setPostponementNewDate(pool, eventId, newStart.toISOString(), 'Test Org', 'Test Event');
  assert(dateResult.decisions_updated === 3, '3 decisions updated with new date');
  assert(typeof dateResult.opt_out_deadline === 'string', 'opt_out_deadline returned');

  const dec2 = await pool.query(
    `SELECT new_date_set_at, opt_out_deadline FROM event_postponement_decisions WHERE event_id=$1 LIMIT 1`, [eventId],
  );
  assert(dec2.rows[0].new_date_set_at !== null, 'new_date_set_at populated');
  const deadlineMs = new Date(dec2.rows[0].opt_out_deadline).getTime();
  const nowMs = Date.now();
  const diffHours = (deadlineMs - nowMs) / 3600000;
  assert(diffHours >= 71.9 && diffHours <= 72.1, `opt_out_deadline ≈ NOW()+72h (got ${diffHours.toFixed(2)}h)`);

  // ── [4] Alice opts out ─────────────────────────────────────────────────────
  console.log('\n[ 4 ] Alice opts out — refund_request created');
  const optOutResult = await processOptOut(pool, aliceDecId, aliceId);
  assert(optOutResult.success === true,                'processOptOut returns success=true');
  assert(optOutResult.decision === 'opted_out_refund', "decision = 'opted_out_refund'");
  // In dev, Razorpay API call fails (no real keys) — but the refund_request row is created.
  // refund_initiated=false is expected here; in production with real keys it would be true.
  console.log(`  [dev-note] refund_initiated=${optOutResult.refund_initiated}, razorpay_error=${optOutResult.razorpay_error || 'none'}`);


  const aliceDecRow = await pool.query(`SELECT decision FROM event_postponement_decisions WHERE id=$1`, [aliceDecId]);
  assert(aliceDecRow.rows[0].decision === 'opted_out_refund', "Alice DB decision = 'opted_out_refund'");

  const aliceRR = await pool.query(`SELECT trigger_source, status, requested_amount FROM refund_requests WHERE registration_id=$1`, [aliceRegId]);
  assert(aliceRR.rows.length > 0,                               'Alice: refund_request row created');
  if (aliceRR.rows.length > 0) {
    assert(aliceRR.rows[0].trigger_source === 'postponement_opt_out', "Alice: trigger_source = 'postponement_opt_out'");
    assertClose(aliceRR.rows[0].requested_amount, 500,              'Alice: requested_amount = ₹500 (full)');
  }

  // ── [5] Bob keeps explicitly ────────────────────────────────────────────────
  console.log('\n[ 5 ] Bob keeps explicitly — no refund');
  const keepResult = await processKeep(pool, bobDecId, bobId);
  assert(keepResult.success === true,       'processKeep returns success=true');
  assert(keepResult.decision === 'kept_ticket', "decision = 'kept_ticket'");

  const bobDecRow = await pool.query(`SELECT decision FROM event_postponement_decisions WHERE id=$1`, [bobDecId]);
  assert(bobDecRow.rows[0].decision === 'kept_ticket', "Bob DB decision = 'kept_ticket'");

  const bobRR = await pool.query(`SELECT * FROM refund_requests WHERE registration_id=$1`, [bobRegId]);
  assert(bobRR.rows.length === 0, 'Bob: NO refund_request created');

  // ── [6] payout_hold stays true while Carol is still pending ────────────────
  console.log('\n[ 6 ] payout_hold stays true while Carol pending');
  const holdCheck = await pool.query(`SELECT payout_hold FROM events WHERE id=$1`, [eventId]);
  assert(holdCheck.rows[0].payout_hold === true, 'payout_hold still true (Carol pending)');

  // ── [7] Cron expires Carol's window → auto_kept_no_response, payout_hold released
  console.log('\n[ 7 ] Cron window expiry → Carol auto-kept, payout_hold released');
  // Backdate Carol's opt_out_deadline to simulate expiry
  await pool.query(
    `UPDATE event_postponement_decisions SET opt_out_deadline = NOW() - INTERVAL '1 second' WHERE id=$1`,
    [carolDecId],
  );
  await runPostponementWindowExpiry(pool);

  const carolDecRow = await pool.query(`SELECT decision FROM event_postponement_decisions WHERE id=$1`, [carolDecId]);
  assert(carolDecRow.rows[0].decision === 'auto_kept_no_response', "Carol: decision = 'auto_kept_no_response'");

  const carolRR = await pool.query(`SELECT * FROM refund_requests WHERE registration_id=$1`, [carolRegId]);
  assert(carolRR.rows.length === 0, 'Carol: NO refund_request (auto-kept, no refund)');

  const holdCheck2 = await pool.query(`SELECT payout_hold FROM events WHERE id=$1`, [eventId]);
  assert(holdCheck2.rows[0].payout_hold === false, 'payout_hold released after all decisions resolved');

  // ── [8] Re-postponement: set date twice → window resets ────────────────────
  console.log('\n[ 8 ] Re-postponement — second date change resets opt_out_deadline');
  // Seed fresh event with one registration for re-postponement test
  const repostEventId = await seedEvent(communityId, ts + 1);
  const daveId = await seedMember(ts, 'dave');
  const daveRegId = await seedRegistrationWithPayment(repostEventId, daveId, 600, ts, 'dave');

  await declarePostponement(pool, repostEventId, communityId, 'community');

  // First date set
  const date1 = new Date(Date.now() + 10 * 24 * 3600 * 1000);
  await setPostponementNewDate(pool, repostEventId, date1.toISOString(), 'Test Org', 'Repost Test');

  const dec1 = await pool.query(
    `SELECT opt_out_deadline FROM event_postponement_decisions WHERE event_id=$1 AND decision='pending' LIMIT 1`,
    [repostEventId],
  );
  const deadline1 = new Date(dec1.rows[0].opt_out_deadline);

  // Small wait then second date set — deadline should push forward
  await new Promise(r => setTimeout(r, 200));
  const date2 = new Date(Date.now() + 20 * 24 * 3600 * 1000);
  await setPostponementNewDate(pool, repostEventId, date2.toISOString(), 'Test Org', 'Repost Test');

  const dec2b = await pool.query(
    `SELECT opt_out_deadline FROM event_postponement_decisions WHERE event_id=$1 AND decision='pending' LIMIT 1`,
    [repostEventId],
  );
  const deadline2 = new Date(dec2b.rows[0].opt_out_deadline);
  assert(deadline2 > deadline1, `opt_out_deadline reset forward on second date change (${deadline2.toISOString()} > ${deadline1.toISOString()})`);

  // ── [9] Indefinite cap (30-day) ─────────────────────────────────────────────
  console.log('\n[ 9 ] Indefinite cap — auto-refund after 30 days with no new date');
  // Seed event with one registration, postpone it, then backdate postponed_at
  const capId = await seedEvent(communityId, ts + 2);
  const eveId = await seedMember(ts, 'eve');
  const eveRegId = await seedRegistrationWithPayment(capId, eveId, 700, ts, 'eve');

  await declarePostponement(pool, capId, communityId, 'community');
  // Backdate postponed_at by 31 days to trigger the cap
  await pool.query(`UPDATE events SET postponed_at = NOW() - INTERVAL '31 days' WHERE id=$1`, [capId]);

  await runIndefinitePostponementCap(pool);

  const eveDecRow = await pool.query(
    `SELECT decision FROM event_postponement_decisions WHERE event_id=$1 AND member_id=$2`,
    [capId, eveId],
  );
  assert(eveDecRow.rows.length > 0, 'Eve: decision row exists');
  if (eveDecRow.rows.length > 0) {
    assert(
      eveDecRow.rows[0].decision === 'auto_refunded_indefinite_cap',
      "Eve: decision = 'auto_refunded_indefinite_cap'",
    );
  }

  const eveRR = await pool.query(
    `SELECT trigger_source, requested_amount FROM refund_requests WHERE registration_id=$1`, [eveRegId],
  );
  assert(eveRR.rows.length > 0, 'Eve: refund_request created by indefinite cap');
  if (eveRR.rows.length > 0) {
    assert(eveRR.rows[0].trigger_source === 'postponement_indefinite_cap', "Eve: trigger_source = 'postponement_indefinite_cap'");
    assertClose(eveRR.rows[0].requested_amount, 700, 'Eve: requested_amount = ₹700 (full)');
  }

  const capHoldCheck = await pool.query(`SELECT payout_hold FROM events WHERE id=$1`, [capId]);
  assert(capHoldCheck.rows[0].payout_hold === false, 'payout_hold released after indefinite cap auto-refund');

  // ── [10] Already-postponed guard ────────────────────────────────────────────
  console.log('\n[ 10 ] Already-postponed guard');
  try {
    await declarePostponement(pool, eventId, communityId, 'community');
    assert(false, 'should have thrown ALREADY_POSTPONED');
  } catch (err) {
    assert(err.code === 'ALREADY_POSTPONED', 'ALREADY_POSTPONED thrown on duplicate postpone');
    assert(err.statusCode === 400, 'statusCode = 400');
  }

  // ── [11] Cancelled event cannot be postponed ─────────────────────────────────
  console.log('\n[ 11 ] Cancelled event guard');
  const cancelledEvId = await seedEvent(communityId, ts + 3);
  await pool.query(`UPDATE events SET is_cancelled=true WHERE id=$1`, [cancelledEvId]);
  try {
    await declarePostponement(pool, cancelledEvId, communityId, 'community');
    assert(false, 'should have thrown for cancelled event');
  } catch (err) {
    assert(err.statusCode === 400, 'cancelled event: 400 error thrown');
    assert(/cancelled/i.test(err.message), 'error message mentions cancellation');
  }

  // ── [12] Window-closed guard ─────────────────────────────────────────────────
  console.log('\n[ 12 ] Opt-out window-closed guard');
  // Find a pending decision on repost event and backdate its deadline
  const expiredDec = await pool.query(
    `SELECT id FROM event_postponement_decisions WHERE event_id=$1 AND decision='pending' LIMIT 1`,
    [repostEventId],
  );
  if (expiredDec.rows.length > 0) {
    await pool.query(
      `UPDATE event_postponement_decisions SET opt_out_deadline=NOW()-INTERVAL '1 second' WHERE id=$1`,
      [expiredDec.rows[0].id],
    );
    try {
      await processOptOut(pool, expiredDec.rows[0].id, daveId);
      assert(false, 'should have thrown WINDOW_CLOSED');
    } catch (err) {
      assert(err.code === 'WINDOW_CLOSED', 'WINDOW_CLOSED thrown on expired deadline');
    }
  } else {
    assert(false, 'could not find pending decision to test window-closed guard');
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n  ─────────────────────────────────────────────────────');
  console.log(`\n  PASS: ${passed}   FAIL: ${failed}\n`);
  if (failed === 0) {
    console.log('  ✅  All postponement verification checks passed.\n');
  } else {
    console.log('  ❌  Some checks failed — see above.\n');
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('FATAL:', e.message, e.stack);
  pool.end().finally(() => process.exit(1));
});
