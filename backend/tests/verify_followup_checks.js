const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');

const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

async function logHttp(label, method, path, reqBody, status, resBody) {
  console.log(`\n================================================================`);
  console.log(`[HTTP CALL] ${label}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`REQUEST: ${method} ${path}`);
  console.log(`PAYLOAD: ${JSON.stringify(reqBody, null, 2)}`);
  console.log(`STATUS:  ${status}`);
  console.log(`RESPONSE: ${JSON.stringify(resBody, null, 2)}`);
}

async function apiRequest(member, method, path, body = null) {
  const token = generateAccessToken(member.id, 'member', member.email);
  const url = `${API_BASE}${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const opt = {
    method,
    headers,
  };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function runFollowupVerification() {
  console.log('\n================================================================');
  console.log('FOLLOW-UP VERIFICATION: GAP 2 MISMATCH & CONCURRENT DOUBLE-TAP');
  console.log('Target Server:', API_BASE);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  try {
    // 1. Fetch community & members
    const commRes = await pool.query('SELECT id FROM communities LIMIT 1');
    const communityId = commRes.rows[0].id;

    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 5');
    const member1 = memRes.rows[0];
    const member2 = memRes.rows[1];

    console.log(`Using Community #${communityId}`);
    console.log(`Using Member 1 #${member1.id} (${member1.email}), Member 2 #${member2.id} (${member2.email})`);

    // 2. Create dedicated event
    const now = new Date();
    const eventDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const eventRes = await pool.query(
      `INSERT INTO events (
        title, description, event_date, start_datetime, end_datetime,
        event_type, location_name, status, community_id, creator_id
      ) VALUES ($1, $2, $3, $4, $5, 'in-person', 'Followup Arena', 'published', $6, $6)
      RETURNING id, title`,
      [
        'Follow-up Verification Event ' + Date.now(),
        'Verification of reservation mismatch and concurrent double-tap',
        eventDate.toISOString().split('T')[0],
        eventDate.toISOString(),
        new Date(eventDate.getTime() + 4 * 3600 * 1000).toISOString(),
        communityId,
      ]
    );
    const testEventId = eventRes.rows[0].id;
    console.log(`Created Test Event #${testEventId}`);

    // 3. Create ticket type (price 200, qty 100)
    const ticketRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, sold_count, reserved_count,
        sale_start_at, sale_end_at, is_active
      ) VALUES ($1, 'General Admission', 200.00, 100, 0, 0, $2, $3, true)
      RETURNING id`,
      [testEventId, new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString()]
    );
    const ticketId = ticketRes.rows[0].id;
    console.log(`Created Ticket Type #${ticketId} (₹200.00, qty: 100)`);

    // 4. Create 100% discount promo code with max_uses = 5
    await pool.query(
      `INSERT INTO discount_codes (
        event_id, code, code_normalized, discount_type, discount_value, max_uses, current_uses,
        valid_from, valid_until, applies_to, selected_tickets, is_active
      ) VALUES ($1, 'FREE100', 'FREE100', 'percentage', 100.00, 5, 0, $2, $3, 'all', '[]', true)`,
      [
        testEventId,
        new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString(),
      ]
    );
    console.log(`Created Promo Code 'FREE100' (100% off, max_uses: 5)`);

    // =========================================================================
    // PART 1: RESERVATION MISMATCH CHECK (GAP 2)
    // =========================================================================
    console.log('\n================================================================');
    console.log('PART 1: RESERVATION MISMATCH VERIFICATION (GAP 2 CAPACITY BYPASS)');
    console.log('----------------------------------------------------------------');
    console.log('Step 1a: Reserve 1 ticket via POST /events/:eventId/reserve-tickets');

    const reservePayload = {
      tickets: [{ ticketTypeId: ticketId, quantity: 1 }],
    };
    const reserveRes = await apiRequest(member1, 'POST', `/events/${testEventId}/reserve-tickets`, reservePayload);
    await logHttp('Part 1a: Reserve 1 Ticket Hold', 'POST', `/events/${testEventId}/reserve-tickets`, reservePayload, reserveRes.status, reserveRes.data);

    if (!reserveRes.data?.sessionId) {
      throw new Error('Failed to obtain reservation sessionId: ' + JSON.stringify(reserveRes.data));
    }
    const sessionId = reserveRes.data.sessionId;

    // Check DB hold state
    const holdDbCheck = await pool.query(
      `SELECT session_id, member_id, ticket_type_id, quantity, expires_at 
       FROM ticket_reservations WHERE session_id = $1`,
      [sessionId]
    );
    console.log('\nDB Active Hold Record:', holdDbCheck.rows[0]);

    const ticketDbCheckAfterHold = await pool.query(
      `SELECT id, name, sold_count, reserved_count, total_quantity FROM ticket_types WHERE id = $1`,
      [ticketId]
    );
    console.log('DB Ticket State after 1 hold:', ticketDbCheckAfterHold.rows[0]);

    console.log('\nStep 1b: Attempt createOrder requesting 5 tickets using sessionId that only holds 1 ticket...');
    const mismatchPayload = {
      eventId: testEventId,
      totalAmountRupees: 1000, // 5 * ₹200
      tickets: [{ ticketTypeId: ticketId, quantity: 5 }], // REQUESTING 5 TICKETS WITH HOLD OF 1
      sessionId: sessionId,
    };
    const mismatchRes = await apiRequest(member1, 'POST', '/payments/create-order', mismatchPayload);
    await logHttp('Part 1b: createOrder with Quantity Mismatch (Held: 1, Requested: 5)', 'POST', '/payments/create-order', mismatchPayload, mismatchRes.status, mismatchRes.data);

    if (mismatchRes.status === 400 && mismatchRes.data?.error === 'reservation_mismatch') {
      console.log('✅ PART 1 PASSED: Capacity bypass prevented! Server rejected with 400 reservation_mismatch.');
    } else {
      console.error('❌ PART 1 FAILED: Server did not reject with reservation_mismatch!');
    }

    // Verify DB state: hold remains intact, not consumed
    const holdDbCheckAfter = await pool.query(
      `SELECT session_id, quantity FROM ticket_reservations WHERE session_id = $1`,
      [sessionId]
    );
    console.log('DB Hold Record after rejected mismatch (still intact):', holdDbCheckAfter.rows[0]);


    // =========================================================================
    // PART 2: TRUE CONCURRENT DOUBLE-TAP IDEMPOTENCY ON 100% DISCOUNT
    // =========================================================================
    console.log('\n================================================================');
    console.log('PART 2: TRUE CONCURRENT DOUBLE-TAP IDEMPOTENCY (Promise.all)');
    console.log('----------------------------------------------------------------');
    console.log(`Firing 2 identical createOrder calls for Member #${member2.id} at the exact same millisecond...`);

    const doubleTapPayload = {
      eventId: testEventId,
      promoCode: 'FREE100',
      totalAmountRupees: 0,
      discountAmount: 200,
      tickets: [{ ticketTypeId: ticketId, quantity: 1 }],
    };

    const t0 = Date.now();
    const [tap1, tap2] = await Promise.all([
      (async () => {
        const start = Date.now();
        const r = await apiRequest(member2, 'POST', '/payments/create-order', doubleTapPayload);
        const dur = Date.now() - start;
        return { call: 'Call #1', startOffsetMs: start - t0, durationMs: dur, ...r };
      })(),
      (async () => {
        const start = Date.now();
        const r = await apiRequest(member2, 'POST', '/payments/create-order', doubleTapPayload);
        const dur = Date.now() - start;
        return { call: 'Call #2', startOffsetMs: start - t0, durationMs: dur, ...r };
      })(),
    ]);

    console.log('\n[CONCURRENT DOUBLE-TAP TIMING & RESPONSES]');
    console.log(`${tap1.call}: offset ${tap1.startOffsetMs}ms, took ${tap1.durationMs}ms -> HTTP ${tap1.status}`, JSON.stringify(tap1.data, null, 2));
    console.log(`${tap2.call}: offset ${tap2.startOffsetMs}ms, took ${tap2.durationMs}ms -> HTTP ${tap2.status}`, JSON.stringify(tap2.data, null, 2));

    // LIVE DB STATE CHECKS FOR PART 2
    console.log('\n--- LIVE DB STATE CHECKS FOR PART 2 ---');
    const dcState = await pool.query(
      `SELECT id, code, max_uses, current_uses FROM discount_codes WHERE event_id = $1 AND code_normalized = 'FREE100'`,
      [testEventId]
    );
    console.log('discount_codes state:', dcState.rows[0]);

    const regRows = await pool.query(
      `SELECT id, event_id, member_id, promo_code, total_amount, registration_status, created_at
       FROM event_registrations 
       WHERE event_id = $1 AND member_id = $2 AND registration_status != 'cancelled'`,
      [testEventId, member2.id]
    );
    console.log(`event_registrations rows for Member #${member2.id} (count: ${regRows.rows.length}):`, regRows.rows);

    const ticketState = await pool.query(
      `SELECT id, name, sold_count, reserved_count FROM ticket_types WHERE id = $1`,
      [ticketId]
    );
    console.log('ticket_types state:', ticketState.rows[0]);

    // Invariant assertions:
    const both200 = tap1.status === 200 && tap2.status === 200;
    const sameRegId = (tap1.data?.registrationId && tap2.data?.registrationId) && 
                      (String(tap1.data.registrationId) === String(tap2.data.registrationId));
    const exactlyOneRegInDb = regRows.rows.length === 1;
    const exactlyOneUseIncremented = dcState.rows[0]?.current_uses === 1;

    console.log('\n--- INVARIANT VERIFICATION ---');
    console.log(`1. Both responses returned HTTP 200: ${both200}`);
    console.log(`2. Both responses returned identical registrationId (${tap1.data?.registrationId} === ${tap2.data?.registrationId}): ${sameRegId}`);
    console.log(`3. DB event_registrations row count is strictly 1: ${exactlyOneRegInDb}`);
    console.log(`4. discount_codes current_uses is strictly 1: ${exactlyOneUseIncremented}`);

    if (both200 && sameRegId && exactlyOneRegInDb && exactlyOneUseIncremented) {
      console.log('\n✅ PART 2 PASSED: True concurrent double-tap idempotency verified! Exactly 1 registration row, 1 promo use, identical registrationId returned.');
    } else {
      console.error('\n❌ PART 2 FAILED');
    }

  } catch (err) {
    console.error('Error during follow-up verification:', err);
  } finally {
    await pool.end();
  }
}

runFollowupVerification();
