/**
 * verify_postponement_reliability.js
 *
 * Automated verification suite for Step 2:
 * 1. Zero-attendee postponement & new date resolution (fixes zero-attendee stuck bug)
 * 2. Normal postponement with >= 1 attendee & genuine reason (weather_safety)
 * 3. Normal postponement with >= 1 attendee & non-genuine reason & 90-day flagging
 * 4. Normal-case is_postponed reset via checkAndReleasePayoutHold when all decisions resolve
 * 5. Postponement lifecycle & idempotency (ALREADY_POSTPONED guard, setPostponementNewDate zero disruption rows, separate-cycle logging)
 *
 * Run: node tests/verify_postponement_reliability.js
 */

require('dotenv').config();
const { createPool } = require('../config/db');
const {
  declarePostponement,
  setPostponementNewDate,
  processKeep,
  checkAndReleasePayoutHold,
} = require('../services/eventPostponementService');

const pool = createPool();
const ts = Date.now();

async function createTestCommunity(name) {
  const res = await pool.query(
    `INSERT INTO communities (name, username, email, signup_status)
     VALUES ($1, $2, $3, 'completed')
     RETURNING id, name`,
    [name, `comm_post_${ts}_${Math.floor(Math.random()*10000)}`, `comm_post_${ts}_${Math.floor(Math.random()*10000)}@test.com`]
  );
  return res.rows[0];
}

