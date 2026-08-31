'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const { createPool } = require('../config/db');

async function testNewPostVisibility() {
  const pool = createPool();
  console.log('================================================================');
  console.log('TEST 4: New-Post Visibility & Circle Feed Integration');
  console.log('================================================================\n');

  let testPostId = null;
  try {
    // 1. Member 52 creates a brand-new post right now
    const insertRes = await pool.query(`
      INSERT INTO posts (author_id, author_type, post_type, caption, image_urls, created_at)
      VALUES (52, 'member', 'media', '⚡ Real-time Circle Feed Test Post from Harsh', '[]', NOW())
      RETURNING id, author_id, author_type, post_type, caption, created_at
    `);
    testPostId = insertRes.rows[0].id;
    console.log(`✓ Created new post ID ${testPostId} by Member 52 at ${insertRes.rows[0].created_at}`);

    // 2. Query getFeed for Viewer 51 (Harshith)
    const getFeedQuery = `
      SELECT
        p.id,
        p.author_type,
        p.author_id,
        p.post_type,
        p.caption,
        p.created_at,
        CASE
          WHEN p.author_id = 51 AND p.author_type = 'member' THEN false
          ELSE NOT EXISTS (
            SELECT 1 FROM follows f_bp
            WHERE f_bp.follower_id = 51 AND f_bp.follower_type = 'member'
              AND f_bp.following_id = p.author_id AND f_bp.following_type = p.author_type
              AND f_bp.created_at <= p.created_at
            UNION ALL
            SELECT 1 FROM circles ci_bp
            WHERE ((ci_bp.user_a_id = 51 AND ci_bp.user_b_id = p.author_id)
                OR (ci_bp.user_b_id = 51 AND ci_bp.user_a_id = p.author_id))
              AND p.author_type = 'member'
              AND ci_bp.created_at <= p.created_at
            UNION ALL
            SELECT 1 FROM community_member_circles cc_bp
            WHERE cc_bp.member_id = 51
              AND cc_bp.community_id = p.author_id
              AND p.author_type = 'community'
              AND cc_bp.created_at <= p.created_at
          )
        END AS is_backlog_post
      FROM posts p
      WHERE
        -- Condition 1: Own posts OR Followed accounts OR Circle connections
        (
          (p.author_id = 51 AND p.author_type = 'member')
          OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = 51 AND f.follower_type = 'member'
              AND f.following_id = p.author_id AND f.following_type = p.author_type
              AND f.is_superseded_by_circle = false
          )
          OR EXISTS (
            SELECT 1 FROM circles ci
            WHERE (ci.user_a_id = 51 AND ci.user_b_id = p.author_id)
               OR (ci.user_b_id = 51 AND ci.user_a_id = p.author_id)
              AND p.author_type = 'member'
          )
          OR EXISTS (
            SELECT 1 FROM community_member_circles cmc
            WHERE cmc.member_id = 51 AND cmc.community_id = p.author_id
              AND p.author_type = 'community'
          )
        )
        -- Condition 3: Impression retirement exclusion
        AND NOT EXISTS (
          SELECT 1 FROM post_impression_state pis
          WHERE pis.user_id = 51 AND pis.user_type = 'member'
            AND pis.post_id = p.id
            AND pis.retired_at IS NOT NULL
            AND pis.retired_at > NOW() - INTERVAL '15 days'
        )
      ORDER BY p.created_at DESC
    `;

    const feedRes = await pool.query(getFeedQuery);
    console.log(`\ngetFeed query returned ${feedRes.rows.length} posts for Viewer 51:`);
    feedRes.rows.slice(0, 5).forEach((r, idx) => {
      console.log(`  [Slot ${idx + 1}] Post ${r.id} (${r.author_type}-${r.author_id}): is_backlog=${r.is_backlog_post} | caption="${r.caption}"`);
    });

    const topItem = feedRes.rows[0];
    assert.strictEqual(String(topItem.id), String(testPostId), 'The newly created post MUST appear as the #1 item in Viewer 51 feed');
    assert.strictEqual(topItem.is_backlog_post, false, 'A newly created post (post created after circle) MUST be is_backlog_post = false');
    console.log('\n✓ TEST 4 PASSED: Brand new post from connected circle member appears immediately at top of feed with is_backlog_post = false!\n');

  } catch (err) {
    console.error('Test 4 failed:', err);
    process.exit(1);
  } finally {
    // 3. Clean up the temporary test post
    if (testPostId) {
      await pool.query(`DELETE FROM posts WHERE id = $1`, [testPostId]);
      console.log(`✓ Cleaned up temporary test post ID ${testPostId}.`);
    }
    await pool.end();
  }
}

testNewPostVisibility();
