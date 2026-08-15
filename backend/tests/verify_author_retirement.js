/**
 * verify_author_retirement.js
 *
 * Automated verification test suite for Author-Bypass Removal from Retirement Logic:
 * 1. Own Post Initial Visibility in Home Feed
 * 2. Own Post Strike 1 (Light Penalty, Still Visible)
 * 3. Own Post Strike 2 (Retired from Author's Home Feed)
 * 4. Own Post Profile Visibility Preservation (Always Visible in getUserPosts)
 * 5. Untimed Self-Like Immediate Retirement from Author's Home Feed
 * 6. 15-Day Cooldown Expiry (Reappears in Feed)
 * 7. Qualified View / Dwell Slate Reset (Reappears in Feed)
 * 8. Non-Author Regression Check (Strikes & Likes continue to retire external posts)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

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

// Helper to query getFeed SQL directly
async function queryFeed(userId, userType) {
  const query = `
    SELECT 
      p.id,
      p.caption,
      p.author_id,
      p.author_type,
      CASE
        WHEN pis_rank.rank_penalty_tier = 'heavy'
         AND pis_rank.rank_penalty_until IS NOT NULL
         AND NOW() < pis_rank.rank_penalty_until
        THEN p.created_at - INTERVAL '10 days'
        WHEN pis_rank.rank_penalty_tier = 'light'
         AND pis_rank.rank_penalty_until IS NOT NULL
         AND NOW() < pis_rank.rank_penalty_until
        THEN p.created_at - INTERVAL '3 days'
        ELSE p.created_at
      END AS effective_sort_time
    FROM posts p
    LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
    LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
    LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
    LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
    LEFT JOIN post_impression_state pis_rank
      ON pis_rank.user_id = $1
     AND pis_rank.user_type = $2
     AND pis_rank.post_id = p.id
    WHERE (
      (p.author_id = $1 AND p.author_type = $2)
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.follower_type = $2
          AND f.following_id = p.author_id AND f.following_type = p.author_type
          AND f.is_superseded_by_circle = false
          AND p.created_at >= f.created_at - INTERVAL '7 days'
      )
    )
    AND p.post_type NOT IN ('plan_promo', 'event_promo')
    -- 3. Exclude posts the viewer has retired (two-strike unseen rule or untimed like)
    AND NOT EXISTS (
      SELECT 1 FROM post_impression_state pis
      WHERE pis.user_id = $1
        AND pis.user_type = $2
        AND pis.post_id = p.id
        AND pis.retired_at IS NOT NULL
        AND pis.retired_at > NOW() - INTERVAL '15 days'
    )
    -- 4. Exclude backlog posts engaged with
    AND NOT (
      (p.author_id != $1 OR p.author_type != $2)
      AND (
        EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.liker_id = $1 AND pl.liker_type = $2)
        OR EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = $1 AND pc.commenter_type = $2)
      )
      AND NOT EXISTS (
        SELECT 1 FROM follows f_e
        WHERE f_e.follower_id = $1 AND f_e.follower_type = $2
          AND f_e.following_id = p.author_id AND f_e.following_type = p.author_type
          AND f_e.created_at <= p.created_at
      )
    )
    ORDER BY effective_sort_time DESC, p.id DESC
  `;
  const res = await pool.query(query, [userId, userType]);
  return res.rows;
}

// Helper to query getUserPosts SQL directly
async function queryUserPosts(authorId, authorType, viewerId, viewerType) {
  const query = `
    SELECT p.id, p.caption, p.author_id, p.author_type
    FROM posts p
    WHERE p.author_id = $1 AND p.author_type = $2
      AND p.post_type != 'community_voice'
    ORDER BY COALESCE(p.is_pinned, FALSE) DESC, p.created_at DESC
  `;
  const res = await pool.query(query, [authorId, authorType]);
  return res.rows;
}

// Helper to simulate submitUnseenImpression
async function submitUnseen(userId, userType, postId, sessionId) {
  await pool.query(
    `INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, last_session_id,
                                        rank_penalty_tier, rank_penalty_until)
     VALUES ($1, $2, $3, 1, $4, 'light', NOW() + INTERVAL '5 days')
     ON CONFLICT (user_id, user_type, post_id)
     DO UPDATE SET
       unseen_count = CASE
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
         THEN LEAST(post_impression_state.unseen_count + 1, 2)
         ELSE post_impression_state.unseen_count
       END,
       last_session_id = EXCLUDED.last_session_id,
       retired_at = CASE
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
           AND post_impression_state.unseen_count + 1 >= 2
         THEN COALESCE(post_impression_state.retired_at, NOW())
         ELSE post_impression_state.retired_at
       END,
       rank_penalty_tier = CASE
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
           AND post_impression_state.unseen_count + 1 >= 2
         THEN NULL
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
         THEN 'light'
         ELSE post_impression_state.rank_penalty_tier
       END,
       rank_penalty_until = CASE
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
           AND post_impression_state.unseen_count + 1 >= 2
         THEN NULL
         WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
         THEN NOW() + INTERVAL '5 days'
         ELSE post_impression_state.rank_penalty_until
       END
     WHERE post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id`,
    [userId, userType, postId, sessionId]
  );
}

// Helper to simulate likePost (untimed content branch)
async function simulateLike(userId, userType, postId) {
  await pool.query(
    `INSERT INTO post_likes (post_id, liker_id, liker_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id, liker_id, liker_type) DO NOTHING`,
    [postId, userId, userType]
  );
  await pool.query(
    `INSERT INTO post_impression_state
       (user_id, user_type, post_id, unseen_count, retired_at, rank_penalty_tier, rank_penalty_until)
     VALUES ($1, $2, $3, 0, NOW(), NULL, NULL)
     ON CONFLICT (user_id, user_type, post_id)
     DO UPDATE SET
       unseen_count       = 0,
       retired_at         = COALESCE(post_impression_state.retired_at, NOW()),
       rank_penalty_tier  = NULL,
       rank_penalty_until = NULL`,
    [userId, userType, postId]
  );
}

// Helper to simulate qualified view reset
async function simulateQualifiedView(userId, userType, postId) {
  await pool.query(
    `UPDATE post_impression_state
     SET unseen_count = 0,
         retired_at = NULL,
         rank_penalty_tier = NULL,
         rank_penalty_until = NULL
     WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
    [userId, userType, postId]
  );
}

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING VERIFICATION: Author-Bypass Removal from Retirement Logic');
  console.log('======================================================================\n');

  // Setup: Find or create test users
  const user1Res = await pool.query(`SELECT id FROM members LIMIT 1`);
  const user2Res = await pool.query(`SELECT id FROM members OFFSET 1 LIMIT 1`);
  
  if (user1Res.rows.length === 0 || user2Res.rows.length === 0) {
    throw new Error("Need at least 2 member records in DB to run test");
  }

  const user1Id = user1Res.rows[0].id;
  const user2Id = user2Res.rows[0].id;
  const userType = 'member';

  console.log(`Using Test User 1 (Author): id=${user1Id}, type=${userType}`);
  console.log(`Using Test User 2 (Viewer): id=${user2Id}, type=${userType}\n`);

  let postAId, postBId, postCId;

  try {
    // -------------------------------------------------------------------------
    // SETUP POSTS
    // -------------------------------------------------------------------------
    const createPostARes = await pool.query(`
      INSERT INTO posts (author_id, author_type, caption, post_type, status, image_urls, created_at)
      VALUES ($1, $2, 'Test Post A - Two Strike Retirement Test', 'text', 'active', '[]', NOW())
      RETURNING id
    `, [user1Id, userType]);
    postAId = createPostARes.rows[0].id;

    const createPostBRes = await pool.query(`
      INSERT INTO posts (author_id, author_type, caption, post_type, status, image_urls, created_at)
      VALUES ($1, $2, 'Test Post B - Self Like Retirement Test', 'prompt', 'active', '[]', NOW())
      RETURNING id
    `, [user1Id, userType]);
    postBId = createPostBRes.rows[0].id;

    const createPostCRes = await pool.query(`
      INSERT INTO posts (author_id, author_type, caption, post_type, status, image_urls, created_at)
      VALUES ($1, $2, 'Test Post C - Non-Author Regression Test', 'media', 'active', '[]', NOW())
      RETURNING id
    `, [user1Id, userType]);
    postCId = createPostCRes.rows[0].id;

    // Ensure User 2 follows User 1 for non-author test
    await pool.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, created_at, is_superseded_by_circle)
      VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 hour', false)
      ON CONFLICT DO NOTHING
    `, [user2Id, userType, user1Id, userType]);

    const crypto = require('crypto');
    const session1 = crypto.randomUUID();
    const session2 = crypto.randomUUID();
    const session3 = crypto.randomUUID();
    const session4 = crypto.randomUUID();

    // -------------------------------------------------------------------------
    // TEST 1: Own Post Initial Visibility in Home Feed
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Own Post Initial Visibility in Home Feed ---');
    const feedInitial = await queryFeed(user1Id, userType);
    const hasPostAInitial = feedInitial.some(p => p.id === postAId);
    assert(hasPostAInitial, `Author's fresh Post A (${postAId}) is visible in author's own Home Feed`);

    // -------------------------------------------------------------------------
    // TEST 2: Own Post Strike 1 (Light Penalty, Still in Feed)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Own Post Strike 1 (Light Penalty, Still Visible) ---');
    await submitUnseen(user1Id, userType, postAId, session1);
    const stateStrike1 = await pool.query(
      `SELECT unseen_count, rank_penalty_tier, retired_at FROM post_impression_state
       WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
      [user1Id, userType, postAId]
    );
    assert(stateStrike1.rows[0]?.unseen_count === 1, 'unseen_count is 1 after Strike 1');
    assert(stateStrike1.rows[0]?.rank_penalty_tier === 'light', 'rank_penalty_tier is "light" after Strike 1');
    assert(stateStrike1.rows[0]?.retired_at === null, 'retired_at is NULL after Strike 1');

    const feedStrike1 = await queryFeed(user1Id, userType);
    const hasPostAStrike1 = feedStrike1.some(p => p.id === postAId);
    assert(hasPostAStrike1, `Post A (${postAId}) remains visible in author's feed after Strike 1`);

    // -------------------------------------------------------------------------
    // TEST 3: Own Post Strike 2 (Disappears from Author's Home Feed)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Own Post Strike 2 (Retired from Author Home Feed) ---');
    await submitUnseen(user1Id, userType, postAId, session2);
    const stateStrike2 = await pool.query(
      `SELECT unseen_count, rank_penalty_tier, retired_at FROM post_impression_state
       WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
      [user1Id, userType, postAId]
    );
    assert(stateStrike2.rows[0]?.unseen_count === 2, 'unseen_count is 2 after Strike 2');
    assert(stateStrike2.rows[0]?.retired_at !== null, 'retired_at is set to timestamp after Strike 2');

    const feedStrike2 = await queryFeed(user1Id, userType);
    const hasPostAStrike2 = feedStrike2.some(p => p.id === postAId);
    assert(!hasPostAStrike2, `Post A (${postAId}) is NO LONGER visible in author's Home Feed after Strike 2`);

    // -------------------------------------------------------------------------
    // TEST 4: Own Post Profile Visibility Preservation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Own Post Profile Visibility Preservation ---');
    const userPosts = await queryUserPosts(user1Id, userType, user1Id, userType);
    const hasPostAProfile = userPosts.some(p => p.id === postAId);
    assert(hasPostAProfile, `Retired Post A (${postAId}) is STILL fully visible on author's profile view (getUserPosts)`);

    // -------------------------------------------------------------------------
    // TEST 5: Untimed Self-Like Immediate Retirement from Home Feed
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Untimed Self-Like Immediate Retirement from Home Feed ---');
    const feedBeforeLike = await queryFeed(user1Id, userType);
    assert(feedBeforeLike.some(p => p.id === postBId), `Post B (${postBId}) is visible in feed before self-like`);

    await simulateLike(user1Id, userType, postBId);
    const stateSelfLike = await pool.query(
      `SELECT unseen_count, retired_at FROM post_impression_state
       WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
      [user1Id, userType, postBId]
    );
    assert(stateSelfLike.rows[0]?.retired_at !== null, 'retired_at is set immediately on self-like of untimed post');

    const feedAfterLike = await queryFeed(user1Id, userType);
    assert(!feedAfterLike.some(p => p.id === postBId), `Post B (${postBId}) is IMMEDIATELY retired/hidden from author's Home Feed after self-like`);

    const userPostsAfterLike = await queryUserPosts(user1Id, userType, user1Id, userType);
    assert(userPostsAfterLike.some(p => p.id === postBId), `Liked Post B (${postBId}) is STILL visible on author's profile view`);

    // -------------------------------------------------------------------------
    // TEST 6: 15-Day Cooldown Expiry
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: 15-Day Cooldown Expiry ---');
    await pool.query(
      `UPDATE post_impression_state
       SET retired_at = NOW() - INTERVAL '16 days'
       WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
      [user1Id, userType, postAId]
    );
    const feedAfterCooldown = await queryFeed(user1Id, userType);
    assert(feedAfterCooldown.some(p => p.id === postAId), `Post A (${postAId}) reappears in author's feed after 15-day cooldown expires`);

    // -------------------------------------------------------------------------
    // TEST 7: Qualified View / Dwell Slate Reset
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Qualified View / Dwell Slate Reset ---');
    await simulateQualifiedView(user1Id, userType, postBId);
    const feedAfterReset = await queryFeed(user1Id, userType);
    assert(feedAfterReset.some(p => p.id === postBId), `Post B (${postBId}) reappears in author's feed after qualified dwell reset`);

    // -------------------------------------------------------------------------
    // TEST 8: Non-Author Regression Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Non-Author Regression Check ---');
    const feedUser2Initial = await queryFeed(user2Id, userType);
    assert(feedUser2Initial.some(p => p.id === postCId), `Post C (${postCId}) is visible in follower User 2's feed`);

    // User 2 Strike 1 & 2
    await submitUnseen(user2Id, userType, postCId, session3);
    await submitUnseen(user2Id, userType, postCId, session4);

    const feedUser2Retired = await queryFeed(user2Id, userType);
    assert(!feedUser2Retired.some(p => p.id === postCId), `Post C (${postCId}) is retired from User 2's feed after 2 strikes`);

    // Verify Author User 1's feed still shows Post C (User 1 has not retired it)
    const feedUser1PostC = await queryFeed(user1Id, userType);
    assert(feedUser1PostC.some(p => p.id === postCId), `Post C (${postCId}) remains in Author User 1's feed (unaffected by User 2's strikes)`);

    console.log('\n======================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================');

  } finally {
    // Cleanup test records
    console.log('\nCleaning up test posts and impression states...');
    const testIds = [postAId, postBId, postCId].filter(Boolean);
    if (testIds.length > 0) {
      await pool.query(`DELETE FROM post_likes WHERE post_id = ANY($1::int[])`, [testIds]);
      await pool.query(`DELETE FROM post_impression_state WHERE post_id = ANY($1::int[])`, [testIds]);
      await pool.query(`DELETE FROM posts WHERE id = ANY($1::int[])`, [testIds]);
    }
    await pool.end();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