async function createTestMember(name) {
  const res = await pool.query(
    `INSERT INTO members (name, username, email, phone, dob, gender, interests, signup_status)
     VALUES ($1, $2, $3, $4, '2000-01-01', 'Male', '["sports", "music", "tech"]'::jsonb, 'completed')
     RETURNING id`,
    [name, `mem_post_${ts}_${Math.floor(Math.random()*10000)}`, `mem_post_${ts}_${Math.floor(Math.random()*10000)}@test.com`, `98765${Math.floor(Math.random()*90000+10000)}`]
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
     RETURNING id, title`,
    [title, communityId, start.toISOString().split('T')[0], start.toISOString(), end.toISOString()]
  );
  return res.rows[0];
}

async function registerMemberForEvent(eventId, memberId) {
  const res = await pool.query(
    `INSERT INTO event_registrations (
       event_id, member_id, registration_status, total_amount
     ) VALUES ($1, $2, 'registered', 200.00)
     RETURNING id`,
    [eventId, memberId]
  );
  return res.rows[0].id;
}

async function runTests() {
  console.log('===============================================================');
  console.log('  POSTPONEMENT RELIABILITY & IS_POSTPONED FIX VERIFICATION     ');
  console.log('===============================================================\n');

  try {
    const comm = await createTestCommunity(`Postpone Comm ${ts}`);
    const memberId = await createTestMember(`Postpone Member ${ts}`);
    console.log(`Created test community: ${comm.id}, member: ${memberId}\n`);

    // ───────────────────────────────────────────────────────────────────────────
    // Test 1: Zero attendees postponement -> new date set -> is_postponed reset
    // ───────────────────────────────────────────────────────────────────────────
    console.log('[ Test 1 ] Zero attendees: declarePostponement -> setPostponementNewDate resets is_postponed');
    const evZero = await createTestEvent(comm.id, `Zero Attendee Event ${ts}`);

    const postRes1 = await declarePostponement(pool, evZero.id, comm.id, 'community', {
      reason_category: 'personal_emergency',
      reason_text: 'Host unavailable',
    });

    const evCheck1 = await pool.query(`SELECT is_postponed, payout_hold FROM events WHERE id = $1`, [evZero.id]);
    if (!evCheck1.rows[0].is_postponed || !evCheck1.rows[0].payout_hold) {
      throw new Error(`Test 1 Failed: expected is_postponed=true, payout_hold=true on declaration`);
    }

    const disCheck1 = await pool.query(`SELECT * FROM community_disruptions WHERE event_id = $1`, [evZero.id]);
    if (disCheck1.rows.length !== 0) {
      throw new Error(`Test 1 Failed: expected 0 disruption rows for zero attendees, found ${disCheck1.rows.length}`);
    }

    // Now host sets new date
    const newStart1 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const dateRes1 = await setPostponementNewDate(pool, evZero.id, newStart1.toISOString(), comm.name, evZero.title);

    const evCheck1After = await pool.query(`SELECT is_postponed, payout_hold FROM events WHERE id = $1`, [evZero.id]);
    if (evCheck1After.rows[0].is_postponed !== false || evCheck1After.rows[0].payout_hold !== false) {
      throw new Error(`Test 1 Failed: is_postponed and payout_hold should reset to false on zero-attendee event! got is_postponed=${evCheck1After.rows[0].is_postponed}, payout_hold=${evCheck1After.rows[0].payout_hold}`);
    }
    console.log('  ✓ PASS: Zero-attendee postponement bypassed disruptions and setPostponementNewDate cleared is_postponed/payout_hold\n');

    // ───────────────────────────────────────────────────────────────────────────
    // Test 2: Normal postponement >= 1 attendee with genuine reason
    // ───────────────────────────────────────────────────────────────────────────
    console.log('[ Test 2 ] >= 1 attendee & Genuine Reason (weather_safety)');
    const evGenuine = await createTestEvent(comm.id, `Genuine Postpone Event ${ts}`);
    await registerMemberForEvent(evGenuine.id, memberId);

    const postRes2 = await declarePostponement(pool, evGenuine.id, comm.id, 'community', {
      reason_category: 'weather_safety',
      reason_text: 'Cyclone forecast',
    });

    const disCheck2 = await pool.query(`SELECT * FROM community_disruptions WHERE event_id = $1`, [evGenuine.id]);
    if (disCheck2.rows.length !== 1) {
      throw new Error(`Test 2 Failed: expected 1 disruption row, found ${disCheck2.rows.length}`);
    }
    const row2 = disCheck2.rows[0];
    if (row2.disruption_type !== 'postponement' || !row2.is_genuine || row2.needs_manual_review) {
      throw new Error(`Test 2 Failed: expected disruption_type='postponement', is_genuine=true, needs_manual_review=false`);
    }

    const commCheck2 = await pool.query(`SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1`, [comm.id]);
    if (commCheck2.rows[0].non_genuine_cancellation_count !== 0 || commCheck2.rows[0].cancellation_flagged) {
      throw new Error(`Test 2 Failed: genuine reason should not increment non_genuine count or flag community`);
    }
    console.log('  ✓ PASS: Genuine postponement recorded with is_genuine=true and zero non-genuine counter change\n');

    // ───────────────────────────────────────────────────────────────────────────
    // Test 3: Normal postponement >= 1 attendee with non-genuine reason & flagging
    // ───────────────────────────────────────────────────────────────────────────
    console.log('[ Test 3 ] >= 1 attendee & Non-Genuine Reason (change_of_plans & other) -> Flagging');
    const evNonGen = await createTestEvent(comm.id, `Non-Gen Postpone Event ${ts}`);
    await registerMemberForEvent(evNonGen.id, memberId);

    await declarePostponement(pool, evNonGen.id, comm.id, 'community', {
      reason_category: 'change_of_plans',
    });

    const commCheck3A = await pool.query(`SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1`, [comm.id]);
    if (commCheck3A.rows[0].non_genuine_cancellation_count !== 1 || commCheck3A.rows[0].cancellation_flagged) {
      throw new Error(`Test 3 Failed: expected non_genuine=1, cancellation_flagged=false`);
    }

    // Second non-genuine disruption (using 'other')
    const evOther = await createTestEvent(comm.id, `Other Postpone Event ${ts}`);
    await registerMemberForEvent(evOther.id, memberId);

    await declarePostponement(pool, evOther.id, comm.id, 'community', {
      reason_category: 'other',
      reason_text: 'Personal conflicts',
    });

    const commCheck3B = await pool.query(`SELECT non_genuine_cancellation_count, cancellation_flagged FROM communities WHERE id = $1`, [comm.id]);
    if (commCheck3B.rows[0].non_genuine_cancellation_count !== 2) {
      throw new Error(`Test 3 Failed: expected non_genuine=2, got ${commCheck3B.rows[0].non_genuine_cancellation_count}`);
    }
    if (!commCheck3B.rows[0].cancellation_flagged) {
      throw new Error(`Test 3 Failed: expected cancellation_flagged=true after 2 non-genuine disruptions!`);
    }
    console.log('  ✓ PASS: Non-genuine postponements recorded, second non-genuine triggered cancellation_flagged=true\n');

    // ───────────────────────────────────────────────────────────────────────────
    // Test 4: Normal-case is_postponed reset via checkAndReleasePayoutHold
    // ───────────────────────────────────────────────────────────────────────────
    console.log('[ Test 4 ] Normal-case is_postponed reset when all decisions resolve');
    const comm4 = await createTestCommunity(`Normal Resolve Comm ${ts}`);
    const evNormal = await createTestEvent(comm4.id, `Normal Resolve Event ${ts}`);
    const regId4 = await registerMemberForEvent(evNormal.id, memberId);

    await declarePostponement(pool, evNormal.id, comm4.id, 'community', {
      reason_category: 'weather_safety',
    });

    const evCheck4Pre = await pool.query(`SELECT is_postponed, payout_hold FROM events WHERE id = $1`, [evNormal.id]);
    if (!evCheck4Pre.rows[0].is_postponed || !evCheck4Pre.rows[0].payout_hold) {
      throw new Error(`Test 4 Failed: event should be is_postponed=true, payout_hold=true`);
    }

    // Set new date
    const newStart4 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await setPostponementNewDate(pool, evNormal.id, newStart4.toISOString(), comm4.name, evNormal.title);

    // Get the decision row
    const decRes = await pool.query(`SELECT id FROM event_postponement_decisions WHERE event_id = $1 AND registration_id = $2`, [evNormal.id, regId4]);
    if (decRes.rows.length === 0) {
      throw new Error(`Test 4 Failed: decision row not found`);
    }
    const decisionId = decRes.rows[0].id;

    // Buyer resolves decision via processKeep
    await processKeep(pool, decisionId, memberId);

    // Check events row: both payout_hold and is_postponed should now be false!
    const evCheck4Post = await pool.query(`SELECT is_postponed, payout_hold FROM events WHERE id = $1`, [evNormal.id]);
    if (evCheck4Post.rows[0].payout_hold !== false || evCheck4Post.rows[0].is_postponed !== false) {
      throw new Error(`Test 4 Failed: expected is_postponed=false and payout_hold=false after all decisions resolved! got is_postponed=${evCheck4Post.rows[0].is_postponed}, payout_hold=${evCheck4Post.rows[0].payout_hold}`);
    }
    console.log('  ✓ PASS: Normal-case is_postponed reset to false alongside payout_hold when all decisions resolved\n');

    // ───────────────────────────────────────────────────────────────────────────
    // Test 5: Postponement lifecycle & idempotency
    // ───────────────────────────────────────────────────────────────────────────
    console.log('[ Test 5 ] Postponement lifecycle & idempotency');
    const comm5 = await createTestCommunity(`Lifecycle Comm ${ts}`);
    const evCycle = await createTestEvent(comm5.id, `Lifecycle Event ${ts}`);
    await registerMemberForEvent(evCycle.id, memberId);

    await declarePostponement(pool, evCycle.id, comm5.id, 'community', {
      reason_category: 'weather_safety',
    });

    // 5A: Calling declarePostponement while active throws ALREADY_POSTPONED
    let alreadyPostponedThrew = false;
    try {
      await declarePostponement(pool, evCycle.id, comm5.id, 'community', {
        reason_category: 'change_of_plans',
      });
    } catch (err) {
      if (err.code === 'ALREADY_POSTPONED') {
        alreadyPostponedThrew = true;
      }
    }
    if (!alreadyPostponedThrew) {
      throw new Error(`Test 5A Failed: declarePostponement should throw ALREADY_POSTPONED during same cycle`);
    }

    // 5B: Calling setPostponementNewDate multiple times does NOT insert disruption rows
    const countBeforeDates = (await pool.query(`SELECT COUNT(*)::int as c FROM community_disruptions WHERE event_id = $1`, [evCycle.id])).rows[0].c;
    const dateA = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const dateB = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    await setPostponementNewDate(pool, evCycle.id, dateA.toISOString(), comm5.name, evCycle.title);
    await setPostponementNewDate(pool, evCycle.id, dateB.toISOString(), comm5.name, evCycle.title);

    const countAfterDates = (await pool.query(`SELECT COUNT(*)::int as c FROM community_disruptions WHERE event_id = $1`, [evCycle.id])).rows[0].c;
    if (countBeforeDates !== countAfterDates || countAfterDates !== 1) {
      throw new Error(`Test 5B Failed: setPostponementNewDate inserted unexpected disruption rows! expected 1, got ${countAfterDates}`);
    }

    // 5C: Once prior postponement resolves, a separate-cycle postponement logs legitimately
    const decCycleRes = await pool.query(`SELECT id FROM event_postponement_decisions WHERE event_id = $1`, [evCycle.id]);
    await processKeep(pool, decCycleRes.rows[0].id, memberId);

    const evCycleResolved = await pool.query(`SELECT is_postponed FROM events WHERE id = $1`, [evCycle.id]);
    if (evCycleResolved.rows[0].is_postponed !== false) {
      throw new Error(`Test 5C Failed: event should be resolved (is_postponed=false)`);
    }

    // Now a legitimate second postponement occurs later
    await declarePostponement(pool, evCycle.id, comm5.id, 'community', {
      reason_category: 'venue_unavailable',
    });

    const countAfterSecondCycle = (await pool.query(`SELECT COUNT(*)::int as c FROM community_disruptions WHERE event_id = $1`, [evCycle.id])).rows[0].c;
    if (countAfterSecondCycle !== 2) {
      throw new Error(`Test 5C Failed: legitimate second-cycle postponement should log a 2nd disruption row! expected 2, got ${countAfterSecondCycle}`);
    }
    console.log('  ✓ PASS: ALREADY_POSTPONED protected active cycle, setPostponementNewDate created 0 disruptions, and separate cycle logged legitimately\n');

    console.log('===============================================================');
    console.log('  ALL 5 POSTPONEMENT RELIABILITY TESTS PASSED CLEANLY!         ');
    console.log('===============================================================');
  } catch (err) {
    console.error('\n❌ Test Suite Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
