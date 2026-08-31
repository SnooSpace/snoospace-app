'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function auditCollateralDamage() {
  const pool = createPool();
  console.log('================================================================');
  console.log('AUDIT: Post-Cleanup Real-Account Collateral Damage');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------------------
    // 1. Follow / Circle Graph Integrity
    // ----------------------------------------------------------------
    console.log('════ 1. Follow / Circle Graph for Real Accounts (51, 52, 155, 54) ════');
    const follows = await pool.query(`
      SELECT id, follower_id, follower_type, following_id, following_type, created_at, is_superseded_by_circle
      FROM follows
      ORDER BY id
    `);
    console.log(`\nFollows rows (${follows.rows.length}):`);
    console.log(follows.rows);

    const circles = await pool.query(`
      SELECT id, user_a_id, user_b_id, created_at
      FROM circles
      ORDER BY id
    `);
    console.log(`\nCircles rows (${circles.rows.length}):`);
    console.log(circles.rows);

    const cmc = await pool.query(`
      SELECT id, community_id, member_id, created_at
      FROM community_member_circles
      ORDER BY id
    `);
    console.log(`\nCommunity Member Circles rows (${cmc.rows.length}):`);
    console.log(cmc.rows);

    // ----------------------------------------------------------------
    // 2. Real Content Retirement State
    // ----------------------------------------------------------------
    console.log('\n════ 2. Real Content Retirement State (post_impression_state) ════');
    const impressions = await pool.query(`
      SELECT pis.user_id, pis.user_type, pis.post_id, pis.unseen_count, pis.ignored_view_count, pis.retired_at, p.caption, p.created_at as post_created_at
      FROM post_impression_state pis
      JOIN posts p ON p.id = pis.post_id
      ORDER BY pis.user_id, pis.post_id
    `);
    console.log(`\nImpression state rows for preserved posts (${impressions.rows.length}):`);
    console.log(impressions.rows);

    // ----------------------------------------------------------------
    // 3. Backlog Resurfacing Analysis for Viewer 51
    // ----------------------------------------------------------------
    console.log('\n════ 3. Backlog Resurfacing Analysis for Viewer 51 ════');
    // Query all 25 posts with age, author, and backlog eligibility for viewer 51
    const postsAnalysis = await pool.query(`
      SELECT 
        p.id, 
        p.author_type, 
        p.author_id, 
        p.post_type,
        p.created_at,
        p.caption,
        f.created_at as follow_created_at,
        (p.created_at < f.created_at) as is_backlog_calc,
        EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.liker_id = 51) as viewer_liked,
        EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = 51) as viewer_commented
      FROM posts p
      LEFT JOIN follows f 
        ON f.follower_id = 51 AND f.follower_type = 'member' 
       AND f.following_id = p.author_id AND f.following_type = p.author_type
      ORDER BY p.created_at DESC
    `);
    console.log(`\nAll 25 preserved posts analysis for viewer 51:`);
    postsAnalysis.rows.forEach(r => {
      const ageDays = ((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1);
      const isConnected = !!r.follow_created_at;
      console.log(`  Post ${r.id} (${r.author_type}-${r.author_id}, ${r.post_type}): age=${ageDays}d (${new Date(r.created_at).toISOString().slice(0,10)}) | connected=${isConnected} | is_backlog=${r.is_backlog_calc} | liked=${r.viewer_liked} | commented=${r.viewer_commented} | caption="${r.caption ? r.caption.slice(0, 30) : '(empty)'}"`);
    });

    // ----------------------------------------------------------------
    // 4. Test getFeed Query for Viewer 51
    // ----------------------------------------------------------------
    console.log('\n════ 4. Real getFeed Execution for Viewer 51 ════');
    // Execute the exact getFeed query logic from postController.js
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
        -- Condition 4: Backlog engagement exclusion
        AND NOT (
          (
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
            END
          )
          AND (
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.liker_id = 51)
            OR EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = 51)
          )
        )
      ORDER BY p.created_at DESC
    `;
    const feedRes = await pool.query(getFeedQuery);
    console.log(`getFeed results for Viewer 51 (${feedRes.rows.length} rows):`);
    feedRes.rows.forEach(r => {
      console.log(`  - Post ${r.id} (${r.author_type}-${r.author_id}, ${r.post_type}): is_backlog=${r.is_backlog_post} | caption="${r.caption ? r.caption.slice(0, 35) : '(empty)'}"`);
    });

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

auditCollateralDamage();
