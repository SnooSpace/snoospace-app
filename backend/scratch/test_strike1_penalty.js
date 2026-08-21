/**
 * Strike-1 Penalty Consistency Test for /posts/discovery scoring
 * ==============================================================
 * Verifies that a discovery candidate's discovery_score drops by ~70%
 * (i.e., raw_score * 0.3) once rank_penalty_tier='light' is applied
 * for that viewer/post pair.
 *
 * Strategy:
 *   - Runs the exact scoring CTE from getDiscoveryPosts directly via SQL
 *     (avoids needing a live JWT for HTTP calls; same query, same result).
 *   - If no non-followed editorial post exists in the current candidate pool,
 *     synthesises one via direct INSERT (test_member author + test post),
 *     clearly marked, removed on cleanup.
 *   - Upserts a light-penalty row into post_impression_state, re-scores,
 *     asserts ~70% drop, then reverts all changes.
 *
 * Usage:  node backend/scratch/test_strike1_penalty.js
 * Safe:   fully cleans up after itself; re-runnable.
 */

'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ── Scoring CTE — identical to getDiscoveryPosts in postController.js ────────
// Parameterised: $1 = userId, $2 = userType (viewer).
// Returns one row per matching candidate with raw_discovery_score and discovery_score.
const SCORING_QUERY = `
  WITH engagement_raw AS (
    SELECT p.post_type, SUM(1.0) AS weight
      FROM post_likes l JOIN posts p ON l.post_id = p.id
     WHERE l.liker_id = $1 AND l.liker_type = $2 GROUP BY p.post_type
    UNION ALL
    SELECT p.post_type, SUM(2.0) AS weight
      FROM post_comments c JOIN posts p ON c.post_id = p.id
     WHERE c.commenter_id = $1 AND c.commenter_type = $2 GROUP BY p.post_type
    UNION ALL
    SELECT p.post_type, SUM(3.0) AS weight
      FROM post_saves s JOIN posts p ON s.post_id = p.id
     WHERE s.saver_id = $1 AND s.saver_type = $2 GROUP BY p.post_type
    UNION ALL
    SELECT p.post_type, SUM(3.0) AS weight
      FROM post_shares sh JOIN posts p ON sh.post_id = p.id
     WHERE sh.sharer_id = $1 AND sh.sharer_type = $2 GROUP BY p.post_type
  ),
  engagement_agg AS (
    SELECT post_type, SUM(weight) AS total_weight FROM engagement_raw GROUP BY post_type
  ),
  engagement_max AS (
    SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
  ),
  engagement_norm AS (
    SELECT ea.post_type, ea.total_weight / em.max_weight AS engagement_score
      FROM engagement_agg ea CROSS JOIN engagement_max em
  ),
  dwell_aff AS (
    SELECT post_type, AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score
      FROM unique_view_events WHERE user_id = $1 AND user_type = $2 GROUP BY post_type
  )
  SELECT
    p.id,
    p.post_type,
    COALESCE(en.engagement_score, 0)::float AS engagement_score,
    COALESCE(da.dwell_score, 0)::float       AS dwell_score,
    (
      (COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)
       +COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
      / GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0, 1.0)
    ) AS popularity_score,
    pis_disc.rank_penalty_tier AS penalty_tier,
    -- raw score (pre-penalty)
    (
      COALESCE(en.engagement_score, 0)
      + COALESCE(da.dwell_score, 0)
      + (COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)
         +COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
        / GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0, 1.0)
    )::float AS raw_discovery_score,
    -- penalised score (the column getDiscoveryPosts actually sorts on)
    CASE
      WHEN pis_disc.rank_penalty_tier = 'light'
       AND pis_disc.rank_penalty_until IS NOT NULL
       AND NOW() < pis_disc.rank_penalty_until
      THEN (
        COALESCE(en.engagement_score, 0)
        + COALESCE(da.dwell_score, 0)
        + (COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)
           +COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
          / GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0, 1.0)
      ) * 0.3
      ELSE (
        COALESCE(en.engagement_score, 0)
        + COALESCE(da.dwell_score, 0)
        + (COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)
           +COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
          / GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0, 1.0)
      )
    END::float AS discovery_score
  FROM posts p
  LEFT JOIN engagement_norm en  ON en.post_type  = p.post_type
  LEFT JOIN dwell_aff da        ON da.post_type  = p.post_type
  LEFT JOIN post_impression_state pis_disc
    ON pis_disc.user_id = $1 AND pis_disc.user_type = $2 AND pis_disc.post_id = p.id
  WHERE
    p.post_type IN ('media','community_voice')
    AND p.created_at >= NOW() - INTERVAL '5 days'
    AND p.post_type NOT IN ('plan_promo','event_promo')
    AND NOT (p.author_id = $1 AND p.author_type = $2)
    AND NOT EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id=$1 AND f.follower_type=$2
        AND f.following_id=p.author_id AND f.following_type=p.author_type
        AND f.is_superseded_by_circle=false)
    AND NOT (p.author_type='member' AND EXISTS (
      SELECT 1 FROM creator_follows cf
      WHERE cf.follower_id=$1 AND cf.follower_type=$2
        AND cf.creator_id=p.author_id AND cf.is_dormant=false
        AND cf.is_superseded_by_circle=false))
    AND NOT ($2='member' AND p.author_type='member' AND EXISTS (
      SELECT 1 FROM circles ci
      WHERE (ci.user_a_id=$1 AND ci.user_b_id=p.author_id)
         OR (ci.user_b_id=$1 AND ci.user_a_id=p.author_id)))
    AND NOT ($2='community' AND p.author_type='member' AND EXISTS (
      SELECT 1 FROM community_member_circles cc
      WHERE cc.community_id=$1 AND cc.member_id=p.author_id))
    AND NOT ($2='member' AND p.author_type='community' AND EXISTS (
      SELECT 1 FROM community_member_circles cc
      WHERE cc.community_id=p.author_id AND cc.member_id=$1))
    AND NOT EXISTS (
      SELECT 1 FROM post_impression_state pis
      WHERE pis.user_id=$1 AND pis.user_type=$2 AND pis.post_id=p.id
        AND pis.retired_at IS NOT NULL AND pis.retired_at > NOW()-INTERVAL '15 days')
    AND NOT ((p.expires_at IS NULL OR p.expires_at<=NOW()) AND EXISTS (
      SELECT 1 FROM post_likes pl
      WHERE pl.post_id=p.id AND pl.liker_id=$1 AND pl.liker_type=$2))
    -- Filter to this specific post when provided
    AND ($3::int IS NULL OR p.id = $3)
  ORDER BY discovery_score DESC
  LIMIT 10
`;

