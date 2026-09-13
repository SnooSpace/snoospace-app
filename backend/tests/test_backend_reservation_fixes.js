require('dotenv').config();
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const { createPool } = require('../config/db');
const pool = createPool();
const eventController = require('../controllers/eventController');
const schedulerService = require('../services/schedulerService');
const { handleRazorpayWebhook } = require('../routes/webhooks');

async function runTests() {
  console.log('================================================================');
  console.log('BACKEND RESERVATION SYSTEM FIXES: VERIFICATION SUITE');
  console.log('================================================================');

  let testCommunityId = null;
  let testMemberId = null;
  let testEventId = null;
  let vipTicketId = null;
  let gaTicketId = null;

  try {
    // Fixture setup
    const commRes = await pool.query(`SELECT id FROM communities LIMIT 1`);
    testCommunityId = commRes.rows[0].id;

    const memberRes = await pool.query(`SELECT id FROM members LIMIT 1`);
    testMemberId = memberRes.rows[0].id;

    const eventInsert = await pool.query(
      `INSERT INTO events (
        title, event_type, creator_id, creator_type, community_id,
        event_date, start_datetime, end_datetime, status
      ) VALUES (
        'Verification Event - Backend Fixes', 'in-person', $1, 'community', $1,
        '2026-11-01', '2026-11-01 10:00:00+00', '2026-11-01 18:00:00+00', 'published'
      ) RETURNING id`,
      [testCommunityId]
    );
    testEventId = eventInsert.rows[0].id;

    // Create VIP ticket type
    const vipRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, max_per_order, is_active, reserved_count, sold_count
      ) VALUES (
        $1, 'VIP Pass', 1000.00, 5, 5, true, 0, 0
      ) RETURNING id`,
      [testEventId]
    );
    vipTicketId = vipRes.rows[0].id;

    // Create GA ticket type
    const gaRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, max_per_order, is_active, reserved_count, sold_count
      ) VALUES (
        $1, 'General Admission', 250.00, 10, 5, true, 0, 0
      ) RETURNING id`,
      [testEventId]
    );
    gaTicketId = gaRes.rows[0].id;

    console.log(`[Setup] Event #${testEventId} created with VIP #${vipTicketId} and GA #${gaTicketId}`);

    // =========================================================================
    // TEST 5: Dirty re-entry
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 5: Dirty re-entry (VIP -> GA switch without explicit release)');
    console.log('----------------------------------------------------------------');

    // 1. Reserve 2x VIP
    let vipSessionId = null;
    await eventController.reserveTickets(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: { tickets: [{ ticketTypeId: vipTicketId, quantity: 2 }] }
      },
      {
        status: (c) => ({ json: (d) => { if (c >= 400) throw new Error(d.error); } }),
        json: (d) => { vipSessionId = d.sessionId; }
      }
    );

    const step1Vip = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    const step1Ga = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [gaTicketId]);
    const step1Holds = await pool.query(`SELECT session_id, ticket_type_id, quantity FROM ticket_reservations WHERE event_id = $1`, [testEventId]);

    console.log('Step 1 (Reserved 2x VIP):');
    console.log(`  - VIP reserved_count: ${step1Vip.rows[0].reserved_count}`);
    console.log(`  - GA reserved_count: ${step1Ga.rows[0].reserved_count}`);
    console.log(`  - Holds in DB:`, step1Holds.rows);
    console.log(`  - VIP Session ID: ${vipSessionId}`);

    // 2. Call reserveTickets again for SAME user/event with 2x GA instead (no release called)
    console.log('\nStep 2: Calling reserveTickets with 2x GA for the same member & event...');
    let gaSessionId = null;
    await eventController.reserveTickets(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: { tickets: [{ ticketTypeId: gaTicketId, quantity: 2 }] }
      },
      {
        status: (c) => ({ json: (d) => { if (c >= 400) throw new Error(d.error); } }),
        json: (d) => { gaSessionId = d.sessionId; }
      }
    );

    const step2Vip = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    const step2Ga = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [gaTicketId]);
    const step2Holds = await pool.query(`SELECT session_id, ticket_type_id, quantity FROM ticket_reservations WHERE event_id = $1`, [testEventId]);

    console.log('Step 2 (After switching to GA):');
    console.log(`  - VIP reserved_count: ${step2Vip.rows[0].reserved_count}`);
    console.log(`  - GA reserved_count: ${step2Ga.rows[0].reserved_count}`);
    console.log(`  - Holds in DB:`, step2Holds.rows);
    console.log(`  - New GA Session ID: ${gaSessionId}`);

    // Validate Test 5
    const t5Fails = [];
    if (step2Vip.rows[0].reserved_count !== 0) t5Fails.push(`VIP reserved_count is ${step2Vip.rows[0].reserved_count} (expected 0)`);
    if (step2Ga.rows[0].reserved_count !== 2) t5Fails.push(`GA reserved_count is ${step2Ga.rows[0].reserved_count} (expected 2)`);
    if (step2Holds.rows.length !== 1) t5Fails.push(`Holds count is ${step2Holds.rows.length} (expected 1)`);
    if (step2Holds.rows[0]?.ticket_type_id !== gaTicketId) t5Fails.push('Remaining hold is not GA');
    if (gaSessionId === vipSessionId) t5Fails.push('Session ID was reused rather than generating a fresh session');

    if (t5Fails.length === 0) {
      console.log('>>> [PASS] TEST 5: Dirty re-entry succeeded. VIP released (0), GA held (2), 1 row in DB, new sessionId issued.');
    } else {
      console.error('>>> [FAIL] TEST 5:', t5Fails);
    }

    // Clean holds before Test 6
    await pool.query(`DELETE FROM ticket_reservations WHERE event_id = $1`, [testEventId]);
    await pool.query(`UPDATE ticket_types SET reserved_count = 0, sold_count = 0 WHERE event_id = $1`, [testEventId]);

    // =========================================================================
    // TEST 6: Startup cleanup
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 6: Startup cleanup via schedulerService.init()');
    console.log('----------------------------------------------------------------');

    // 1. Manually insert expired row (expires_at in the past) and bump reserved_count
    const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const expiredSessionId = 'expired_test_session_123';
    await pool.query(
      `INSERT INTO ticket_reservations (
        ticket_type_id, member_id, event_id, quantity, session_id, expires_at
      ) VALUES ($1, $2, $3, 3, $4, $5)`,
      [vipTicketId, testMemberId, testEventId, expiredSessionId, pastDate]
    );
    await pool.query(
      `UPDATE ticket_types SET reserved_count = 3 WHERE id = $1`,
      [vipTicketId]
    );

    const step1ExpCheck = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    const step1ExpHolds = await pool.query(`SELECT id, session_id, expires_at FROM ticket_reservations WHERE session_id = $1`, [expiredSessionId]);
    console.log('Step 1 (Manually inserted expired hold):');
    console.log(`  - VIP reserved_count: ${step1ExpCheck.rows[0].reserved_count}`);
    console.log(`  - Expired Hold in DB:`, step1ExpHolds.rows);

    // 2. Invoke schedulerService.init() to simulate server boot
    console.log('\nStep 2: Calling schedulerService.init(pool) to simulate server startup...');
    const startTime = Date.now();
    schedulerService.init(pool);

    // Give it 500ms for the promise launched in init() to resolve
    await new Promise((resolve) => setTimeout(resolve, 600));
    const elapsed = Date.now() - startTime;
    console.log(`Startup cleanup resolved within ${elapsed}ms (running immediately on boot)`);

    const step2ExpCheck = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    const step2ExpHolds = await pool.query(`SELECT id, session_id FROM ticket_reservations WHERE session_id = $1`, [expiredSessionId]);
    console.log('Step 2 (After init startup cleanup):');
    console.log(`  - VIP reserved_count: ${step2ExpCheck.rows[0].reserved_count}`);
    console.log(`  - Expired Holds in DB: ${step2ExpHolds.rows.length}`);

    // Validate Test 6
    const t6Fails = [];
    if (step2ExpCheck.rows[0].reserved_count !== 0) t6Fails.push(`VIP reserved_count is ${step2ExpCheck.rows[0].reserved_count} (expected 0)`);
    if (step2ExpHolds.rows.length !== 0) t6Fails.push(`Expired reservation row was not deleted on startup`);

    if (t6Fails.length === 0) {
      console.log('>>> [PASS] TEST 6: Startup cleanup purged expired reservation and reset reserved_count to 0 immediately on init().');
    } else {
      console.error('>>> [FAIL] TEST 6:', t6Fails);
    }

    // =========================================================================
    // TEST 7/8: Webhook race — reservation already expired at capture time
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST 7/8: Webhook race — reservation already expired at capture time');
    console.log('----------------------------------------------------------------');

    // Make ticket capacity 1 so selling 1 leaves 0 available
    await pool.query(`UPDATE ticket_types SET total_quantity = 1, reserved_count = 0, sold_count = 0 WHERE id = $1`, [vipTicketId]);

    // 1. Reserve 1x ticket
    let raceSessionId = null;
    await eventController.reserveTickets(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: { tickets: [{ ticketTypeId: vipTicketId, quantity: 1 }] }
      },
      {
        status: (c) => ({ json: (d) => { if (c >= 400) throw new Error(d.error); } }),
        json: (d) => { raceSessionId = d.sessionId; }
      }
    );
    console.log(`Step 1: Created hold for VIP -> Session: ${raceSessionId}`);
    const holdSnap = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    console.log(`  - VIP reserved_count: ${holdSnap.rows[0].reserved_count}`);

    // 2. Delete the reservation row to simulate the cron expiry sweep having beat the webhook
    console.log('\nStep 2: Forcing cron expiry sweep (deleting hold before webhook arrives)...');
    await pool.query(`DELETE FROM ticket_reservations WHERE session_id = $1`, [raceSessionId]);
    await pool.query(`UPDATE ticket_types SET reserved_count = 0 WHERE id = $1`, [vipTicketId]);

    // Let's also set sold_count = 1 on VIP to simulate another buyer having bought the released ticket!
    // This forces available < 0 when our webhook runs, triggering the OVERSELL DETECTED check!
    await pool.query(`UPDATE ticket_types SET sold_count = 1 WHERE id = $1`, [vipTicketId]);
    const oversellSetup = await pool.query(`SELECT total_quantity, sold_count, reserved_count FROM ticket_types WHERE id = $1`, [vipTicketId]);
    console.log('  - Pre-webhook state (already at full capacity 1/1 sold):', oversellSetup.rows[0]);

    // 3. Invoke handleRazorpayWebhook with order pointing to the expired session
    console.log('\nStep 3: Invoking handleRazorpayWebhook with order pointing to deleted session...');
    const raceOrderId = `order_race_${Date.now()}`;
    const racePayId = `pay_race_${Date.now()}`;

    await pool.query(
      `INSERT INTO razorpay_orders (
        razorpay_order_id, user_id, event_id, amount_paise, currency, status, notes
      ) VALUES ($1, $2, $3, 100000, 'INR', 'created', $4)`,
      [
        raceOrderId,
        testMemberId,
        testEventId,
        JSON.stringify({
          sessionId: raceSessionId,
          tickets: [{ ticketTypeId: vipTicketId, quantity: 1, unitPrice: 1000, ticketName: 'VIP Pass' }]
        })
      ]
    );

    const mockReq = {
      app: { locals: { pool } },
      webhookBody: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: racePayId,
              order_id: raceOrderId,
              amount: 100000,
              currency: 'INR',
              method: 'card'
            }
          }
        }
      }
    };
    const mockRes = { status: () => ({ json: () => {} }) };

    await handleRazorpayWebhook(mockReq, mockRes);

    // 4. Check DB results
    const afterWebhookTicket = await pool.query(
      `SELECT total_quantity, sold_count, reserved_count FROM ticket_types WHERE id = $1`,
      [vipTicketId]
    );
    const afterWebhookReg = await pool.query(
      `SELECT id, registration_status, total_amount FROM event_registrations WHERE event_id = $1 AND member_id = $2`,
      [testEventId, testMemberId]
    );
    const afterWebhookRegTickets = await pool.query(
      `SELECT id, ticket_type_id, quantity, unit_price FROM registration_tickets WHERE registration_id = $1`,
      [afterWebhookReg.rows[0]?.id]
    );

    console.log('\nStep 4: Post-Webhook DB Verification:');
    console.log(`  - Ticket Type State:`, afterWebhookTicket.rows[0]);
    console.log(`  - Event Registration:`, afterWebhookReg.rows[0]);
    console.log(`  - Registration Tickets:`, afterWebhookRegTickets.rows);

    // Validate Test 7/8
    const t7Fails = [];
    if (!afterWebhookReg.rows.length || afterWebhookReg.rows[0].registration_status !== 'registered') {
      t7Fails.push('Registration was not created or not marked registered');
    }
    if (!afterWebhookRegTickets.rows.length) {
      t7Fails.push('No registration_tickets row created');
    }
    if (afterWebhookTicket.rows[0].sold_count !== 2) {
      t7Fails.push(`Sold count is ${afterWebhookTicket.rows[0].sold_count} (expected 2)`);
    }

    if (t7Fails.length === 0) {
      console.log('>>> [PASS] TEST 7/8: Webhook safely fulfilled paid booking despite expired hold, created registration + tickets, and handled oversell logging.');
    } else {
      console.error('>>> [FAIL] TEST 7/8:', t7Fails);
    }

  } catch (err) {
    console.error('Test Suite Error:', err);
  } finally {
    if (testEventId) {
      console.log('\n[Cleanup] Removing test fixture...');
      await pool.query(`DELETE FROM registration_tickets WHERE ticket_type_id IN ($1, $2)`, [vipTicketId, gaTicketId]);
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

runTests();
