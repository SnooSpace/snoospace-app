require("dotenv").config();
const assert = require("assert");
const { createPool } = require("../config/db");
const NotificationTypes = require("../config/notificationTypes");
const pushService = require("../services/pushService");

const pool = createPool();

async function run() {
  console.log("=== VERIFY COMMUNITY REFUND PUSH NOTIFICATION ===");

  // 1. Verify NotificationTypes has refund_requested
  console.log("\n[1] Check NotificationTypes registry");
  assert(NotificationTypes.refund_requested, "NotificationTypes.refund_requested should be defined");
  assert.strictEqual(NotificationTypes.refund_requested.category, "events", "Category should be events");
  assert.strictEqual(NotificationTypes.refund_requested.channel, "events", "Channel should be events");
  console.log("✓ refund_requested registered under category 'events' and channel 'events'");

  // 2. Set up test community, member, event, ticket type, registration
  console.log("\n[2] Setting up test data");
  const testSuffix = Date.now().toString().slice(-6);

  // Community
  const commRes = await pool.query(
    `INSERT INTO communities (name, username, email, signup_status)
     VALUES ($1, $2, $3, 'complete')
     RETURNING id`,
    [`Refund Test Comm ${testSuffix}`, `comm_refund_${testSuffix}`, `comm_refund_${testSuffix}@example.com`]
  );
  const communityId = commRes.rows[0].id;

  // Member
  const memRes = await pool.query(
    `INSERT INTO members (name, username, email, phone, dob, gender, interests, signup_status)
     VALUES ($1, $2, $3, $4, '2000-01-01', 'Male', '["tech", "music", "art"]', 'complete')
     RETURNING id`,
    [`Buyer ${testSuffix}`, `buyer_${testSuffix}`, `buyer_${testSuffix}@example.com`, `98${testSuffix.padStart(8, '0')}`]
  );
  const memberId = memRes.rows[0].id;

  // Event (in future so it's refundable)
  const eventRes = await pool.query(
    `INSERT INTO events (
       community_id, creator_id, title, description,
       event_date, start_datetime, end_datetime,
       location_url, event_type, is_published
     )
     VALUES ($1, $1, $2, 'Description', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 2 hours', 'https://maps.google.com', 'in-person', true)
     RETURNING id`,
    [communityId, `Refund Event ${testSuffix}`]
  );
  const eventId = eventRes.rows[0].id;

  // Ticket type with refund policy
  const ttRes = await pool.query(
    `INSERT INTO ticket_types (
       event_id, name, base_price, total_quantity, sold_count,
       refund_policy, is_active
     )
     VALUES ($1, 'General Admission', 500, 50, 1, $2, true)
     RETURNING id`,
    [eventId, JSON.stringify({ allowed: true, deadline_hours_before: 24, percentage: 100 })]
  );
  const ticketTypeId = ttRes.rows[0].id;

  // Registration
  const regRes = await pool.query(
    `INSERT INTO event_registrations (
       event_id, member_id, registration_status, total_amount
     )
     VALUES ($1, $2, 'registered', 500)
     RETURNING id`,
    [eventId, memberId]
  );
  const registrationId = regRes.rows[0].id;

  // Registration ticket
  await pool.query(
    `INSERT INTO registration_tickets (
       registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
     )
     VALUES ($1, $2, 'General Admission', 1, 500, 500)`,
    [registrationId, ticketTypeId]
  );

  console.log(`✓ Created test data: community=${communityId}, member=${memberId}, event=${eventId}, reg=${registrationId}`);

  // 3. Spy on pushService.sendPushNotification
  console.log("\n[3] Testing submitRefundRequest handler notification dispatch");
  const pushCalls = [];
  const originalSendPushNotification = pushService.sendPushNotification;
  pushService.sendPushNotification = async (p, uid, utype, title, body, data) => {
    pushCalls.push({ uid, utype, title, body, data });
  };

  try {
    const { submitRefundRequest } = require("../controllers/eventController");

    let responseStatus = 200;
    let responseData = null;

    const mockReq = {
      user: { id: memberId, type: "member" },
      params: { registrationId: String(registrationId) },
      body: { ticket_type_id: ticketTypeId, reason: "Can no longer attend" },
    };

    const mockRes = {
      status(s) {
        responseStatus = s;
        return this;
      },
      json(d) {
        responseData = d;
        return this;
      },
    };

    await submitRefundRequest(mockReq, mockRes);

    assert.strictEqual(responseStatus, 201, `Expected status 201, got ${responseStatus}: ${JSON.stringify(responseData)}`);
    assert(responseData?.success, "Expected success response");
    console.log("✓ submitRefundRequest completed with HTTP 201");

    // Verify refund_requests row in DB
    const rrCheck = await pool.query(
      `SELECT * FROM refund_requests WHERE registration_id = $1`,
      [registrationId]
    );
    assert.strictEqual(rrCheck.rows.length, 1, "Should create 1 refund_requests row");
    assert.strictEqual(parseFloat(rrCheck.rows[0].requested_amount), 500, "Requested amount should be 500");
    console.log("✓ refund_requests row created in database");

    // Verify push notifications dispatched
    console.log(`✓ Total push calls captured: ${pushCalls.length}`);
    const buyerPush = pushCalls.find((c) => c.utype === "member" && c.uid === memberId);
    const commPush = pushCalls.find((c) => c.utype === "community" && c.uid === communityId);

    assert(buyerPush, "Buyer should receive push notification");
    assert(commPush, "Community should receive push notification");
    assert.strictEqual(commPush.title, "Refund Request Received", "Community push title mismatch");
    assert(commPush.body.includes(`Buyer ${testSuffix}`), "Community push body should include buyer name");
    assert.strictEqual(commPush.data.type, "refund_requested", "Data type should be refund_requested");
    assert.strictEqual(parseInt(commPush.data.eventId), parseInt(eventId), "Data eventId should match");
    console.log("✓ Community push notification verified:", commPush);

    // 4. CRITICAL: Verify NO in-app notification for community
    console.log("\n[4] Verifying in-app notifications (clean community inbox)");
    const inAppNotifs = await pool.query(
      `SELECT recipient_id, recipient_type, type FROM notifications WHERE recipient_id = $1 AND recipient_type = 'community'`,
      [communityId]
    );
    assert.strictEqual(
      inAppNotifs.rows.length,
      0,
      `Community should have 0 in-app notifications, but found ${inAppNotifs.rows.length}`
    );
    console.log("✓ Verified: ZERO in-app notifications created for the community");

    // Verify buyer DID get their in-app notification
    const buyerInApp = await pool.query(
      `SELECT recipient_id, recipient_type, type FROM notifications WHERE recipient_id = $1 AND recipient_type = 'member' AND type = 'refund_requested'`,
      [memberId]
    );
    assert.strictEqual(buyerInApp.rows.length, 1, "Buyer should have their in-app notification");
    console.log("✓ Verified: Buyer received in-app notification receipt");

  } finally {
    // Restore pushService
    pushService.sendPushNotification = originalSendPushNotification;

    // Clean up test data
    console.log("\n[5] Cleaning up test data");
    await pool.query(`DELETE FROM notifications WHERE recipient_id IN ($1, $2)`, [communityId, memberId]);
    await pool.query(`DELETE FROM refund_requests WHERE registration_id = $1`, [registrationId]);
    await pool.query(`DELETE FROM registration_tickets WHERE registration_id = $1`, [registrationId]);
    await pool.query(`DELETE FROM event_registrations WHERE id = $1`, [registrationId]);
    await pool.query(`DELETE FROM ticket_types WHERE id = $1`, [ticketTypeId]);
    await pool.query(`DELETE FROM events WHERE id = $1`, [eventId]);
    await pool.query(`DELETE FROM members WHERE id = $1`, [memberId]);
    await pool.query(`DELETE FROM communities WHERE id = $1`, [communityId]);
    console.log("✓ Cleanup complete");
  }

  console.log("\n✅ ALL TESTS PASSED!");
  await pool.end();
}

run().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  pool.end().finally(() => process.exit(1));
});
