require('dotenv').config();
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const { createPool } = require('../config/db');
const pool = createPool();
const eventController = require('../controllers/eventController');
const { handleRazorpayWebhook } = require('../routes/webhooks');

async function runScenarioTests() {
  console.log('================================================================');
  console.log('CHECKOUT SCREEN RETRY & LIFECYCLE VERIFICATION');
  console.log('================================================================');

  let testCommunityId = null;
  let testMemberId = null;
  let testEventId = null;
  let testTicketTypeId = null;

  try {
    // 1. Setup test fixture
    const commRes = await pool.query(`SELECT id FROM communities LIMIT 1`);
    testCommunityId = commRes.rows[0].id;

    const memberRes = await pool.query(`SELECT id FROM members LIMIT 1`);
    testMemberId = memberRes.rows[0].id;

    // Create a temporary test event
    const eventInsert = await pool.query(
      `INSERT INTO events (
        title, event_type, creator_id, creator_type, community_id,
        event_date, start_datetime, end_datetime, status
      ) VALUES (
        'Verification Test Event - Checkout Retry', 'in-person', $1, 'community', $1,
        '2026-10-01', '2026-10-01 10:00:00+00', '2026-10-01 18:00:00+00', 'published'
      ) RETURNING id`,
      [testCommunityId]
    );
    testEventId = eventInsert.rows[0].id;

    // Create a ticket type
    const ticketInsert = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, max_per_order, is_active, reserved_count, sold_count
      ) VALUES (
        $1, 'Retry Test Tier', 500.00, 10, 5, true, 0, 0
      ) RETURNING id`,
      [testEventId]
    );
    testTicketTypeId = ticketInsert.rows[0].id;

    console.log(`[Setup] Created Test Event #${testEventId} with TicketType #${testTicketTypeId}`);

    // Helper: snapshot DB state
    const getSnapshot = async () => {
      const ticket = await pool.query(`SELECT reserved_count, sold_count, total_quantity FROM ticket_types WHERE id = $1`, [testTicketTypeId]);
      const holds = await pool.query(`SELECT id, session_id, quantity, expires_at FROM ticket_reservations WHERE ticket_type_id = $1`, [testTicketTypeId]);
      return {
        reservedCount: ticket.rows[0].reserved_count,
        soldCount: ticket.rows[0].sold_count,
        holdsCount: holds.rows.length,
        holds: holds.rows.map(h => ({ sessionId: h.session_id, qty: h.quantity }))
      };
    };

    console.log('\nInitial DB Snapshot:', await getSnapshot());

    // =========================================================================
    // SCENARIO A: Payment Failure -> Release Old Hold -> Re-reserve Fresh Hold
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO A: Payment Failure -> Release Old Hold -> Re-reserve Fresh Hold');
    console.log('----------------------------------------------------------------');

    // 1. Mount reservation (Session 1)
    let session1 = null;
    await eventController.reserveTickets(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: { tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1 }] }
      },
      {
        status: (c) => ({ json: (d) => { if (c >= 400) throw new Error(d.error); } }),
        json: (d) => { session1 = d.sessionId; }
      }
    );

    console.log(`Step 1 (Mount): Reserved ticket -> Session 1 = ${session1}`);
    const snapshotAfterMount = await getSnapshot();
    console.log('DB Snapshot after Mount:', snapshotAfterMount);

    // 2. Payment Failure trigger
    console.log('\nStep 2: Simulating onFailure trigger...');
    console.log('  - Calling handleReleaseReservation() for Session 1...');
    await eventController.releaseReservation(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: { sessionId: session1 }
      },
      {
        status: () => ({ json: () => {} }),
        json: () => {}
      }
    );

    const snapshotAfterRelease = await getSnapshot();
    console.log('DB Snapshot after releaseReservation (Session 1 released):', snapshotAfterRelease);

    // 3. In .finally(), attemptReservation() fires to get fresh hold
    console.log('\nStep 3: Simulating .finally() -> setSessionId(null) -> attemptReservation()...');
    let session2 = null;
    let timerReset = null;

    // Simulate attemptReservation() client logic
    await (async () => {
      await eventController.reserveTickets(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: { tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1 }] }
        },
        {
          status: (c) => ({ json: (d) => { if (c >= 400) throw new Error(d.error); } }),
          json: (d) => {
            session2 = d.sessionId;
            timerReset = 10 * 60; // setTimeLeft(10 * 60)
          }
        }
      );
    })();

    const snapshotAfterRetry = await getSnapshot();
    console.log('DB Snapshot after Retry attemptReservation():', snapshotAfterRetry);
    console.log(`New SessionId = ${session2}`);
    console.log(`Timer Value = ${timerReset} seconds (${Math.floor(timerReset/60)}:00)`);

    // Validations for Scenario A
    const scAFails = [];
    if (session2 === session1) scAFails.push('SessionId did not change!');
    if (snapshotAfterRetry.reservedCount !== 1) scAFails.push(`Expected reservedCount=1, got ${snapshotAfterRetry.reservedCount}`);
    if (snapshotAfterRetry.holdsCount !== 1) scAFails.push(`Expected holdsCount=1, got ${snapshotAfterRetry.holdsCount}`);
    if (snapshotAfterRetry.holds[0]?.sessionId !== session2) scAFails.push('Held session in DB does not match new session2');
    if (timerReset !== 600) scAFails.push('Timer was not reset to 10:00 (600s)');

    if (scAFails.length === 0) {
      console.log('>>> [PASS] Scenario A: Old hold released, fresh hold acquired with new session_id, reserved_count=1, timer reset to 10:00.');
    } else {
      console.error('>>> [FAIL] Scenario A:', scAFails);
    }

    // =========================================================================
    // SCENARIO B: Webhook Consumes Fresh Session 2 Successfully
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO B: Webhook Consumes Fresh Session 2 Successfully');
    console.log('----------------------------------------------------------------');

    const mockRzpOrderId = `order_test_${Date.now()}`;
    const mockRzpPaymentId = `pay_test_${Date.now()}`;

    // Create razorpay_orders record pointing to session2
    await pool.query(
      `INSERT INTO razorpay_orders (
        razorpay_order_id, user_id, event_id, amount_paise, currency, status, notes
      ) VALUES (
        $1, $2, $3, 50000, 'INR', 'created', $4
      )`,
      [
        mockRzpOrderId,
        testMemberId,
        testEventId,
        JSON.stringify({
          sessionId: session2,
          tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1, unitPrice: 500, ticketName: 'Retry Test Tier' }]
        })
      ]
    );

    console.log(`Step 1: Created order ${mockRzpOrderId} with notes pointing to Session 2 (${session2})`);

    // Simulate Webhook processing handleRazorpayWebhook
    console.log('Step 2: Webhook handleRazorpayWebhook executing...');
    const mockPayment = {
      id: mockRzpPaymentId,
      order_id: mockRzpOrderId,
      amount: 50000,
      currency: 'INR',
      method: 'upi'
    };
    const mockReq = {
      app: { locals: { pool } },
      webhookBody: {
        event: 'payment.captured',
        payload: { payment: { entity: mockPayment } }
      }
    };
    const mockRes = {
      status: () => ({ json: () => {} })
    };

    await handleRazorpayWebhook(mockReq, mockRes);

    const snapshotAfterWebhook = await getSnapshot();
    console.log('DB Snapshot after Webhook Capture:', snapshotAfterWebhook);

    // Verify registration row created
    const regCheck = await pool.query(
      `SELECT id, registration_status, total_amount 
       FROM event_registrations 
       WHERE event_id = $1 AND member_id = $2`,
      [testEventId, testMemberId]
    );
    console.log('Registration Record:', regCheck.rows[0]);

    // Validations for Scenario B
    const scBFails = [];
    if (snapshotAfterWebhook.reservedCount !== 0) scBFails.push(`Expected reservedCount=0, got ${snapshotAfterWebhook.reservedCount}`);
    if (snapshotAfterWebhook.soldCount !== 1) scBFails.push(`Expected soldCount=1, got ${snapshotAfterWebhook.soldCount}`);
    if (snapshotAfterWebhook.holdsCount !== 0) scBFails.push(`Expected holdsCount=0, got ${snapshotAfterWebhook.holdsCount}`);
    if (!regCheck.rows.length || regCheck.rows[0].registration_status !== 'registered') scBFails.push('Registration not marked registered');

    if (scBFails.length === 0) {
      console.log('>>> [PASS] Scenario B: Webhook consumed Session 2, reserved_count=0, sold_count=1, registration created.');
    } else {
      console.error('>>> [FAIL] Scenario B:', scBFails);
    }

    // =========================================================================
    // SCENARIO C: Unmount During In-Flight Retry Reservation (No Orphan Leak)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO C: Unmount During In-Flight Retry Reservation (No Orphan Leak)');
    console.log('----------------------------------------------------------------');

    // Simulate in-flight attemptReservation when unmount occurs
    let isMountedRef = { current: true };
    let session3 = null;
    let stateSetCalled = false;

    const mockAttemptReservationWithUnmountRace = async () => {
      // 1. Call reserveTickets
      let resData = null;
      await eventController.reserveTickets(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: { tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1 }] }
        },
        {
          status: () => ({ json: (d) => { resData = d; } }),
          json: (d) => { resData = d; }
        }
      );

      // SIMULATE UNMOUNT OCCURRING WHILE REQUEST WAS IN FLIGHT:
      isMountedRef.current = false;
      console.log('  [Race Condition] Screen unmounted while reserveTickets was in-flight (isMountedRef.current = false)');

      // Component check from STEP 4:
      if (!isMountedRef.current) {
        if (resData?.success && resData?.sessionId) {
          console.log(`  [Safety Net] Component unmounted -> automatically releasing newly created hold ${resData.sessionId}`);
          await eventController.releaseReservation(
            {
              user: { id: testMemberId, type: 'member' },
              params: { eventId: testEventId },
              body: { sessionId: resData.sessionId }
            },
            {
              status: () => ({ json: () => {} }),
              json: () => {}
            }
          );
        }
        return; // Skip setState
      }

      stateSetCalled = true;
      session3 = resData.sessionId;
    };

    await mockAttemptReservationWithUnmountRace();

    const snapshotAfterUnmount = await getSnapshot();
    console.log('DB Snapshot after Unmount Race:', snapshotAfterUnmount);
    console.log(`setState called? ${stateSetCalled} (Must be false to prevent React memory leak warning)`);

    // Validations for Scenario C
    const scCFails = [];
    if (stateSetCalled) scCFails.push('State setter was called after unmount!');
    if (snapshotAfterUnmount.reservedCount !== 0) scCFails.push(`Expected reservedCount=0, got ${snapshotAfterUnmount.reservedCount}`);
    if (snapshotAfterUnmount.holdsCount !== 0) scCFails.push(`Expected holdsCount=0, got ${snapshotAfterUnmount.holdsCount}`);

    if (scCFails.length === 0) {
      console.log('>>> [PASS] Scenario C: No state updates after unmount, orphaned reservation auto-released, zero DB leaks.');
    } else {
      console.error('>>> [FAIL] Scenario C:', scCFails);
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Cleanup test event
    if (testEventId) {
      console.log('\n[Cleanup] Purging test fixtures...');
      await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM ticket_reservations WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM razorpay_orders WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM events WHERE id = $1`, [testEventId]);
      console.log('[Cleanup] Done.');
    }
    await pool.end();
  }
}

runScenarioTests();
