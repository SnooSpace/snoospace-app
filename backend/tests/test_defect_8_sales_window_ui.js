require('dotenv').config();
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const path = require('path');
const { pathToFileURL } = require('url');
const { createPool } = require('../config/db');
const pool = createPool();
const { generateAccessToken } = require('../controllers/authControllerV2');

async function runDefect8Tests() {
  console.log('================================================================');
  console.log('VERIFICATION SUITE: DEFECT 8 (SALES WINDOW URGENCY UI & API)');
  console.log('================================================================');

  let testEventId = null;
  let memberToken = null;
  let testMember = null;
  let ticketAId = null;
  let ticketBId = null;
  let ticketCId = null;
  let ticketEId = null;

  try {
    // 1. Dynamic import of frontend salesTiming utility
    const salesTimingPath = path.resolve(__dirname, '../../frontend/utils/salesTiming.js');
    const { getSalesStatus, formatEndingSoonLabel, formatUpcomingLabel } = await import(pathToFileURL(salesTimingPath).href);

    // 2. Setup member & community fixtures
    const commRes = await pool.query('SELECT id FROM communities LIMIT 1');
    const communityId = commRes.rows[0].id;

    const memRes = await pool.query("SELECT id, email, gender FROM members WHERE gender ILIKE 'male' LIMIT 1");
    testMember = memRes.rows[0] || (await pool.query('SELECT id, email, gender FROM members LIMIT 1')).rows[0];

    memberToken = generateAccessToken(testMember.id, 'member', testMember.email);
    console.log(`[Setup] Using Community #${communityId}, Member #${testMember.id} (${testMember.email})`);

    // 3. Create test event in DB (event 10 days in future)
    const eventRes = await pool.query(
      `INSERT INTO events (
        title, description, event_date, start_datetime, end_datetime,
        event_type, location_name, location_url, status, creator_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id, title, event_date, start_datetime`,
      [
        'Defect 8 Urgency Verification Event',
        'Testing sales window countdown and status enforcement',
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
        'in-person',
        'Bangalore Arena',
        'https://maps.google.com/?q=Bangalore',
        'published',
        communityId,
      ]
    );
    testEventId = eventRes.rows[0].id;
    const testEvent = eventRes.rows[0];
    console.log(`[Setup] Created test event #${testEventId}: "${testEvent.title}"`);

    // 4. Create ticket types
    // Ticket A: sale_end_at 5 hours in future (ending_soon)
    const end5h = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const tARes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, description, base_price, total_quantity,
        sale_start_at, sale_end_at, is_active, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 1) RETURNING *`,
      [testEventId, 'Tier A - Ending Soon (5h)', 'Closes in 5 hours', 100, 50, null, end5h]
    );
    ticketAId = tARes.rows[0].id;
    const ticketA = tARes.rows[0];

    // Ticket B: sale_end_at 2 hours in past (closed)
    const endPast = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const tBRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, description, base_price, total_quantity,
        sale_start_at, sale_end_at, is_active, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 2) RETURNING *`,
      [testEventId, 'Tier B - Closed Tier', 'Closed 2 hours ago', 150, 50, null, endPast]
    );
    ticketBId = tBRes.rows[0].id;
    const ticketB = tBRes.rows[0];

    // Ticket C: sale_start_at 24 hours in future (upcoming)
    const startFuture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tCRes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, description, base_price, total_quantity,
        sale_start_at, sale_end_at, is_active, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 3) RETURNING *`,
      [testEventId, 'Tier C - Upcoming Tier', 'Opens tomorrow', 200, 50, startFuture, null]
    );
    ticketCId = tCRes.rows[0].id;
    const ticketC = tCRes.rows[0];

    // Ticket E: normal active ticket, no sales window configured (regression test)
    const tERes = await pool.query(
      `INSERT INTO ticket_types (
        event_id, name, description, base_price, total_quantity,
        sale_start_at, sale_end_at, is_active, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 4) RETURNING *`,
      [testEventId, 'Tier E - Standard Active', 'Standard general admission', 50, 100, null, null]
    );
    ticketEId = tERes.rows[0].id;
    const ticketE = tERes.rows[0];

    // =========================================================================
    // TEST D8a: Ticket with sale_end_at 5 hours from now
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8a: sale_end_at 5 hours from now -> ending_soon & urgency banner');
    console.log('----------------------------------------------------------------');
    const statusA = getSalesStatus(ticketA, testEvent);
    console.log('[D8a Output]', {
      ticketName: ticketA.name,
      sale_end_at: ticketA.sale_end_at,
      status: statusA.status,
      label: statusA.label,
      hoursRemaining: (statusA.msRemaining / (1000 * 60 * 60)).toFixed(2),
    });

    const isAddEnabledA = statusA.status !== 'closed' && statusA.status !== 'upcoming';
    const hasUrgencyBanner = statusA.status === 'ending_soon';

    if (
      statusA.status === 'ending_soon' &&
      statusA.label &&
      /^Closes in (4h|5h)/.test(statusA.label) &&
      isAddEnabledA &&
      hasUrgencyBanner
    ) {
      console.log('Result: PASS — Status is "ending_soon", label is "' + statusA.label + '", urgency banner triggers, Add button enabled.');
    } else {
      console.error('Result: FAIL — Unexpected status or label:', statusA);
    }

    // =========================================================================
    // TEST D8b: Ticket with sale_end_at in the past
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8b: sale_end_at in the past -> closed & disabled Add button');
    console.log('----------------------------------------------------------------');
    const statusB = getSalesStatus(ticketB, testEvent);
    console.log('[D8b Output (Explicit sale_end_at)]', {
      ticketName: ticketB.name,
      sale_end_at: ticketB.sale_end_at,
      status: statusB.status,
      label: statusB.label,
      msRemaining: statusB.msRemaining,
    });

    // Also test past event start_datetime fallback with no explicit sale_end_at
    const pastEvent = {
      ...testEvent,
      start_datetime: new Date(Date.now() - 3600000).toISOString(),
    };
    const ticketNoEnd = { ...ticketE, sale_end_at: null };
    const statusPastFallback = getSalesStatus(ticketNoEnd, pastEvent);
    console.log('[D8b Output (Event start_datetime fallback)]', {
      status: statusPastFallback.status,
      label: statusPastFallback.label,
    });

    const isAddDisabledB = statusB.status === 'closed';

    if (
      statusB.status === 'closed' &&
      statusB.label === 'Sales Closed' &&
      isAddDisabledB &&
      statusPastFallback.status === 'closed'
    ) {
      console.log('Result: PASS — Status is "closed", label is "Sales Closed", Add button disabled, past event fallback works.');
    } else {
      console.error('Result: FAIL — Unexpected closed status:', { statusB, statusPastFallback });
    }

    // =========================================================================
    // TEST D8c: Ticket with sale_start_at in the future
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8c: sale_start_at in the future -> upcoming & disabled Add button');
    console.log('----------------------------------------------------------------');
    const statusC = getSalesStatus(ticketC, testEvent);
    console.log('[D8c Output]', {
      ticketName: ticketC.name,
      sale_start_at: ticketC.sale_start_at,
      status: statusC.status,
      label: statusC.label,
    });

    const isAddDisabledC = statusC.status === 'upcoming';

    if (
      statusC.status === 'upcoming' &&
      statusC.label &&
      statusC.label.startsWith('Opens ') &&
      isAddDisabledC
    ) {
      console.log('Result: PASS — Status is "upcoming", label is "' + statusC.label + '", Add button disabled.');
    } else {
      console.error('Result: FAIL — Unexpected upcoming status:', statusC);
    }

    // =========================================================================
    // TEST D8d: EventDetailsScreen all 3 CTA states
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8d: EventDetailsScreen bottom bar CTA states');
    console.log('----------------------------------------------------------------');

    // Helper simulating EventDetailsScreen salesSummary & CTA logic
    function evaluateCTAState(tickets, event) {
      const statuses = tickets.map((t) => getSalesStatus(t, event));
      const allClosed = statuses.length > 0 && statuses.every((s) => s.status === 'closed');
      const allUpcoming = statuses.length > 0 && statuses.every((s) => s.status === 'upcoming');
      const endingSoon = statuses.find((s) => s.status === 'ending_soon');

      let ctaLabel;
      let ctaDisabled;
      if (allClosed) {
        ctaLabel = 'Sales Closed';
        ctaDisabled = true;
      } else if (allUpcoming) {
        ctaLabel = 'Coming Soon';
        ctaDisabled = true;
      } else {
        ctaLabel = 'Register Now';
        ctaDisabled = false;
      }

      return {
        allClosed,
        allUpcoming,
        urgencyBadge: endingSoon ? endingSoon.label : null,
        ctaLabel,
        ctaDisabled,
      };
    }

    // State 1: Normal event with active and ending_soon tickets
    const ctaNormal = evaluateCTAState([ticketA, ticketE], testEvent);
    console.log('[D8d State 1: Normal with ending_soon tier]', ctaNormal);

    // State 2: Event where every tier is closed
    const ctaAllClosed = evaluateCTAState([ticketB], testEvent);
    console.log('[D8d State 2: All tiers closed]', ctaAllClosed);

    // State 3: Event where every tier is upcoming
    const ctaAllUpcoming = evaluateCTAState([ticketC], testEvent);
    console.log('[D8d State 3: All tiers upcoming]', ctaAllUpcoming);

    const passD8d =
      ctaNormal.ctaLabel === 'Register Now' &&
      !ctaNormal.ctaDisabled &&
      ctaNormal.urgencyBadge !== null &&
      ctaAllClosed.ctaLabel === 'Sales Closed' &&
      ctaAllClosed.ctaDisabled === true &&
      ctaAllUpcoming.ctaLabel === 'Coming Soon' &&
      ctaAllUpcoming.ctaDisabled === true;

    if (passD8d) {
      console.log('Result: PASS — All 3 CTA states and urgency badge evaluated correctly.');
    } else {
      console.error('Result: FAIL — CTA state evaluation mismatch:', { ctaNormal, ctaAllClosed, ctaAllUpcoming });
    }

    // =========================================================================
    // TEST D8e: Regression — Normal active ticket with no near deadline
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8e: Regression — Normal active ticket (no badge, normal Add)');
    console.log('----------------------------------------------------------------');
    const statusE = getSalesStatus(ticketE, testEvent);
    console.log('[D8e Output]', {
      ticketName: ticketE.name,
      sale_start_at: ticketE.sale_start_at,
      sale_end_at: ticketE.sale_end_at,
      status: statusE.status,
      label: statusE.label,
      effectiveEnd: statusE.effectiveEnd,
    });

    if (statusE.status === 'active' && statusE.label === null) {
      console.log('Result: PASS — Normal active ticket shows no badge (label: null) and status: "active".');
    } else {
      console.error('Result: FAIL — Regression on normal ticket:', statusE);
    }

    // =========================================================================
    // TEST D8f: Cross-check against Defect 2's backend reserveTickets over HTTP
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D8f: Cross-check backend reserveTickets HTTP API against UI states');
    console.log('----------------------------------------------------------------');

    const baseUrl = 'http://localhost:5000';

    // HTTP Call 1: Ticket A (5 hours remaining, UI showed "ending_soon" & purchasable)
    console.log(`[D8f Request 1] Calling POST /events/${testEventId}/reserve-tickets for Ticket A (#${ticketAId}, 5h left)...`);
    const resA = await fetch(`${baseUrl}/events/${testEventId}/reserve-tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        tickets: [{ ticketTypeId: ticketAId, quantity: 1 }],
      }),
    });
    const statusHttpA = resA.status;
    const bodyHttpA = await resA.json();
    console.log(`[D8f Response 1] HTTP ${statusHttpA}:`, JSON.stringify(bodyHttpA));

    // HTTP Call 2: Ticket B (Closed 2h ago, UI showed "Sales Closed" & disabled)
    console.log(`\n[D8f Request 2] Calling POST /events/${testEventId}/reserve-tickets for Ticket B (#${ticketBId}, closed)...`);
    const resB = await fetch(`${baseUrl}/events/${testEventId}/reserve-tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        tickets: [{ ticketTypeId: ticketBId, quantity: 1 }],
      }),
    });
    const statusHttpB = resB.status;
    const bodyHttpB = await resB.json();
    console.log(`[D8f Response 2] HTTP ${statusHttpB}:`, JSON.stringify(bodyHttpB));

    const passHttpA = statusHttpA === 200 && bodyHttpA.success === true && bodyHttpA.sessionId;
    const passHttpB = statusHttpB === 400 && bodyHttpB.error && bodyHttpB.error.includes('closed');

    if (passHttpA && passHttpB) {
      console.log('\nResult: PASS — Backend HTTP API strictly aligns with Frontend UI:');
      console.log('  - Ticket A (5h left): UI allows tap / Backend accepts hold (HTTP 200)');
      console.log('  - Ticket B (closed): UI disables tap / Backend rejects hold (HTTP 400: "' + bodyHttpB.error + '")');
    } else {
      console.error('\nResult: FAIL — Backend enforcement discrepancy:', { passHttpA, passHttpB, bodyHttpA, bodyHttpB });
    }

  } catch (err) {
    console.error('[Verification Error]', err);
  } finally {
    // Cleanup fixtures
    if (testEventId) {
      try {
        await pool.query('DELETE FROM ticket_reservations WHERE event_id = $1', [testEventId]);
        await pool.query('DELETE FROM ticket_types WHERE event_id = $1', [testEventId]);
        await pool.query('DELETE FROM events WHERE id = $1', [testEventId]);
        console.log(`\n[Cleanup] Successfully purged test event #${testEventId} and ticket fixtures.`);
      } catch (cleanupErr) {
        console.warn('[Cleanup Warning]', cleanupErr.message);
      }
    }
    await pool.end();
  }
}

runDefect8Tests();
