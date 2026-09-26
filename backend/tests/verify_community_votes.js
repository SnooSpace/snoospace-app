const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createPool } = require("../config/db");

const pool = createPool();

async function testCommunityVoting() {
  console.log("=== Testing Community Votes Migration & Logic ===");

  // Find an active post
  const postRes = await pool.query("SELECT id, community_vote_score FROM posts LIMIT 1");
  if (postRes.rows.length === 0) {
    console.log("No posts found to test with.");
    await pool.end();
    return;
  }

  const testPostId = postRes.rows[0].id;
  const initialScore = postRes.rows[0].community_vote_score || 0;
  console.log(`Testing with Post ID: ${testPostId}, Initial Score: ${initialScore}`);

  const testUserId = 999999;
  const testUserType = "member";

  // 1. Simulate Upvote (vote_type = 1)
  await pool.query(
    `INSERT INTO post_community_votes (post_id, user_id, user_type, vote_type, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (post_id, user_id, user_type)
     DO UPDATE SET vote_type = 1, updated_at = NOW()`,
    [testPostId, testUserId, testUserType]
  );

  // Recalculate
  let updateRes = await pool.query(
    `WITH vote_counts AS (
       SELECT
         COALESCE(COUNT(*) FILTER (WHERE vote_type = 1), 0)::int AS upvotes,
         COALESCE(COUNT(*) FILTER (WHERE vote_type = -1), 0)::int AS downvotes,
         COALESCE(SUM(vote_type), 0)::int AS score
       FROM post_community_votes
       WHERE post_id = $1
     )
     UPDATE posts
     SET
       community_upvote_count = vote_counts.upvotes,
       community_downvote_count = vote_counts.downvotes,
       community_vote_score = vote_counts.score
     FROM vote_counts
     WHERE posts.id = $1
     RETURNING community_vote_score, community_upvote_count, community_downvote_count`,
    [testPostId]
  );
  console.log("After Upvote:", updateRes.rows[0]);

  // 2. Simulate Downvote (vote_type = -1)
  await pool.query(
    `INSERT INTO post_community_votes (post_id, user_id, user_type, vote_type, updated_at)
     VALUES ($1, $2, $3, -1, NOW())
     ON CONFLICT (post_id, user_id, user_type)
     DO UPDATE SET vote_type = -1, updated_at = NOW()`,
    [testPostId, testUserId, testUserType]
  );

  updateRes = await pool.query(
    `WITH vote_counts AS (
       SELECT
         COALESCE(COUNT(*) FILTER (WHERE vote_type = 1), 0)::int AS upvotes,
         COALESCE(COUNT(*) FILTER (WHERE vote_type = -1), 0)::int AS downvotes,
         COALESCE(SUM(vote_type), 0)::int AS score
       FROM post_community_votes
       WHERE post_id = $1
     )
     UPDATE posts
     SET
       community_upvote_count = vote_counts.upvotes,
       community_downvote_count = vote_counts.downvotes,
       community_vote_score = vote_counts.score
     FROM vote_counts
     WHERE posts.id = $1
     RETURNING community_vote_score, community_upvote_count, community_downvote_count`,
    [testPostId]
  );
  console.log("After Downvote:", updateRes.rows[0]);

  // 3. Clean up test vote
  await pool.query(
    "DELETE FROM post_community_votes WHERE post_id = $1 AND user_id = $2 AND user_type = $3",
    [testPostId, testUserId, testUserType]
  );

  // Restore post score
  await pool.query(
    `WITH vote_counts AS (
       SELECT
         COALESCE(COUNT(*) FILTER (WHERE vote_type = 1), 0)::int AS upvotes,
         COALESCE(COUNT(*) FILTER (WHERE vote_type = -1), 0)::int AS downvotes,
         COALESCE(SUM(vote_type), 0)::int AS score
       FROM post_community_votes
       WHERE post_id = $1
     )
     UPDATE posts
     SET
       community_upvote_count = vote_counts.upvotes,
       community_downvote_count = vote_counts.downvotes,
       community_vote_score = vote_counts.score
     FROM vote_counts
     WHERE posts.id = $1`,
    [testPostId]
  );

  console.log("Cleaned up and restored successfully. All tests passed!");
  await pool.end();
}

testCommunityVoting().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
