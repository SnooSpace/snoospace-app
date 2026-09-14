const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { createPool } = require('../config/db');
const { generateAccessToken } = require('../controllers/authControllerV2');

const pool = createPool();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const ADMIN_JWT_SECRET = process.env.JWT_SECRET || 'your-admin-jwt-secret-change-in-production';

function logSection(title) {
  console.log(`\n================================================================`);
  console.log(`[SUITE] ${title}`);
  console.log(`================================================================`);
}

function logHttp(label, method, urlPath, reqBody, status, resBody) {
  console.log(`\n--- [HTTP CALL] ${label} ---`);
  console.log(`REQUEST:  ${method} ${urlPath}`);
  if (reqBody !== null && reqBody !== undefined) {
    console.log(`PAYLOAD:  ${JSON.stringify(reqBody, null, 2)}`);
  }
  console.log(`STATUS:   ${status}`);
  console.log(`RESPONSE: ${typeof resBody === 'object' ? JSON.stringify(resBody, null, 2) : resBody}`);
}

async function apiRequest(tokenOrUser, method, urlPath, body = null) {
  let token = null;
  if (typeof tokenOrUser === 'string') {
    token = tokenOrUser;
  } else if (tokenOrUser && tokenOrUser.token) {
    token = tokenOrUser.token;
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

// Mirror of admin UI rendering logic in admin/src/app/(dashboard)/finance/page.tsx
const refundStatusColors = {
  pending_review: "bg-yellow-100 text-yellow-800",
  auto_approved:  "bg-blue-100 text-blue-800",
  manual_review:  "bg-orange-100 text-orange-800",
  approved:       "bg-teal-100 text-teal-800",
  completed:      "bg-green-100 text-green-800",
  rejected:       "bg-red-100 text-red-800",
};

const refundStatusLabels = {
  pending_review: "Pending Review",
  auto_approved:  "Auto-Approved",
  manual_review:  "Manual Review",
  approved:       "Approved",
  completed:      "Completed",
  rejected:       "Rejected",
};

const triggerSourceConfig = {
  tier_switch_downgrade: {
    label: "Tier Switch",
    className: "border-purple-300 bg-purple-50 text-purple-700",
  },
  system_cancellation: {
    label: "Event Cancelled",
    className: "border-red-300 bg-red-50 text-red-700",
  },
  postponement_opt_out: {
    label: "Postponed",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  },
  postponement_indefinite_cap: {
    label: "Postponed",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  },
};

function renderRowPolicy(rq) {
  if (rq.policy_snapshot?.downgrade) {
    return "Tier switch";
  } else if (rq.policy_snapshot?.percentage !== undefined && rq.policy_snapshot?.percentage !== null) {
    return `${rq.policy_snapshot.percentage}% · ${rq.policy_snapshot.deadline_hours_before}h`;
  } else {
    return "—";
  }
}

function renderRowStatusBadges(rq) {
  const statusLabel = refundStatusLabels[rq.status] || rq.status;
  const badges = [`[StatusBadge: "${statusLabel}"]`];
  if (rq.trigger_source && rq.trigger_source !== "buyer") {
    const triggerLabel = triggerSourceConfig[rq.trigger_source]?.label || rq.trigger_source;
    badges.push(`[TriggerBadge: "${triggerLabel}"]`);
  }
  return badges.join(" ");
}

async function runSuite() {
  console.log('================================================================');
  console.log('ADMIN REFUND QUEUE & TIER SWITCH VISIBILITY VERIFICATION');
  console.log('Target API:', API_BASE);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================');

  const results = {};

  try {
    // 1. Get test entities
    const commRes = await pool.query('SELECT id, name, email FROM communities LIMIT 1');
    if (commRes.rows.length === 0) throw new Error('No community found');
    const communityUser = { ...commRes.rows[0], type: 'community' };

    const memRes = await pool.query('SELECT id, name, email FROM members ORDER BY id ASC LIMIT 2');
    if (memRes.rows.length < 2) throw new Error('Need at least 2 members');
    const member1 = { ...memRes.rows[0], type: 'member' };
    const member2 = { ...memRes.rows[1], type: 'member' };

    // Get admin
    let admin = null;
    const adminRes = await pool.query('SELECT id, name, email, role, is_active FROM admins WHERE is_active = true LIMIT 1');
    if (adminRes.rows.length > 0) {
      admin = adminRes.rows[0];
    } else {
      // Create test admin if none exists
      const newAdmin = await pool.query(`
        INSERT INTO admins (name, email, password_hash, role, is_active)
        VALUES ('Test Super Admin', 'admin@snoospace.com', 'dummyhash', 'superadmin', true)
        RETURNING id, name, email, role, is_active
      `);
      admin = newAdmin.rows[0];
    }

    const adminToken = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin',
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '1d' }
    );

    console.log(`Community: #${communityUser.id} (${communityUser.name})`);
    console.log(`Member 1: #${member1.id} (${member1.name || member1.email})`);
    console.log(`Member 2: #${member2.id} (${member2.name || member2.email})`);
    console.log(`Admin: #${admin.id} (${admin.email}, role: ${admin.role})`);

    // 2. Create an event with allow_tier_switching=true, allow_downgrade_refunds=true
    const now = new Date();
    const eventStart = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
    const eventEnd = new Date(eventStart.getTime() + 3 * 3600 * 1000);

    const createPayload = {
      title: `Admin Refund Visibility Test Event ${Date.now()}`,
      description: 'Testing tier_switch_downgrade visibility in admin queue',
      event_date: eventStart.toISOString().split('T')[0],
      start_datetime: eventStart.toISOString(),
      end_datetime: eventEnd.toISOString(),
      event_type: 'hybrid',
      location_name: 'Tech Convention Center',
      location_url: 'https://maps.google.com/?q=Tech+Center',
      virtual_link: 'https://meet.google.com/test-admin-queue',
      meeting_platform: 'Google Meet',
      allow_tier_switching: true,
      allow_downgrade_refunds: true,
      ticket_types: [
        {
          name: 'Virtual Pass',
          description: 'Virtual stream access',
          base_price: 50.00,
          total_quantity: 50,
          access_mode: 'virtual',
          refund_policy: {
            allowed: true,
            deadline_hours_before: 24,
            percentage: 85,
          },
        },
        {
          name: 'VIP All-Access',
          description: 'In-person + stream',
          base_price: 150.00,
          total_quantity: 50,
          access_mode: 'both',
          refund_policy: {
            allowed: true,
            deadline_hours_before: 24,
            percentage: 85,
          },
        },
      ],
    };

    const eventRes = await apiRequest(communityUser, 'POST', '/events', createPayload);
    if (eventRes.status !== 201 && eventRes.status !== 200) {
      throw new Error(`Failed to create event: ${JSON.stringify(eventRes.data)}`);
    }
    const testEventId = eventRes.data.event?.id || eventRes.data.id;

    const tiersDb = await pool.query(
      'SELECT id, name, base_price, access_mode, refund_policy FROM ticket_types WHERE event_id = $1 ORDER BY base_price ASC',
      [testEventId]
    );
    const virtualTier = tiersDb.rows.find(t => t.name === 'Virtual Pass');
    const vipTier = tiersDb.rows.find(t => t.name === 'VIP All-Access');

    console.log(`Created Event #${testEventId} with Tiers:`);
    console.log(`- Virtual Tier: #${virtualTier.id} (₹${virtualTier.base_price})`);
    console.log(`- VIP Tier:     #${vipTier.id} (₹${vipTier.base_price})`);

    // Helper to create registration
    async function createRegistration(member, tier, price) {
      const qrHash = require('crypto').randomBytes(16).toString('hex');
      const regRes = await pool.query(
        `INSERT INTO event_registrations (
          event_id, member_id, registration_status, qr_code_hash, created_at
        ) VALUES ($1, $2, 'registered', $3, NOW())
        RETURNING id, qr_code_hash, registration_status`,
        [testEventId, member.id, qrHash]
      );
      const reg = regRes.rows[0];
      await pool.query(
        `INSERT INTO registration_tickets (
          registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, 1, $4, $4)`,
        [reg.id, tier.id, tier.name, price]
      );
      await pool.query(
        `UPDATE ticket_types SET sold_count = COALESCE(sold_count, 0) + 1 WHERE id = $1`,
        [tier.id]
      );
      return reg;
    }

    // =========================================================================
    // TEST F1: Trigger tier-switch downgrade & query DB row directly
    // =========================================================================
    logSection('TEST F1: Trigger Tier-Switch Downgrade & Confirm trigger_source');
    const regMember1 = await createRegistration(member1, vipTier, 150.00);
    console.log(`Member 1 registered with VIP All-Access (Reg #${regMember1.id})`);

    const switchPayload = {
      newTicketTypeId: virtualTier.id,
      quantity: 1,
    };
    const switchRes = await apiRequest(member1, 'POST', `/events/${testEventId}/registrations/${regMember1.id}/switch-ticket`, switchPayload);
    logHttp('F1: Switch VIP (₹150) -> Virtual (₹50)', 'POST', `/events/${testEventId}/registrations/${regMember1.id}/switch-ticket`, switchPayload, switchRes.status, switchRes.data);

    // Query refund_requests directly from Postgres
    const dbRefundF1 = await pool.query(
      `SELECT id, registration_id, member_id, event_id, ticket_type_id,
              requested_amount, reason, status, trigger_source, policy_snapshot, requested_at
       FROM refund_requests
       WHERE registration_id = $1
       ORDER BY id DESC LIMIT 1`,
      [regMember1.id]
    );

    console.log('\n--- Real Postgres DB Row for TEST F1 ---');
    console.dir(dbRefundF1.rows[0], { depth: null });

    const f1Row = dbRefundF1.rows[0];
    const passF1 =
      switchRes.status === 200 &&
      switchRes.data?.success === true &&
      switchRes.data?.switched === true &&
      switchRes.data?.refundQueued === true &&
      f1Row !== undefined &&
      f1Row.trigger_source === 'tier_switch_downgrade' &&
      f1Row.status === 'manual_review' &&
      parseFloat(f1Row.requested_amount) === 100.00 &&
      f1Row.policy_snapshot?.downgrade === true;

    results['TEST F1'] = passF1 ? 'PASS' : 'FAIL';
    console.log(`\nRESULT TEST F1: ${results['TEST F1']}`);
    console.log(`  trigger_source value: '${f1Row?.trigger_source}' (Expected: 'tier_switch_downgrade')`);
    console.log(`  status value:         '${f1Row?.status}' (Expected: 'manual_review')`);
    console.log(`  policy_snapshot:      ${JSON.stringify(f1Row?.policy_snapshot)}`);

    // =========================================================================
    // TEST F2: Admin API Queue returns trigger_source & row rendering verification
    // =========================================================================
    logSection('TEST F2: Admin Refund Queue Visibility & Badge/Policy Rendering');
    const adminQueueRes = await apiRequest(adminToken, 'GET', `/admin/refund-requests?status=manual_review`);
    logHttp('F2: Admin GET /admin/refund-requests?status=manual_review', 'GET', '/admin/refund-requests?status=manual_review', null, adminQueueRes.status, {
      total: adminQueueRes.data?.total,
      requestsCount: adminQueueRes.data?.requests?.length,
    });

    const f2AdminRow = adminQueueRes.data?.requests?.find(r => r.id === f1Row.id);
    console.log('\n--- Admin API Returned Row for Downgrade Refund ---');
    console.dir(f2AdminRow, { depth: null });

    const policyRenderF2 = renderRowPolicy(f2AdminRow);
    const badgesRenderF2 = renderRowStatusBadges(f2AdminRow);

    console.log('\n--- Simulated UI Render for Table Row ---');
    console.log(`Policy Column:  "${policyRenderF2}"`);
    console.log(`Status Column:  ${badgesRenderF2}`);

    const passF2 =
      adminQueueRes.status === 200 &&
      f2AdminRow !== undefined &&
      f2AdminRow.trigger_source === 'tier_switch_downgrade' &&
      policyRenderF2 === 'Tier switch' &&
      badgesRenderF2.includes('[TriggerBadge: "Tier Switch"]') &&
      badgesRenderF2.includes('[StatusBadge: "Manual Review"]');

    results['TEST F2'] = passF2 ? 'PASS' : 'FAIL';
    console.log(`\nRESULT TEST F2: ${results['TEST F2']}`);
    console.log(`  API returned trigger_source: '${f2AdminRow?.trigger_source}'`);
    console.log(`  Policy column rendered:       '${policyRenderF2}' (NOT '% · h')`);
    console.log(`  Trigger badge rendered:       'Tier Switch' (Inline with Status)`);

    // =========================================================================
    // TEST F3: Regression — Normal buyer-initiated refund request
    // =========================================================================
    logSection('TEST F3: Regression — Buyer-Initiated Refund (Unrelated to Tier Switch)');
    const regMember2 = await createRegistration(member2, virtualTier, 50.00);
    console.log(`Member 2 registered with Virtual Pass (Reg #${regMember2.id})`);

    const buyerRefundPayload = {
      ticket_type_id: virtualTier.id,
      reason: 'Schedule conflict, unable to attend virtual event',
    };
    const buyerRefundRes = await apiRequest(member2, 'POST', `/registrations/${regMember2.id}/refund-request`, buyerRefundPayload);
    logHttp('F3: Submit Buyer Refund Request', 'POST', `/registrations/${regMember2.id}/refund-request`, buyerRefundPayload, buyerRefundRes.status, buyerRefundRes.data);

    // Query DB directly for regression row
    const dbRefundF3 = await pool.query(
      `SELECT id, registration_id, member_id, event_id, ticket_type_id,
              requested_amount, reason, status, trigger_source, policy_snapshot, requested_at
       FROM refund_requests
       WHERE registration_id = $1
       ORDER BY id DESC LIMIT 1`,
      [regMember2.id]
    );

    console.log('\n--- Real Postgres DB Row for TEST F3 ---');
    console.dir(dbRefundF3.rows[0], { depth: null });

    const f3Row = dbRefundF3.rows[0];

    // Query admin API for this row
    const adminBuyerQueueRes = await apiRequest(adminToken, 'GET', `/admin/refund-requests`);
    const f3AdminRow = adminBuyerQueueRes.data?.requests?.find(r => r.id === f3Row.id);

    const policyRenderF3 = renderRowPolicy(f3AdminRow);
    const badgesRenderF3 = renderRowStatusBadges(f3AdminRow);

    console.log('\n--- Simulated UI Render for Normal Buyer Row ---');
    console.log(`Policy Column:  "${policyRenderF3}"`);
    console.log(`Status Column:  ${badgesRenderF3}`);

    const passF3 =
      (buyerRefundRes.status === 200 || buyerRefundRes.status === 201) &&
      f3Row !== undefined &&
      f3Row.trigger_source === 'buyer' &&
      f3AdminRow !== undefined &&
      f3AdminRow.trigger_source === 'buyer' &&
      policyRenderF3 === '85% · 24h' &&
      !badgesRenderF3.includes('[TriggerBadge:') &&
      badgesRenderF3.includes('[StatusBadge:');

    results['TEST F3'] = passF3 ? 'PASS' : 'FAIL';
    console.log(`\nRESULT TEST F3: ${results['TEST F3']}`);
    console.log(`  trigger_source value:         '${f3Row?.trigger_source}' (Expected: 'buyer')`);
    console.log(`  Policy column rendered:       '${policyRenderF3}' (Percentage/deadline intact)`);
    console.log(`  No Trigger Badge rendered:    ${!badgesRenderF3.includes('[TriggerBadge:')}`);

    // Summary
    logSection('FINAL VERIFICATION SUMMARY');
    console.table(results);

    const allPassed = Object.values(results).every(r => r === 'PASS');
    console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
  } finally {
    await pool.end();
  }
}

runSuite();
