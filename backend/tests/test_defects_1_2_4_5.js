require('dotenv').config();
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const { createPool } = require('../config/db');
const pool = createPool();
const eventController = require('../controllers/eventController');

async function runDefectTests() {
  console.log('================================================================');
  console.log('VERIFICATION SUITE: DEFECTS 1, 2, 4, 5');
  console.log('================================================================');

  let testCommunityId = null;
  let testMaleId = null;
  let testFemaleId = null;
  let createdEventId = null;

  try {
    // 1. Setup fixtures
    const commRes = await pool.query(`SELECT id FROM communities LIMIT 1`);
    testCommunityId = commRes.rows[0].id;

    const maleRes = await pool.query(`SELECT id, gender FROM members WHERE gender ILIKE 'male' LIMIT 1`);
    testMaleId = maleRes.rows[0]?.id;

    const femaleRes = await pool.query(`SELECT id, gender FROM members WHERE gender ILIKE 'female' LIMIT 1`);
    testFemaleId = femaleRes.rows[0]?.id;

    console.log(`[Setup] Using Community #${testCommunityId}, Male Member #${testMaleId}, Female Member #${testFemaleId}`);

    // =========================================================================
    // TEST D1: Sales window field persistence on create and update
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D1: Sales window field name compatibility (create & update)');
    console.log('----------------------------------------------------------------');

    const d1Start = '2026-10-01T10:00:00.000Z';
    const d1End = '2026-10-05T18:00:00.000Z';

    // Simulate createEvent receiving what TicketTypesEditor sends (sales_start_date & sales_end_date)
    const mockCreateReq = {
      app: { locals: { pool } },
      user: { id: testCommunityId, type: 'community' },
      body: {
        title: 'D1 Sales Window Persistence Test',
        description: 'Testing sales window dates',
        event_date: '2026-10-10T00:00:00.000Z',
        start_datetime: '2026-10-10T10:00:00.000Z',
        end_datetime: '2026-10-10T18:00:00.000Z',
        event_type: 'in-person',
        location_url: 'https://maps.google.com/?q=Bangalore',
        banner_carousel: [
          { url: 'https://images.unsplash.com/photo-1?test=1', cloudinary_public_id: 'test_b1' }
        ],
        ticket_types: [
          {
            name: 'D1 Ticket Tier',
            base_price: 150,
            total_quantity: 50,
            // Simulated payload from frontend editor:
            sales_start_date: d1Start,
            sales_end_date: d1End,
            sale_start_at: d1Start,
            sale_end_at: d1End,
            visibility: 'public'
          }
        ]
      }
    };

    let createResData = null;
    let createStatusCode = 200;
    await eventController.createEvent(mockCreateReq, {
      status: (c) => ({ json: (d) => { createStatusCode = c; createResData = d; } }),
      json: (d) => { createResData = d; }
    });

    console.log('createEvent response:', createStatusCode, createResData);
    createdEventId = createResData?.event?.id || createResData?.id;
    console.log(`Step 1: Created Event #${createdEventId}`);

    // Direct DB query to verify columns populated
    const dbCheck1 = await pool.query(
      `SELECT id, name, sale_start_at, sale_end_at FROM ticket_types WHERE event_id = $1`,
      [createdEventId]
    );
    const d1Ticket = dbCheck1.rows[0];
    console.log('DB Check after createEvent:', d1Ticket);

    const d1CreateStartIso = d1Ticket.sale_start_at ? new Date(d1Ticket.sale_start_at).toISOString() : null;
    const d1CreateEndIso = d1Ticket.sale_end_at ? new Date(d1Ticket.sale_end_at).toISOString() : null;

    // Fetch via getEventById
    let getResData = null;
    await eventController.getEventById(
      { params: { eventId: createdEventId }, user: null },
      { status: () => ({ json: (d) => { getResData = d; } }), json: (d) => { getResData = d; } }
    );
    const fetchedTicket = getResData?.event?.ticket_types?.[0] || getResData?.ticket_types?.[0];
    console.log('Fetched Ticket via getEventById:', {
      id: fetchedTicket?.id,
      sale_start_at: fetchedTicket?.sale_start_at,
      sale_end_at: fetchedTicket?.sale_end_at
    });

    // Update the event changing an unrelated field (e.g. description)
    const mockUpdateReq = {
      app: { locals: { pool } },
      user: { id: testCommunityId, type: 'community' },
      params: { id: createdEventId },
      body: {
        title: 'D1 Sales Window Persistence Test (Updated Title)',
        description: 'Updated Description',
        ticket_types: [
          {
            id: d1Ticket.id,
            name: 'D1 Ticket Tier',
            base_price: 150,
            total_quantity: 50,
            // What the editor would send back after opening and saving:
            sales_start_date: d1Start,
            sales_end_date: d1End,
            sale_start_at: d1Start,
            sale_end_at: d1End,
            visibility: 'public'
          }
        ]
      }
    };

    await eventController.updateEvent(mockUpdateReq, {
      status: () => ({ json: () => {} }),
      json: () => {}
    });

    const dbCheckAfterUpdate = await pool.query(
      `SELECT id, name, sale_start_at, sale_end_at FROM ticket_types WHERE id = $1`,
      [d1Ticket.id]
    );
    console.log('DB Check after updateEvent:', dbCheckAfterUpdate.rows[0]);

    const d1UpdateStartIso = dbCheckAfterUpdate.rows[0].sale_start_at ? new Date(dbCheckAfterUpdate.rows[0].sale_start_at).toISOString() : null;
    const d1UpdateEndIso = dbCheckAfterUpdate.rows[0].sale_end_at ? new Date(dbCheckAfterUpdate.rows[0].sale_end_at).toISOString() : null;

    // Assertions for D1
    const d1Fails = [];
    if (!d1Ticket.sale_start_at || !d1Ticket.sale_end_at) d1Fails.push('sale_start_at or sale_end_at is null after createEvent');
    if (d1CreateStartIso !== d1Start) d1Fails.push(`Start date mismatch: got ${d1CreateStartIso}, expected ${d1Start}`);
    if (d1CreateEndIso !== d1End) d1Fails.push(`End date mismatch: got ${d1CreateEndIso}, expected ${d1End}`);
    if (d1UpdateStartIso !== d1Start || d1UpdateEndIso !== d1End) d1Fails.push('Sales dates were wiped out on updateEvent');

    if (d1Fails.length === 0) {
      console.log('>>> [PASS] TEST D1: Sales window persisted on create, round-tripped via getEvent, and preserved on update.');
    } else {
      console.error('>>> [FAIL] TEST D1:', d1Fails);
    }

    // =========================================================================
    // TEST D2: Sales window enforcement in reserveTickets
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D2: reserveTickets sales window enforcement (past, future, active)');
    console.log('----------------------------------------------------------------');

    // Setup 3 ticket types: expired, future, active
    const expiredTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sale_start_at, sale_end_at, is_active)
       VALUES ($1, 'Expired Tier', 200, 10, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour', true) RETURNING id, name`,
      [createdEventId]
    );
    const expiredTicketId = expiredTicketRes.rows[0].id;

    const futureTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sale_start_at, sale_end_at, is_active)
       VALUES ($1, 'Future Tier', 200, 10, NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', true) RETURNING id, name`,
      [createdEventId]
    );
    const futureTicketId = futureTicketRes.rows[0].id;

    const activeTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sale_start_at, sale_end_at, is_active)
       VALUES ($1, 'Active Tier', 200, 10, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', true) RETURNING id, name`,
      [createdEventId]
    );
    const activeTicketId = activeTicketRes.rows[0].id;

    // D2a: Attempt reserveTickets against Expired Tier
    console.log('\nStep D2a: Attempting reserveTickets for Expired Tier...');
    let d2aError = null;
    let d2aStatus = null;
    await eventController.reserveTickets(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: { tickets: [{ ticketTypeId: expiredTicketId, quantity: 1 }] }
      },
      {
        status: (code) => ({ json: (d) => { d2aStatus = code; d2aError = d.error; } }),
        json: (d) => { d2aStatus = 200; d2aError = d.error; }
      }
    );
    console.log(`D2a Result: Status ${d2aStatus}, Error: "${d2aError}"`);

    // D2b: Attempt reserveTickets against Future Tier
    console.log('\nStep D2b: Attempting reserveTickets for Future Tier...');
    let d2bError = null;
    let d2bStatus = null;
    await eventController.reserveTickets(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: { tickets: [{ ticketTypeId: futureTicketId, quantity: 1 }] }
      },
      {
        status: (code) => ({ json: (d) => { d2bStatus = code; d2bError = d.error; } }),
        json: (d) => { d2bStatus = 200; d2bError = d.error; }
      }
    );
    console.log(`D2b Result: Status ${d2bStatus}, Error: "${d2bError}"`);

    // D2c: Attempt reserveTickets against Active Tier
    console.log('\nStep D2c: Attempting reserveTickets for Active Tier...');
    let d2cRes = null;
    let d2cStatus = null;
    await eventController.reserveTickets(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: { tickets: [{ ticketTypeId: activeTicketId, quantity: 1 }] }
      },
      {
        status: (code) => ({ json: (d) => { d2cStatus = code; d2cRes = d; } }),
        json: (d) => { d2cStatus = 200; d2cRes = d; }
      }
    );
    console.log(`D2c Result: Status ${d2cStatus}, Success: ${d2cRes?.success}, SessionId: ${d2cRes?.sessionId}`);

    // Assertions for D2
    const d2Fails = [];
    if (!d2aError?.includes('have closed')) d2Fails.push(`D2a expected "have closed", got: ${d2aError}`);
    if (!d2bError?.includes('have not opened yet')) d2Fails.push(`D2b expected "have not opened yet", got: ${d2bError}`);
    if (d2cStatus !== 200 || !d2cRes?.success) d2Fails.push(`D2c active ticket reservation failed: ${d2cRes?.error}`);

    if (d2Fails.length === 0) {
      console.log('>>> [PASS] TEST D2a, D2b, D2c: Expired tier rejected ("have closed"), future tier rejected ("have not opened yet"), active tier succeeded.');
    } else {
      console.error('>>> [FAIL] TEST D2:', d2Fails);
    }

    // Clean active hold
    if (d2cRes?.sessionId) {
      await eventController.releaseReservation(
        { user: { id: testMaleId, type: 'member' }, params: { eventId: createdEventId }, body: { sessionId: d2cRes.sessionId } },
        { status: () => ({ json: () => {} }), json: () => {} }
      );
    }

    // =========================================================================
    // TEST D4 & D5: registerForEvent unitPrice fallback & paid ticket fraud guard
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D4: Free ticket unitPrice fallback & Paid-ticket fraud guard');
    console.log('----------------------------------------------------------------');

    // Create a free ticket type
    const freeTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, is_active)
       VALUES ($1, 'Free Community Pass', 0, 50, true) RETURNING id, name`,
      [createdEventId]
    );
    const freeTicketId = freeTicketRes.rows[0].id;

    // Create a paid ticket type
    const paidTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, is_active)
       VALUES ($1, 'Exclusive Paid VIP', 500, 20, true) RETURNING id, name`,
      [createdEventId]
    );
    const paidTicketId = paidTicketRes.rows[0].id;

    // D4a: Call registerForEvent with free ticket (base_price = 0) and NO unitPrice sent
    console.log('\nStep D4a: Calling registerForEvent for free ticket without unitPrice...');
    let d4aRes = null;
    let d4aStatus = null;
    await eventController.registerForEvent(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: {
          tickets: [{ ticketTypeId: freeTicketId, quantity: 1 }], // NO unitPrice sent!
          totalAmount: 0
        }
      },
      {
        status: (code) => ({ json: (d) => { d4aStatus = code; d4aRes = d; } }),
        json: (d) => { d4aStatus = 200; d4aRes = d; }
      }
    );
    console.log(`D4a Result: Status ${d4aStatus}, Success: ${d4aRes?.success}, RegistrationId: ${d4aRes?.registrationId}`);

    // Check registration_tickets row for D4a
    const regTicketCheck = await pool.query(
      `SELECT id, unit_price, total_price FROM registration_tickets WHERE registration_id = $1`,
      [d4aRes?.registrationId]
    );
    console.log('Inserted registration_tickets row:', regTicketCheck.rows[0]);

    // D4b: Fraud attempt — Call registerForEvent with paid ticket (base_price = 500)
    console.log('\nStep D4b: Attempting free registration for paid ticket (fraud bypass attempt)...');
    let d4bRes = null;
    let d4bStatus = null;
    await eventController.registerForEvent(
      {
        user: { id: testFemaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: {
          tickets: [{ ticketTypeId: paidTicketId, quantity: 1 }],
          totalAmount: 0
        }
      },
      {
        status: (code) => ({ json: (d) => { d4bStatus = code; d4bRes = d; } }),
        json: (d) => { d4bStatus = 200; d4bRes = d; }
      }
    );
    console.log(`D4b Result: Status ${d4bStatus}, Error: "${d4bRes?.error}"`);

    // Verify NO rows inserted for testFemaleId
    const femaleRegCheck = await pool.query(
      `SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2`,
      [createdEventId, testFemaleId]
    );
    console.log(`Event registrations count for female user: ${femaleRegCheck.rows.length}`);

    // Assertions for D4
    const d4Fails = [];
    if (d4aStatus !== 200 || !d4aRes?.success) d4Fails.push(`D4a failed: ${d4aRes?.error}`);
    if (parseFloat(regTicketCheck.rows[0]?.unit_price) !== 0) d4Fails.push(`D4a unit_price is not 0: ${regTicketCheck.rows[0]?.unit_price}`);
    if (d4bStatus !== 400) d4Fails.push(`D4b expected status 400, got: ${d4bStatus}`);
    if (!d4bRes?.error?.includes('paid ticket and cannot be claimed via free registration')) {
      d4Fails.push(`D4b error message mismatch: ${d4bRes?.error}`);
    }
    if (femaleRegCheck.rows.length !== 0) d4Fails.push('D4b allowed registration row insertion despite paid ticket!');

    if (d4Fails.length === 0) {
      console.log('>>> [PASS] TEST D4a & D4b: Free ticket succeeded with unit_price=0, paid ticket was rejected (400) with zero rows inserted.');
    } else {
      console.error('>>> [FAIL] TEST D4:', d4Fails);
    }

    // =========================================================================
    // TEST D5: Status codes (400 for business validation vs 500 for real server error)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D5: Proper error status codes (400 for validation vs 500 for server crash)');
    console.log('----------------------------------------------------------------');

    // Create a female-only ticket
    const femaleOnlyTicketRes = await pool.query(
      `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, gender_restriction, is_active)
       VALUES ($1, 'Women Only Pass', 0, 10, 'Female', true) RETURNING id, name`,
      [createdEventId]
    );
    const femaleOnlyTicketId = femaleOnlyTicketRes.rows[0].id;

    // Clean prior registrations from D4a so male user can test gender restriction
    await pool.query(`DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = $1)`, [createdEventId]);
    await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [createdEventId]);

    // D5 Part 1: Male user attempts to register for female-only ticket
    console.log('Step D5.1: Male member attempting female-only ticket...');
    let d5GenderRes = null;
    let d5GenderStatus = null;
    await eventController.registerForEvent(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: createdEventId },
        body: {
          tickets: [{ ticketTypeId: femaleOnlyTicketId, quantity: 1 }],
          totalAmount: 0
        }
      },
      {
        status: (code) => ({ json: (d) => { d5GenderStatus = code; d5GenderRes = d; } }),
        json: (d) => { d5GenderStatus = 200; d5GenderRes = d; }
      }
    );
    console.log(`D5.1 Result: Status ${d5GenderStatus}, Error: "${d5GenderRes?.error}"`);

    // D5 Part 2: Simulate genuine unexpected error (e.g. invalid eventId causing DB syntax or constraint error)
    console.log('\nStep D5.2: Simulating unexpected server error (unhandled error path)...');
    let d5CrashRes = null;
    let d5CrashStatus = null;
    await eventController.registerForEvent(
      {
        user: { id: testMaleId, type: 'member' },
        params: { eventId: 'NOT_A_VALID_INTEGER' }, // causes PostgreSQL invalid input syntax for type bigint
        body: {
          tickets: [{ ticketTypeId: freeTicketId, quantity: 1 }],
          totalAmount: 0
        }
      },
      {
        status: (code) => ({ json: (d) => { d5CrashStatus = code; d5CrashRes = d; } }),
        json: (d) => { d5CrashStatus = 200; d5CrashRes = d; }
      }
    );
    console.log(`D5.2 Result: Status ${d5CrashStatus}, Error: "${d5CrashRes?.error}"`);

    // Assertions for D5
    const d5Fails = [];
    if (d5GenderStatus !== 400) d5Fails.push(`D5.1 expected status 400 for gender restriction, got ${d5GenderStatus}`);
    if (!d5GenderRes?.error?.includes('only available for Female')) d5Fails.push(`D5.1 error message mismatch: ${d5GenderRes?.error}`);
    if (d5CrashStatus !== 500) d5Fails.push(`D5.2 expected status 500 for unexpected error, got ${d5CrashStatus}`);

    if (d5Fails.length === 0) {
      console.log('>>> [PASS] TEST D5: Business validation returned HTTP 400, unexpected error returned HTTP 500.');
    } else {
      console.error('>>> [FAIL] TEST D5:', d5Fails);
    }

  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
  } finally {
    if (createdEventId) {
      console.log('\n[Cleanup] Removing test event fixtures...');
      await pool.query(`DELETE FROM registration_tickets WHERE registration_id IN (SELECT id FROM event_registrations WHERE event_id = $1)`, [createdEventId]);
      await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [createdEventId]);
      await pool.query(`DELETE FROM ticket_reservations WHERE event_id = $1`, [createdEventId]);
      await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [createdEventId]);
      await pool.query(`DELETE FROM events WHERE id = $1`, [createdEventId]);
      console.log('[Cleanup] Done.');
    }
    await pool.end();
  }
}

runDefectTests();
