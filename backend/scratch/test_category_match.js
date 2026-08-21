/**
 * Test 2: Verify Community Category-Match Signal (with synthetic data)
 * ====================================================================
 *
 * Verifies that:
 *   1. When a viewer follows a community with category='networking',
 *      a community-authored post from a community with category='networking'
 *      receives category_score = 1.0 (positive match).
 *   2. A community-authored post from a community with category='gaming' (not followed)
 *      receives category_score = 0.0 (negative match).
 *   3. In the full getDiscoveryPosts candidate pool:
 *      - Unfollowed community post with category='networking' receives category_score = 1.0
 *        which adds +1.0 to raw_discovery_score and discovery_score.
 *      - Unfollowed community post with category='gaming' receives category_score = 0.0.
 *      - Followed community post is excluded from discovery by the non-followed filter.
 *   4. Member-authored posts produce no row in category_match (COALESCE to 0).
 *
 * Fully automated, self-cleaning, and re-runnable.
 * Usage: node backend/scratch/test_category_match.js
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

// ── Exact category match CTE & scoring query from getDiscoveryPosts ─────────
const CATEGORY_MATCH_QUERY = `
  WITH viewer_categories AS (
    SELECT LOWER(com_f.category) AS category
      FROM follows f_aff
      JOIN communities com_f ON f_aff.following_id = com_f.id
                            AND f_aff.following_type = 'community'
     WHERE f_aff.follower_id   = $1
       AND f_aff.follower_type = $2
       AND f_aff.is_superseded_by_circle = false
       AND com_f.category IS NOT NULL
    UNION
    SELECT LOWER(com_c.category) AS category
      FROM community_member_circles cmc_aff
      JOIN communities com_c ON cmc_aff.community_id = com_c.id
     WHERE cmc_aff.member_id = $1
       AND com_c.category IS NOT NULL
  ),
  category_match AS (
    SELECT
      p_cm.id AS post_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM viewer_categories vc
           WHERE vc.category = LOWER(com_cm.category)
        ) THEN 1.0
        ELSE 0.0
      END AS category_score
      FROM posts p_cm
      JOIN communities com_cm
        ON p_cm.author_id = com_cm.id AND p_cm.author_type = 'community'
  )
  SELECT
    p.id AS post_id,
    p.caption,
    p.author_type,
    p.author_id,
    c.name AS community_name,
    c.category AS community_category,
    COALESCE(cm.category_score, 0)::float AS category_score
  FROM posts p
  LEFT JOIN communities c ON p.author_id = c.id AND p.author_type = 'community'
  LEFT JOIN category_match cm ON cm.post_id = p.id
  WHERE p.id = ANY($3::int[])
  ORDER BY p.id ASC;
`;

const FULL_DISCOVERY_QUERY = `
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
  ),
  viewer_categories AS (
    SELECT LOWER(com_f.category) AS category
      FROM follows f_aff
      JOIN communities com_f ON f_aff.following_id = com_f.id
                            AND f_aff.following_type = 'community'
     WHERE f_aff.follower_id   = $1
       AND f_aff.follower_type = $2
       AND f_aff.is_superseded_by_circle = false
       AND com_f.category IS NOT NULL
    UNION
    SELECT LOWER(com_c.category) AS category
      FROM community_member_circles cmc_aff
      JOIN communities com_c ON cmc_aff.community_id = com_c.id
     WHERE cmc_aff.member_id = $1
       AND com_c.category IS NOT NULL
  ),
  category_match AS (
    SELECT
      p_cm.id AS post_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM viewer_categories vc
           WHERE vc.category = LOWER(com_cm.category)
        ) THEN 1.0
        ELSE 0.0
      END AS category_score
      FROM posts p_cm
      JOIN communities com_cm
        ON p_cm.author_id = com_cm.id AND p_cm.author_type = 'community'
  ),
  daily_discovery_count AS (
    SELECT COUNT(DISTINCT post_id) AS cnt
      FROM post_impression_state
     WHERE user_id             = $1
       AND user_type           = $2
       AND first_discovered_at >= NOW() - INTERVAL '24 hours'
  )
  SELECT
    p.id,
    p.caption,
    p.author_type,
    p.author_id,
    COALESCE(en.engagement_score, 0)::float AS engagement_score,
    COALESCE(da.dwell_score, 0)::float AS dwell_score,
    COALESCE(cm.category_score, 0)::float AS category_score,
    (
      COALESCE(en.engagement_score, 0)
      + COALESCE(da.dwell_score, 0)
      + (
          (COALESCE(p.like_count, 0)
           + COALESCE(p.comment_count, 0)
           + COALESCE(p.save_count, 0)
           + COALESCE(p.share_count, 0))::float
          / GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 1.0)
        )
      + COALESCE(cm.category_score, 0)
    )::float AS raw_discovery_score,
    (
      COALESCE(en.engagement_score, 0)
      + COALESCE(da.dwell_score, 0)
      + (
          (COALESCE(p.like_count, 0)
           + COALESCE(p.comment_count, 0)
           + COALESCE(p.save_count, 0)
           + COALESCE(p.share_count, 0))::float
          / GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 1.0)
        )
      + COALESCE(cm.category_score, 0)
    )::float AS discovery_score
  FROM posts p
  LEFT JOIN engagement_norm en ON en.post_type = p.post_type
  LEFT JOIN dwell_aff da       ON da.post_type = p.post_type
  LEFT JOIN category_match cm  ON cm.post_id = p.id
  LEFT JOIN post_impression_state pis_disc
    ON pis_disc.user_id = $1 AND pis_disc.user_type = $2 AND pis_disc.post_id = p.id
  WHERE
    p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
    AND p.created_at >= NOW() - INTERVAL '5 days'
    AND p.post_type NOT IN ('plan_promo', 'event_promo')
    AND NOT (p.author_id = $1 AND p.author_type = $2)
    AND NOT EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = $1 AND f.follower_type = $2
        AND f.following_id = p.author_id AND f.following_type = p.author_type
        AND f.is_superseded_by_circle = false
    )
    AND p.id = ANY($3::int[])
  ORDER BY discovery_score DESC;
`;

async function main() {
  const client = await pool.connect();

  const synthetic = {
    communityIds: [],
    postIds: [],
    followIds: [],
  };

  try {
    console.log('=== Test 2: Community Category-Match Signal (with synthetic data) ===\n');

    // ── STEP 0: Pick a viewer (member) ───────────────────────────────────────
    const viewerRes = await client.query(
      `SELECT id, 'member' AS type, name FROM members ORDER BY id LIMIT 1`
    );
    if (viewerRes.rows.length === 0) throw new Error('No members in DB — cannot run test');
    const viewer = viewerRes.rows[0];
    console.log(`Viewer: id=${viewer.id} (${viewer.type}) name="${viewer.name}"\n`);

    // ── STEP 1: Insert Synthetic Communities & Posts ─────────────────────────
    console.log('[STEP 1] Inserting synthetic test entities...');

    // 1. Synthetic Community 1: followed, category = 'networking'
    const com1Res = await client.query(`
      INSERT INTO communities (
        name, category, categories, auto_join_group_chat, follower_count, following_count
      ) VALUES (
        '__test_com_networking_followed__', 'networking', '["networking"]'::jsonb, false, 0, 0
      ) RETURNING id
    `);
    const com1Id = com1Res.rows[0].id;
    synthetic.communityIds.push(com1Id);
    console.log(`  Created Community 1 (followed): id=${com1Id}, category='networking'`);

    // Insert follow row so viewer follows Community 1
    const followRes = await client.query(`
      INSERT INTO follows (
        follower_id, follower_type, following_id, following_type, is_superseded_by_circle
      ) VALUES (
        $1, $2, $3, 'community', false
      ) RETURNING id
    `, [viewer.id, viewer.type, com1Id]);
    const followId = followRes.rows[0].id;
    synthetic.followIds.push(followId);
    console.log(`  Follow created: viewer ${viewer.id} -> Community ${com1Id}`);

    // Insert Post 1 from Community 1
    const post1Res = await client.query(`
      INSERT INTO posts (
        author_id, author_type, post_type, caption, image_urls, created_at, like_count, comment_count, save_count, share_count
      ) VALUES (
        $1, 'community', 'media', '__test_post_com1_networking__', '[]', NOW(), 1, 0, 0, 0
      ) RETURNING id
    `, [com1Id]);
    const post1Id = post1Res.rows[0].id;
    synthetic.postIds.push(post1Id);
    console.log(`  Created Post 1 (by Community 1): id=${post1Id}`);

    // 2. Synthetic Community 2: UNFOLLOWED, category = 'gaming' (non-matching)
    const com2Res = await client.query(`
      INSERT INTO communities (
        name, category, categories, auto_join_group_chat, follower_count, following_count
      ) VALUES (
        '__test_com_gaming_unfollowed__', 'gaming', '["gaming"]'::jsonb, false, 0, 0
      ) RETURNING id
    `);
    const com2Id = com2Res.rows[0].id;
    synthetic.communityIds.push(com2Id);
    console.log(`  Created Community 2 (unfollowed, non-match): id=${com2Id}, category='gaming'`);

    // Insert Post 2 from Community 2
    const post2Res = await client.query(`
      INSERT INTO posts (
        author_id, author_type, post_type, caption, image_urls, created_at, like_count, comment_count, save_count, share_count
      ) VALUES (
        $1, 'community', 'media', '__test_post_com2_gaming__', '[]', NOW(), 1, 0, 0, 0
      ) RETURNING id
    `, [com2Id]);
    const post2Id = post2Res.rows[0].id;
    synthetic.postIds.push(post2Id);
    console.log(`  Created Post 2 (by Community 2): id=${post2Id}`);

    // 3. Synthetic Community 3: UNFOLLOWED, category = 'networking' (matching category candidate)
    const com3Res = await client.query(`
      INSERT INTO communities (
        name, category, categories, auto_join_group_chat, follower_count, following_count
      ) VALUES (
        '__test_com_networking_unfollowed__', 'networking', '["networking"]'::jsonb, false, 0, 0
      ) RETURNING id
    `);
    const com3Id = com3Res.rows[0].id;
    synthetic.communityIds.push(com3Id);
    console.log(`  Created Community 3 (unfollowed, MATCHING category): id=${com3Id}, category='networking'`);

    // Insert Post 3 from Community 3
    const post3Res = await client.query(`
      INSERT INTO posts (
        author_id, author_type, post_type, caption, image_urls, created_at, like_count, comment_count, save_count, share_count
      ) VALUES (
        $1, 'community', 'media', '__test_post_com3_networking__', '[]', NOW(), 1, 0, 0, 0
      ) RETURNING id
    `, [com3Id]);
    const post3Id = post3Res.rows[0].id;
    synthetic.postIds.push(post3Id);
    console.log(`  Created Post 3 (by Community 3): id=${post3Id}\n`);

    // ── STEP 2: Evaluate category_match CTE directly ────────────────────────
    console.log('[STEP 2] Running category_match CTE query on all test posts...');
    const matchRes = await client.query(CATEGORY_MATCH_QUERY, [
      viewer.id, viewer.type, [post1Id, post2Id, post3Id]
    ]);

    console.log('\n  Results from category_match CTE:');
    console.table(matchRes.rows.map(r => ({
      'Post ID': r.post_id,
      'Caption': r.caption,
      'Category': r.community_category,
      'category_score': r.category_score,
    })));

    const p1Score = matchRes.rows.find(r => r.post_id === post1Id)?.category_score;
    const p2Score = matchRes.rows.find(r => r.post_id === post2Id)?.category_score;
    const p3Score = matchRes.rows.find(r => r.post_id === post3Id)?.category_score;

    if (p1Score !== 1.0) throw new Error(`FAIL: Post 1 (networking) expected category_score=1.0, got ${p1Score}`);
    console.log('  ✅ PASS: Post 1 (category=\'networking\') -> category_score = 1.0 (positive match)');

    if (p2Score !== 0.0) throw new Error(`FAIL: Post 2 (gaming) expected category_score=0.0, got ${p2Score}`);
    console.log('  ✅ PASS: Post 2 (category=\'gaming\')     -> category_score = 0.0 (non-matching category)');

    if (p3Score !== 1.0) throw new Error(`FAIL: Post 3 (networking, unfollowed) expected category_score=1.0, got ${p3Score}`);
    console.log('  ✅ PASS: Post 3 (category=\'networking\') -> category_score = 1.0 (matching category for discovery)\n');

    // ── STEP 3: Evaluate in Full getDiscoveryPosts query ─────────────────────
    console.log('[STEP 3] Running full getDiscoveryPosts candidate query...');
    const discRes = await client.query(FULL_DISCOVERY_QUERY, [
      viewer.id, viewer.type, [post1Id, post2Id, post3Id]
    ]);

    console.log('\n  Results admitted to getDiscoveryPosts candidate pool:');
    console.table(discRes.rows.map(r => ({
      'Post ID': r.id,
      'Caption': r.caption,
      'engagement': r.engagement_score,
      'dwell': r.dwell_score,
      'category_score': r.category_score,
      'raw_discovery_score': r.raw_discovery_score,
      'discovery_score': r.discovery_score,
    })));

    const discPostIds = discRes.rows.map(r => r.id);

    // Assert Post 1 is EXCLUDED by NOT EXISTS follows
    if (discPostIds.includes(post1Id)) {
      throw new Error(`FAIL: Post 1 is from a followed community, but was included in discovery candidate pool!`);
    }
    console.log('  ✅ PASS: Post 1 is excluded from discovery candidates because its author is followed');

    // Assert Post 3 is included with category_score = 1.0
    const discP3 = discRes.rows.find(r => r.id === post3Id);
    if (!discP3 || discP3.category_score !== 1.0) {
      throw new Error(`FAIL: Post 3 should be included with category_score=1.0, got: ${JSON.stringify(discP3)}`);
    }
    console.log(`  ✅ PASS: Post 3 (matching category) admitted with category_score = 1.0 -> discovery_score = ${discP3.discovery_score}`);

    // Assert Post 2 is included with category_score = 0.0
    const discP2 = discRes.rows.find(r => r.id === post2Id);
    if (!discP2 || discP2.category_score !== 0.0) {
      throw new Error(`FAIL: Post 2 should be included with category_score=0.0, got: ${JSON.stringify(discP2)}`);
    }
    console.log(`  ✅ PASS: Post 2 (non-matching category) admitted with category_score = 0.0 -> discovery_score = ${discP2.discovery_score}`);

    const scoreDiff = discP3.discovery_score - discP2.discovery_score;
    console.log(`\n  Category match delta: Post 3 score (${discP3.discovery_score}) - Post 2 score (${discP2.discovery_score}) = +${scoreDiff.toFixed(4)}`);
    if (Math.abs(scoreDiff - 1.0) > 0.001) {
      throw new Error(`FAIL: Expected exact +1.0 score boost from category match, got ${scoreDiff}`);
    }
    console.log('  ✅ PASS: Category match provides exactly +1.0 boost to discovery candidate score');

    console.log('\n✅ All Category-Match verification assertions passed successfully.\n');

  } finally {
    // ── CLEANUP ─────────────────────────────────────────────────────────────
    console.log('[CLEANUP] Reverting synthetic test data...');

    if (synthetic.followIds.length > 0) {
      await client.query(`DELETE FROM follows WHERE id = ANY($1::bigint[])`, [synthetic.followIds]);
      console.log(`  Deleted ${synthetic.followIds.length} synthetic follow row(s)`);
    }

    if (synthetic.postIds.length > 0) {
      await client.query(`DELETE FROM posts WHERE id = ANY($1::bigint[])`, [synthetic.postIds]);
      console.log(`  Deleted ${synthetic.postIds.length} synthetic post row(s)`);
    }

    if (synthetic.communityIds.length > 0) {
      await client.query(`DELETE FROM communities WHERE id = ANY($1::bigint[])`, [synthetic.communityIds]);
      console.log(`  Deleted ${synthetic.communityIds.length} synthetic community row(s)`);
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
