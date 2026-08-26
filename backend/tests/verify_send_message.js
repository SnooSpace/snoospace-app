/**
 * verify_send_message.js — Integration Test Harness for sendMessage (messageController.js)
 * 
 * Verifies core functionality and database invariants of sendMessage:
 *   a. DM send via recipientId (new conversation creation, message insert, last_message_at update)
 *   b. DM send via conversationId (existing conversation, message insert, last_message_at update)
 *   c. Group send (participant allowed, non-participant rejected with 403)
 *   d. Reply send (reply_to_message_id stored and references parent message)
 *   e. Block handling (sender blocker -> 403 you_have_blocked; sender blocked -> silent is_hidden=true, last_message_at untouched)
 *   f. Group closed / restricted (GROUP_CLOSED -> 403; messaging_restricted -> non-admin 403, admin 201)
 *   g. Validation (empty text rejected, media without metadata.url rejected, self-DM rejected)
 * 
 * Usage:
 *   node tests/verify_send_message.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const { sendMessage } = require('../controllers/messageController');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// Mock req/res execution helper
function callSendMessage(user, body) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      user,
      body,
      app: {
        locals: {
          io: null, // Mock Socket.io
        },
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        resolve({ statusCode, body: responseData });
      },
    };

    sendMessage(req, res).catch((err) => {
      resolve({ statusCode: 500, error: err.message });
    });
  });
}

async function run() {
  console.log('======================================================================');
  console.log('STARTING INTEGRATION VERIFICATION: sendMessage (messageController.js)');
  console.log('======================================================================\n');

  const testMemberIds = [];
  const testConvIds = [];

  try {
    // ── Setup: Create Test Members ───────────────────────────────────────────
    const ts = Date.now();
    const defaults = {
      gender: 'Male',
      interests: JSON.stringify(['sports', 'music', 'tech']),
      dob: '2000-01-01',
    };

    async function createTestMember(label) {
      const phoneDigits = String(Math.floor(1000000000 + Math.random() * 9000000000));
      const res = await pool.query(
        `INSERT INTO members (name, username, email, phone, dob, gender, interests)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`,
        [
          label,
          `${label.toLowerCase().replace(/\s+/g, '_')}_${ts}`,
          `${label.toLowerCase().replace(/\s+/g, '_')}_${ts}@__verify_msg__.local`,
          phoneDigits,
          defaults.dob,
          defaults.gender,
          defaults.interests,
        ]
      );
      return res.rows[0].id;
    }

    const user1Id = await createTestMember('Msg User 1');
    const user2Id = await createTestMember('Msg User 2');
    const user3Id = await createTestMember('Msg User 3');
    testMemberIds.push(user1Id, user2Id, user3Id);

    console.log(`Created test members: User1=${user1Id}, User2=${user2Id}, User3=${user3Id}\n`);

    // ── Test A: DM Send via recipientId (New Conversation) ───────────────────
    console.log('--- Test A: DM Send via recipientId (New Conversation) ---');
    const resA = await callSendMessage(
      { id: user1Id, type: 'member' },
      { recipientId: user2Id, recipientType: 'member', messageText: 'Hello User 2!' }
    );

    assert(resA.statusCode === 201, `Status is 201 Created (got ${resA.statusCode})`);
    assert(resA.body?.success === true, 'Response body has success: true');
    assert(resA.body?.message?.messageText === 'Hello User 2!', 'Response body has correct messageText');

    const convIdA = resA.body?.message?.conversationId;
    assert(!!convIdA, `Conversation ID returned: ${convIdA}`);
    if (convIdA) testConvIds.push(convIdA);

    // Database verification:
    const convRowA = await pool.query('SELECT * FROM conversations WHERE id = $1', [convIdA]);
    assert(convRowA.rows.length === 1, 'Conversation row created in database');
    assert(convRowA.rows[0].is_group === false, 'Conversation is_group is false');

    const msgRowA = await pool.query('SELECT * FROM messages WHERE id = $1', [resA.body?.message?.id]);
    assert(msgRowA.rows.length === 1, 'Message row inserted in database');
    assert(msgRowA.rows[0].message_text === 'Hello User 2!', 'Stored message text matches');
    assert(msgRowA.rows[0].sender_id === String(user1Id), 'Stored sender_id matches');
    assert(msgRowA.rows[0].is_hidden === false, 'Stored is_hidden is false');

    const convLastMsgTime = new Date(convRowA.rows[0].last_message_at).getTime();
    const msgCreatedTime = new Date(msgRowA.rows[0].created_at).getTime();
    assert(
      Math.abs(convLastMsgTime - msgCreatedTime) < 1000,
      'conversations.last_message_at updated to match message created_at'
    );

    // ── Test A2: DM Send via recipientId (Existing Conversation / "Get" path) ──
    console.log('\n--- Test A2: DM Send via recipientId (Existing Conversation / "Get" path) ---');
    await new Promise((r) => setTimeout(r, 50));

    const resA2 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { recipientId: user2Id, recipientType: 'member', messageText: 'Second message via recipientId!' }
    );

    assert(resA2.statusCode === 201, `Status is 201 Created (got ${resA2.statusCode})`);
    assert(resA2.body?.success === true, 'Response body has success: true');
    assert(
      String(resA2.body?.message?.conversationId) === String(convIdA),
      `Returned conversationId (${resA2.body?.message?.conversationId}) matches existing conversation (${convIdA})`
    );

    const msgIdA2 = resA2.body?.message?.id;
    const msgRowA2 = await pool.query('SELECT * FROM messages WHERE id = $1', [msgIdA2]);
    assert(msgRowA2.rows.length === 1, 'Message row inserted in database');
    assert(msgRowA2.rows[0].message_text === 'Second message via recipientId!', 'Stored message text matches');
    assert(msgRowA2.rows[0].sender_id === String(user1Id), 'Stored sender_id matches');

    const convRowA2 = await pool.query('SELECT * FROM conversations WHERE id = $1', [convIdA]);
    const updatedLastMsgTimeA2 = new Date(convRowA2.rows[0].last_message_at).getTime();
    const msgCreatedTimeA2 = new Date(msgRowA2.rows[0].created_at).getTime();
    assert(
      Math.abs(updatedLastMsgTimeA2 - msgCreatedTimeA2) < 1000,
      'conversations.last_message_at updated to match second message created_at'
    );

    // ── Test B: DM Send via conversationId (Existing Conversation) ───────────
    console.log('\n--- Test B: DM Send via conversationId (Existing Conversation) ---');
    // Wait briefly so timestamps differ
    await new Promise((r) => setTimeout(r, 50));

    const resB = await callSendMessage(
      { id: user2Id, type: 'member' },
      { conversationId: convIdA, messageText: 'Hey User 1, got your message!' }
    );

    assert(resB.statusCode === 201, `Status is 201 Created (got ${resB.statusCode})`);
    const msgIdB = resB.body?.message?.id;

    const msgRowB = await pool.query('SELECT * FROM messages WHERE id = $1', [msgIdB]);
    assert(msgRowB.rows.length === 1, 'Second message row inserted in database');
    assert(msgRowB.rows[0].sender_id === String(user2Id), 'Second message sender_id is User 2');

    const convRowB = await pool.query('SELECT * FROM conversations WHERE id = $1', [convIdA]);
    const updatedLastMsgTime = new Date(convRowB.rows[0].last_message_at).getTime();
    const msgCreatedTimeB = new Date(msgRowB.rows[0].created_at).getTime();
    assert(
      Math.abs(updatedLastMsgTime - msgCreatedTimeB) < 1000,
      'conversations.last_message_at advanced to second message created_at'
    );

    // ── Test C: Group Send (Participant vs Non-Participant) ──────────────────
    console.log('\n--- Test C: Group Send (Participant vs Non-Participant) ---');
    // Create group conversation
    const groupConvRes = await pool.query(
      `INSERT INTO conversations (is_group, group_name, status, messaging_restricted)
       VALUES (true, 'Test Engineering Group', 'ACTIVE', false) RETURNING id`
    );
    const groupConvId = groupConvRes.rows[0].id;
    testConvIds.push(groupConvId);

    // Add User 1 as member, User 2 as admin
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_id, participant_type, role)
       VALUES ($1, $2, 'member', 'member'), ($1, $3, 'member', 'admin')`,
      [groupConvId, user1Id, user2Id]
    );

    // Test C1: Group participant (User 1) sends
    const resC1 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { conversationId: groupConvId, messageText: 'Hello team!' }
    );
    assert(resC1.statusCode === 201, `Participant send succeeded with 201 (got ${resC1.statusCode})`);
    assert(resC1.body?.message?.messageText === 'Hello team!', 'Participant message text correct');

    // Test C2: Non-participant (User 3) attempts to send
    const resC2 = await callSendMessage(
      { id: user3Id, type: 'member' },
      { conversationId: groupConvId, messageText: 'Sneaking into group!' }
    );
    assert(resC2.statusCode === 403, `Non-participant rejected with 403 (got ${resC2.statusCode})`);
    assert(
      resC2.body?.error === 'Not a participant of this group',
      'Non-participant received correct error message'
    );

    // ── Test D: Reply Send ───────────────────────────────────────────────────
    console.log('\n--- Test D: Reply Send (Quoted Parent Message) ---');
    const resD = await callSendMessage(
      { id: user1Id, type: 'member' },
      {
        conversationId: convIdA,
        messageText: 'Replying to your second message',
        reply_to_message_id: msgIdB,
      }
    );

    assert(resD.statusCode === 201, `Reply send succeeded with 201 (got ${resD.statusCode})`);
    const msgIdD = resD.body?.message?.id;

    const msgRowD = await pool.query('SELECT * FROM messages WHERE id = $1', [msgIdD]);
    assert(msgRowD.rows.length === 1, 'Reply message inserted in database');
    assert(
      String(msgRowD.rows[0].reply_to_message_id) === String(msgIdB),
      `Stored reply_to_message_id (${msgRowD.rows[0].reply_to_message_id}) matches parent message (${msgIdB})`
    );

    // ── Test E: Block Handling ───────────────────────────────────────────────
    console.log('\n--- Test E: Block Handling ---');
    // E1: User 1 blocks User 3 -> User 1 tries to send to User 3 (sender is blocker)
    await pool.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`,
      [user1Id, user3Id]
    );

    const resE1 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { recipientId: user3Id, recipientType: 'member', messageText: 'Trying to send to someone I blocked' }
    );
    assert(resE1.statusCode === 403, `Blocker sending message rejected with 403 (got ${resE1.statusCode})`);
    assert(resE1.body?.error === 'you_have_blocked', 'Received you_have_blocked error code');

    // E2: User 1 is blocked BY User 3 -> User 3 sends to User 1 (sender is blocked)
    // Create new DM conversation between User 3 and User 1
    const resE2Conv = await callSendMessage(
      { id: user3Id, type: 'member' },
      { recipientId: user1Id, recipientType: 'member', messageText: 'I am blocked by User 1' }
    );
    assert(resE2Conv.statusCode === 201, `Blocked sender silently accepted with 201 (got ${resE2Conv.statusCode})`);
    const convIdE2 = resE2Conv.body?.message?.conversationId;
    if (convIdE2) testConvIds.push(convIdE2);

    const msgRowE2 = await pool.query('SELECT * FROM messages WHERE id = $1', [resE2Conv.body?.message?.id]);
    assert(msgRowE2.rows[0].is_hidden === true, 'Message inserted with is_hidden = true');

    const convRowE2 = await pool.query('SELECT last_message_at FROM conversations WHERE id = $1', [convIdE2]);
    assert(
      convRowE2.rows[0].last_message_at === null,
      'conversations.last_message_at is NOT updated when message is hidden'
    );

    // Clean up block
    await pool.query(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [user1Id, user3Id]);

    // ── Test F: Group Closed / Restricted ────────────────────────────────────
    console.log('\n--- Test F: Group Closed / Restricted ---');
    // F1: Group closed status
    await pool.query(`UPDATE conversations SET status = 'CLOSED' WHERE id = $1`, [groupConvId]);

    const resF1 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { conversationId: groupConvId, messageText: 'Posting in closed group' }
    );
    assert(resF1.statusCode === 403, `Closed group send rejected with 403 (got ${resF1.statusCode})`);
    assert(resF1.body?.error?.code === 'GROUP_CLOSED', 'Received error code GROUP_CLOSED');

    // F2: Announcement Mode (messaging_restricted = true)
    await pool.query(
      `UPDATE conversations SET status = 'ACTIVE', messaging_restricted = true WHERE id = $1`,
      [groupConvId]
    );

    // Regular member attempts to post in restricted group -> rejected
    const resF2Member = await callSendMessage(
      { id: user1Id, type: 'member' },
      { conversationId: groupConvId, messageText: 'Member posting in announcement group' }
    );
    assert(
      resF2Member.statusCode === 403,
      `Non-admin in restricted group rejected with 403 (got ${resF2Member.statusCode})`
    );
    assert(
      resF2Member.body?.error === 'Messaging is restricted to admins only',
      'Received correct restriction error'
    );

    // Admin attempts to post in restricted group -> allowed
    const resF2Admin = await callSendMessage(
      { id: user2Id, type: 'member' },
      { conversationId: groupConvId, messageText: 'Admin announcement!' }
    );
    assert(
      resF2Admin.statusCode === 201,
      `Admin in restricted group allowed with 201 (got ${resF2Admin.statusCode})`
    );

    // ── Test G: Validation Checks ────────────────────────────────────────────
    console.log('\n--- Test G: Input Validation Checks ---');
    // G1: Empty text for text message
    const resG1 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { conversationId: convIdA, messageText: '   ', messageType: 'text' }
    );
    assert(resG1.statusCode === 400, `Empty text message rejected with 400 (got ${resG1.statusCode})`);
    assert(resG1.body?.error === 'Message text is required', 'Correct empty text error message');

    // G2: Media message without metadata.url
    const resG2 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { conversationId: convIdA, messageType: 'image', metadata: {} }
    );
    assert(resG2.statusCode === 400, `Image message without url rejected with 400 (got ${resG2.statusCode})`);

    // G3: Self-DM attempt
    const resG3 = await callSendMessage(
      { id: user1Id, type: 'member' },
      { recipientId: user1Id, recipientType: 'member', messageText: 'Talking to myself' }
    );
    assert(resG3.statusCode === 400, `Self-DM rejected with 400 (got ${resG3.statusCode})`);
    assert(resG3.body?.error === 'Cannot send message to yourself', 'Correct self-DM error message');

  } catch (err) {
    console.error('\n❌ Unhandled test exception:', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (testMemberIds.length > 0) {
        await pool.query(
          `DELETE FROM user_blocks WHERE blocker_id = ANY($1) OR blocked_id = ANY($1)`,
          [testMemberIds]
        );
      }
      if (testConvIds.length > 0) {
        await pool.query(
          `DELETE FROM messages WHERE conversation_id = ANY($1)`,
          [testConvIds]
        );
        await pool.query(
          `DELETE FROM conversation_participants WHERE conversation_id = ANY($1)`,
          [testConvIds]
        );
        await pool.query(
          `DELETE FROM conversations WHERE id = ANY($1)`,
          [testConvIds]
        );
      }
      if (testMemberIds.length > 0) {
        await pool.query(
          `DELETE FROM members WHERE id = ANY($1)`,
          [testMemberIds]
        );
      }
      console.log('✅ Test fixtures cleaned up successfully.');
    } catch (cleanupErr) {
      console.error('⚠ Cleanup error:', cleanupErr.message);
    }
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
