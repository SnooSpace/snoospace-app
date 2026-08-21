/**
 * Test 3: Verify Trickle Daily Cap & Exclusion (with synthetic data)
 * =================================================================
 *
 * Verifies that:
 *   1. When a user has been introduced to 5 discovery posts in the last 24h
 *      (first_discovered_at stamped for 5 posts in post_impression_state),
 *      the daily cap is reached (daily_discovery_count = 5).
 *   2. Under this cap, the 5 previously-discovered posts are still permitted
 *      through the trickle gate (they were already introduced).
 *   3. A 6th candidate post (first_discovered_at IS NULL / not yet introduced)
 *      is strictly EXCLUDED by the trickle WHERE clause in getDiscoveryPosts.
 *   4. Demonstrates the before/after state: when cap < 5, unstamped posts are
 *      allowed; when cap >= 5, unstamped posts are blocked.
 *
 * Fully automated, self-cleaning, and re-runnable.
 * Usage: node backend/scratch/test_trickle_cap.js
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

// ── Full getDiscoveryPosts candidate query with exact trickle WHERE clause ──
const DISCOVERY_TRICKLE_QUERY = `
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
    pis_disc.first_discovered_at,
    (SELECT cnt FROM daily_discovery_count) AS daily_count,
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
    -- ── Trickle pacing WHERE clause gate ──────────────────────────────────
    AND (
      (SELECT cnt FROM daily_discovery_count) < 5
      OR EXISTS (
        SELECT 1 FROM post_impression_state pis_trickle
         WHERE pis_trickle.user_id             = $1
           AND pis_trickle.user_type           = $2
           AND pis_trickle.post_id             = p.id
           AND pis_trickle.first_discovered_at IS NOT NULL
      )
    )
    AND p.id = ANY($3::int[])
  ORDER BY p.id ASC;
`;

async function main() {
  const client = await pool.connect();

  const synthetic = {
    communityId: null,
    postIds: [],
    pisPostIds: [],
    viewerId: null,
    viewerType: null,
  };

  try {
    console.log('=== Test 3: Trickle Daily Cap & Exclusion (with synthetic data) ===\n');

    // ── STEP 0: Pick a test viewer ───────────────────────────────────────────
    const viewerRes = await client.query(
      `SELECT id, 'member' AS type, name FROM members ORDER BY id LIMIT 1`
    );
    if (viewerRes.rows.length === 0) throw new Error('No members in DB — cannot run test');
    const viewer = viewerRes.rows[0];
    synthetic.viewerId = viewer.id;
    synthetic.viewerType = viewer.type;
    console.log(`Viewer: id=${viewer.id} (${viewer.type}) name="${viewer.name}"\n`);

    // Clean up any stale test impressions for this viewer if previous run was interrupted
    await client.query(`
      DELETE FROM post_impression_state
      WHERE user_id = $1 AND user_type = $2 AND first_discovered_at IS NOT NULL
        AND post_id IN (SELECT id FROM posts WHERE caption LIKE '__test_trickle_%')
    `, [viewer.id, viewer.type]);

    // ── STEP 1: Insert Synthetic Unfollowed Community & 6 Posts ─────────────
    console.log('[STEP 1] Creating synthetic unfollowed author & 6 candidate posts...');

    const comRes = await client.query(`
      INSERT INTO communities (
        name, category, categories, auto_join_group_chat, follower_count, following_count
      ) VALUES (
        '__test_trickle_author_com__', 'technology', '["technology"]'::jsonb, false, 0, 0
      ) RETURNING id
    `);
    const comId = comRes.rows[0].id;
    synthetic.communityId = comId;
    console.log(`  Created synthetic author community id=${comId}`);

    // Insert 6 synthetic posts
    for (let i = 1; i <= 6; i++) {
      const pRes = await client.query(`
        INSERT INTO posts (
          author_id, author_type, post_type, caption, image_urls, created_at,
          like_count, comment_count, save_count, share_count
        ) VALUES (
          $1, 'community', 'media', $2, '[]', NOW(), 2, 1, 0, 0
        ) RETURNING id
      `, [comId, `__test_trickle_post_${i}__`]);
      synthetic.postIds.push(pRes.rows[0].id);
    }
    console.log(`  Created 6 synthetic posts: [${synthetic.postIds.join(', ')}]\n`);

    const [p1, p2, p3, p4, p5, p6] = synthetic.postIds;

    // ── STEP 2: Baseline State (Before Cap) ──────────────────────────────────
    console.log('[STEP 2] Verifying baseline state when daily discovery count = 0 (before cap)...');

    const baselineRes = await client.query(DISCOVERY_TRICKLE_QUERY, [
      viewer.id, viewer.type, synthetic.postIds
    ]);
    const baselineReturnedIds = baselineRes.rows.map(r => r.id);
    console.log(`  Daily discovery count in DB : ${baselineRes.rows[0]?.daily_count ?? 0}`);
    console.log(`  Admitted posts before cap  : [${baselineReturnedIds.join(', ')}] (all 6 allowed)`);

    if (baselineReturnedIds.length !== 6) {
      throw new Error(`Expected all 6 posts admitted when count < 5, but got ${baselineReturnedIds.length}`);
    }
    console.log('  ✅ PASS: All 6 candidate posts admitted when daily count < 5\n');

    // ── STEP 3: Apply Trickle Cap (Stamp 5 Posts) ───────────────────────────
    console.log('[STEP 3] Stamping first_discovered_at for exactly 5 posts (p1..p5)...');
    console.log(`  Stamped posts : [${[p1, p2, p3, p4, p5].join(', ')}]`);
    console.log(`  Unstamped post: ${p6} (first_discovered_at = NULL)\n`);

    for (const pid of [p1, p2, p3, p4, p5]) {
      await client.query(`
        INSERT INTO post_impression_state (user_id, user_type, post_id, first_discovered_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, user_type, post_id) DO UPDATE
          SET first_discovered_at = NOW()
      `, [viewer.id, viewer.type, pid]);
      synthetic.pisPostIds.push(pid);
    }

    // Explicitly ensure p6 has no stamp
    await client.query(`
      DELETE FROM post_impression_state
      WHERE user_id = $1 AND user_type = $2 AND post_id = $3
    `, [viewer.id, viewer.type, p6]);

    // ── STEP 4: Query Under Cap & Assert ────────────────────────────────────
    console.log('[STEP 4] Executing getDiscoveryPosts trickle gate query under cap...');

    const cappedRes = await client.query(DISCOVERY_TRICKLE_QUERY, [
      viewer.id, viewer.type, synthetic.postIds
    ]);

    const cappedReturnedIds = cappedRes.rows.map(r => r.id);
    const dailyCountNow = parseInt(cappedRes.rows[0]?.daily_count || '0', 10);

    console.log(`\n  Daily discovery count in DB : ${dailyCountNow} (cap limit = 5)`);
    console.log('  Admitted posts returned by query:');
    console.table(cappedRes.rows.map(r => ({
      'Post ID': r.id,
      'Caption': r.caption,
      'first_discovered_at': r.first_discovered_at?.toISOString(),
      'Status': 'ADMITTED (previously discovered)',
    })));

    console.log(`  Returned post IDs : [${cappedReturnedIds.join(', ')}]`);
    console.log(`  Excluded post ID  : ${p6}\n`);

    // Assert daily count is at least 5
    if (dailyCountNow < 5) {
      throw new Error(`FAIL: Expected daily_discovery_count >= 5, got ${dailyCountNow}`);
    }
    console.log(`  ✅ PASS: daily_discovery_count = ${dailyCountNow} (cap >= 5 reached)`);

    // Assert 5 stamped posts are present
    for (const pid of [p1, p2, p3, p4, p5]) {
      if (!cappedReturnedIds.includes(pid)) {
        throw new Error(`FAIL: Stamped post ${pid} was unexpectedly excluded!`);
      }
    }
    console.log('  ✅ PASS: All 5 stamped posts (p1..p5) successfully passed through trickle gate');

    // Assert 6th unstamped post is EXCLUDED
    if (cappedReturnedIds.includes(p6)) {
      throw new Error(`FAIL: 6th unstamped post ${p6} should have been excluded by trickle cap, but was returned!`);
    }
    console.log(`  ✅ PASS: 6th unstamped post ${p6} was strictly EXCLUDED by trickle gate`);

    console.log('\n✅ All Trickle-Cap verification assertions passed successfully.\n');

  } finally {
    // ── CLEANUP ─────────────────────────────────────────────────────────────
    console.log('[CLEANUP] Reverting synthetic test data...');

    if (synthetic.pisPostIds.length > 0 && synthetic.viewerId) {
      await client.query(`
        DELETE FROM post_impression_state
        WHERE user_id = $1 AND user_type = $2 AND post_id = ANY($3::bigint[])
      `, [synthetic.viewerId, synthetic.viewerType, synthetic.postIds]);
      console.log(`  Deleted synthetic post_impression_state rows`);
    }

    if (synthetic.postIds.length > 0) {
      await client.query(`DELETE FROM posts WHERE id = ANY($1::bigint[])`, [synthetic.postIds]);
      console.log(`  Deleted ${synthetic.postIds.length} synthetic post rows`);
    }

    if (synthetic.communityId) {
      await client.query(`DELETE FROM communities WHERE id = $1`, [synthetic.communityId]);
      console.log(`  Deleted synthetic community author id=${synthetic.communityId}`);
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
