require('dotenv').config();
const { createPool } = require('../config/db');
const eventController = require('../controllers/eventController');

const pool = createPool();

async function runDefect7Tests() {
  console.log('================================================================');
  console.log('VERIFICATION SUITE: DEFECT 7');
  console.log('================================================================');

  let testCommunityId = '75';
  let testMemberId = '206';
  let testEventId = null;

  try {
    // Check accounts
    const commCheck = await pool.query('SELECT id FROM communities WHERE id = $1', [testCommunityId]);
    if (commCheck.rows.length === 0) {
      const anyComm = await pool.query('SELECT id FROM communities LIMIT 1');
      testCommunityId = anyComm.rows[0].id;
    }
    const memCheck = await pool.query('SELECT id FROM members WHERE id = $1', [testMemberId]);
    if (memCheck.rows.length === 0) {
      const anyMem = await pool.query('SELECT id FROM members LIMIT 1');
      testMemberId = anyMem.rows[0].id;
    }

    console.log(`[Setup] Using Community #${testCommunityId}, Member #${testMemberId}`);

    // =========================================================================
    // TEST D7a: Same-day evening event cancellation date math
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D7a: Same-day evening event cancellation date math');
    console.log('----------------------------------------------------------------');

    // Create event with event_date at midnight today, and start_datetime at 8:00 PM today (20:00)
    // Current time is ~02:30 AM.
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const today8PM = new Date();
    today8PM.setHours(20, 0, 0, 0);
    // If 8 PM is already past today, add 1 day so it is well in the future for testing
    if (today8PM.getTime() - Date.now() < 3 * 3600 * 1000) {
      today8PM.setDate(today8PM.getDate() + 1);
    }

    const eventRes = await pool.query(
      `INSERT INTO events (
        community_id, title, description, event_date, start_datetime, end_datetime, is_published, access_type
      ) VALUES ($1, 'D7a Same-Day Evening Event', 'Testing cancel date math', $2, $3, $4, true, 'public')
      RETURNING id, event_date, start_datetime`,
      [testCommunityId, todayMidnight.toISOString(), today8PM.toISOString(), new Date(today8PM.getTime() + 3600000).toISOString()]
    );
    testEventId = eventRes.rows[0].id;
    console.log(`Created Event #${testEventId}:`, {
      event_date_midnight: eventRes.rows[0].event_date,
      start_datetime: eventRes.rows[0].start_datetime
    });

    // Create a ticket tier with deadline_hours_before: 4 (4 hours before start time)
    const ticketRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, refund_policy, is_active
      ) VALUES ($1, 'Evening Tier', 500, 20, $2, true) RETURNING id`,
      [testEventId, JSON.stringify({ allowed: true, deadline_hours_before: 4, percentage: 100 })]
    );
    const ticketId = ticketRes.rows[0].id;

    // Create a registration for testMemberId
    const regRes = await pool.query(
      `INSERT INTO event_registrations (
        event_id, member_id, registration_status, total_amount, qr_code_hash, created_at
      ) VALUES ($1, $2, 'registered', 500, 'hash_d7a', NOW()) RETURNING id`,
      [testEventId, testMemberId]
    );
    const regId = regRes.rows[0].id;

    await pool.query(
      `INSERT INTO registration_tickets (
        registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
      ) VALUES ($1, $2, 'Evening Tier', 1, 500, 500)`,
      [regId, ticketId]
    );

    // Call cancelRegistration
    let d7aRes = null;
    let d7aStatus = null;
    await eventController.cancelRegistration(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId }
      },
      {
        status: (code) => ({ json: (d) => { d7aStatus = code; d7aRes = d; } }),
        json: (d) => { d7aStatus = 200; d7aRes = d; }
      }
    );

    console.log('D7a cancelRegistration response:', { status: d7aStatus, body: d7aRes });

    // Verify DB registration row
    const regCheck = await pool.query(
      `SELECT registration_status, refund_amount, cancelled_at FROM event_registrations WHERE id = $1`,
      [regId]
    );
    console.log('DB Registration row after cancellation:', regCheck.rows[0]);

    const d7aFails = [];
    if (d7aStatus !== 200 || !d7aRes?.success) d7aFails.push(`Cancellation failed: ${d7aRes?.error}`);
    if (parseFloat(d7aRes?.refundAmount) !== 500) {
      d7aFails.push(`Refund amount was not ₹500 (midnight bug may still be present): got ${d7aRes?.refundAmount}`);
    }
    if (regCheck.rows[0]?.registration_status !== 'cancelled') {
      d7aFails.push(`Status is not 'cancelled': ${regCheck.rows[0]?.registration_status}`);
    }

    if (d7aFails.length === 0) {
      console.log('>>> [PASS] TEST D7a: Same-day evening event evaluated against start_datetime; 100% refund processed.');
    } else {
      console.error('>>> [FAIL] TEST D7a:', d7aFails);
    }

    // Clean D7a registration so testMemberId can register for D7b
    await pool.query(`DELETE FROM registration_tickets WHERE registration_id = $1`, [regId]);
    await pool.query(`DELETE FROM event_registrations WHERE id = $1`, [regId]);

    // =========================================================================
    // TEST D7b: Cancellation when ticket tier was deleted by organizer
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D7b: Cancellation with deleted ticket tier (LEFT JOIN test)');
    console.log('----------------------------------------------------------------');

    // Ensure event start is 3 days in the future for D7b so it satisfies the 24h fallback policy
    await pool.query(
      `UPDATE events SET start_datetime = NOW() + INTERVAL '3 days', end_datetime = NOW() + INTERVAL '3 days 4 hours' WHERE id = $1`,
      [testEventId]
    );

    // Create another ticket tier
    const ticketBRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, base_price, total_quantity, refund_policy, is_active
      ) VALUES ($1, 'Ephemeral Tier', 300, 20, $2, true) RETURNING id`,
      [testEventId, JSON.stringify({ allowed: true, deadline_hours_before: 2, percentage: 100 })]
    );
    const ticketBId = ticketBRes.rows[0].id;

    // Register user for Ephemeral Tier
    const regBRes = await pool.query(
      `INSERT INTO event_registrations (
        event_id, member_id, registration_status, total_amount, qr_code_hash, created_at
      ) VALUES ($1, $2, 'registered', 300, 'hash_d7b', NOW()) RETURNING id`,
      [testEventId, testMemberId]
    );
    const regBId = regBRes.rows[0].id;

    await pool.query(
      `INSERT INTO registration_tickets (
        registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
      ) VALUES ($1, $2, 'Ephemeral Tier', 1, 300, 300)`,
      [regBId, ticketBId]
    );

    // Simulate organizer deleting the ticket tier
    console.log(`Simulating deletion of ticket tier #${ticketBId}...`);
    // Nullify or delete ticket type (if foreign key allows delete, or delete row)
    // Check if ticket_types can be deleted:
    try {
      await pool.query('DELETE FROM ticket_types WHERE id = $1', [ticketBId]);
      console.log(`Ticket tier #${ticketBId} successfully deleted from ticket_types.`);
    } catch (e) {
      console.log(`Direct delete blocked by FK, updating registration_tickets.ticket_type_id to non-existent ID 999999`);
      await pool.query('UPDATE registration_tickets SET ticket_type_id = 999999 WHERE registration_id = $1', [regBId]);
    }

    // Call cancelRegistration
    let d7bRes = null;
    let d7bStatus = null;
    await eventController.cancelRegistration(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId }
      },
      {
        status: (code) => ({ json: (d) => { d7bStatus = code; d7bRes = d; } }),
        json: (d) => { d7bStatus = 200; d7bRes = d; }
      }
    );

    console.log('D7b cancelRegistration response:', { status: d7bStatus, body: d7bRes });

    // Verify DB registration row
    const regBCheck = await pool.query(
      `SELECT registration_status, refund_amount, cancelled_at FROM event_registrations WHERE id = $1`,
      [regBId]
    );
    console.log('DB Registration row after cancellation with missing tier:', regBCheck.rows[0]);

    const d7bFails = [];
    if (d7bStatus !== 200 || !d7bRes?.success) d7bFails.push(`Cancellation failed: ${d7bRes?.error}`);
    if (parseFloat(d7bRes?.refundAmount) !== 300) {
      d7bFails.push(`Refund amount was not ₹300: got ${d7bRes?.refundAmount}`);
    }
    if (regBCheck.rows[0]?.registration_status !== 'cancelled') {
      d7bFails.push(`Status is not 'cancelled': ${regBCheck.rows[0]?.registration_status}`);
    }

    if (d7bFails.length === 0) {
      console.log('>>> [PASS] TEST D7b: Cancellation succeeded cleanly despite deleted/missing ticket tier (LEFT JOIN + fallback policy).');
    } else {
      console.error('>>> [FAIL] TEST D7b:', d7bFails);
    }

  } catch (err) {
    console.error('Fatal error running Defect 7 tests:', err);
  } finally {
    if (testEventId) {
      console.log('\n[Cleanup] Cleaning test event fixtures...');
      await pool.query(`DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = $1)`, [testEventId]);
      await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [testEventId]);
      await pool.query(`DELETE FROM events WHERE id = $1`, [testEventId]);
      console.log('[Cleanup] Done.');
    }
    await pool.end();
  }
}

runDefect7Tests();