// ── Floating-point tolerance for the 0.3× assertion ─────────────────────────
const TOLERANCE = 0.0001;

function approxEqual(a, b, tol = TOLERANCE) {
  return Math.abs(a - b) <= tol;
}

async function main() {
  const client = await pool.connect();

  // Track what synthetic data we inserted so cleanup is always complete
  const synthetic = {
    memberId:  null,  // test author member row
    postId:    null,  // test post row
    pisRowKey: null,  // { userId, userType, postId } — pis row to revert/delete
    pisWasNew: false, // true if we inserted pis row (delete on cleanup), false if we updated (revert)
    pisOldTier: null, // original tier value if row existed pre-test
    pisOldUntil: null, // original until value if row existed pre-test
  };

  // Viewer: use the first member in the DB
  let viewer;

  try {
    // ── STEP 0: Pick viewer ───────────────────────────────────────────────────
    const viewerRes = await client.query(
      `SELECT id, 'member' AS type, name FROM members ORDER BY id LIMIT 1`
    );
    if (viewerRes.rows.length === 0) throw new Error('No members in DB — cannot run test');
    viewer = viewerRes.rows[0];
    console.log(`\nViewer: id=${viewer.id} type=${viewer.type} name="${viewer.name}"`);

    // ── STEP 1: Check if a real candidate exists already ─────────────────────
    console.log('\n[STEP 1] Checking existing discovery candidate pool...');
    const realCandidates = await client.query(SCORING_QUERY, [viewer.id, viewer.type, null]);
    let testPostId;
    let usingRealPost = false;

    if (realCandidates.rows.length > 0) {
      // Use the highest-scoring real candidate
      testPostId = realCandidates.rows[0].id;
      usingRealPost = true;
      console.log(`  Real candidate found: post_id=${testPostId} (pool size: ${realCandidates.rows.length})`);
    } else {
      // ── No real candidates — synthesise test data ─────────────────────────
      // Strategy: find an existing member that the viewer does NOT follow, then
      // insert a synthetic editorial post authored by them. This avoids inserting
      // a members row (which has NOT NULL constraints on phone/dob/gender).
      // Only the post row is inserted; only the post row is deleted on cleanup.
      console.log('  Pool empty at current data volume — synthesising test data...');

      // Find an existing member the viewer does not follow (not a circle either)
      const unfollowedRes = await client.query(`
        SELECT m.id
          FROM members m
         WHERE m.id != $1
           AND NOT EXISTS (
             SELECT 1 FROM follows f
             WHERE f.follower_id=$1 AND f.follower_type='member'
               AND f.following_id=m.id AND f.following_type='member'
               AND f.is_superseded_by_circle=false
           )
           AND NOT EXISTS (
             SELECT 1 FROM creator_follows cf
             WHERE cf.follower_id=$1 AND cf.follower_type='member'
               AND cf.creator_id=m.id AND cf.is_dormant=false
               AND cf.is_superseded_by_circle=false
           )
           AND NOT EXISTS (
             SELECT 1 FROM circles ci
             WHERE (ci.user_a_id=$1 AND ci.user_b_id=m.id)
                OR (ci.user_b_id=$1 AND ci.user_a_id=m.id)
           )
         LIMIT 1
      `, [viewer.id]);

      if (unfollowedRes.rows.length === 0) {
        throw new Error(
          'No unfollowed member exists to use as synthetic post author. ' +
          'The viewer follows every member in the DB. Cannot synthesise test data.'
        );
      }
      const synthAuthorId = unfollowedRes.rows[0].id;
      console.log(`  Using existing unfollowed member id=${synthAuthorId} as synthetic post author`);

      // Insert a synthetic editorial post (caption marks it clearly as test data)
      const synthPost = await client.query(`
        INSERT INTO posts (
          author_id, author_type, post_type, caption, created_at,
          image_urls, like_count, comment_count, save_count, share_count
        ) VALUES (
          $1, 'member', 'media', '__test_discovery_post__ (safe to delete)', NOW(),
          '[]', 5, 3, 2, 1
        ) RETURNING id
      `, [synthAuthorId]);
      synthetic.postId = synthPost.rows[0].id;
      testPostId = synthetic.postId;
      console.log(`  Inserted synthetic post: post.id=${testPostId} (like=5 comment=3 save=2 share=1)`);

      // Verify it appears in the scoring query
      const verifyRes = await client.query(SCORING_QUERY, [viewer.id, viewer.type, testPostId]);
      if (verifyRes.rows.length === 0) {
        throw new Error(
          `Synthetic post ${testPostId} did not appear in scoring query — ` +
          `check author follow relationship or WHERE clause filters`
        );
      }
      console.log(`  Synthetic post confirmed in candidate pool ✓`);
    }

    synthetic.pisRowKey = { userId: viewer.id, userType: viewer.type, postId: testPostId };

    // ── STEP 2: Baseline — score without any penalty ─────────────────────────
    console.log('\n[STEP 2] Capturing baseline discovery_score (no penalty)...');

    // Ensure no stale penalty row exists for this viewer/post before measuring baseline
    const existingPis = await client.query(`
      SELECT rank_penalty_tier, rank_penalty_until
        FROM post_impression_state
       WHERE user_id=$1 AND user_type=$2 AND post_id=$3
    `, [viewer.id, viewer.type, testPostId]);

    if (existingPis.rows.length > 0) {
      synthetic.pisOldTier  = existingPis.rows[0].rank_penalty_tier;
      synthetic.pisOldUntil = existingPis.rows[0].rank_penalty_until;
      synthetic.pisWasNew   = false;
      // Temporarily clear any active penalty so baseline is clean
      if (existingPis.rows[0].rank_penalty_tier !== null) {
        await client.query(`
          UPDATE post_impression_state
             SET rank_penalty_tier = NULL, rank_penalty_until = NULL
           WHERE user_id=$1 AND user_type=$2 AND post_id=$3
        `, [viewer.id, viewer.type, testPostId]);
        console.log(`  Cleared pre-existing penalty on pis row (will restore on cleanup)`);
      }
    } else {
      synthetic.pisWasNew = true;
    }

    const baselineRes = await client.query(SCORING_QUERY, [viewer.id, viewer.type, testPostId]);
    if (baselineRes.rows.length === 0) {
      throw new Error(`post_id=${testPostId} not in scoring query results at baseline — unexpected`);
    }
    const baseline = baselineRes.rows[0];
    const rawScore = parseFloat(baseline.raw_discovery_score);
    const baselineScore = parseFloat(baseline.discovery_score);

    console.log(`  post_id          = ${baseline.id}`);
    console.log(`  post_type        = ${baseline.post_type}`);
    console.log(`  engagement_score = ${Number(baseline.engagement_score).toFixed(6)}`);
    console.log(`  dwell_score      = ${Number(baseline.dwell_score).toFixed(6)}`);
    console.log(`  popularity_score = ${Number(baseline.popularity_score).toFixed(6)}`);
    console.log(`  raw_score        = ${rawScore.toFixed(8)}`);
    console.log(`  discovery_score  = ${baselineScore.toFixed(8)}  (penalty_tier=${baseline.penalty_tier ?? 'NULL'})`);
    console.log(`  Expected: raw_score === discovery_score when no penalty → ${approxEqual(rawScore, baselineScore) ? 'CONFIRMED ✓' : 'MISMATCH ✗'}`);

    // ── STEP 3: Apply strike-1 directly via SQL upsert ───────────────────────
    console.log('\n[STEP 3] Applying strike-1 penalty via SQL upsert...');
    await client.query(`
      INSERT INTO post_impression_state
        (user_id, user_type, post_id, rank_penalty_tier, rank_penalty_until)
      VALUES
        ($1, $2, $3, 'light', NOW() + INTERVAL '5 days')
      ON CONFLICT (user_id, user_type, post_id) DO UPDATE
        SET rank_penalty_tier  = 'light',
            rank_penalty_until = NOW() + INTERVAL '5 days'
    `, [viewer.id, viewer.type, testPostId]);
    console.log(`  Upserted: post_impression_state rank_penalty_tier='light' for user=${viewer.id}/post=${testPostId}`);

    // Verify the row was written
    const pisCheck = await client.query(`
      SELECT rank_penalty_tier, rank_penalty_until
        FROM post_impression_state
       WHERE user_id=$1 AND user_type=$2 AND post_id=$3
    `, [viewer.id, viewer.type, testPostId]);
    const pisRow = pisCheck.rows[0];
    console.log(`  Confirmed pis row: tier=${pisRow.rank_penalty_tier} until=${pisRow.rank_penalty_until?.toISOString()}`);

    // ── STEP 4: Re-score with penalty active ─────────────────────────────────
    console.log('\n[STEP 4] Re-fetching discovery_score with strike-1 active...');
    const penalisedRes = await client.query(SCORING_QUERY, [viewer.id, viewer.type, testPostId]);
    if (penalisedRes.rows.length === 0) {
      throw new Error(`post_id=${testPostId} vanished from scoring query after penalty — check retirement filter is not triggering`);
    }
    const penalised = penalisedRes.rows[0];
    const penalisedScore = parseFloat(penalised.discovery_score);

    console.log(`  post_id          = ${penalised.id}`);
    console.log(`  penalty_tier     = ${penalised.penalty_tier}`);
    console.log(`  raw_score        = ${parseFloat(penalised.raw_discovery_score).toFixed(8)}`);
    console.log(`  discovery_score  = ${penalisedScore.toFixed(8)}`);

    // ── STEP 5: Assert ────────────────────────────────────────────────────────
    console.log('\n[STEP 5] Asserting ~70% score reduction...');
    const expectedScore = rawScore * 0.3;
    const actualDrop = 1 - (penalisedScore / rawScore);
    const pass = approxEqual(penalisedScore, expectedScore, TOLERANCE);

    console.log(`  Baseline score          : ${rawScore.toFixed(8)}`);
    console.log(`  Expected after penalty  : ${expectedScore.toFixed(8)}  (baseline × 0.3)`);
    console.log(`  Actual penalised score  : ${penalisedScore.toFixed(8)}`);
    console.log(`  Actual drop             : ${(actualDrop * 100).toFixed(4)}%`);
    console.log(`  Tolerance               : ±${TOLERANCE}`);
    console.log(`  Difference              : ${Math.abs(penalisedScore - expectedScore).toFixed(10)}`);
    console.log('');
    if (pass) {
      console.log('  ✅  PASS — penalised discovery_score ≈ baseline × 0.3');
    } else {
      console.log('  ❌  FAIL — score does not match expected 0.3× multiplier');
      console.log(`         Got ${penalisedScore.toFixed(8)}, expected ${expectedScore.toFixed(8)}`);
    }

  } finally {
    // ── CLEANUP ───────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Reverting all test data...');

    if (synthetic.pisRowKey) {
      const { userId, userType, postId } = synthetic.pisRowKey;
      if (synthetic.pisWasNew || synthetic.postId !== null) {
        // Row was inserted by us (either synthesised post path or penalty upsert on new row)
        await client.query(
          `DELETE FROM post_impression_state WHERE user_id=$1 AND user_type=$2 AND post_id=$3`,
          [userId, userType, postId]
        );
        console.log(`  Deleted pis row (user=${userId}, post=${postId})`);
      } else {
        // Row existed before — restore original penalty values
        await client.query(`
          UPDATE post_impression_state
             SET rank_penalty_tier  = $4,
                 rank_penalty_until = $5
           WHERE user_id=$1 AND user_type=$2 AND post_id=$3
        `, [userId, userType, postId, synthetic.pisOldTier, synthetic.pisOldUntil]);
        console.log(`  Restored pis row to pre-test state (tier=${synthetic.pisOldTier}, until=${synthetic.pisOldUntil?.toISOString() ?? 'NULL'})`);
      }
    }

    if (synthetic.postId !== null) {
      await client.query(`DELETE FROM posts WHERE id=$1`, [synthetic.postId]);
      console.log(`  Deleted synthetic post id=${synthetic.postId}`);
    }

    if (synthetic.memberId !== null) {
      await client.query(`DELETE FROM members WHERE id=$1`, [synthetic.memberId]);
      console.log(`  Deleted synthetic member id=${synthetic.memberId}`);
    }

    console.log('  Cleanup complete.\n');

    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
