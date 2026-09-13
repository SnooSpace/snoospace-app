const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');

const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

async function apiRequest(member, method, path, body = null) {
  const token = generateAccessToken(member.id, 'member', member.email);
  const url = `${API_BASE}${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const opt = { method, headers };
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

async function runTest() {
  console.log('================================================================');
  console.log('ITEM 1.3 INVESTIGATION: max_uses_per_user ENFORCEMENT TEST');
  console.log('================================================================');

  try {
    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 1');
    const member = memRes.rows[0];
    const commRes = await pool.query('SELECT id FROM communities LIMIT 1');
    const communityId = commRes.rows[0].id;

    // Create fresh test event
    const now = new Date();
    const eventDate = new Date(now.getTime() + 10 * 24 * 3600 * 1000);
    const eventRes = await pool.query(
      `INSERT INTO events (
        title, description, event_date, start_datetime, end_datetime,
        event_type, location_name, status, community_id, creator_id
      ) VALUES ($1, 'Item 1 Investigation', $2, $3, $4, 'in-person', 'Investigation Hall', 'published', $5, $5)
      RETURNING id`,
      [
        'Item 1 Investigation Event ' + Date.now(),
        eventDate.toISOString().split('T')[0],
        eventDate.toISOString(),
        new Date(eventDate.getTime() + 3600000).toISOString(),
        communityId,
      ]
    );
    const eventId = eventRes.rows[0].id;

    // Create ticket (₹200)
    const ticketRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, sold_count, reserved_count,
        sale_start_at, sale_end_at, is_active
      ) VALUES ($1, 'General Pass', 200.00, 100, 0, 0, $2, $3, true)
      RETURNING id`,
      [eventId, new Date(now.getTime() - 3600000).toISOString(), new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString()]
    );
    const ticketId = ticketRes.rows[0].id;

    // Seed discount code with max_uses: 10, max_uses_per_user: 1
    const dcRes = await pool.query(
      `INSERT INTO discount_codes (
        event_id, code, code_normalized, discount_type, discount_value,
        max_uses, current_uses, max_uses_per_user, valid_from, valid_until,
        applies_to, selected_tickets, is_active
      ) VALUES ($1, 'LIMIT1USER', 'LIMIT1USER', 'percentage', 100.00, 10, 0, 1, $2, $3, 'all', '[]', true)
      RETURNING id, code, max_uses, max_uses_per_user, current_uses`,
      [eventId, new Date(now.getTime() - 3600000).toISOString(), new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString()]
    );
    console.log('Seeded Discount Code:', dcRes.rows[0]);

    const payload = {
      eventId,
      promoCode: 'LIMIT1USER',
      totalAmountRupees: 0,
      discountAmount: 200,
      tickets: [{ ticketTypeId: ticketId, quantity: 1 }],
    };

    // Attempt 1: First redemption by Member
    console.log('\n--- ATTEMPT 1: First redemption by Member #' + member.id + ' ---');
    console.log('REQUEST: POST /payments/create-order', JSON.stringify(payload, null, 2));
    const res1 = await apiRequest(member, 'POST', '/payments/create-order', payload);
    console.log('STATUS:', res1.status);
    console.log('RESPONSE:', JSON.stringify(res1.data, null, 2));

    // Check DB state after Attempt 1
    const regCheck1 = await pool.query(
      `SELECT id, member_id, promo_code, registration_status, total_amount FROM event_registrations WHERE event_id = $1`,
      [eventId]
    );
    const dcCheck1 = await pool.query(
      `SELECT id, code, max_uses, max_uses_per_user, current_uses FROM discount_codes WHERE id = $1`,
      [dcRes.rows[0].id]
    );
    console.log('\nDB State after Attempt 1:');
    console.log('discount_codes:', dcCheck1.rows[0]);
    console.log('event_registrations:', regCheck1.rows);

    // Attempt 2: Second redemption by SAME Member in sequential request
    console.log('\n--- ATTEMPT 2: Second redemption by SAME Member #' + member.id + ' ---');
    console.log('REQUEST: POST /payments/create-order', JSON.stringify(payload, null, 2));
    const res2 = await apiRequest(member, 'POST', '/payments/create-order', payload);
    console.log('STATUS:', res2.status);
    console.log('RESPONSE:', JSON.stringify(res2.data, null, 2));

    // Attempt 3: Member cancels registration, then tries to use LIMIT1USER again
    console.log('\n--- ATTEMPT 3: Member cancels registration, then attempts to reuse LIMIT1USER ---');
    const cancelRes = await apiRequest(member, 'POST', `/events/${eventId}/cancel-registration`, {});
    console.log('Cancel Registration Status:', cancelRes.status, cancelRes.data);

    const res3 = await apiRequest(member, 'POST', '/payments/create-order', payload);
    console.log('STATUS:', res3.status);
    console.log('RESPONSE:', JSON.stringify(res3.data, null, 2));

    const regCheck3 = await pool.query(
      `SELECT id, member_id, promo_code, registration_status, total_amount FROM event_registrations WHERE event_id = $1 ORDER BY id ASC`,
      [eventId]
    );
    const dcCheck3 = await pool.query(
      `SELECT id, code, max_uses, max_uses_per_user, current_uses FROM discount_codes WHERE id = $1`,
      [dcRes.rows[0].id]
    );
    console.log('\nDB State after Attempt 3:');
    console.log('discount_codes:', dcCheck3.rows[0]);
    console.log('event_registrations:', regCheck3.rows);

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await pool.end();
  }
}

runTest();
