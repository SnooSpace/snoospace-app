require('dotenv').config();
const { createPool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const boardPostController = require('../controllers/boardPostController');
const collabRequestController = require('../controllers/collabRequestController');

const pool = createPool();

// Helper to mock express req/res
function mockReqRes(reqData = {}) {
  const req = {
    user: reqData.user || { id: 1, type: 'community' },
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
    headers: reqData.headers || {},
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    getStatusCode() { return statusCode; },
    getData() { return responseData; },
  };

  return { req, res };
}

async function runVerification() {
  console.log('=== STARTING VERIFICATION OF BOARD COLLABS & MIGRATION 064 ===\n');

  try {
    // 0. Apply migration 063 then 064
    console.log('[0/7] Ensuring Migration 063 is applied...');
    const sql063Path = path.join(__dirname, '../migrations/063_collab_requests.sql');
    const sql063 = fs.readFileSync(sql063Path, 'utf8');
    await pool.query(sql063);
    console.log('✓ Migration 063 verified / applied.');

    console.log('[0/7] Applying Migration 064 SQL...');
    const sqlPath = path.join(__dirname, '../migrations/064_board_posts.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('✓ Migration 064 executed successfully.\n');

    // 1. Setup test entities:
    // Community A (Poster), Member B (Creator mode ON), Member C (Creator mode ON), Member D (Creator mode OFF)
    console.log('[Setup] Finding or creating test entities...');
    
    // Find or create Community
    let commRes = await pool.query(`SELECT id FROM communities LIMIT 1`);
    let commId;
    if (commRes.rows.length > 0) {
      commId = commRes.rows[0].id;
    } else {
      const newComm = await pool.query(`
        INSERT INTO communities (name, email, username)
        VALUES ('Test Verification Comm', 'testcomm_verify@snoospace.com', 'testcomm_verify')
        RETURNING id
      `);
      commId = newComm.rows[0].id;
    }

    // Fetch 3 existing members
    const membersRes = await pool.query(`SELECT id FROM members LIMIT 3`);
    if (membersRes.rows.length < 3) {
      throw new Error(`Need at least 3 members in DB to run test. Found: ${membersRes.rows.length}`);
    }

    const creator1Id = membersRes.rows[0].id;
    const creator2Id = membersRes.rows[1].id;
    const nonCreatorId = membersRes.rows[2].id;

    // Set creator mode flags
    await pool.query(`UPDATE members SET is_creator_mode_enabled = TRUE WHERE id IN ($1, $2)`, [creator1Id, creator2Id]);
    await pool.query(`UPDATE members SET is_creator_mode_enabled = FALSE WHERE id = $1`, [nonCreatorId]);

    console.log(`Entities ready: Comm=${commId}, Creator1=${creator1Id}, Creator2=${creator2Id}, NonCreator=${nonCreatorId}\n`);

    // =========================================================================
    // SCENARIO 1: Post fills exactly at spots_total & auto-declines remaining
    // =========================================================================
    console.log('--- Scenario 1: Post fills exactly at spots_total (spots=1, 2 applicants) ---');
    {
      // Create post with spots_total = 1
      const { req: pReq, res: pRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        body: {
          collab_type: 'cross_promo',
          title: 'Promo Video Collab',
          description: 'Looking for 1 creator for a promo video',
          spots_total: 1,
        },
      });
      await boardPostController.createPost(pReq, pRes);
      if (pRes.getStatusCode() !== 201) throw new Error(`Create post failed: ${JSON.stringify(pRes.getData())}`);
      const post = pRes.getData().post;
      console.log(`✓ Created board post #${post.id} (spots_total=1, spots_filled=0, status=open)`);

      // Creator 1 joins
      const { req: j1Req, res: j1Res } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        params: { id: post.id },
        body: { note: 'I would love to do this promo!' },
      });
      await boardPostController.joinPost(j1Req, j1Res);
      if (j1Res.getStatusCode() !== 201) throw new Error(`Join post by Creator 1 failed: ${JSON.stringify(j1Res.getData())}`);
      const req1 = j1Res.getData().request;
      console.log(`✓ Creator 1 submitted join-request #${req1.id}`);

      // Creator 2 joins
      const { req: j2Req, res: j2Res } = mockReqRes({
        user: { id: creator2Id, type: 'member' },
        params: { id: post.id },
        body: { note: 'Available immediately' },
      });
      await boardPostController.joinPost(j2Req, j2Res);
      if (j2Res.getStatusCode() !== 201) throw new Error(`Join post by Creator 2 failed: ${JSON.stringify(j2Res.getData())}`);
      const req2 = j2Res.getData().request;
      console.log(`✓ Creator 2 submitted join-request #${req2.id}`);

      // Poster accepts Creator 1
      const { req: aReq, res: aRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        params: { id: req1.id },
      });
      await collabRequestController.acceptRequest(aReq, aRes);
      if (aRes.getStatusCode() !== 200) throw new Error(`Accept request failed: ${JSON.stringify(aRes.getData())}`);
      console.log(`✓ Poster accepted Creator 1 join-request #${req1.id}`);

      // Check board post state: should be filled (1/1 spots, status='filled')
      const postCheck = await pool.query(`SELECT status, spots_filled, spots_total FROM board_posts WHERE id = $1`, [post.id]);
      const pRow = postCheck.rows[0];
      if (pRow.status !== 'filled' || pRow.spots_filled !== 1) {
        throw new Error(`Board post state unexpected: ${JSON.stringify(pRow)}`);
      }
      console.log(`✓ Post #${post.id} auto-updated to status='filled', spots_filled=1/1`);

      // Check Creator 2 request: should be auto-declined with decline_reason='position_filled'
      const req2Check = await pool.query(`SELECT status, decline_reason FROM collab_requests WHERE id = $1`, [req2.id]);
      const r2Row = req2Check.rows[0];
      if (r2Row.status !== 'declined' || r2Row.decline_reason !== 'position_filled') {
        throw new Error(`Creator 2 request not auto-declined: ${JSON.stringify(r2Row)}`);
      }
      console.log(`✓ Creator 2 request #${req2.id} auto-declined with reason='position_filled'`);
      console.log('PASSED Scenario 1\n');
    }

    // =========================================================================
    // SCENARIO 2: Manual /close declines all pending join requests
    // =========================================================================
    console.log('--- Scenario 2: Manual /close by poster ---');
    {
      // Create post with spots_total = 3
      const { req: pReq, res: pRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        body: {
          collab_type: 'event_partnership',
          title: 'Event Partner Search',
          description: 'Need partners for upcoming summit',
          spots_total: 3,
        },
      });
      await boardPostController.createPost(pReq, pRes);
      const post = pRes.getData().post;
      console.log(`✓ Created board post #${post.id} (spots_total=3)`);

      // Creator 1 & Creator 2 both apply
      const { req: j1Req, res: j1Res } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        params: { id: post.id },
      });
      await boardPostController.joinPost(j1Req, j1Res);
      const req1 = j1Res.getData().request;

      const { req: j2Req, res: j2Res } = mockReqRes({
        user: { id: creator2Id, type: 'member' },
        params: { id: post.id },
      });
      await boardPostController.joinPost(j2Req, j2Res);
      const req2 = j2Res.getData().request;

      console.log(`✓ Join requests created (#${req1.id}, #${req2.id})`);

      // Poster manually closes post
      const { req: cReq, res: cRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        params: { id: post.id },
      });
      await boardPostController.closePost(cReq, cRes);
      if (cRes.getStatusCode() !== 200) throw new Error(`Close post failed: ${JSON.stringify(cRes.getData())}`);
      console.log(`✓ Poster manually closed post #${post.id}`);

      // Verify post status is 'closed'
      const postCheck = await pool.query(`SELECT status, closed_at FROM board_posts WHERE id = $1`, [post.id]);
      if (postCheck.rows[0].status !== 'closed' || !postCheck.rows[0].closed_at) {
        throw new Error(`Post not marked closed: ${JSON.stringify(postCheck.rows[0])}`);
      }

      // Verify both requests declined with position_filled
      const reqsCheck = await pool.query(
        `SELECT id, status, decline_reason FROM collab_requests WHERE id IN ($1, $2)`,
        [req1.id, req2.id]
      );
      for (const r of reqsCheck.rows) {
        if (r.status !== 'declined' || r.decline_reason !== 'position_filled') {
          throw new Error(`Request ${r.id} not properly declined: ${JSON.stringify(r)}`);
        }
      }
      console.log(`✓ All pending join requests auto-declined with reason='position_filled'`);
      console.log('PASSED Scenario 2\n');
    }

    // =========================================================================
    // SCENARIO 3: Direct (non-board) accept is unaffected
    // =========================================================================
    console.log('--- Scenario 3: Direct (non-board) accept is unaffected ---');
    {
      // Creator 1 sends direct request to Community
      const { req: dReq, res: dRes } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        body: {
          receiver_id: commId,
          receiver_type: 'community',
          collab_type: 'guest_collab',
          pitch_text: 'Direct collab pitch for guest appearance',
        },
      });
      await collabRequestController.createRequest(dReq, dRes);
      if (dRes.getStatusCode() !== 201) throw new Error(`Direct request failed: ${JSON.stringify(dRes.getData())}`);
      const directReq = dRes.getData().request;
      console.log(`✓ Direct request #${directReq.id} created (source=${directReq.source || 'direct'}, board_post_id=${directReq.board_post_id})`);

      // Community accepts direct request
      const { req: aReq, res: aRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        params: { id: directReq.id },
      });
      await collabRequestController.acceptRequest(aReq, aRes);
      if (aRes.getStatusCode() !== 200) throw new Error(`Accept direct request failed: ${JSON.stringify(aRes.getData())}`);

      const dCheck = await pool.query(`SELECT status, linked_chat_thread_id FROM collab_requests WHERE id = $1`, [directReq.id]);
      if (dCheck.rows[0].status !== 'accepted' || !dCheck.rows[0].linked_chat_thread_id) {
        throw new Error(`Direct request accept failed: ${JSON.stringify(dCheck.rows[0])}`);
      }
      console.log(`✓ Direct request accepted successfully, chat thread #${dCheck.rows[0].linked_chat_thread_id} opened`);
      console.log('PASSED Scenario 3\n');
    }

    // =========================================================================
    // SCENARIO 4: Duplicate join rejected (409)
    // =========================================================================
    console.log('--- Scenario 4: Duplicate join rejected (409) ---');
    {
      // Create post
      const { req: pReq, res: pRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        body: {
          collab_type: 'guest_collab',
          title: 'Guest Speaker',
          description: 'Guest speaker spot',
          spots_total: 2,
        },
      });
      await boardPostController.createPost(pReq, pRes);
      const post = pRes.getData().post;

      // Creator 1 joins first time
      const { req: j1Req, res: j1Res } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        params: { id: post.id },
        body: { note: 'First application' },
      });
      await boardPostController.joinPost(j1Req, j1Res);
      if (j1Res.getStatusCode() !== 201) throw new Error(`First join failed`);

      // Creator 1 joins second time -> MUST return 409
      const { req: j2Req, res: j2Res } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        params: { id: post.id },
        body: { note: 'Second attempt' },
      });
      await boardPostController.joinPost(j2Req, j2Res);
      if (j2Res.getStatusCode() !== 409) {
        throw new Error(`Expected 409 on duplicate join, got ${j2Res.getStatusCode()}`);
      }
      console.log(`✓ Duplicate join rejected with 409: "${j2Res.getData().error}"`);
      console.log('PASSED Scenario 4\n');
    }

    // =========================================================================
    // SCENARIO 5: Non-poster cannot close (403)
    // =========================================================================
    console.log('--- Scenario 5: Non-poster cannot close (403) ---');
    {
      const { req: pReq, res: pRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        body: {
          collab_type: 'custom',
          title: 'Private Listing',
          description: 'Only owner can close',
          spots_total: 2,
        },
      });
      await boardPostController.createPost(pReq, pRes);
      const post = pRes.getData().post;

      // Creator 1 attempts to close Community's post
      const { req: cReq, res: cRes } = mockReqRes({
        user: { id: creator1Id, type: 'member' },
        params: { id: post.id },
      });
      await boardPostController.closePost(cReq, cRes);
      if (cRes.getStatusCode() !== 403) {
        throw new Error(`Expected 403 for unauthorized close, got ${cRes.getStatusCode()}`);
      }
      console.log(`✓ Unauthorized close rejected with 403: "${cRes.getData().error}"`);
      console.log('PASSED Scenario 5\n');
    }

    // =========================================================================
    // SCENARIO 6: Creator-mode gate on join (403 for non-creator member)
    // =========================================================================
    console.log('--- Scenario 6: Creator-mode gate on join (403) ---');
    {
      const { req: pReq, res: pRes } = mockReqRes({
        user: { id: commId, type: 'community' },
        body: {
          collab_type: 'sponsorship',
          title: 'Creator Only Spot',
          description: 'Only creators can apply',
          spots_total: 2,
        },
      });
      await boardPostController.createPost(pReq, pRes);
      const post = pRes.getData().post;

      // Non-creator member attempts to join
      const { req: jReq, res: jRes } = mockReqRes({
        user: { id: nonCreatorId, type: 'member' },
        params: { id: post.id },
      });
      await boardPostController.joinPost(jReq, jRes);
      if (jRes.getStatusCode() !== 403) {
        throw new Error(`Expected 403 for non-creator join, got ${jRes.getStatusCode()}`);
      }
      console.log(`✓ Non-creator join rejected with 403: "${jRes.getData().error}"`);
      console.log('PASSED Scenario 6\n');
    }

    // Cleanup test posts and requests created during test
    console.log('[Cleanup] Cleaning up test posts and requests...');
    await pool.query(`DELETE FROM board_posts WHERE title IN ('Promo Video Collab', 'Event Partner Search', 'Guest Speaker', 'Private Listing', 'Creator Only Spot')`);
    await pool.query(`DELETE FROM collab_requests WHERE pitch_text = 'Direct collab pitch for guest appearance'`);
    console.log('✓ Cleanup complete.\n');

    console.log('====================================================');
    console.log('🎉 ALL 6 VERIFICATION SCENARIOS PASSED WITH ZERO ERRORS');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
  }
}

runVerification();
