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

async function runSuite() {
  console.log('\n================================================================');
  console.log('STARTING ADVERSARIAL PRICING & CONCURRENCY VERIFICATION SUITE (P1-P11)');
  console.log('Target Server:', API_BASE);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  let testEventId = null;
  let ticketPaidId = null;
  let ticketCap1Id = null;
  let testMembers = [];

  try {
    // 1. Fetch Community
    const commRes = await pool.query('SELECT id FROM communities LIMIT 1');
    const communityId = commRes.rows[0].id;

    // 2. Fetch 8 distinct test members
    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 10');
    testMembers = memRes.rows;
    if (testMembers.length < 8) {
      throw new Error(`Need at least 8 members for testing, found ${testMembers.length}`);
    }

    console.log(`Using Community #${communityId}`);
    console.log(`Loaded ${testMembers.length} test members:`, testMembers.map(m => `#${m.id} (${m.email})`).join(', '));

    // 3. Create fresh test event
    const now = new Date();
    const eventDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const eventRes = await pool.query(
      `INSERT INTO events (
        title, description, event_date, start_datetime, end_datetime,
        event_type, location_name, status, community_id, creator_id
      ) VALUES ($1, $2, $3, $4, $5, 'in-person', 'Verification Arena', 'published', $6, $6)
      RETURNING id, title`,
      [
        'Pricing & Concurrency Verification Event ' + Date.now(),
        'Automated adversarial test suite verification event',
        eventDate.toISOString().split('T')[0],
        eventDate.toISOString(),
        new Date(eventDate.getTime() + 4 * 3600 * 1000).toISOString(),
        communityId,
      ]
    );
    testEventId = eventRes.rows[0].id;
    console.log(`Created Test Event #${testEventId} - "${eventRes.rows[0].title}"`);

    // 4. Create Ticket Types:
    // ticketPaid: base_price = 200, total_quantity = 500
    const ticketPaidRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, sold_count, reserved_count,
        sale_start_at, sale_end_at, is_active
      ) VALUES ($1, 'Paid Standard Pass', 200.00, 500, 0, 0, $2, $3, true)
      RETURNING id`,
      [testEventId, new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString()]
    );
    ticketPaidId = ticketPaidRes.rows[0].id;

    // ticketCap1: base_price = 0, total_quantity = 1 (for capacity concurrency test)
    const ticketCap1Res = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, sold_count, reserved_count,
        sale_start_at, sale_end_at, is_active
      ) VALUES ($1, 'Exclusive Last Spot', 0.00, 1, 0, 0, $2, $3, true)
      RETURNING id`,
      [testEventId, new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString()]
    );
    ticketCap1Id = ticketCap1Res.rows[0].id;

    console.log(`Created Tickets: Paid Pass #${ticketPaidId} (₹200), Last Spot #${ticketCap1Id} (₹0, qty: 1)`);

    // 5. Seed Discount Codes
    await pool.query(
      `INSERT INTO discount_codes (
        event_id, code, code_normalized, discount_type, discount_value, max_uses, current_uses,
        valid_from, valid_until, min_cart_value, applies_to, selected_tickets, is_active
      ) VALUES 
        ($1, 'PROMO100', 'PROMO100', 'percentage', 100.00, NULL, 0, $2, $3, NULL, 'all', '[]', true),
        ($1, 'EXPIRED_PROMO', 'EXPIRED_PROMO', 'percentage', 50.00, NULL, 0, $4, $5, NULL, 'all', '[]', true),
        ($1, 'SPECIFIC_PROMO', 'SPECIFIC_PROMO', 'percentage', 20.00, NULL, 0, $2, $3, NULL, 'specific', $6, true),
        ($1, 'MIN_ORDER_PROMO', 'MIN_ORDER_PROMO', 'fixed', 50.00, NULL, 0, $2, $3, 500.00, 'all', '[]', true),
        ($1, 'PERCENT_20', 'PERCENT_20', 'percentage', 20.00, NULL, 0, $2, $3, NULL, 'all', '[]', true),
        ($1, 'MULTI_2', 'MULTI_2', 'percentage', 100.00, 2, 0, $2, $3, NULL, 'all', '[]', true),
        ($1, 'RACE_1', 'RACE_1', 'percentage', 100.00, 1, 0, $2, $3, NULL, 'all', '[]', true)`,
      [
        testEventId,
        new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString(),
        new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
        new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(), // expired yesterday
        JSON.stringify([ticketCap1Id]),
      ]
    );
    console.log('Seeded discount codes: PROMO100, EXPIRED_PROMO, SPECIFIC_PROMO, MIN_ORDER_PROMO, PERCENT_20, MULTI_2, RACE_1');

    // Helper to send HTTP requests with JWT
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

    // =========================================================================
    // TEST P1: Client-Submitted Discount Tamper (₹199/₹200 ticket sent as ₹1)
    // =========================================================================
    {
      const mem = testMembers[0];
      const payload = {
        eventId: testEventId,
        totalAmountRupees: 1, // TAMPERED: Real price is 200
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P1: Client-Submitted Price Tamper', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 400 && res.data?.error === 'price_mismatch') {
        console.log('✅ TEST P1 PASSED: Correctly blocked price tampering with 400 price_mismatch');
      } else {
        console.error('❌ TEST P1 FAILED: Expected 400 price_mismatch');
      }
    }

    // =========================================================================
    // TEST P2: Direct Registration of Paid Ticket Without 100% Discount
    // =========================================================================
    {
      const mem = testMembers[0];
      const payload = {
        totalAmount: 0, // Direct free bypass attempt on ₹200 ticket
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', `/events/${testEventId}/register`, payload);
      await logHttp('P2: Direct Registration Bypass on Paid Ticket', 'POST', `/events/${testEventId}/register`, payload, res.status, res.data);
      if (res.status === 402 && res.data?.error === 'payment_required') {
        console.log('✅ TEST P2 PASSED: Direct paid bypass hard-blocked with 402 payment_required');
      } else {
        console.error('❌ TEST P2 FAILED: Expected 402 payment_required');
      }
    }

    // =========================================================================
    // TEST P3: Valid 100% Promo Code via create-order
    // =========================================================================
    let p3RegistrationId = null;
    {
      const mem = testMembers[0];
      const payload = {
        eventId: testEventId,
        promoCode: 'PROMO100',
        totalAmountRupees: 0,
        discountAmount: 200,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P3: Valid 100% Promo Code', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 200 && res.data?.success && res.data?.isFullyDiscounted && res.data?.registrationId) {
        p3RegistrationId = res.data.registrationId;
        console.log('✅ TEST P3 PASSED: 100% discount registered directly without Razorpay order. RegId:', p3RegistrationId);
      } else {
        console.error('❌ TEST P3 FAILED: Expected 200 with isFullyDiscounted: true');
      }
    }

    // =========================================================================
    // TEST P4: Replay Attack / Idempotency on 100% Discount Order
    // =========================================================================
    {
      const mem = testMembers[0];
      const payload = {
        eventId: testEventId,
        promoCode: 'PROMO100',
        totalAmountRupees: 0,
        discountAmount: 200,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P4: Replay / Idempotent Retry on 100% Discount', 'POST', '/payments/create-order', payload, res.status, res.data);
      
      const dbCheck = await pool.query(
        `SELECT id, registration_status, total_amount FROM event_registrations 
         WHERE event_id = $1 AND member_id = $2 AND registration_status != 'cancelled'`,
        [testEventId, mem.id]
      );
      console.log(`DB Count Check for Member #${mem.id}: Found ${dbCheck.rows.length} registration(s):`, dbCheck.rows);

      if (res.status === 200 && res.data?.replayed === true && dbCheck.rows.length === 1) {
        console.log('✅ TEST P4 PASSED: Replay attack handled idempotently. Zero duplicate rows created.');
      } else {
        console.error('❌ TEST P4 FAILED: Expected 200 replayed: true with exactly 1 DB row.');
      }
    }

    // =========================================================================
    // TEST P5: Expired Promo Code Rejection
    // =========================================================================
    {
      const mem = testMembers[1];
      const payload = {
        eventId: testEventId,
        promoCode: 'EXPIRED_PROMO',
        totalAmountRupees: 100,
        discountAmount: 100,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P5: Expired Promo Code Rejection', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 400 && res.data?.error === 'promo_expired') {
        console.log('✅ TEST P5 PASSED: Expired promo code rejected with 400 promo_expired');
      } else {
        console.error('❌ TEST P5 FAILED: Expected 400 promo_expired');
      }
    }

    // =========================================================================
    // TEST P6: Promo Code Ticket-Type Mismatch
    // =========================================================================
    {
      const mem = testMembers[1];
      const payload = {
        eventId: testEventId,
        promoCode: 'SPECIFIC_PROMO', // Only valid for ticketCap1
        totalAmountRupees: 160,
        discountAmount: 40,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P6: Promo Code Ticket-Type Mismatch', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 400 && res.data?.error === 'promo_not_applicable') {
        console.log('✅ TEST P6 PASSED: Ineligible ticket promo rejected with 400 promo_not_applicable');
      } else {
        console.error('❌ TEST P6 FAILED: Expected 400 promo_not_applicable');
      }
    }

    // =========================================================================
    // TEST P7: Promo Code min_order_amount Violation
    // =========================================================================
    {
      const mem = testMembers[1];
      const payload = {
        eventId: testEventId,
        promoCode: 'MIN_ORDER_PROMO', // Requires ₹500, order is ₹200
        totalAmountRupees: 150,
        discountAmount: 50,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P7: Min Order Amount Violation', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 400 && res.data?.error === 'promo_min_order_unmet') {
        console.log('✅ TEST P7 PASSED: Min order violation rejected with 400 promo_min_order_unmet');
      } else {
        console.error('❌ TEST P7 FAILED: Expected 400 promo_min_order_unmet');
      }
    }

    // =========================================================================
    // TEST P8: Percentage Discount Calculation Accuracy
    // =========================================================================
    {
      const mem = testMembers[1];
      const payload = {
        eventId: testEventId,
        promoCode: 'PERCENT_20', // ₹200 - 20% = ₹160
        totalAmountRupees: 160,
        discountAmount: 40,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };
      const res = await apiRequest(mem, 'POST', '/payments/create-order', payload);
      await logHttp('P8: Percentage Discount Calculation Accuracy', 'POST', '/payments/create-order', payload, res.status, res.data);
      if (res.status === 200 && res.data?.success && res.data?.orderId && res.data?.amount === 16000) {
        console.log('✅ TEST P8 PASSED: Exact calculation verified. Razorpay order created for 16000 paise (₹160.00)');
      } else {
        console.error('❌ TEST P8 FAILED: Expected 200 with amount: 16000');
      }
    }

    // =========================================================================
    // TEST P9: Multi-Use Promo Code With max_uses Enforcement (max_uses = 2)
    // =========================================================================
    {
      console.log('\n================================================================');
      console.log('TEST P9: Multi-Use Promo Code With max_uses Enforcement (MULTI_2, max_uses = 2)');
      console.log('----------------------------------------------------------------');

      const memB = testMembers[1];
      const memC = testMembers[2];
      const memD = testMembers[3];

      const payload = {
        eventId: testEventId,
        promoCode: 'MULTI_2',
        totalAmountRupees: 0,
        discountAmount: 200,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };

      // 1st redemption (User B)
      const res1 = await apiRequest(memB, 'POST', '/payments/create-order', payload);
      await logHttp('P9.1: First Redemption (User B)', 'POST', '/payments/create-order', payload, res1.status, res1.data);

      // 2nd redemption (User C)
      const res2 = await apiRequest(memC, 'POST', '/payments/create-order', payload);
      await logHttp('P9.2: Second Redemption (User C)', 'POST', '/payments/create-order', payload, res2.status, res2.data);

      // 3rd redemption attempt (User D) — Must fail
      const res3 = await apiRequest(memD, 'POST', '/payments/create-order', payload);
      await logHttp('P9.3: Third Redemption (User D) - Should be Blocked', 'POST', '/payments/create-order', payload, res3.status, res3.data);

      // DB STATE CHECKS FOR P9
      console.log('\n--- LIVE DB STATE CHECKS FOR P9 ---');
      const dcP9 = await pool.query(
        `SELECT id, code, max_uses, current_uses, is_active FROM discount_codes WHERE event_id = $1 AND code_normalized = 'MULTI_2'`,
        [testEventId]
      );
      console.log('P9 discount_codes row:', dcP9.rows[0]);

      const regP9 = await pool.query(
        `SELECT id, member_id, promo_code, total_amount, registration_status, created_at 
         FROM event_registrations 
         WHERE event_id = $1 AND UPPER(TRIM(promo_code)) = 'MULTI_2' AND registration_status != 'cancelled'
         ORDER BY id ASC`,
        [testEventId]
      );
      console.log(`P9 event_registrations rows (count: ${regP9.rows.length}):`, regP9.rows);

      const ticketP9 = await pool.query(
        `SELECT id, name, sold_count, reserved_count, total_quantity FROM ticket_types WHERE id = $1`,
        [ticketPaidId]
      );
      console.log('P9 ticket_types state:', ticketP9.rows[0]);

      if (res1.status === 200 && res2.status === 200 && res3.status === 400 && res3.data?.error === 'promo_limit_reached' && dcP9.rows[0]?.current_uses === 2 && regP9.rows.length === 2) {
        console.log('✅ TEST P9 PASSED: Multi-use code enforced limit at exactly 2 redemptions.');
      } else {
        console.error('❌ TEST P9 FAILED');
      }
    }

    // =========================================================================
    // TEST P10: Concurrent Race on max_uses: 1 Promo Code
    // =========================================================================
    {
      console.log('\n================================================================');
      console.log('TEST P10: Concurrent Race on max_uses: 1 Promo Code (RACE_1)');
      console.log('----------------------------------------------------------------');

      const memE = testMembers[4];
      const memF = testMembers[5];

      const payload = {
        eventId: testEventId,
        promoCode: 'RACE_1',
        totalAmountRupees: 0,
        discountAmount: 200,
        tickets: [{ ticketTypeId: ticketPaidId, quantity: 1 }],
      };

      console.log(`Firing 2 simultaneous HTTP requests for Member #${memE.id} and Member #${memF.id} via Promise.all...`);
      const t0 = Date.now();

      const [resE, resF] = await Promise.all([
        (async () => {
          const start = Date.now();
          const r = await apiRequest(memE, 'POST', '/payments/create-order', payload);
          const dur = Date.now() - start;
          return { member: `Member #${memE.id}`, start: start - t0, duration: dur, ...r };
        })(),
        (async () => {
          const start = Date.now();
          const r = await apiRequest(memF, 'POST', '/payments/create-order', payload);
          const dur = Date.now() - start;
          return { member: `Member #${memF.id}`, start: start - t0, duration: dur, ...r };
        })(),
      ]);

      console.log('\n[CONCURRENT EXECUTION TIMING / ORDERING]');
      console.log(`${resE.member}: offset ${resE.start}ms, took ${resE.duration}ms -> HTTP ${resE.status}`, resE.data);
      console.log(`${resF.member}: offset ${resF.start}ms, took ${resF.duration}ms -> HTTP ${resF.status}`, resF.data);

      // DB STATE CHECKS FOR P10
      console.log('\n--- LIVE DB STATE CHECKS FOR P10 ---');
      const dcP10 = await pool.query(
        `SELECT id, code, max_uses, current_uses FROM discount_codes WHERE event_id = $1 AND code_normalized = 'RACE_1'`,
        [testEventId]
      );
      console.log('P10 discount_codes row:', dcP10.rows[0]);

      const regP10 = await pool.query(
        `SELECT id, member_id, promo_code, registration_status, created_at 
         FROM event_registrations 
         WHERE event_id = $1 AND UPPER(TRIM(promo_code)) = 'RACE_1' AND registration_status != 'cancelled'`,
        [testEventId]
      );
      console.log(`P10 event_registrations rows (count: ${regP10.rows.length}):`, regP10.rows);

      const ticketP10 = await pool.query(
        `SELECT id, name, sold_count, reserved_count FROM ticket_types WHERE id = $1`,
        [ticketPaidId]
      );
      console.log('P10 ticket_types state:', ticketP10.rows[0]);

      const oneSucceeded = (resE.status === 200 && resF.status === 400) || (resF.status === 200 && resE.status === 400);
      const limitReached = (resE.data?.error === 'promo_limit_reached') || (resF.data?.error === 'promo_limit_reached');

      if (oneSucceeded && limitReached && dcP10.rows[0]?.current_uses === 1 && regP10.rows.length === 1) {
        console.log('✅ TEST P10 PASSED: Atomic row lock prevented duplicate redemption under real concurrent HTTP calls!');
      } else {
        console.error('❌ TEST P10 FAILED');
      }
    }

    // =========================================================================
    // TEST P11: Concurrent Race on Last Ticket With Capacity Hold
    // =========================================================================
    {
      console.log('\n================================================================');
      console.log('TEST P11: Concurrent Race on Last Ticket Capacity (ticketCap1, total_quantity = 1)');
      console.log('----------------------------------------------------------------');

      const memG = testMembers[6];
      const memH = testMembers[7];

      const payload = {
        totalAmount: 0,
        tickets: [{ ticketTypeId: ticketCap1Id, quantity: 1 }],
      };

      console.log(`Firing 2 simultaneous HTTP registration requests for Member #${memG.id} and Member #${memH.id} via Promise.all...`);
      const t0 = Date.now();

      const [resG, resH] = await Promise.all([
        (async () => {
          const start = Date.now();
          const r = await apiRequest(memG, 'POST', `/events/${testEventId}/register`, payload);
          const dur = Date.now() - start;
          return { member: `Member #${memG.id}`, start: start - t0, duration: dur, ...r };
        })(),
        (async () => {
          const start = Date.now();
          const r = await apiRequest(memH, 'POST', `/events/${testEventId}/register`, payload);
          const dur = Date.now() - start;
          return { member: `Member #${memH.id}`, start: start - t0, duration: dur, ...r };
        })(),
      ]);

      console.log('\n[CONCURRENT EXECUTION TIMING / ORDERING]');
      console.log(`${resG.member}: offset ${resG.start}ms, took ${resG.duration}ms -> HTTP ${resG.status}`, resG.data);
      console.log(`${resH.member}: offset ${resH.start}ms, took ${resH.duration}ms -> HTTP ${resH.status}`, resH.data);

      // DB STATE CHECKS FOR P11
      console.log('\n--- LIVE DB STATE CHECKS FOR P11 ---');
      const ticketP11 = await pool.query(
        `SELECT id, name, total_quantity, sold_count, reserved_count FROM ticket_types WHERE id = $1`,
        [ticketCap1Id]
      );
      console.log('P11 ticket_types row:', ticketP11.rows[0]);

      const regP11 = await pool.query(
        `SELECT er.id, er.member_id, er.registration_status, rt.ticket_type_id, rt.quantity 
         FROM event_registrations er
         JOIN registration_tickets rt ON er.id = rt.registration_id
         WHERE er.event_id = $1 AND rt.ticket_type_id = $2 AND er.registration_status != 'cancelled'`,
        [testEventId, ticketCap1Id]
      );
      console.log(`P11 event_registrations rows for ticketCap1 (count: ${regP11.rows.length}):`, regP11.rows);

      const oneSucceeded = (resG.status === 200 && resH.status === 400) || (resH.status === 200 && resG.status === 400);
      const soldOutMessage = (resG.data?.error?.includes('Sold out')) || (resH.data?.error?.includes('Sold out'));

      if (oneSucceeded && soldOutMessage && ticketP11.rows[0]?.sold_count === 1 && regP11.rows.length === 1) {
        console.log('✅ TEST P11 PASSED: Ticket capacity race serialized correctly. Exactly 1 winner, 1 blocked with Sold Out!');
      } else {
        console.error('❌ TEST P11 FAILED');
      }
    }

    console.log('\n================================================================');
    console.log('ALL ADVERSARIAL SUITE TESTS (P1-P11) COMPLETED');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Unexpected error running suite:', err);
  } finally {
    await pool.end();
  }
}

runSuite();
