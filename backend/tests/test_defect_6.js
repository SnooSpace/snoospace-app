require('dotenv').config();
const { createPool } = require('../config/db');
const eventController = require('../controllers/eventController');

const pool = createPool();

async function runDefect6Verification() {
  console.log('================================================================');
  console.log('VERIFICATION SUITE: DEFECT 6');
  console.log('================================================================');

  let testCommunityId = '75';
  let testMemberId = '206';
  const createdTestEvents = [];
  let orig44Dates = null;

  try {
    // Check community and member
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

    // =========================================================================
    // TEST D6-migration: Re-query DB for zero ticket_types events & spot check
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D6-migration: Database Zero-Ticket Count & Spot Checks');
    console.log('----------------------------------------------------------------');

    const countRes = await pool.query(`
      SELECT COUNT(*) as zero_ticket_events
      FROM events e
      LEFT JOIN ticket_types tt ON e.id = tt.event_id
      GROUP BY e.id
      HAVING COUNT(tt.id) = 0
    `);
    const zeroTicketCount = countRes.rows.length;
    console.log(`Current events with zero ticket types: ${zeroTicketCount}`);

    // Spot-check events: 44 (₹0), 47 (₹799), 48 (₹2999), 9920 (cancelled)
    const spotCheckIds = [44, 47, 48, 9920];
    const spotCheckRes = await pool.query(`
      SELECT e.id as event_id, e.title, tt.id as ticket_type_id, tt.name, tt.base_price, tt.total_quantity, tt.is_active, tt.visibility
      FROM events e
      JOIN ticket_types tt ON e.id = tt.event_id
      WHERE e.id = ANY($1)
      ORDER BY e.id ASC
    `, [spotCheckIds]);

    console.log('Spot-checked backfilled rows:');
    console.table(spotCheckRes.rows);

    const d6MigrationFails = [];
    if (zeroTicketCount !== 0) d6MigrationFails.push(`Expected 0 events with zero tickets, found ${zeroTicketCount}`);
    
    const ev44 = spotCheckRes.rows.find(r => r.event_id === '44');
    const ev47 = spotCheckRes.rows.find(r => r.event_id === '47');
    const ev48 = spotCheckRes.rows.find(r => r.event_id === '48');
    const ev9920 = spotCheckRes.rows.find(r => r.event_id === '9920');

    if (!ev44 || parseFloat(ev44.base_price) !== 0 || !ev44.is_active) d6MigrationFails.push(`Event 44 mismatch: ${JSON.stringify(ev44)}`);
    if (!ev47 || parseFloat(ev47.base_price) !== 799 || !ev47.is_active) d6MigrationFails.push(`Event 47 mismatch: ${JSON.stringify(ev47)}`);
    if (!ev48 || parseFloat(ev48.base_price) !== 2999 || !ev48.is_active) d6MigrationFails.push(`Event 48 mismatch: ${JSON.stringify(ev48)}`);
    if (!ev9920 || ev9920.is_active !== false) d6MigrationFails.push(`Event 9920 cancelled mismatch: ${JSON.stringify(ev9920)}`);

    if (d6MigrationFails.length === 0) {
      console.log('>>> [PASS] TEST D6-migration: 0 ticketless events remaining. Spot checks for 44 (₹0), 47 (₹799), 48 (₹2999), and 9920 (inactive) matched reviewed proposal perfectly.');
    } else {
      console.error('>>> [FAIL] TEST D6-migration:', d6MigrationFails);
    }

    // =========================================================================
    // TEST D6-createEvent: Forward-looking default-tier logic
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D6-createEvent: Forward-looking default-tier creation in createEvent');
    console.log('----------------------------------------------------------------');

    // Case 1: Paid event with ticket_price=599, max_attendees=40, NO ticket_types array
    console.log('\nCase 1: Creating event with ticket_price: 599, max_attendees: 40, no ticket_types array...');
    let createRes1 = null;
    let createStatus1 = null;
    await eventController.createEvent(
      {
        app: { locals: { pool } },
        user: { id: testCommunityId, type: 'community' },
        body: {
          title: 'D6 Paid Forward Event Test',
          description: 'Testing forward-looking default tier creation for paid event',
          event_date: new Date(Date.now() + 86400000).toISOString(),
          start_datetime: new Date(Date.now() + 86400000).toISOString(),
          end_datetime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          ticket_price: 599,
          max_attendees: 40,
          location_url: 'https://maps.google.com/?q=Test',
          access_type: 'public'
          // ticket_types omitted!
        }
      },
      {
        status: (code) => ({ json: (d) => { createStatus1 = code; createRes1 = d; } }),
        json: (d) => { createStatus1 = 200; createRes1 = d; }
      }
    );

    const event1Id = createRes1?.event?.id;
    if (event1Id) createdTestEvents.push(event1Id);
    console.log(`Created Event #1 ID: ${event1Id}, Status: ${createStatus1}`);

    const tt1Check = await pool.query(
      `SELECT id, name, base_price, total_quantity, is_active FROM ticket_types WHERE event_id = $1`,
      [event1Id]
    );
    console.log('Auto-created ticket tier for Case 1:', tt1Check.rows);

    // Case 2: Free event with ticket_price omitted, max_attendees omitted, NO ticket_types
    console.log('\nCase 2: Creating event with ticket_types omitted & ticket_price omitted...');
    let createRes2 = null;
    let createStatus2 = null;
    await eventController.createEvent(
      {
        app: { locals: { pool } },
        user: { id: testCommunityId, type: 'community' },
        body: {
          title: 'D6 Free Forward Event Test',
          description: 'Testing forward-looking default tier creation for free event',
          event_date: new Date(Date.now() + 86400000).toISOString(),
          start_datetime: new Date(Date.now() + 86400000).toISOString(),
          end_datetime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          location_url: 'https://maps.google.com/?q=Test',
          access_type: 'public'
          // ticket_types AND ticket_price omitted!
        }
      },
      {
        status: (code) => ({ json: (d) => { createStatus2 = code; createRes2 = d; } }),
        json: (d) => { createStatus2 = 200; createRes2 = d; }
      }
    );

    const event2Id = createRes2?.event?.id;
    if (event2Id) createdTestEvents.push(event2Id);
    console.log(`Created Event #2 ID: ${event2Id}, Status: ${createStatus2}`);

    const tt2Check = await pool.query(
      `SELECT id, name, base_price, total_quantity, is_active FROM ticket_types WHERE event_id = $1`,
      [event2Id]
    );
    console.log('Auto-created ticket tier for Case 2:', tt2Check.rows);

    const d6CreateFails = [];
    if (createStatus1 !== 201 || tt1Check.rows.length !== 1) d6CreateFails.push(`Case 1 failed or tier not created`);
    if (parseFloat(tt1Check.rows[0]?.base_price) !== 599) d6CreateFails.push(`Case 1 base_price expected 599, got ${tt1Check.rows[0]?.base_price}`);
    if (tt1Check.rows[0]?.total_quantity !== 40) d6CreateFails.push(`Case 1 total_quantity expected 40, got ${tt1Check.rows[0]?.total_quantity}`);

    if (createStatus2 !== 201 || tt2Check.rows.length !== 1) d6CreateFails.push(`Case 2 failed or tier not created`);
    if (parseFloat(tt2Check.rows[0]?.base_price) !== 0) d6CreateFails.push(`Case 2 base_price expected 0, got ${tt2Check.rows[0]?.base_price}`);
    if (tt2Check.rows[0]?.total_quantity !== null) d6CreateFails.push(`Case 2 total_quantity expected null, got ${tt2Check.rows[0]?.total_quantity}`);

    if (d6CreateFails.length === 0) {
      console.log('>>> [PASS] TEST D6-createEvent: Default tiers cleanly auto-created for both paid (599, qty=40) and free (0, qty=null).');
    } else {
      console.error('>>> [FAIL] TEST D6-createEvent:', d6CreateFails);
    }

    // =========================================================================
    // TEST D6-regression: Normal multi-tier event creation & update
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D6-regression: Multi-tier event does not get extra default tier');
    console.log('----------------------------------------------------------------');

    let createRes3 = null;
    let createStatus3 = null;
    await eventController.createEvent(
      {
        app: { locals: { pool } },
        user: { id: testCommunityId, type: 'community' },
        body: {
          title: 'D6 Multi-Tier Regression Test',
          description: 'Testing that multi-tier events do NOT receive an unwanted default tier',
          event_date: new Date(Date.now() + 86400000).toISOString(),
          start_datetime: new Date(Date.now() + 86400000).toISOString(),
          end_datetime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          location_url: 'https://maps.google.com/?q=Test',
          access_type: 'public',
          ticket_types: [
            { name: 'Silver Tier', base_price: 200, total_quantity: 50 },
            { name: 'Gold VIP Tier', base_price: 800, total_quantity: 20 }
          ]
        }
      },
      {
        status: (code) => ({ json: (d) => { createStatus3 = code; createRes3 = d; } }),
        json: (d) => { createStatus3 = 200; createRes3 = d; }
      }
    );

    const event3Id = createRes3?.event?.id;
    if (event3Id) createdTestEvents.push(event3Id);
    console.log(`Created Multi-Tier Event ID: ${event3Id}, Status: ${createStatus3}`);

    const tt3Check = await pool.query(
      `SELECT id, name, base_price, total_quantity FROM ticket_types WHERE event_id = $1 ORDER BY base_price ASC`,
      [event3Id]
    );
    console.log('Tiers found in DB for Multi-Tier event:', tt3Check.rows);

    const d6RegressFails = [];
    if (tt3Check.rows.length !== 2) {
      d6RegressFails.push(`Expected exactly 2 tiers, got ${tt3Check.rows.length}`);
    }
    if (tt3Check.rows.some(t => t.name === 'General Admission')) {
      d6RegressFails.push('Unwanted "General Admission" tier was added alongside explicit tiers!');
    }

    if (d6RegressFails.length === 0) {
      console.log('>>> [PASS] TEST D6-regression: Multi-tier event created only its 2 explicit tiers (Silver & Gold VIP), no unwanted default tier.');
    } else {
      console.error('>>> [FAIL] TEST D6-regression:', d6RegressFails);
    }

    // =========================================================================
    // TEST D6-frontend: End-to-end registration on backfilled Event #44
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D6-frontend: End-to-end registration on backfilled Event #44');
    console.log('----------------------------------------------------------------');

    // Save original Event 44 dates and set to future (7 days ahead) for registration test
    orig44Dates = await pool.query(
      `SELECT start_datetime, end_datetime, event_date FROM events WHERE id = 44`
    );
    await pool.query(
      `UPDATE events SET start_datetime = NOW() + INTERVAL '7 days', end_datetime = NOW() + INTERVAL '7 days 4 hours', event_date = NOW() + INTERVAL '7 days' WHERE id = 44`
    );

    // Fetch Event 44 via getEventById to simulate what frontend receives
    let get44Res = null;
    await eventController.getEventById(
      { params: { eventId: 44 }, user: { id: testMemberId, type: 'member' } },
      { json: (d) => { get44Res = d; } }
    );
    const event44Ticket = get44Res?.event?.ticket_types?.[0];
    console.log('Event 44 ticket types available for booking:', {
      ticket_types_count: get44Res?.event?.ticket_types?.length,
      tier_name: event44Ticket?.name,
      base_price: event44Ticket?.base_price,
      ticket_type_id: event44Ticket?.id
    });

    // Remove any previous registration for testMemberId on Event 44 if exists
    await pool.query(
      `DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = 44 AND member_id = $1)`,
      [testMemberId]
    );
    await pool.query(
      `DELETE FROM event_registrations WHERE event_id = 44 AND member_id = $1`,
      [testMemberId]
    );

    // Call registerForEvent with the backfilled tier
    let reg44Res = null;
    let reg44Status = null;
    await eventController.registerForEvent(
      {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: 44 },
        body: {
          tickets: [{ ticketTypeId: event44Ticket.id, quantity: 1 }],
          totalAmount: 0
        }
      },
      {
        status: (code) => ({ json: (d) => { reg44Status = code; reg44Res = d; } }),
        json: (d) => { reg44Status = 200; reg44Res = d; }
      }
    );
    console.log('Registration response for Event 44:', { status: reg44Status, body: reg44Res });

    // Verify registration row in DB
    const regCheck = await pool.query(
      `SELECT er.id, er.registration_status, rt.ticket_name, rt.unit_price, rt.quantity
       FROM event_registrations er
       JOIN registration_tickets rt ON er.id = rt.registration_id
       WHERE er.event_id = 44 AND er.member_id = $1`,
      [testMemberId]
    );
    console.log('Inserted registration record for Event 44:', regCheck.rows[0]);

    const d6FrontendFails = [];
    if (reg44Status !== 200 || !reg44Res?.success) d6FrontendFails.push(`Registration on Event 44 failed: ${reg44Res?.error}`);
    if (regCheck.rows.length === 0) d6FrontendFails.push('No registration row found in database for Event 44');
    if (parseFloat(regCheck.rows[0]?.unit_price) !== 0) d6FrontendFails.push(`Unit price is not 0: ${regCheck.rows[0]?.unit_price}`);

    if (d6FrontendFails.length === 0) {
      console.log('>>> [PASS] TEST D6-frontend: Event 44 now delivers valid General Admission ticket tier, allows selection, and completes free registration cleanly end-to-end.');
    } else {
      console.error('>>> [FAIL] TEST D6-frontend:', d6FrontendFails);
    }

  } catch (err) {
    console.error('Fatal error in Defect 6 verification:', err);
  } finally {
    // Clean up Event 44 test registration
    await pool.query(
      `DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = 44 AND member_id = $1)`,
      [testMemberId]
    );
    await pool.query(
      `DELETE FROM event_registrations WHERE event_id = 44 AND member_id = $1`,
      [testMemberId]
    );

    // Restore Event 44 original dates
    if (orig44Dates?.rows?.[0]) {
      await pool.query(
        `UPDATE events SET start_datetime = $1, end_datetime = $2, event_date = $3 WHERE id = 44`,
        [orig44Dates.rows[0].start_datetime, orig44Dates.rows[0].end_datetime, orig44Dates.rows[0].event_date]
      );
    }

    if (createdTestEvents.length > 0) {
      console.log('\n[Cleanup] Cleaning up created test events...');
      for (const evId of createdTestEvents) {
        await pool.query(`DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = $1)`, [evId]);
        await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [evId]);
        await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [evId]);
        await pool.query(`DELETE FROM events WHERE id = $1`, [evId]);
      }
      console.log('[Cleanup] Done.');
    }
    await pool.end();
  }
}

runDefect6Verification();
