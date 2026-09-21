const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');

const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

async function apiRequest(tokenOrUser, method, urlPath, body = null) {
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

async function run() {
  console.log('=== TEST SUITE: TIER SWITCH RULES & GENDER LOOPHOLE ELIMINATION ===\n');

  // 1. Get community and members
  const commRes = await pool.query('SELECT id, name, email FROM communities LIMIT 1');
  const community = { ...commRes.rows[0], type: 'community' };

  // Ensure we have a Male member and a Female member
  let maleMemberRes = await pool.query("SELECT id, name, email, gender FROM members WHERE LOWER(gender) = 'male' LIMIT 1");
  let maleMember = maleMemberRes.rows[0] ? { ...maleMemberRes.rows[0], type: 'member' } : null;
  if (!maleMember) {
    const newM = await pool.query(
      `INSERT INTO members (name, username, email, phone, dob, gender, signup_status)
       VALUES ('Test Male', 'test_male_${Date.now()}', 'test_male_${Date.now()}@example.com', '9888888801', '1995-01-01', 'Male', 'completed')
       RETURNING id, name, email, gender`
    );
    maleMember = { ...newM.rows[0], type: 'member' };
  }

  let femaleMemberRes = await pool.query("SELECT id, name, email, gender FROM members WHERE LOWER(gender) = 'female' LIMIT 1");
  let femaleMember = femaleMemberRes.rows[0] ? { ...femaleMemberRes.rows[0], type: 'member' } : null;
  if (!femaleMember) {
    const newF = await pool.query(
      `INSERT INTO members (name, username, email, phone, dob, gender, signup_status)
       VALUES ('Test Female', 'test_female_${Date.now()}', 'test_female_${Date.now()}@example.com', '9888888802', '1995-01-01', 'Female', 'completed')
       RETURNING id, name, email, gender`
    );
    femaleMember = { ...newF.rows[0], type: 'member' };
  }

  console.log(`[Setup] Community ID: ${community.id}, Male Member ID: ${maleMember.id}, Female Member ID: ${femaleMember.id}`);

  // -------------------------------------------------------------
  // TEST 1: Creation with Male -> Female rule should be REJECTED
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Event Creation Rejects Male -> Female Switch Rule ---');
  const startDate = new Date(Date.now() + 86400000 * 2).toISOString();
  const endDate = new Date(Date.now() + 86400000 * 2 + 14400000).toISOString();

  const crossGenderPayload = {
    title: `Cross-Gender Test Event ${Date.now()}`,
    event_date: startDate,
    start_datetime: startDate,
    end_datetime: endDate,
    event_type: 'in-person',
    location_url: 'https://maps.google.com/?q=Bangalore',
    ticket_types: [
      { name: 'Stag Men', base_price: 500, total_quantity: 20, gender_restriction: 'Male' },
      { name: 'Women Pass', base_price: 200, total_quantity: 20, gender_restriction: 'Female' },
    ],
    allow_tier_switching: true,
    tier_switch_rules: [
      {
        from_tier_name: 'Stag Men',
        to_tier_names: ['Women Pass'],
      },
    ],
  };

  const test1Res = await apiRequest(community, 'POST', '/events', crossGenderPayload);
  console.log(`Status: ${test1Res.status}`);
  console.log(`Response:`, test1Res.data);
  if (test1Res.status === 400 && test1Res.data.error?.includes('Male and Female tickets')) {
    console.log('>>> [PASS] TEST 1: Correctly rejected Male -> Female switch rule at event creation.');
  } else {
    console.error('>>> [FAIL] TEST 1: Allowed Male -> Female switch rule!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 2: Creation with Compulsory Rule Missing should be REJECTED
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Event Creation Rejects allow_tier_switching = true with empty rules ---');
  const emptyRulesPayload = {
    ...crossGenderPayload,
    title: `Empty Rules Test Event ${Date.now()}`,
    tier_switch_rules: [],
  };
  const test2Res = await apiRequest(community, 'POST', '/events', emptyRulesPayload);
  console.log(`Status: ${test2Res.status}`);
  if (test2Res.status === 400 && test2Res.data.error?.includes('at least one allowed switch rule')) {
    console.log('>>> [PASS] TEST 2: Compulsory rule enforced: cannot enable switching with empty rules.');
  } else {
    console.error('>>> [FAIL] TEST 2: Failed compulsory check!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 3: Create Valid Event: 2 Male Tickets + 1 Female Ticket
  // Switching configured: Male Regular -> Male VIP
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Create Valid Event with 2 Male Tiers + 1 Female Tier ---');
  const validPayload = {
    title: `Tier Switching Valid Test ${Date.now()}`,
    event_date: startDate,
    start_datetime: startDate,
    end_datetime: endDate,
    event_type: 'in-person',
    location_url: 'https://maps.google.com/?q=Bangalore',
    ticket_types: [
      { name: 'Men Regular', base_price: 100, total_quantity: 20, gender_restriction: 'Male' },
      { name: 'Men VIP', base_price: 250, total_quantity: 10, gender_restriction: 'Male' },
      { name: 'Women Solo', base_price: 100, total_quantity: 20, gender_restriction: 'Female' },
    ],
    allow_tier_switching: true,
    tier_switch_rules: [
      {
        from_tier_name: 'Men Regular',
        to_tier_names: ['Men VIP'],
      },
    ],
  };

  const test3Res = await apiRequest(community, 'POST', '/events', validPayload);
  console.log(`Status: ${test3Res.status}`);
  if (test3Res.status !== 201 && test3Res.status !== 200) {
    console.error('>>> [FAIL] TEST 3: Could not create event:', test3Res.data);
    process.exit(1);
  }
  const createdEvent = test3Res.data.event;
  console.log(`Event created ID: ${createdEvent.id}`);

  // Fetch ticket types from DB
  const ttRes = await pool.query('SELECT id, name, gender_restriction, base_price FROM ticket_types WHERE event_id = $1', [createdEvent.id]);
  const menRegular = ttRes.rows.find(t => t.name === 'Men Regular');
  const menVIP = ttRes.rows.find(t => t.name === 'Men VIP');
  const womenSolo = ttRes.rows.find(t => t.name === 'Women Solo');
  console.log('Ticket types in DB:', ttRes.rows);

  // Check tier_switch_rules in DB
  const evDb = await pool.query('SELECT tier_switch_rules FROM events WHERE id = $1', [createdEvent.id]);
  console.log('Saved tier_switch_rules in DB:', evDb.rows[0].tier_switch_rules);
  const rules = evDb.rows[0].tier_switch_rules;
  if (!rules || rules.length !== 1 || parseInt(rules[0].from_tier_id) !== parseInt(menRegular.id)) {
    console.error('>>> [FAIL] TEST 3: tier_switch_rules not properly resolved/stored in DB');
    process.exit(1);
  }
  console.log('>>> [PASS] TEST 3: Valid event created and tier_switch_rules resolved with DB IDs.');

  // Helper to create valid registration
  async function createTestRegistration(member, tierId, tierName, price) {
    const qrHash = require('crypto').randomBytes(16).toString('hex');
    const regRes = await pool.query(
      `INSERT INTO event_registrations (
        event_id, member_id, registration_status, qr_code_hash, created_at
      ) VALUES ($1, $2, 'registered', $3, NOW())
      RETURNING id, qr_code_hash, registration_status`,
      [createdEvent.id, member.id, qrHash]
    );
    const reg = regRes.rows[0];
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

  // -------------------------------------------------------------
  // TEST 4: Male registers for Men Regular, attempts switch to Women Solo -> REJECTED
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Attempt Cross-Gender Switch (Men Regular -> Women Solo) ---');
  const maleReg = await createTestRegistration(maleMember, menRegular.id, menRegular.name, menRegular.base_price);
  const registrationId = maleReg.id;

  // Attempt switch to Women Solo
  const switchCrossRes = await apiRequest(maleMember, 'POST', `/events/${createdEvent.id}/registrations/${registrationId}/switch-ticket`, {
    newTicketTypeId: womenSolo.id,
    oldTicketTypeId: menRegular.id,
    quantity: 1,
  });
  console.log('Switch cross-gender status:', switchCrossRes.status, switchCrossRes.data);
  if (switchCrossRes.status === 400) {
    console.log('>>> [PASS] TEST 4: Blocked cross-gender switch with 400:', switchCrossRes.data.error);
  } else {
    console.error('>>> [FAIL] TEST 4: Cross-gender switch was not blocked!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 5: Male switches Men Regular -> Men VIP -> SUCCESS (Upgrade payment due)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Valid Switch (Men Regular -> Men VIP) ---');
  const validSwitchRes = await apiRequest(maleMember, 'POST', `/events/${createdEvent.id}/registrations/${registrationId}/switch-ticket`, {
    newTicketTypeId: menVIP.id,
    oldTicketTypeId: menRegular.id,
    quantity: 1,
  });
  console.log('Valid switch status:', validSwitchRes.status, validSwitchRes.data);
  if (validSwitchRes.status === 200 && validSwitchRes.data.upgradeRequired === true && validSwitchRes.data.difference === 150) {
    console.log('>>> [PASS] TEST 5: Successfully allowed Men Regular -> Men VIP with upgrade payment required (₹150).');
  } else {
    console.error('>>> [FAIL] TEST 5: Valid switch failed!', validSwitchRes.data);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 6: Female attendee attempts switch to Men VIP -> REJECTED (Profile gender mismatch)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Female Member Profile Cannot Switch to Male Ticket ---');
  const femReg = await createTestRegistration(femaleMember, womenSolo.id, womenSolo.name, womenSolo.base_price);
  const femRegId = femReg.id;

  const switchFemToMale = await apiRequest(femaleMember, 'POST', `/events/${createdEvent.id}/registrations/${femRegId}/switch-ticket`, {
    newTicketTypeId: menVIP.id,
    oldTicketTypeId: womenSolo.id,
    quantity: 1,
  });
  console.log('Female to Male switch status:', switchFemToMale.status, switchFemToMale.data);
  if (switchFemToMale.status === 400) {
    console.log('>>> [PASS] TEST 6: Correctly rejected female user switching to Male ticket:', switchFemToMale.data.error);
  } else {
    console.error('>>> [FAIL] TEST 6: Female user was allowed to switch to Male ticket!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 7: Attempt switch to expired ticket tier -> REJECTED
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Attempt Switch to Expired Sales Window Tier ---');
  // Create an expired tier in the event
  const expTierRes = await pool.query(
    `INSERT INTO ticket_types (event_id, name, base_price, total_quantity, sale_start_at, sale_end_at, gender_restriction, is_active)
     VALUES ($1, 'Expired Early Bird', 50, 20, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour', 'Male', true)
     RETURNING id`,
    [createdEvent.id]
  );
  const expiredTierId = expTierRes.rows[0].id;

  // Add expired tier to host rules
  await pool.query(
    `UPDATE events SET tier_switch_rules = $1 WHERE id = $2`,
    [
      JSON.stringify([
        {
          from_tier_id: parseInt(menRegular.id),
          from_tier_name: menRegular.name,
          to_tier_ids: [parseInt(menVIP.id), parseInt(expiredTierId)],
          to_tier_names: [menVIP.name, 'Expired Early Bird'],
        },
      ]),
      createdEvent.id,
    ]
  );

  const switchExpiredRes = await apiRequest(maleMember, 'POST', `/events/${createdEvent.id}/registrations/${registrationId}/switch-ticket`, {
    newTicketTypeId: expiredTierId,
    oldTicketTypeId: menRegular.id,
    quantity: 1,
  });
  console.log('Expired tier switch status:', switchExpiredRes.status, switchExpiredRes.data);
  if (switchExpiredRes.status === 400 && switchExpiredRes.data.error?.includes('closed')) {
    console.log('>>> [PASS] TEST 7: Correctly rejected switch into expired sales window ticket.');
  } else {
    console.error('>>> [FAIL] TEST 7: Allowed switch into expired tier!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TEST 8: updateEvent with tier_switch_rules & cross-gender rejection
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: updateEvent with tier_switch_rules ---');
  // Attempt invalid cross-gender update
  const badUpdateRes = await apiRequest(community, 'PATCH', `/events/${createdEvent.id}`, {
    allow_tier_switching: true,
    tier_switch_rules: [
      {
        from_tier_id: parseInt(womenSolo.id),
        to_tier_ids: [parseInt(menVIP.id)],
      },
    ],
  });
  console.log('Bad update status:', badUpdateRes.status, badUpdateRes.data);
  if (badUpdateRes.status === 400 && badUpdateRes.data.error?.includes('Male and Female tickets')) {
    console.log('>>> [PASS] TEST 8a: updateEvent rejected cross-gender switch rule.');
  } else {
    console.error('>>> [FAIL] TEST 8a: updateEvent did not reject cross-gender rule!');
    process.exit(1);
  }

  // Valid update: disable switching
  const disableRes = await apiRequest(community, 'PATCH', `/events/${createdEvent.id}`, {
    allow_tier_switching: false,
  });
  console.log('Disable switching status:', disableRes.status);
  const evDbAfterDisable = await pool.query('SELECT allow_tier_switching, tier_switch_rules FROM events WHERE id = $1', [createdEvent.id]);
  if (evDbAfterDisable.rows[0].allow_tier_switching === false && JSON.stringify(evDbAfterDisable.rows[0].tier_switch_rules) === '[]') {
    console.log('>>> [PASS] TEST 8b: Disabling switching cleared tier_switch_rules.');
  } else {
    console.error('>>> [FAIL] TEST 8b: Rules were not cleared when switching was disabled!');
    process.exit(1);
  }

  console.log('\n=============================================================');
  console.log('ALL BACKEND TIER SWITCH RULE & GENDER INVARIANT TESTS PASSED!');
  console.log('=============================================================');

  await pool.end();
}

run().catch((e) => {
  console.error('[FATAL ERROR]', e);
  process.exit(1);
});
