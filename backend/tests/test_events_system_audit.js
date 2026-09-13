/**
 * test_events_system_audit.js
 * 
 * End-to-end diagnostic test suite for the SnooSpace Events System.
 * Tests DB integrity, sequence synchronization, createEvent, updateEvent,
 * getEventById, searchEvents, discoverEvents, reserveTickets, releaseReservation,
 * registerForEvent, discount codes, pricing rules, cancellation, and ticket verification.
 */

require('dotenv').config();
const { createPool } = require('../config/db');

const pool = createPool();

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function pass(name, detail = '') {
  results.passed.push({ name, detail });
  console.log(`  [PASS] ${name}${detail ? ' - ' + detail : ''}`);
}

function fail(name, error) {
  results.failed.push({ name, error: error?.message || String(error) });
  console.error(`  [FAIL] ${name} =>`, error?.message || error);
}

function warn(name, detail) {
  results.warnings.push({ name, detail });
  console.warn(`  [WARN] ${name} =>`, detail);
}

async function runAudit() {
  console.log('\n======================================================');
  console.log('       SNOOSPACE EVENTS SYSTEM END-TO-END AUDIT       ');
  console.log('======================================================\n');

  let testCommunityId = null;
  let testMemberId = null;
  let testMemberFemaleId = null;
  let testEventId = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: DATABASE SCHEMA & SEQUENCE INTEGRITY
    // -------------------------------------------------------------
    console.log('--- Section 1: Schema & Sequence Integrity ---');

    const expectedTables = [
      'events',
      'ticket_types',
      'ticket_reservations',
      'discount_codes',
      'pricing_rules',
      'event_banners',
      'event_gallery',
      'event_highlights',
      'event_featured_accounts',
      'event_things_to_know',
      'event_cohosts',
      'event_registrations',
      'event_attendees',
      'event_likes',
      'event_comments',
      'event_views',
      'event_shares',
      'event_interests',
      'refund_requests',
      'payout_ledger',
      'event_postponements',
      'event_verifications',
    ];

    for (const table of expectedTables) {
      try {
        const check = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          );`,
          [table]
        );
        if (check.rows[0].exists) {
          pass(`Table exists: ${table}`);
        } else {
          fail(`Table exists: ${table}`, `Missing table: ${table}`);
        }
      } catch (err) {
        fail(`Table check error: ${table}`, err);
      }
    }

    // Check Sequences sync with MAX(id)
    const tablesWithSequences = [
      { table: 'events', seq: 'events_id_seq' },
      { table: 'ticket_types', seq: 'ticket_types_id_seq' },
      { table: 'discount_codes', seq: 'discount_codes_id_seq' },
      { table: 'pricing_rules', seq: 'pricing_rules_id_seq' },
      { table: 'event_registrations', seq: 'event_registrations_id_seq' },
      { table: 'ticket_reservations', seq: 'ticket_reservations_id_seq' },
    ];

    for (const item of tablesWithSequences) {
      try {
        const maxRes = await pool.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM ${item.table}`);
        const maxId = parseInt(maxRes.rows[0].max_id, 10);
        const seqRes = await pool.query(`SELECT last_value, is_called FROM ${item.seq}`);
        const lastVal = parseInt(seqRes.rows[0].last_value, 10);

        if (maxId > 0 && lastVal < maxId) {
          fail(
            `Sequence sync: ${item.seq}`,
            `Sequence last_value (${lastVal}) < MAX(id) (${maxId}). Next INSERT will crash with unique violation!`
          );
        } else {
          pass(`Sequence sync: ${item.seq}`, `MAX(id)=${maxId}, last_value=${lastVal}`);
        }
      } catch (err) {
        warn(`Sequence check: ${item.seq}`, err.message);
      }
    }

    // Check key column names in ticket_types
    try {
      const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ticket_types';
      `);
      const colNames = cols.rows.map(r => r.column_name);
      if (colNames.includes('sale_start_at') && colNames.includes('sale_end_at')) {
        pass('ticket_types has sale_start_at and sale_end_at');
      } else {
        fail('ticket_types sales columns', `Found columns: ${colNames.join(', ')}`);
      }
      if (colNames.includes('refund_policy')) {
        pass('ticket_types has refund_policy column');
      } else {
        fail('ticket_types refund_policy', 'Missing refund_policy column');
      }
      if (colNames.includes('gender_restriction')) {
        pass('ticket_types has gender_restriction column');
      } else {
        warn('ticket_types gender_restriction', 'Missing gender_restriction column');
      }
    } catch (err) {
      fail('Check ticket_types columns', err);
    }

    // -------------------------------------------------------------
    // SECTION 2: TEST FIXTURES SETUP
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Setting up test fixtures ---');
    
    // Create test community
    const commRes = await pool.query(`
      INSERT INTO communities (name, username, email, created_at)
      VALUES ('Audit Test Community', 'audit_comm_${Date.now()}', 'audit_comm_${Date.now()}@test.com', NOW())
      RETURNING id;
    `);
    testCommunityId = commRes.rows[0].id;
    pass('Created test community', `ID=${testCommunityId}`);

    const ts = Date.now();
    // Create test male member
    const memRes = await pool.query(`
      INSERT INTO members (name, username, email, phone, gender, dob, interests, created_at)
      VALUES ('Audit Male User', 'male_audit_${ts}', 'male_audit_${ts}@test.com', '9876543210', 'Male', '2000-01-01', '["music","tech","sports"]', NOW())
      RETURNING id;
    `);
    testMemberId = memRes.rows[0].id;
    pass('Created test male member', `ID=${testMemberId}`);

    // Create test female member
    const femRes = await pool.query(`
      INSERT INTO members (name, username, email, phone, gender, dob, interests, created_at)
      VALUES ('Audit Female User', 'fem_audit_${ts}', 'female_audit_${ts}@test.com', '9876543211', 'Female', '2000-01-01', '["music","art","travel"]', NOW())
      RETURNING id;
    `);
    testMemberFemaleId = femRes.rows[0].id;
    pass('Created test female member', `ID=${testMemberFemaleId}`);

    // -------------------------------------------------------------
    // SECTION 3: EVENT CREATION FLOW AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Event Creation Flow Audit ---');

    const eventController = require('../controllers/eventController');

    // Simulate req, res for createEvent
    const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days ahead
    const futureEndDate = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 4 * 3600 * 1000); // +4 hours
    const salesStartDate = new Date(Date.now() - 24 * 3600 * 1000); // yesterday
    const salesEndDate = new Date(Date.now() + 6 * 24 * 3600 * 1000); // 6 days ahead

    let createdEventResponse = null;
    let createStatusCode = null;

    const mockCreateReq = {
      app: { locals: { pool } },
      user: { id: testCommunityId, type: 'community' },
      body: {
        title: 'Audit Grand Festival',
        description: 'Comprehensive test event for auditing full system.',
        event_date: futureDate.toISOString(),
        start_datetime: futureDate.toISOString(),
        end_datetime: futureEndDate.toISOString(),
        event_type: 'in-person',
        location_url: 'https://maps.google.com/?q=Bangalore',
        location_name: 'Bangalore Palace Ground',
        max_attendees: 500,
        access_type: 'public',
        banner_carousel: [
          { url: 'https://images.unsplash.com/photo-1?test=1', cloudinary_public_id: 'test_b1' },
          { url: 'https://images.unsplash.com/photo-2?test=2', cloudinary_public_id: 'test_b2' }
        ],
        gallery: [
          { url: 'https://images.unsplash.com/photo-3?test=3', cloudinary_public_id: 'test_g1' }
        ],
        highlights: [
          { title: 'Live Music', description: 'Featuring top indie bands', icon_name: 'music' }
        ],
        featured_accounts: [
          { display_name: 'DJ Spark', role: 'Headliner', profile_photo_url: 'https://unsplash.com/dj' }
        ],
        things_to_know: [
          { label: 'Age Limit 18+', icon_name: 'alert-circle' }
        ],
        ticket_types: [
          {
            name: 'General Admission Free',
            base_price: 0,
            total_quantity: 100,
            min_per_order: 1,
            max_per_order: 2,
            gender_restriction: 'all',
            // Test frontend-sent field naming:
            sales_start_date: salesStartDate.toISOString(),
            sales_end_date: salesEndDate.toISOString(),
            refund_policy: { allowed: false, deadline_hours_before: 0, percentage: 0 }
          },
          {
            name: 'VIP Experience Paid',
            base_price: 499,
            total_quantity: 50,
            min_per_order: 1,
            max_per_order: 5,
            gender_restriction: 'all',
            sales_start_date: salesStartDate.toISOString(),
            sales_end_date: salesEndDate.toISOString(),
            refund_policy: { allowed: true, deadline_hours_before: 24, percentage: 100 }
          },
          {
            name: 'Women Exclusive Pass',
            base_price: 299,
            total_quantity: 30,
            min_per_order: 1,
            max_per_order: 2,
            gender_restriction: 'female',
            sale_start_at: salesStartDate.toISOString(),
            sale_end_at: salesEndDate.toISOString(),
            refund_policy: { allowed: true, deadline_hours_before: 12, percentage: 50 }
          }
        ],
        discount_codes: [
          {
            code: 'EARLY50',
            discount_type: 'percentage',
            discount_value: 50,
            max_uses: 100,
            applies_to: 'all',
            is_active: true
          }
        ],
        pricing_rules: [
          {
            name: 'Early Bird',
            rule_type: 'early_bird_time',
            discount_type: 'flat',
            discount_value: 100,
            valid_until: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
            applies_to: 'all',
            is_active: true
          }
        ]
      }
    };

    const mockCreateRes = {
      status: (code) => {
        createStatusCode = code;
        return {
          json: (data) => { createdEventResponse = data; }
        };
      },
      json: (data) => {
        createStatusCode = 200;
        createdEventResponse = data;
      }
    };

    await eventController.createEvent(mockCreateReq, mockCreateRes);

    if (createStatusCode === 201 && createdEventResponse?.event?.id) {
      testEventId = createdEventResponse.event.id;
      pass('createEvent API call', `Created event ID ${testEventId}`);
    } else {
      fail('createEvent API call', createdEventResponse?.error || `Status code: ${createStatusCode}`);
    }

    // -------------------------------------------------------------
    // SECTION 4: DATA PERSISTENCE CHECK (VERIFY TICKET SALES DATES)
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Ticket Sales Dates Persistence Check ---');

    if (testEventId) {
      const ticketsCheck = await pool.query(
        `SELECT id, name, sale_start_at, sale_end_at, base_price, gender_restriction 
         FROM ticket_types WHERE event_id = $1 ORDER BY id ASC`,
        [testEventId]
      );

      pass(`Ticket types inserted: ${ticketsCheck.rows.length} rows`);

      for (const t of ticketsCheck.rows) {
        if (t.name === 'General Admission Free' || t.name === 'VIP Experience Paid') {
          // Frontend sent `sales_start_date` and `sales_end_date`
          if (t.sale_start_at === null || t.sale_end_at === null) {
            fail(
              `Ticket '${t.name}' sales window persistence`,
              `sale_start_at is ${t.sale_start_at}, sale_end_at is ${t.sale_end_at}! Frontend sent sales_start_date/sales_end_date, but backend inserted NULL!`
            );
          } else {
            pass(`Ticket '${t.name}' sales window persistence`, `Start: ${t.sale_start_at}, End: ${t.sale_end_at}`);
          }
        } else if (t.name === 'Women Exclusive Pass') {
          // Sent sale_start_at and sale_end_at
          if (t.sale_start_at && t.sale_end_at) {
            pass(`Ticket '${t.name}' with direct DB names`, `Persisted properly`);
          } else {
            fail(`Ticket '${t.name}' with direct DB names`, `Failed to persist: ${t.sale_start_at}, ${t.sale_end_at}`);
          }
        }
      }

      // Check banners, gallery, highlights, featured accounts, things to know
      const bannersCheck = await pool.query(`SELECT COUNT(*) FROM event_banners WHERE event_id = $1`, [testEventId]);
      if (parseInt(bannersCheck.rows[0].count, 10) === 2) {
        pass('Event banners persisted (2 rows)');
      } else {
        fail('Event banners count', `Expected 2, got ${bannersCheck.rows[0].count}`);
      }

      const galleryCheck = await pool.query(`SELECT COUNT(*) FROM event_gallery WHERE event_id = $1`, [testEventId]);
      if (parseInt(galleryCheck.rows[0].count, 10) === 1) {
        pass('Event gallery persisted (1 row)');
      } else {
        fail('Event gallery count', `Expected 1, got ${galleryCheck.rows[0].count}`);
      }

      const highlightsCheck = await pool.query(`SELECT COUNT(*) FROM event_highlights WHERE event_id = $1`, [testEventId]);
      if (parseInt(highlightsCheck.rows[0].count, 10) === 1) {
        pass('Event highlights persisted (1 row)');
      } else {
        fail('Event highlights count', `Expected 1, got ${highlightsCheck.rows[0].count}`);
      }

      const accountsCheck = await pool.query(`SELECT COUNT(*) FROM event_featured_accounts WHERE event_id = $1`, [testEventId]);
      if (parseInt(accountsCheck.rows[0].count, 10) === 1) {
        pass('Event featured accounts persisted (1 row)');
      } else {
        fail('Event featured accounts count', `Expected 1, got ${accountsCheck.rows[0].count}`);
      }

      const discountsCheck = await pool.query(`SELECT COUNT(*) FROM discount_codes WHERE event_id = $1`, [testEventId]);
      if (parseInt(discountsCheck.rows[0].count, 10) === 1) {
        pass('Discount codes persisted (1 row)');
      } else {
        fail('Discount codes count', `Expected 1, got ${discountsCheck.rows[0].count}`);
      }

      const pricingRulesCheck = await pool.query(`SELECT COUNT(*) FROM pricing_rules WHERE event_id = $1`, [testEventId]);
      if (parseInt(pricingRulesCheck.rows[0].count, 10) === 1) {
        pass('Pricing rules persisted (1 row)');
      } else {
        fail('Pricing rules count', `Expected 1, got ${pricingRulesCheck.rows[0].count}`);
      }
    }

    // -------------------------------------------------------------
    // SECTION 5: GET EVENT BY ID AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 5: getEventById Flow Audit ---');

    if (testEventId) {
      let getResData = null;
      let getStatusCode = null;
      const mockGetReq = {
        app: { locals: { pool } },
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId }
      };
      const mockGetRes = {
        status: (code) => {
          getStatusCode = code;
          return { json: (d) => { getResData = d; } };
        },
        json: (d) => {
          getStatusCode = 200;
          getResData = d;
        }
      };

      await eventController.getEventById(mockGetReq, mockGetRes);

      if (getStatusCode === 200 && getResData?.event) {
        pass('getEventById returned event');
        const ev = getResData.event;
        if (ev.ticket_types && ev.ticket_types.length === 3) {
          pass('getEventById contains all 3 ticket types');
        } else {
          fail('getEventById ticket_types', `Expected 3, got ${ev.ticket_types?.length}`);
        }

        if (ev.banner_carousel && ev.banner_carousel.length === 2) {
          pass('getEventById contains banner_carousel');
        } else {
          fail('getEventById banner_carousel', `Expected 2, got ${ev.banner_carousel?.length}`);
        }

        if (ev.discount_codes && ev.discount_codes.length === 1) {
          pass('getEventById contains discount_codes');
        } else {
          fail('getEventById discount_codes', `Expected 1, got ${ev.discount_codes?.length}`);
        }

        if (ev.pricing_rules && ev.pricing_rules.length === 1) {
          pass('getEventById contains pricing_rules');
        } else {
          fail('getEventById pricing_rules', `Expected 1, got ${ev.pricing_rules?.length}`);
        }
      } else {
        fail('getEventById execution', getResData?.error || `Status: ${getStatusCode}`);
      }
    }

    // -------------------------------------------------------------
    // SECTION 6: TICKET RESERVATION (PAID HOLD) FLOW AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 6: reserveTickets (Paid Hold) Flow Audit ---');

    if (testEventId) {
      const ticketsRes = await pool.query(`SELECT id, name, base_price, total_quantity, max_per_order FROM ticket_types WHERE event_id = $1`, [testEventId]);
      const vipTicket = ticketsRes.rows.find(t => t.name === 'VIP Experience Paid');

      // Test 6a: Normal reservation within limits
      let reserveResData = null;
      let reserveStatusCode = null;
      const mockReserveReq = {
        user: { id: testMemberId, type: 'member' },
        params: { eventId: testEventId },
        body: {
          tickets: [{ ticketTypeId: vipTicket.id, quantity: 2 }]
        }
      };
      const mockReserveRes = {
        status: (code) => {
          reserveStatusCode = code;
          return { json: (d) => { reserveResData = d; } };
        },
        json: (d) => {
          reserveStatusCode = 200;
          reserveResData = d;
        }
      };

      await eventController.reserveTickets(mockReserveReq, mockReserveRes);

      if (reserveStatusCode === 200 && reserveResData?.success && reserveResData?.sessionId) {
        pass('reserveTickets successfully created hold session', `SessionId: ${reserveResData.sessionId}`);
        
        // Verify reserved_count was incremented in DB
        const checkReserved = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicket.id]);
        if (checkReserved.rows[0].reserved_count === 2) {
          pass('ticket_types.reserved_count correctly incremented to 2');
        } else {
          fail('ticket_types.reserved_count increment', `Expected 2, got ${checkReserved.rows[0].reserved_count}`);
        }

        // Test 6b: Exceeding max_per_order
        let overMaxRes = null;
        let overMaxStatus = null;
        await eventController.reserveTickets(
          {
            user: { id: testMemberFemaleId, type: 'member' },
            params: { eventId: testEventId },
            body: { tickets: [{ ticketTypeId: vipTicket.id, quantity: 10 }] } // max is 5
          },
          {
            status: (c) => { overMaxStatus = c; return { json: (d) => { overMaxRes = d; } }; },
            json: (d) => { overMaxStatus = 200; overMaxRes = d; }
          }
        );

        if (overMaxStatus === 400 || overMaxRes?.error?.includes('Maximum')) {
          pass('reserveTickets rejects quantity exceeding max_per_order');
        } else {
          fail('reserveTickets max_per_order check', `Expected error, got status ${overMaxStatus}: ${JSON.stringify(overMaxRes)}`);
        }

        // Test 6c: Releasing reservation
        let releaseResData = null;
        let releaseStatusCode = null;
        await eventController.releaseReservation(
          {
            user: { id: testMemberId, type: 'member' },
            params: { eventId: testEventId },
            body: { sessionId: reserveResData.sessionId }
          },
          {
            status: (c) => { releaseStatusCode = c; return { json: (d) => { releaseResData = d; } }; },
            json: (d) => { releaseStatusCode = 200; releaseResData = d; }
          }
        );

        const checkAfterRelease = await pool.query(`SELECT reserved_count FROM ticket_types WHERE id = $1`, [vipTicket.id]);
        if (checkAfterRelease.rows[0].reserved_count === 0) {
          pass('releaseReservation decremented reserved_count back to 0');
        } else {
          fail('releaseReservation decrement', `Expected 0, got ${checkAfterRelease.rows[0].reserved_count}`);
        }

      } else {
        fail('reserveTickets normal execution', reserveResData?.error || `Status: ${reserveStatusCode}`);
      }

      // Test 6d: Does reserveTickets enforce sales window?
      // Temporarily set sales_end_at to past for vipTicket
      await pool.query(`UPDATE ticket_types SET sale_end_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [vipTicket.id]);
      
      let expiredReserveRes = null;
      let expiredReserveStatus = null;
      await eventController.reserveTickets(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: { tickets: [{ ticketTypeId: vipTicket.id, quantity: 1 }] }
        },
        {
          status: (c) => { expiredReserveStatus = c; return { json: (d) => { expiredReserveRes = d; } }; },
          json: (d) => { expiredReserveStatus = 200; expiredReserveRes = d; }
        }
      );

      if (expiredReserveStatus === 400 || expiredReserveRes?.error?.toLowerCase().includes('ended')) {
        pass('reserveTickets blocks expired ticket tier');
      } else {
        fail(
          'reserveTickets sales window enforcement',
          `Allowed reservation on expired ticket! Status: ${expiredReserveStatus}, Response: ${JSON.stringify(expiredReserveRes)}`
        );
      }

      // Restore sale_end_at
      await pool.query(`UPDATE ticket_types SET sale_end_at = $1 WHERE id = $2`, [salesEndDate.toISOString(), vipTicket.id]);
    }

    // -------------------------------------------------------------
    // SECTION 7: FREE REGISTRATION & GENDER RESTRICTIONS AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Free Registration & Gender Restriction Audit ---');

    if (testEventId) {
      const ticketsRes = await pool.query(`SELECT id, name, base_price, gender_restriction FROM ticket_types WHERE event_id = $1`, [testEventId]);
      const freeTicket = ticketsRes.rows.find(t => t.name === 'General Admission Free');
      const womenTicket = ticketsRes.rows.find(t => t.name === 'Women Exclusive Pass');

      // Test 7a: Male user attempts to register for Women Exclusive Pass
      let genderBlockRes = null;
      let genderBlockStatus = null;
      await eventController.registerForEvent(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: {
            tickets: [{ ticketTypeId: womenTicket.id, quantity: 1 }]
          }
        },
        {
          status: (c) => { genderBlockStatus = c; return { json: (d) => { genderBlockRes = d; } }; },
          json: (d) => { genderBlockStatus = 200; genderBlockRes = d; }
        }
      );

      if (genderBlockStatus === 400 && genderBlockRes?.error?.toLowerCase().includes('female')) {
        pass('registerForEvent blocks male user from buying female-restricted ticket');
      } else {
        fail('registerForEvent gender restriction', `Expected block, got ${genderBlockStatus}: ${JSON.stringify(genderBlockRes)}`);
      }

      // Test 7b: Male user registers for Free ticket
      let freeRegRes = null;
      let freeRegStatus = null;
      await eventController.registerForEvent(
        {
          user: { id: testMemberId, type: 'member' },
          params: { eventId: testEventId },
          body: {
            tickets: [{ ticketTypeId: freeTicket.id, quantity: 1 }],
            totalAmount: 0
          }
        },
        {
          status: (c) => { freeRegStatus = c; return { json: (d) => { freeRegRes = d; } }; },
          json: (d) => { freeRegStatus = 200; freeRegRes = d; }
        }
      );

      if (freeRegStatus === 200 && freeRegRes?.success) {
        pass('registerForEvent successfully registered free ticket');
        
        // Verify sold_count incremented
        const checkSold = await pool.query(`SELECT sold_count FROM ticket_types WHERE id = $1`, [freeTicket.id]);
        if (checkSold.rows[0].sold_count === 1) {
          pass('Free ticket sold_count incremented to 1');
        } else {
          fail('Free ticket sold_count increment', `Expected 1, got ${checkSold.rows[0].sold_count}`);
        }

        // Test 7c: Duplicate registration prevention
        let dupRegRes = null;
        let dupRegStatus = null;
        await eventController.registerForEvent(
          {
            user: { id: testMemberId, type: 'member' },
            params: { eventId: testEventId },
            body: {
              tickets: [{ ticketTypeId: freeTicket.id, quantity: 1 }],
              totalAmount: 0
            }
          },
          {
            status: (c) => { dupRegStatus = c; return { json: (d) => { dupRegRes = d; } }; },
            json: (d) => { dupRegStatus = 200; dupRegRes = d; }
          }
        );

        if (dupRegStatus === 400 && dupRegRes?.error?.toLowerCase().includes('already registered')) {
          pass('registerForEvent prevents duplicate registrations');
        } else {
          fail('registerForEvent duplicate prevention', `Expected already registered error, got ${dupRegStatus}: ${JSON.stringify(dupRegRes)}`);
        }

        // Test 7d: Check user registration in getMyEvents
        let myEventsRes = null;
        let myEventsStatus = null;
        await eventController.getMyEvents(
          {
            user: { id: testMemberId, type: 'member' }
          },
          {
            status: (c) => { myEventsStatus = c; return { json: (d) => { myEventsRes = d; } }; },
            json: (d) => { myEventsStatus = 200; myEventsRes = d; }
          }
        );

        if (myEventsStatus === 200 && myEventsRes?.events?.some(e => e.id === testEventId)) {
          pass('getMyEvents includes registered event');
        } else {
          fail('getMyEvents lookup', `Registered event ${testEventId} not found in user events`);
        }

        // Test 7e: Check QR Code and getMyTicket
        let myTicketRes = null;
        let myTicketStatus = null;
        await eventController.getMyTicket(
          {
            user: { id: testMemberId, type: 'member' },
            params: { eventId: testEventId }
          },
          {
            status: (c) => { myTicketStatus = c; return { json: (d) => { myTicketRes = d; } }; },
            json: (d) => { myTicketStatus = 200; myTicketRes = d; }
          }
        );

        if (myTicketStatus === 200 && myTicketRes?.ticket?.qr_code) {
          pass('getMyTicket returned valid ticket with qr_code');
        } else {
          fail('getMyTicket', `Failed to retrieve ticket or missing qr_code: ${JSON.stringify(myTicketRes)}`);
        }

      } else {
        fail('registerForEvent free execution', freeRegRes?.error || `Status: ${freeRegStatus}`);
      }
    }

    // -------------------------------------------------------------
    // SECTION 8: DISCOVER & SEARCH EVENTS AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Discover & Search Events Audit ---');

    let discoverRes = null;
    let discoverStatus = null;
    await eventController.discoverEvents(
      {
        user: { id: testMemberId, type: 'member' },
        query: { limit: 10 }
      },
      {
        status: (c) => { discoverStatus = c; return { json: (d) => { discoverRes = d; } }; },
        json: (d) => { discoverStatus = 200; discoverRes = d; }
      }
    );

    if (discoverStatus === 200 && Array.isArray(discoverRes?.events)) {
      pass(`discoverEvents returned ${discoverRes.events.length} events`);
    } else {
      fail('discoverEvents execution', discoverRes?.error || `Status: ${discoverStatus}`);
    }

    let searchRes = null;
    let searchStatus = null;
    await eventController.searchEvents(
      {
        user: { id: testMemberId, type: 'member' },
        query: { q: 'Grand Festival' }
      },
      {
        status: (c) => { searchStatus = c; return { json: (d) => { searchRes = d; } }; },
        json: (d) => { searchStatus = 200; searchRes = d; }
      }
    );

    if (searchStatus === 200 && searchRes?.events?.some(e => e.id === testEventId)) {
      pass('searchEvents found event by title query');
    } else {
      fail('searchEvents query match', `Failed to find event ${testEventId} with search query 'Grand Festival'`);
    }

    // -------------------------------------------------------------
    // SECTION 9: EVENT UPDATE & TICKET EDITING AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 9: Event Update Flow Audit ---');

    if (testEventId) {
      const ticketsRes = await pool.query(`SELECT id, name FROM ticket_types WHERE event_id = $1`, [testEventId]);
      const freeTicket = ticketsRes.rows.find(t => t.name === 'General Admission Free');
      const vipTicket = ticketsRes.rows.find(t => t.name === 'VIP Experience Paid');

      let updateRes = null;
      let updateStatus = null;

      // Update event title and change ticket details
      await eventController.updateEvent(
        {
          app: { locals: { pool } },
          user: { id: testCommunityId, type: 'community' },
          params: { eventId: testEventId },
          body: {
            title: 'Audit Grand Festival - Updated',
            ticket_types: [
              {
                id: freeTicket.id,
                name: 'General Admission Free (Updated)',
                base_price: 0,
                total_quantity: 120,
                // Test frontend field naming on update:
                sales_start_date: salesStartDate.toISOString(),
                sales_end_date: salesEndDate.toISOString()
              },
              {
                id: vipTicket.id,
                name: 'VIP Experience Paid',
                base_price: 599, // price changed
                total_quantity: 40,
                sales_start_date: salesStartDate.toISOString(),
                sales_end_date: salesEndDate.toISOString()
              },
              {
                // New ticket added on update
                name: 'Late Bird Special',
                base_price: 350,
                total_quantity: 25,
                sales_start_date: salesStartDate.toISOString(),
                sales_end_date: salesEndDate.toISOString()
              }
            ]
          }
        },
        {
          status: (c) => { updateStatus = c; return { json: (d) => { updateRes = d; } }; },
          json: (d) => { updateStatus = 200; updateRes = d; }
        }
      );

      if (updateStatus === 200 && updateRes?.event?.title === 'Audit Grand Festival - Updated') {
        pass('updateEvent successfully updated title and tickets');
        
        // Verify sales dates on updated tickets
        const checkUpdatedTickets = await pool.query(
          `SELECT id, name, sale_start_at, sale_end_at, base_price FROM ticket_types WHERE event_id = $1`,
          [testEventId]
        );

        for (const ut of checkUpdatedTickets.rows) {
          if (ut.sale_start_at === null || ut.sale_end_at === null) {
            fail(
              `updateEvent ticket '${ut.name}' sales dates`,
              `Lost sales dates on update! sale_start_at: ${ut.sale_start_at}, sale_end_at: ${ut.sale_end_at}`
            );
          } else {
            pass(`updateEvent ticket '${ut.name}' sales dates`, `Persisted: ${ut.sale_start_at}`);
          }
        }
      } else {
        fail('updateEvent execution', updateRes?.error || `Status: ${updateStatus}`);
      }
    }

  } catch (err) {
    fail('Global Audit Failure', err);
  } finally {
    // -------------------------------------------------------------
    // SECTION 10: CLEANUP TEST DATA
    // -------------------------------------------------------------
    console.log('\n--- Section 10: Cleaning up audit test fixtures ---');
    try {
      if (testEventId) {
        await pool.query(`DELETE FROM event_verifications WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM ticket_reservations WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_registrations WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM discount_codes WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM pricing_rules WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_banners WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_gallery WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_highlights WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_featured_accounts WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM event_things_to_know WHERE event_id = $1`, [testEventId]);
        await pool.query(`DELETE FROM events WHERE id = $1`, [testEventId]);
        pass('Cleaned up test event and related data');
      }
      if (testMemberId) {
        await pool.query(`DELETE FROM members WHERE id = $1`, [testMemberId]);
      }
      if (testMemberFemaleId) {
        await pool.query(`DELETE FROM members WHERE id = $1`, [testMemberFemaleId]);
      }
      if (testCommunityId) {
        await pool.query(`DELETE FROM communities WHERE id = $1`, [testCommunityId]);
      }
      pass('Cleaned up test members and community');
    } catch (cleanErr) {
      warn('Cleanup error', cleanErr.message);
    }

    console.log('\n======================================================');
    console.log(`AUDIT COMPLETE: ${results.passed.length} Passed, ${results.failed.length} Failed, ${results.warnings.length} Warnings`);
    console.log('======================================================\n');

    await pool.end();
  }
}

runAudit();
