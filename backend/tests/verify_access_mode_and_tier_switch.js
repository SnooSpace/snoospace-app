const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');

const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

function logSection(title) {
  console.log(`\n================================================================`);
  console.log(`[SUITE] ${title}`);
  console.log(`================================================================`);
}

function logHttp(label, method, urlPath, reqBody, status, resBody, extra = null) {
  console.log(`\n--- [HTTP CALL] ${label} ---`);
  console.log(`REQUEST:  ${method} ${urlPath}`);
  if (reqBody !== null && reqBody !== undefined) {
    console.log(`PAYLOAD:  ${JSON.stringify(reqBody, null, 2)}`);
  }
  console.log(`STATUS:   ${status}`);
  if (extra) {
    console.log(`EXTRA:    ${JSON.stringify(extra, null, 2)}`);
  }
  console.log(`RESPONSE: ${typeof resBody === 'object' ? JSON.stringify(resBody, null, 2) : resBody}`);
}

async function apiRequest(tokenOrUser, method, urlPath, body = null, redirect = 'follow') {
  let token = null;
  if (typeof tokenOrUser === 'string') {
    token = tokenOrUser;
  } else if (tokenOrUser && tokenOrUser.id) {
    token = generateAccessToken(tokenOrUser.id, tokenOrUser.type || 'member', tokenOrUser.email);
  }

  const url = `${API_BASE}${urlPath}`;
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const opt = {
    method,
    headers,
    redirect,
  };
  if (body) opt.body = JSON.stringify(body);

  const res = await fetch(url, opt);
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

async function runTests() {
  console.log('Starting Access-Mode & Tier-Switching Verification Suite (TEST H1 - H14)');
  console.log('Target API:', API_BASE);
  console.log('Timestamp:', new Date().toISOString());

  const results = {};
  let testEventId = null;
  let inPersonTierId = null;
  let virtualTierId = null;
  let bothTierId = null;
  let communityUser = null;
  let member1 = null;
  let member2 = null;
  let member3 = null;
  let member4 = null;
  let member5 = null;
  let member6 = null;

  try {
    // 0. Setup test users
    const commRes = await pool.query('SELECT id, name, email FROM communities LIMIT 1');
    if (commRes.rows.length === 0) throw new Error('No community found');
    communityUser = { ...commRes.rows[0], type: 'community' };

    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 10');
    if (memRes.rows.length < 6) throw new Error('Need at least 6 members');
    member1 = { ...memRes.rows[0], type: 'member' };
    member2 = { ...memRes.rows[1], type: 'member' };
    member3 = { ...memRes.rows[2], type: 'member' };
    member4 = { ...memRes.rows[3], type: 'member' };
    member5 = { ...memRes.rows[4], type: 'member' };
    member6 = { ...memRes.rows[5], type: 'member' };

    console.log(`Community user: #${communityUser.id} (${communityUser.name})`);
    console.log(`Test members: #${member1.id}, #${member2.id}, #${member3.id}, #${member4.id}, #${member5.id}, #${member6.id}`);

    const now = new Date();
    const eventStart = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const eventEnd = new Date(eventStart.getTime() + 4 * 3600 * 1000);

    // =========================================================================
    // TEST H1: Create hybrid event with all 3 access_modes & round-trip edit
    // =========================================================================
    logSection('TEST H1: Create Hybrid Event with 3 access_modes & Round-Trip Edit');
    {
      const createPayload = {
        title: `Hybrid Verification Event ${Date.now()}`,
        description: 'Testing access_mode persistence and tier switching',
        event_date: eventStart.toISOString().split('T')[0],
        start_datetime: eventStart.toISOString(),
        end_datetime: eventEnd.toISOString(),
        event_type: 'hybrid',
        location_name: 'SnooSpace Grand Arena',
        location_url: 'https://maps.google.com/?q=SnooSpace+Arena',
        virtual_link: 'https://meet.google.com/test-snoo-xyz',
        meeting_platform: 'Google Meet',
        allow_tier_switching: true,
        allow_downgrade_refunds: true,
        ticket_types: [
          {
            name: 'In-Person Pass',
            description: 'Physical venue access only',
            base_price: 100.00,
            total_quantity: 100,
            access_mode: 'in_person',
          },
          {
            name: 'Virtual Pass',
            description: 'Online streaming access only',
            base_price: 50.00,
            total_quantity: 100,
            access_mode: 'virtual',
          },
          {
            name: 'VIP All-Access',
            description: 'Both physical venue and online stream',
            base_price: 150.00,
            total_quantity: 100,
            access_mode: 'both',
          },
        ],
      };

      const res = await apiRequest(communityUser, 'POST', '/events', createPayload);
      logHttp('H1: Create Hybrid Event', 'POST', '/events', createPayload, res.status, res.data);

      if (res.status !== 201 && res.status !== 200) {
        throw new Error(`Failed to create event: ${JSON.stringify(res.data)}`);
      }

      testEventId = res.data.event?.id || res.data.id;

      // Verify DB persistence of event flags
      const eventDb = await pool.query(
        'SELECT id, title, event_type, allow_tier_switching, allow_downgrade_refunds, virtual_link FROM events WHERE id = $1',
        [testEventId]
      );
      console.log('DB Event Row:', eventDb.rows[0]);

      // Verify DB persistence of ticket tiers access_mode
      const tiersDb = await pool.query(
        'SELECT id, name, base_price, total_quantity, access_mode FROM ticket_types WHERE event_id = $1 ORDER BY base_price ASC',
        [testEventId]
      );
      console.log('DB Ticket Tiers:', tiersDb.rows);

      const vTier = tiersDb.rows.find(t => t.access_mode === 'virtual');
      const ipTier = tiersDb.rows.find(t => t.access_mode === 'in_person');
      const bTier = tiersDb.rows.find(t => t.access_mode === 'both');

      virtualTierId = vTier.id;
      inPersonTierId = ipTier.id;
      bothTierId = bTier.id;

      // Edit event round-trip via PATCH
      const updatePayload = {
        title: `${createPayload.title} (Updated)`,
        event_type: 'hybrid',
        allow_tier_switching: true,
        allow_downgrade_refunds: true,
        ticket_types: tiersDb.rows.map(t => ({
          id: t.id,
          name: t.name,
          base_price: t.base_price,
          total_quantity: t.total_quantity,
          access_mode: t.access_mode,
        })),
      };
      const updateRes = await apiRequest(communityUser, 'PATCH', `/events/${testEventId}`, updatePayload);
      logHttp('H1: Update Event Round-Trip', 'PATCH', `/events/${testEventId}`, updatePayload, updateRes.status, updateRes.data);

      const getRes = await apiRequest(communityUser, 'GET', `/events/${testEventId}`);
      const fetchedEvent = getRes.data?.event || getRes.data;
      logHttp('H1: Fetch Updated Event', 'GET', `/events/${testEventId}`, null, getRes.status, {
        allow_tier_switching: fetchedEvent?.allow_tier_switching,
        allow_downgrade_refunds: fetchedEvent?.allow_downgrade_refunds,
        ticket_types: fetchedEvent?.ticket_types?.map(t => ({ id: t.id, name: t.name, access_mode: t.access_mode })),
      });

      const passH1 =
        eventDb.rows[0].allow_tier_switching === true &&
        eventDb.rows[0].allow_downgrade_refunds === true &&
        vTier && ipTier && bTier &&
        fetchedEvent?.allow_tier_switching === true &&
        fetchedEvent?.ticket_types.every(t => ['in_person', 'virtual', 'both'].includes(t.access_mode));

      results['H1'] = passH1 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H1: ${results['H1']}`);
    }

    // Helper to create a confirmed registration
    async function createTestRegistration(member, tierId, tierName, price) {
      const qrHash = require('crypto').randomBytes(16).toString('hex');
      const regRes = await pool.query(
        `INSERT INTO event_registrations (
          event_id, member_id, registration_status, qr_code_hash, created_at
        ) VALUES ($1, $2, 'registered', $3, NOW())
        RETURNING id, qr_code_hash, registration_status`,
        [testEventId, member.id, qrHash]
      );
      const reg = regRes.rows[0];
      // Canonical full QR code string for client scanner
      reg.fullQrData = `SNOO-E${testEventId}-R${reg.id}-${qrHash}`;

      await pool.query(
        `INSERT INTO registration_tickets (
          registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, 1, $4, $4)`,
        [reg.id, tierId, tierName, price]
      );

      await pool.query(
        `UPDATE ticket_types SET sold_count = sold_count + 1 WHERE id = $1`,
        [tierId]
      );

      return reg;
    }

    // Seed registrations
    const regVirtual = await createTestRegistration(member1, virtualTierId, 'Virtual Pass', 50.00);
    const regInPerson = await createTestRegistration(member2, inPersonTierId, 'In-Person Pass', 100.00);
    const regBoth = await createTestRegistration(member3, bothTierId, 'VIP All-Access', 150.00);

    // =========================================================================
    // TEST H2: Attempt to check in a virtual-only ticket at verifyTicket
    // =========================================================================
    logSection('TEST H2: VerifyTicket Physical Gating on Virtual-Only Ticket');
    {
      const verifyPayload = { qrData: regVirtual.fullQrData };
      const res = await apiRequest(communityUser, 'POST', `/events/${testEventId}/verify-ticket`, verifyPayload);
      logHttp('H2: Check In Virtual-Only Ticket', 'POST', `/events/${testEventId}/verify-ticket`, verifyPayload, res.status, res.data);

      const passH2 =
        res.status === 400 &&
        res.data?.error === 'This ticket is virtual-only and cannot be checked in at the venue.';

      // Confirm DB was NOT marked checked in
      const checkDb = await pool.query(
        'SELECT registration_status, checked_in_at FROM event_registrations WHERE id = $1',
        [regVirtual.id]
      );
      console.log('DB State after verifyTicket attempt:', checkDb.rows[0]);

      results['H2'] = (passH2 && checkDb.rows[0].checked_in_at === null) ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H2: ${results['H2']}`);
    }

    // =========================================================================
    // TEST H3: getMyTicket for virtual-only (no location) & in-person-only (no virtual/join)
    // =========================================================================
    logSection('TEST H3: getMyTicket Information Gating (Virtual vs In-Person)');
    {
      // Virtual-only ticket (Member 1)
      const resV = await apiRequest(member1, 'GET', `/events/${testEventId}/my-ticket`);
      logHttp('H3: Virtual Pass getMyTicket', 'GET', `/events/${testEventId}/my-ticket`, null, resV.status, {
        accessMode: resV.data?.ticket?.accessMode,
        locationUrl: resV.data?.ticket?.locationUrl,
        locationName: resV.data?.ticket?.locationName,
        virtualLink: resV.data?.ticket?.virtualLink,
        joinUrl: resV.data?.ticket?.joinUrl,
      });

      // In-person-only ticket (Member 2)
      const resIP = await apiRequest(member2, 'GET', `/events/${testEventId}/my-ticket`);
      logHttp('H3: In-Person Pass getMyTicket', 'GET', `/events/${testEventId}/my-ticket`, null, resIP.status, {
        accessMode: resIP.data?.ticket?.accessMode,
        locationUrl: resIP.data?.ticket?.locationUrl,
        locationName: resIP.data?.ticket?.locationName,
        virtualLink: resIP.data?.ticket?.virtualLink,
        joinUrl: resIP.data?.ticket?.joinUrl,
      });

      const vTicket = resV.data?.ticket;
      const ipTicket = resIP.data?.ticket;

      const vOk =
        vTicket &&
        vTicket.accessMode === 'virtual' &&
        vTicket.locationUrl === null &&
        vTicket.locationName === null &&
        vTicket.joinUrl &&
        vTicket.joinUrl.includes('/join/');

      const ipOk =
        ipTicket &&
        ipTicket.accessMode === 'in_person' &&
        ipTicket.locationName !== null &&
        ipTicket.virtualLink === null &&
        ipTicket.joinUrl === null;

      results['H3'] = (vOk && ipOk) ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H3: ${results['H3']}`);
    }

    // =========================================================================
    // TEST H4: getMyTicket for 'both' ticket returns all fields + signed joinUrl
    // =========================================================================
    logSection('TEST H4: getMyTicket for Both (Hybrid) Tier');
    let signedJoinUrlForBoth = null;
    {
      const resBoth = await apiRequest(member3, 'GET', `/events/${testEventId}/my-ticket`);
      const bTicket = resBoth.data?.ticket;
      signedJoinUrlForBoth = bTicket?.joinUrl;

      logHttp('H4: Both Pass getMyTicket', 'GET', `/events/${testEventId}/my-ticket`, null, resBoth.status, {
        accessMode: bTicket?.accessMode,
        locationName: bTicket?.locationName,
        locationUrl: bTicket?.locationUrl,
        virtualLink: bTicket?.virtualLink,
        joinUrl: bTicket?.joinUrl,
      });

      const passH4 =
        bTicket &&
        bTicket.accessMode === 'both' &&
        bTicket.locationName !== null &&
        bTicket.joinUrl &&
        bTicket.joinUrl.includes('/join/') &&
        !bTicket.joinUrl.includes('meet.google.com') && // must NOT leak raw link
        bTicket.virtualLink === bTicket.joinUrl;

      results['H4'] = passH4 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H4: ${results['H4']}`);
    }

    // =========================================================================
    // TEST H5: Attempt to reserve virtual + in-person in same cart
    // =========================================================================
    logSection('TEST H5: Block Mixed Access-Mode in Single Cart');
    {
      const mixedPayload = {
        tickets: [
          { ticketTypeId: virtualTierId, quantity: 1 },
          { ticketTypeId: inPersonTierId, quantity: 1 },
        ],
      };
      const res = await apiRequest(member4, 'POST', `/events/${testEventId}/reserve-tickets`, mixedPayload);
      logHttp('H5: Reserve Mixed Tickets', 'POST', `/events/${testEventId}/reserve-tickets`, mixedPayload, res.status, res.data);

      const passH5 =
        res.status === 400 &&
        res.data?.error === 'Cannot combine virtual-only and in-person-only tickets in one order. Please purchase them separately.';

      results['H5'] = passH5 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H5: ${results['H5']}`);
    }

    // =========================================================================
    // TEST H6: GET /join/:signedToken with valid token -> 302 redirect to real link
    // =========================================================================
    logSection('TEST H6: Join-Link Route 302 Redirect with Valid Token');
    {
      // Extract signed token from signedJoinUrlForBoth
      const tokenMatch = signedJoinUrlForBoth.match(/\/join\/(.+)$/);
      const signedToken = tokenMatch ? tokenMatch[1] : null;

      const res = await apiRequest(null, 'GET', `/join/${signedToken}`, null, 'manual');
      const locationHeader = res.headers.get('location');

      logHttp('H6: Open Join URL', 'GET', `/join/${signedToken}`, null, res.status, res.data, {
        location: locationHeader,
      });

      const passH6 =
        res.status === 302 &&
        locationHeader === 'https://meet.google.com/test-snoo-xyz';

      results['H6'] = passH6 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H6: ${results['H6']}`);

      // Sub-test: Multi-ticket order combining 'both' + 'in_person' tiers
      // Confirms handleJoinRedirect's tightened query handles multi-row registration_tickets cleanly
      const multiReg = await createTestRegistration(member5, bothTierId, 'VIP All-Access', 150.00);
      // Add second ticket line item for in_person to the same registration
      await pool.query(
        `INSERT INTO registration_tickets (
          registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, 1, $4, $4)`,
        [multiReg.id, inPersonTierId, 'In-Person Pass', 100.00]
      );
      const multiToken = jwt.sign(
        {
          registrationId: multiReg.id,
          ticketTypeId: bothTierId,
          type: 'virtual_join',
        },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        { expiresIn: '2h' }
      );
      const multiRes = await apiRequest(null, 'GET', `/join/${multiToken}`, null, 'manual');
      const multiLocation = multiRes.headers.get('location');
      logHttp('H6b: Multi-Ticket Order (Both + In-Person) Join Redirect', 'GET', `/join/${multiToken}`, null, multiRes.status, multiRes.data, {
        location: multiLocation,
      });
      if (multiRes.status === 302 && multiLocation === 'https://meet.google.com/test-snoo-xyz') {
        console.log('✅ TEST H6b PASSED: Multi-ticket order (both + in_person) redirected successfully with zero query-shape anomaly');
      } else {
        console.error('❌ TEST H6b FAILED: Multi-ticket order did not redirect as expected');
      }
    }

    // =========================================================================
    // TEST H7: GET /join/:signedToken with EXPIRED token -> rejected, not redirected
    // =========================================================================
    logSection('TEST H7: Join-Link Rejection on Expired Token');
    {
      const expiredToken = jwt.sign(
        {
          registrationId: regVirtual.id,
          ticketTypeId: virtualTierId,
          type: 'virtual_join',
        },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        { expiresIn: '0s' }
      );

      const res = await apiRequest(null, 'GET', `/join/${expiredToken}`, null, 'manual');
      logHttp('H7: Open Expired Join URL', 'GET', `/join/${expiredToken}`, null, res.status, res.data);

      const passH7 =
        res.status === 400 &&
        res.data?.error &&
        res.data.error.includes('expired');

      results['H7'] = passH7 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H7: ${results['H7']}`);
    }

    // =========================================================================
    // TEST H8: GET /join/:signedToken for CANCELLED registration -> rejected
    // =========================================================================
    logSection('TEST H8: Join-Link Rejection on Cancelled Registration');
    {
      const cancelledReg = await createTestRegistration(member6, virtualTierId, 'Virtual Pass', 50.00);
      const validToken = jwt.sign(
        {
          registrationId: cancelledReg.id,
          ticketTypeId: virtualTierId,
          type: 'virtual_join',
        },
        process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        { expiresIn: '2h' }
      );

      // Now cancel registration in DB
      await pool.query(
        "UPDATE event_registrations SET registration_status = 'cancelled' WHERE id = $1",
        [cancelledReg.id]
      );

      const res = await apiRequest(null, 'GET', `/join/${validToken}`, null, 'manual');
      logHttp('H8: Open Join URL for Cancelled Registration', 'GET', `/join/${validToken}`, null, res.status, res.data);

      const passH8 =
        (res.status === 400 || res.status === 403) &&
        res.data?.error &&
        res.data.error.includes('cancelled');

      results['H8'] = passH8 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H8: ${results['H8']}`);
    }

    // =========================================================================
    // TEST H9: Tier switch — downgrade with allow_downgrade_refunds = true
    // =========================================================================
    logSection('TEST H9: Tier Switch Downgrade with Downgrade Refunds Enabled');
    {
      // Member 3 currently has VIP All-Access (₹150)
      // Switch to Virtual Pass (₹50) -> diff = -100
      const switchPayload = {
        newTicketTypeId: virtualTierId,
        quantity: 1,
      };

      const res = await apiRequest(member3, 'POST', `/events/${testEventId}/registrations/${regBoth.id}/switch-ticket`, switchPayload);
      logHttp('H9: Switch VIP to Virtual (Downgrade with Refund)', 'POST', `/events/${testEventId}/registrations/${regBoth.id}/switch-ticket`, switchPayload, res.status, res.data);

      // Verify DB ticket type updated
      const regTicketDb = await pool.query(
        'SELECT ticket_type_id, ticket_name, unit_price FROM registration_tickets WHERE registration_id = $1',
        [regBoth.id]
      );
      console.log('DB Registration Tickets Row after switch:', regTicketDb.rows[0]);

      // Verify refund_requests row created with manual_review
      const refundDb = await pool.query(
        'SELECT * FROM refund_requests WHERE registration_id = $1 ORDER BY id DESC LIMIT 1',
        [regBoth.id]
      );
      console.log('DB Refund Request Row:', refundDb.rows[0]);

      const passH9 =
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.switched === true &&
        res.data?.refundQueued === true &&
        regTicketDb.rows[0].ticket_type_id === virtualTierId &&
        refundDb.rows.length > 0 &&
        refundDb.rows[0].status === 'manual_review' &&
        parseFloat(refundDb.rows[0].requested_amount) === 100.00;

      results['H9'] = passH9 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H9: ${results['H9']}`);
    }

    // =========================================================================
    // TEST H10: Tier switch — downgrade with allow_downgrade_refunds = false
    // =========================================================================
    logSection('TEST H10: Tier Switch Downgrade with Downgrade Refunds Disabled');
    {
      // Disable allow_downgrade_refunds on event
      await pool.query('UPDATE events SET allow_downgrade_refunds = false WHERE id = $1', [testEventId]);

      // Member 2 currently has In-Person Pass (₹100)
      // Switch to Virtual Pass (₹50) -> diff = -50
      const switchPayload = {
        newTicketTypeId: virtualTierId,
        quantity: 1,
      };

      const beforeRefunds = await pool.query('SELECT COUNT(*) FROM refund_requests WHERE registration_id = $1', [regInPerson.id]);

      const res = await apiRequest(member2, 'POST', `/events/${testEventId}/registrations/${regInPerson.id}/switch-ticket`, switchPayload);
      logHttp('H10: Switch In-Person to Virtual (No Refund Allowed)', 'POST', `/events/${testEventId}/registrations/${regInPerson.id}/switch-ticket`, switchPayload, res.status, res.data);

      const afterRefunds = await pool.query('SELECT COUNT(*) FROM refund_requests WHERE registration_id = $1', [regInPerson.id]);

      // Verify DB ticket type updated
      const regTicketDb = await pool.query(
        'SELECT ticket_type_id, ticket_name FROM registration_tickets WHERE registration_id = $1',
        [regInPerson.id]
      );
      console.log('DB Registration Tickets Row after switch:', regTicketDb.rows[0]);

      const passH10 =
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.switched === true &&
        res.data?.refundQueued === false &&
        regTicketDb.rows[0].ticket_type_id === virtualTierId &&
        parseInt(beforeRefunds.rows[0].count) === parseInt(afterRefunds.rows[0].count);

      results['H10'] = passH10 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H10: ${results['H10']}`);

      // Re-enable for subsequent tests
      await pool.query('UPDATE events SET allow_downgrade_refunds = true WHERE id = $1', [testEventId]);
    }

    // =========================================================================
    // TEST H11: Tier switch — upgrade (requires payment first, blocks tamper)
    // =========================================================================
    logSection('TEST H11: Tier Switch Upgrade & Price Tampering Guard');
    {
      // Member 1 has Virtual Pass (₹50)
      // Request upgrade to In-Person Pass (₹100) -> diff = +50
      const switchPayload = {
        newTicketTypeId: inPersonTierId,
        quantity: 1,
      };

      const res = await apiRequest(member1, 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload);
      logHttp('H11: Switch Virtual to In-Person (Upgrade)', 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload, res.status, res.data);

      // Verify switch did NOT complete immediately in DB
      const checkRegTicket = await pool.query(
        'SELECT ticket_type_id FROM registration_tickets WHERE registration_id = $1',
        [regVirtual.id]
      );
      const unchangedInDb = checkRegTicket.rows[0].ticket_type_id === virtualTierId;

      // Tamper attempt: submit ₹1 instead of ₹50 to create-order
      const tamperedOrderPayload = {
        eventId: testEventId,
        isTierSwitch: true,
        registrationId: regVirtual.id,
        oldTicketTypeId: virtualTierId,
        newTicketTypeId: inPersonTierId,
        quantity: 1,
        totalAmountRupees: 1, // Tampered price
      };

      const tamperRes = await apiRequest(member1, 'POST', '/payments/create-order', tamperedOrderPayload);
      logHttp('H11: Attempt Tampered Upgrade Payment (₹1 instead of ₹50)', 'POST', '/payments/create-order', tamperedOrderPayload, tamperRes.status, tamperRes.data);

      // Legitimate order creation with ₹50
      const validOrderPayload = {
        eventId: testEventId,
        isTierSwitch: true,
        registrationId: regVirtual.id,
        oldTicketTypeId: virtualTierId,
        newTicketTypeId: inPersonTierId,
        quantity: 1,
        totalAmountRupees: 50,
      };
      const validRes = await apiRequest(member1, 'POST', '/payments/create-order', validOrderPayload);
      logHttp('H11: Legitimate Upgrade Order Creation (₹50)', 'POST', '/payments/create-order', validOrderPayload, validRes.status, validRes.data);

      const passH11 =
        res.status === 200 &&
        res.data?.requiresPayment === true &&
        res.data?.difference === 50 &&
        unchangedInDb &&
        tamperRes.status === 400 &&
        tamperRes.data?.error === 'price_mismatch' &&
        (validRes.status === 200 || validRes.status === 201) &&
        validRes.data?.orderId;

      results['H11'] = passH11 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H11: ${results['H11']}`);
    }

    // =========================================================================
    // TEST H12: Attempt tier switch after event has started -> rejected
    // =========================================================================
    logSection('TEST H12: Attempt Tier Switch After Event Started');
    {
      // Backdate start_datetime to past
      await pool.query(
        "UPDATE events SET start_datetime = NOW() - INTERVAL '2 hours', event_date = CURRENT_DATE - 1 WHERE id = $1",
        [testEventId]
      );

      const switchPayload = {
        newTicketTypeId: inPersonTierId,
        quantity: 1,
      };
      const res = await apiRequest(member1, 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload);
      logHttp('H12: Switch on Started Event', 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload, res.status, res.data);

      const passH12 =
        res.status === 400 &&
        res.data?.error &&
        res.data.error.toLowerCase().includes('already started');

      results['H12'] = passH12 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H12: ${results['H12']}`);

      // Restore event dates
      await pool.query(
        'UPDATE events SET start_datetime = $1, event_date = $2 WHERE id = $3',
        [eventStart.toISOString(), eventStart.toISOString().split('T')[0], testEventId]
      );
    }

    // =========================================================================
    // TEST H13: Attempt tier switch when events.allow_tier_switching = false -> rejected
    // =========================================================================
    logSection('TEST H13: Attempt Tier Switch When allow_tier_switching = false');
    {
      await pool.query('UPDATE events SET allow_tier_switching = false WHERE id = $1', [testEventId]);

      const switchPayload = {
        newTicketTypeId: inPersonTierId,
        quantity: 1,
      };
      const res = await apiRequest(member1, 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload);
      logHttp('H13: Switch When Disabled', 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload, res.status, res.data);

      const passH13 =
        res.status === 400 &&
        res.data?.error &&
        (res.data.error.toLowerCase().includes('switching') || res.data.error.toLowerCase().includes('not allowed'));

      results['H13'] = passH13 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H13: ${results['H13']}`);

      // Restore allow_tier_switching
      await pool.query('UPDATE events SET allow_tier_switching = true WHERE id = $1', [testEventId]);
    }

    // =========================================================================
    // TEST H14: Attempt tier switch to tier with 0 capacity -> rejected, untouched
    // =========================================================================
    logSection('TEST H14: Attempt Tier Switch to Zero Remaining Capacity Tier');
    {
      // Create sold-out tier
      const soldOutRes = await pool.query(
        `INSERT INTO ticket_types (
          event_id, name, base_price, total_quantity, sold_count, reserved_count,
          sale_start_at, sale_end_at, is_active, access_mode
        ) VALUES ($1, 'Sold-Out Premium Tier', 200.00, 5, 5, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', true, 'both')
        RETURNING id`,
        [testEventId]
      );
      const soldOutTierId = soldOutRes.rows[0].id;

      const switchPayload = {
        newTicketTypeId: soldOutTierId,
        quantity: 1,
      };

      const res = await apiRequest(member1, 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload);
      logHttp('H14: Switch to Sold-Out Tier', 'POST', `/events/${testEventId}/registrations/${regVirtual.id}/switch-ticket`, switchPayload, res.status, res.data);

      // Verify original registration is completely untouched
      const checkRegTicket = await pool.query(
        'SELECT ticket_type_id FROM registration_tickets WHERE registration_id = $1',
        [regVirtual.id]
      );

      const passH14 =
        res.status === 400 &&
        res.data?.error &&
        (res.data.error.toLowerCase().includes('sold out') || res.data.error.toLowerCase().includes('capacity')) &&
        checkRegTicket.rows[0].ticket_type_id === virtualTierId;

      results['H14'] = passH14 ? 'PASS' : 'FAIL';
      console.log(`RESULT TEST H14: ${results['H14']}`);
    }

  } catch (err) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST RUNNER:', err);
  } finally {
    console.log('\n================================================================');
    console.log('FINAL SUMMARY OF TESTS (H1 - H14)');
    console.log('================================================================');
    for (let i = 1; i <= 14; i++) {
      const key = `H${i}`;
      console.log(`${key}: ${results[key] || 'NOT_RUN'}`);
    }
    console.log('================================================================\n');

    await pool.end();
  }
}

runTests();
