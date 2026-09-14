require('dotenv').config();
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const { createPool } = require('../config/db');
const pool = createPool();
const eventController = require('../controllers/eventController');
const paymentController = require('../controllers/paymentController');

// Simulate client.js buildError implementation
function buildError(res, data) {
  const status = res?.status;
  const serverMessage = data?.message || data?.error || data?.msg;
  const statusText = res?.statusText;
  const message = serverMessage || statusText || 'Request failed';
  const err = new Error(message);
  if (typeof status === 'number') err.status = status;
  if (data) err.data = data;
  err.code = data?.error || data?.code || null;
  err.error = data?.error || null;
  return err;
}

const DEAD_SESSION_CODES = new Set([
  'reservation_expired',
  'reservation_mismatch',
  'price_mismatch',
  'session_expired',
]);

function isDeadSessionError(error) {
  const code = error?.code || error?.data?.error || error?.data?.code;
  return DEAD_SESSION_CODES.has(code);
}

// Simple EventEmitter for EventBus simulation
class EventBusMock {
  constructor() {
    this.listeners = new Map();
  }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    const set = this.listeners.get(event);
    if (set) set.delete(handler);
  }
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch {}
    });
  }
}

async function runBSuite() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('CHECKOUT SCREEN BACKGROUNDING & STALE SESSION SUITE (B1 - B6)');
  console.log('════════════════════════════════════════════════════════════════\n');

  let testCommunityId = null;
  let testMemberId = null;
  let testEventId = null;
  let testTicketTypeId = null;

  try {
    // Fixture setup
    const commRes = await pool.query(`SELECT id FROM communities LIMIT 1`);
    testCommunityId = commRes.rows[0].id;

    const memberRes = await pool.query(`SELECT id, name, email FROM members LIMIT 1`);
    testMemberId = memberRes.rows[0].id;

    const eventInsert = await pool.query(
      `INSERT INTO events (
        title, event_type, creator_id, creator_type, community_id,
        event_date, start_datetime, end_datetime, status
      ) VALUES (
        'B-Suite Verification Event', 'in-person', $1, 'community', $1,
        '2026-11-01', '2026-11-01 10:00:00+00', '2026-11-01 18:00:00+00', 'published'
      ) RETURNING id`,
      [testCommunityId]
    );
    testEventId = eventInsert.rows[0].id;

    const ticketInsert = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, max_per_order, is_active, reserved_count, sold_count
      ) VALUES (
        $1, 'Tier B', 650.00, 20, 5, true, 0, 0
      ) RETURNING id`,
      [testEventId]
    );
    testTicketTypeId = ticketInsert.rows[0].id;

    console.log(`[Setup] Event #${testEventId} created with TicketType #${testTicketTypeId} (price: ₹650, qty: 20)`);

    const getSnapshot = async () => {
      const ticket = await pool.query(
        `SELECT reserved_count, sold_count, total_quantity FROM ticket_types WHERE id = $1`,
        [testTicketTypeId]
      );
      const holds = await pool.query(
        `SELECT id, session_id, quantity, expires_at FROM ticket_reservations WHERE ticket_type_id = $1`,
        [testTicketTypeId]
      );
      return {
        reservedCount: parseInt(ticket.rows[0].reserved_count, 10),
        soldCount: parseInt(ticket.rows[0].sold_count, 10),
        holdsCount: holds.rows.length,
        holds: holds.rows.map((h) => ({
          sessionId: h.session_id,
          qty: h.quantity,
          expiresAt: h.expires_at,
        })),
      };
    };

    // Helper: reserve ticket via eventController
    const reserve = async () => {
      let result = null;
      let status = 200;
      await eventController.reserveTickets(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: { tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1 }] },
        },
        {
          status: (c) => {
            status = c;
            return {
              json: (d) => {
                result = d;
              },
            };
          },
          json: (d) => {
            result = d;
          },
        }
      );
      return { status, result };
    };

    // Helper: release reservation via eventController
    const release = async (sessId) => {
      let result = null;
      await eventController.releaseReservation(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: { sessionId: sessId },
        },
        {
          status: () => ({ json: (d) => (result = d) }),
          json: (d) => (result = d),
        }
      );
      return result;
    };

    // =========================================================================
    // TEST B1: Proactive re-validation on app resume via existing appResumed
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B1: Proactive re-validation on app resume via appResumed');
    console.log('────────────────────────────────────────────────────────────────');

    const resB1 = await reserve();
    const sessionB1 = resB1.result.sessionId;
    console.log(`Step 1: Created hold Session #${sessionB1}, expiresAt: ${resB1.result.expiresAt}`);
    console.log('DB Snapshot after reserve:', await getSnapshot());

    // Simulate backgrounding: expire the DB row (set expires_at = NOW() - 10s)
    await pool.query(
      `UPDATE ticket_reservations SET expires_at = NOW() - INTERVAL '10 seconds' WHERE session_id = $1`,
      [sessionB1]
    );
    // Also advance clock timestamp past expiry
    const expiredClockTimestamp = Date.now() - 5000;

    console.log('Step 2: Simulated backgrounding by setting DB expires_at to 10s in the past.');

    // Simulate CheckoutScreen's EventBus listener & triggerSessionExpired
    let b1AlertFired = null;
    let b1Navigated = false;
    const eventBusB1 = new EventBusMock();

    const mockStateB1 = {
      sessionId: sessionB1,
      isConfirmed: false,
      expiresAtRef: { current: expiredClockTimestamp },
      hasExpiredRef: { current: false },
      timeLeft: 300,
      isRazorpayVisibleRef: { current: false },
    };

    const triggerSessionExpiredB1 = async (force = false) => {
      if (mockStateB1.hasExpiredRef.current) return;
      if (!force && mockStateB1.isRazorpayVisibleRef.current) return;
      mockStateB1.hasExpiredRef.current = true;
      mockStateB1.expiresAtRef.current = null;
      mockStateB1.timeLeft = 0;
      await release(mockStateB1.sessionId);
      b1AlertFired = 'Session Expired';
      b1Navigated = true;
    };

    const handleAppResumedB1 = async () => {
      if (!mockStateB1.sessionId || mockStateB1.isConfirmed) return;
      if (mockStateB1.isRazorpayVisibleRef.current) return;
      if (mockStateB1.expiresAtRef.current && mockStateB1.expiresAtRef.current <= Date.now()) {
        await triggerSessionExpiredB1();
      }
    };

    eventBusB1.on('appResumed', handleAppResumedB1);

    // Fire appResumed
    console.log('Step 3: Firing EventBus "appResumed"...');
    await handleAppResumedB1();

    const snapshotB1 = await getSnapshot();
    console.log('DB Snapshot after appResumed:', snapshotB1);
    console.log(`Alert fired: "${b1AlertFired}", Navigated popToTop: ${b1Navigated}, timeLeft: ${mockStateB1.timeLeft}`);

    const passB1 =
      b1AlertFired === 'Session Expired' &&
      b1Navigated === true &&
      mockStateB1.timeLeft === 0 &&
      snapshotB1.holdsCount === 0 &&
      snapshotB1.reservedCount === 0;

    console.log(`TEST B1 RESULT: ${passB1 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // TEST B2: Timer implementation self-corrects against real clock without drift
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B2: Timestamp-based countdown timer self-correction');
    console.log('────────────────────────────────────────────────────────────────');

    const resB2 = await reserve();
    const sessionB2 = resB2.result.sessionId;
    console.log(`Step 1: Created hold Session #${sessionB2}`);

    // Simulate clock elapsed 15 minutes while app was suspended (no appResumed fired)
    const expiresAtB2 = Date.now() - 10000; // 10s in past
    let b2AlertFired = null;
    let b2TimeLeft = 450; // stale state value from before suspension

    const mockStateB2 = {
      sessionId: sessionB2,
      isConfirmed: false,
      expiresAtRef: { current: expiresAtB2 },
      hasExpiredRef: { current: false },
      isRazorpayVisibleRef: { current: false },
    };

    // Timer tick function
    const checkAndTickB2 = async () => {
      if (!mockStateB2.expiresAtRef.current) return;
      const remainingSeconds = Math.max(
        0,
        Math.floor((mockStateB2.expiresAtRef.current - Date.now()) / 1000)
      );
      b2TimeLeft = remainingSeconds;

      if (remainingSeconds <= 0) {
        if (mockStateB2.isRazorpayVisibleRef.current) return;
        mockStateB2.hasExpiredRef.current = true;
        mockStateB2.expiresAtRef.current = null;
        await release(mockStateB2.sessionId);
        b2AlertFired = 'Session Expired';
      }
    };

    console.log(`Step 2: Stale timeLeft before tick: ${b2TimeLeft}s. Real clock is past expiry.`);
    console.log('Step 3: Ticking countdown timer once...');
    await checkAndTickB2();

    const snapshotB2 = await getSnapshot();
    console.log(`timeLeft after 1 tick: ${b2TimeLeft}s (expected 0)`);
    console.log(`Alert fired: "${b2AlertFired}", DB holds count: ${snapshotB2.holdsCount}`);

    const passB2 =
      b2TimeLeft === 0 &&
      b2AlertFired === 'Session Expired' &&
      snapshotB2.holdsCount === 0 &&
      snapshotB2.reservedCount === 0;

    console.log(`TEST B2 RESULT: ${passB2 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // TEST B3: Genuine reservation_expired error during payment -> Human readable message & NO silent re-reserve
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B3: Genuine reservation_expired handling (No Silent Re-reserve)');
    console.log('────────────────────────────────────────────────────────────────');

    const resB3 = await reserve();
    const sessionB3 = resB3.result.sessionId;
    console.log(`Step 1: Created hold Session #${sessionB3}`);

    // Manually expire the DB row
    await pool.query(
      `UPDATE ticket_reservations SET expires_at = NOW() - INTERVAL '1 minute' WHERE session_id = $1`,
      [sessionB3]
    );
    console.log('Step 2: Manually expired reservation in DB');

    // Attempt createOrder with expired session
    let orderStatusB3 = 200;
    let orderDataB3 = null;
    await paymentController.createOrder(
      {
        user: { id: testMemberId, type: 'member' },
        body: {
          eventId: testEventId,
          totalAmountRupees: 650,
          tickets: [{ ticketTypeId: testTicketTypeId, quantity: 1 }],
          sessionId: sessionB3,
        },
      },
      {
        status: (c) => {
          orderStatusB3 = c;
          return {
            json: (d) => {
              orderDataB3 = d;
            },
          };
        },
        json: (d) => {
          orderDataB3 = d;
        },
      }
    );

    console.log(`Step 3: createPaymentOrder returned status: ${orderStatusB3}`);
    console.log('Backend Response Payload:', orderDataB3);

    // Build error with client.js buildError
    const builtErrB3 = buildError({ status: orderStatusB3 }, orderDataB3);
    console.log(`Built client error -> message: "${builtErrB3.message}", code: "${builtErrB3.code}"`);

    // Simulate CheckoutScreen handleConfirmBooking catch block
    let b3AlertTitle = null;
    let b3AlertMsg = null;
    let b3ReReserved = false;

    if (isDeadSessionError(builtErrB3)) {
      b3AlertTitle = builtErrB3.code === 'price_mismatch' ? 'Price Updated' : 'Session Expired';
      b3AlertMsg = builtErrB3.message || 'Your booking session has expired.';
      // NO attemptReservation() call!
      await release(sessionB3);
    } else {
      // Fallback: silent retry
      b3ReReserved = true;
      await reserve();
    }

    const snapshotB3 = await getSnapshot();
    console.log('DB Snapshot after B3 catch block:', snapshotB3);
    console.log(`Alert Title: "${b3AlertTitle}"`);
    console.log(`Alert Message: "${b3AlertMsg}"`);
    console.log(`Silent Re-reserve attempted: ${b3ReReserved}`);

    const passB3 =
      orderStatusB3 === 400 &&
      orderDataB3.error === 'reservation_expired' &&
      builtErrB3.message === 'Your ticket reservation hold has expired. Please select your tickets again.' &&
      builtErrB3.code === 'reservation_expired' &&
      isDeadSessionError(builtErrB3) === true &&
      b3AlertTitle === 'Session Expired' &&
      b3ReReserved === false &&
      snapshotB3.holdsCount === 0 &&
      snapshotB3.reservedCount === 0;

    console.log(`TEST B3 RESULT: ${passB3 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // TEST B4: Regression — Genuine payment FAILURE (declined card) still triggers silent re-reserve
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B4: Regression — Legitimate payment FAILURE silent retry');
    console.log('────────────────────────────────────────────────────────────────');

    const resB4 = await reserve();
    const sessionB4 = resB4.result.sessionId;
    console.log(`Step 1: Created hold Session #${sessionB4}`);
    console.log('DB Snapshot before payment failure:', await getSnapshot());

    // Simulate Razorpay payment failure (card declined by bank) with valid hold
    const rzpErrorB4 = {
      code: 'BAD_REQUEST_ERROR',
      description: 'Your card has insufficient funds / transaction declined.',
    };

    let b4AlertTitle = null;
    let b4NewSession = null;

    const isExpiredB4 = isDeadSessionError(rzpErrorB4);
    if (isExpiredB4) {
      b4AlertTitle = 'Session Expired';
    } else {
      b4AlertTitle = 'Payment Failed';
      // Release old hold
      await release(sessionB4);
      // Auto-retry with fresh hold (Fix 4.5 preservation)
      const freshRes = await reserve();
      b4NewSession = freshRes.result.sessionId;
    }

    const snapshotB4 = await getSnapshot();
    console.log(`Alert Title: "${b4AlertTitle}"`);
    console.log(`Old Session Released: #${sessionB4}, New Fresh Session Acquired: #${b4NewSession}`);
    console.log('DB Snapshot after payment failure retry:', snapshotB4);

    const passB4 =
      b4AlertTitle === 'Payment Failed' &&
      isExpiredB4 === false &&
      b4NewSession !== null &&
      b4NewSession !== sessionB4 &&
      snapshotB4.holdsCount === 1 &&
      snapshotB4.reservedCount === 1;

    console.log(`TEST B4 RESULT: ${passB4 ? 'PASS' : 'FAIL'}`);

    // Clean up sessionB4 fresh hold
    if (b4NewSession) await release(b4NewSession);

    // =========================================================================
    // TEST B5: Compatibility of client.js priority swap across app error checks
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B5: client.js priority swap compatibility');
    console.log('────────────────────────────────────────────────────────────────');

    const testCasesB5 = [
      {
        name: 'MemberUsernameScreen username_taken check',
        backendPayload: {
          error: 'username_taken',
          message: 'That username is already in use by another member.',
        },
        verify: (err) =>
          (err.code === 'username_taken' || err.message === 'username_taken') &&
          err.message === 'That username is already in use by another member.',
      },
      {
        name: 'GroupInfoScreen LAST_ADMIN check',
        backendPayload: {
          error: 'LAST_ADMIN',
          message: 'You are the only admin of this group. Promote someone else first.',
        },
        verify: (err) =>
          (err.error === 'LAST_ADMIN' || err.code === 'LAST_ADMIN') &&
          err.message === 'You are the only admin of this group. Promote someone else first.',
      },
      {
        name: 'HostRequestsScreen plan_at_capacity check',
        backendPayload: {
          error: 'plan_at_capacity',
          message: 'This plan is already full.',
        },
        verify: (err) =>
          err.data?.error === 'plan_at_capacity' &&
          err.code === 'plan_at_capacity' &&
          err.message === 'This plan is already full.',
      },
      {
        name: 'RequestBottomSheet proof_gate_required check',
        backendPayload: {
          error: 'proof_gate_required',
          message: 'Face verification is required to join this plan.',
        },
        verify: (err) =>
          err.data?.error === 'proof_gate_required' &&
          err.code === 'proof_gate_required' &&
          err.message === 'Face verification is required to join this plan.',
      },
      {
        name: 'Dead session codes (reservation_mismatch, price_mismatch)',
        backendPayload: {
          error: 'price_mismatch',
          message: 'Pricing has changed, please review your order again.',
        },
        verify: (err) =>
          isDeadSessionError(err) &&
          err.message === 'Pricing has changed, please review your order again.',
      },
    ];

    let allB5Passed = true;
    for (const tc of testCasesB5) {
      const err = buildError({ status: 400 }, tc.backendPayload);
      const passed = tc.verify(err);
      console.log(`  - [${passed ? 'PASS' : 'FAIL'}] ${tc.name}:`);
      console.log(`      err.message: "${err.message}"`);
      console.log(`      err.code: "${err.code}", err.error: "${err.error}", err.data.error: "${err.data?.error}"`);
      if (!passed) allB5Passed = false;
    }

    const passB5 = allB5Passed;
    console.log(`TEST B5 RESULT: ${passB5 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // TEST B6: Background/Resume while Razorpay Sheet is Open (Deferred Expiry)
    // =========================================================================
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('TEST B6: Background/Resume while Razorpay sheet is open');
    console.log('────────────────────────────────────────────────────────────────');

    const resB6 = await reserve();
    const sessionB6 = resB6.result.sessionId;
    console.log(`Step 1: Created hold Session #${sessionB6}`);

    // User clicked Pay, Razorpay modal is OPEN
    let isRazorpayVisibleB6 = true;
    let b6AlertFired = null;
    let b6Navigated = false;

    // Simulate backgrounding: DB hold expires while user is in Razorpay sheet
    await pool.query(
      `UPDATE ticket_reservations SET expires_at = NOW() - INTERVAL '30 seconds' WHERE session_id = $1`,
      [sessionB6]
    );
    const expiredTimeB6 = Date.now() - 15000;

    const mockStateB6 = {
      sessionId: sessionB6,
      isConfirmed: false,
      expiresAtRef: { current: expiredTimeB6 },
      hasExpiredRef: { current: false },
      isRazorpayVisibleRef: { current: isRazorpayVisibleB6 },
      timeLeft: 300,
    };

    const triggerSessionExpiredB6 = async (force = false) => {
      if (mockStateB6.hasExpiredRef.current) return;
      if (!force && mockStateB6.isRazorpayVisibleRef.current) {
        console.log('  [triggerSessionExpired] Alert suppressed because Razorpay sheet is open');
        return;
      }
      mockStateB6.hasExpiredRef.current = true;
      mockStateB6.expiresAtRef.current = null;
      mockStateB6.timeLeft = 0;
      await release(mockStateB6.sessionId);
      b6AlertFired = 'Session Expired';
      b6Navigated = true;
    };

    // Step 2: appResumed fires while Razorpay sheet is open
    console.log('Step 2: App resumes from background while Razorpay sheet is visible...');
    if (mockStateB6.isRazorpayVisibleRef.current) {
      console.log('  [handleAppResumed] Proactive expiry suppressed while Razorpay sheet is open.');
    } else {
      await triggerSessionExpiredB6();
    }

    console.log(`  -> Alert fired during sheet open: ${b6AlertFired} (expected null)`);
    console.log(`  -> Navigated during sheet open: ${b6Navigated} (expected false)`);

    // Step 3: User cancels or closes the Razorpay sheet
    console.log('\nStep 3: User closes the Razorpay sheet (onClose)...');
    isRazorpayVisibleB6 = false;
    mockStateB6.isRazorpayVisibleRef.current = false;

    // Simulate onClose handler:
    // "If the hold expired while the payment sheet was open, trigger session expired now"
    if (mockStateB6.expiresAtRef.current && mockStateB6.expiresAtRef.current <= Date.now()) {
      console.log('  [onClose] Detected hold expired while sheet was open. Triggering session expired.');
      await triggerSessionExpiredB6(true);
    } else {
      console.log('  [onClose] Hold not expired, performing silent re-reserve.');
      await release(sessionB6);
      await reserve();
    }

    const snapshotB6 = await getSnapshot();
    console.log(`Alert fired after sheet close: "${b6AlertFired}" (expected "Session Expired")`);
    console.log(`Navigated popToTop: ${b6Navigated}`);
    console.log('DB Snapshot after onClose:', snapshotB6);

    const passB6 =
      b6AlertFired === 'Session Expired' &&
      b6Navigated === true &&
      snapshotB6.holdsCount === 0 &&
      snapshotB6.reservedCount === 0;

    console.log(`TEST B6 RESULT: ${passB6 ? 'PASS' : 'FAIL'}`);

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('FINAL B-SUITE EXECUTION SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`TEST B1 (Proactive Resume Expiration):         ${passB1 ? 'PASS' : 'FAIL'}`);
    console.log(`TEST B2 (Timer Drift Self-Correction):         ${passB2 ? 'PASS' : 'FAIL'}`);
    console.log(`TEST B3 (Dead Session / Friendly Msg):         ${passB3 ? 'PASS' : 'FAIL'}`);
    console.log(`TEST B4 (Payment Failure Silent Retry):        ${passB4 ? 'PASS' : 'FAIL'}`);
    console.log(`TEST B5 (client.js Code Compatibility):        ${passB5 ? 'PASS' : 'FAIL'}`);
    console.log(`TEST B6 (Razorpay Sheet Open Suppression):     ${passB6 ? 'PASS' : 'FAIL'}`);

    if (passB1 && passB2 && passB3 && passB4 && passB5 && passB6) {
      console.log('\nALL 6 B-SUITE TESTS PASSED WITH 100% SUCCESS!');
    } else {
      console.error('\nONE OR MORE TESTS FAILED!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    // Cleanup fixtures
    if (testTicketTypeId) {
      await pool.query(`DELETE FROM ticket_reservations WHERE ticket_type_id = $1`, [testTicketTypeId]);
      await pool.query(`DELETE FROM ticket_types WHERE id = $1`, [testTicketTypeId]);
    }
    if (testEventId) {
      await pool.query(`DELETE FROM events WHERE id = $1`, [testEventId]);
    }
    await pool.end();
  }
}

runBSuite();
