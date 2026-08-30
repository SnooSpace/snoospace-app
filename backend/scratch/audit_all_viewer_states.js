'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function runAudit() {
  const pool = createPool();
  console.log('================================================================');
  console.log('AUDIT: HomeFeedScreen Post-Inclusion Across All Viewer States');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------------------
    // Scenario 1: Following (direct follow, no circle)
    // ----------------------------------------------------------------
    console.log('--- SCENARIO 1: Following (Direct follow, no circle) ---');
    // Test setup: Member 51 follows Community 55 ('tech_ai_guild')
    const followCheck = await pool.query(`
      SELECT f.follower_id, f.following_id, f.following_type, c.name as community_name
      FROM follows f
      JOIN communities c ON f.following_id = c.id
      WHERE f.follower_id = 51 AND f.follower_type = 'member' AND f.following_id = 55
    `);
    console.log('Follow relationship exists in DB:', followCheck.rows);

    // Run getFeed query for member 51
    const feedPostsS1 = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type, p.created_at
      FROM posts p
      WHERE (
        (p.author_id = 51 AND p.author_type = 'member')
        OR EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = 51 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
            AND f.is_superseded_by_circle = false
            AND p.created_at >= f.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice') THEN INTERVAL '15 days' ELSE INTERVAL '7 days' END
            )
        )
      )
      AND p.author_id = 55 AND p.author_type = 'community'
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    console.log(`Posts from followed Community 55 returned in getFeed (${feedPostsS1.rows.length} rows):`);
    console.log(feedPostsS1.rows.map(r => ({ id: r.id, post_type: r.post_type, caption: r.caption.slice(0, 40) })));

    // ----------------------------------------------------------------
    // Scenario 2: Circle membership (no direct follow)
    // ----------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Circle Membership (No direct follow) ---');
    // Create temporary circle test: Member 51 in circle with Community 59, but NO follow row
    await pool.query(`DELETE FROM follows WHERE follower_id = 51 AND follower_type = 'member' AND following_id = 59 AND following_type = 'community'`);
    await pool.query(`
      INSERT INTO community_member_circles (community_id, member_id, created_at)
      VALUES (59, 51, NOW())
      ON CONFLICT DO NOTHING
    `);

    const circleFeedPosts = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type
      FROM posts p
      WHERE (
        p.author_type = 'community' AND EXISTS (
          SELECT 1 FROM community_member_circles cc
          WHERE cc.community_id = p.author_id AND cc.member_id = 51
            AND p.created_at >= cc.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice') THEN INTERVAL '15 days' ELSE INTERVAL '7 days' END
            )
        )
      )
      AND p.author_id = 59
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    console.log(`Posts from circled (non-followed) Community 59 returned via circle branch (${circleFeedPosts.rows.length} rows):`);
    console.log(circleFeedPosts.rows.map(r => ({ id: r.id, post_type: r.post_type, caption: r.caption.slice(0, 40) })));

    // Clean up test circle
    await pool.query(`DELETE FROM community_member_circles WHERE community_id = 59 AND member_id = 51`);
    // Restore follow
    await pool.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES (51, 'member', 59, 'community') ON CONFLICT DO NOTHING`);

    // ----------------------------------------------------------------
    // Scenario 3: Non-following, non-circle (Stranger)
    // ----------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Non-following, non-circle (Stranger) ---');
    // Target viewer: Member 155 ('veena')
    // Stranger: Community 56 ('Fitness & Run Club') with NO follow or circle from 155
    await pool.query(`DELETE FROM follows WHERE follower_id = 155 AND following_id = 56`);
    await pool.query(`DELETE FROM community_member_circles WHERE member_id = 155 AND community_id = 56`);

    const strangerInGetFeed = await pool.query(`
      SELECT p.id FROM posts p
      WHERE (
        (p.author_id = 155 AND p.author_type = 'member')
        OR EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = 155 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
        OR EXISTS (
          SELECT 1 FROM community_member_circles cc
          WHERE cc.community_id = p.author_id AND cc.member_id = 155
        )
      )
      AND p.author_id = 56
    `);
    console.log(`Stranger Community 56 in getFeed for Member 155: ${strangerInGetFeed.rows.length} rows (Expected: 0)`);

    // Check getDiscoveryPosts eligibility for Community 56 posts
    const strangerInDiscovery = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.created_at
      FROM posts p
      WHERE p.author_id = 56 AND p.author_type = 'community'
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
      ORDER BY p.created_at DESC
      LIMIT 3
    `);
    console.log(`Discovery-eligible recent posts by Community 56 for Member 155 (${strangerInDiscovery.rows.length} candidates):`);
    console.log(strangerInDiscovery.rows.map(r => ({ id: r.id, post_type: r.post_type, caption: r.caption.slice(0, 40) })));

    // Non-discovery eligible type (opportunity post_type or older than 5 days)
    const nonDiscoveryPosts = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.created_at
      FROM posts p
      WHERE p.author_id = 56 AND p.author_type = 'community'
        AND (p.post_type NOT IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge') OR p.created_at < NOW() - INTERVAL '5 days')
      ORDER BY p.created_at DESC
      LIMIT 3
    `);
    console.log(`Non-discovery eligible posts by Community 56 (${nonDiscoveryPosts.rows.length} rows - invisible to stranger via both getFeed and discovery):`);
    console.log(nonDiscoveryPosts.rows.map(r => ({ id: r.id, post_type: r.post_type, caption: r.caption.slice(0, 40) })));

    // ----------------------------------------------------------------
    // Scenario 4: New user, zero follows
    // ----------------------------------------------------------------
    console.log('\n--- SCENARIO 4: New User, Zero Follows ---');
    const zeroFollowUser = await pool.query(`
      SELECT m.id, m.name
      FROM members m
      WHERE NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = m.id AND f.follower_type = 'member')
        AND NOT EXISTS (SELECT 1 FROM community_member_circles cc WHERE cc.member_id = m.id)
      LIMIT 1
    `);
    let zfUserId = zeroFollowUser.rows[0]?.id;
    if (!zfUserId) {
      // Create a test zero-follow member
      const zf = await pool.query(`
        INSERT INTO members (name, username, email, phone, dob, gender)
        VALUES ('Zero Follow Test', 'zero_follow_test', 'zf_test@snoospace.dev', '9000000000', '2000-01-01', 'Other')
        RETURNING id
      `);
      zfUserId = zf.rows[0].id;
    }
    console.log(`Testing Zero-Follow User ID: ${zfUserId}`);

    const zfFeedPosts = await pool.query(`
      SELECT p.id FROM posts p
      WHERE (
        (p.author_id = $1 AND p.author_type = 'member')
        OR EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $1 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
      )
    `, [zfUserId]);
    console.log(`getFeed result for zero-follow user: ${zfFeedPosts.rows.length} rows (triggers zero-follow append builder in frontend)`);

    // ----------------------------------------------------------------
    // Scenario 5: Existing user, small following, exhausted
    // ----------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Small Following Exhausted & Retirement ---');
    // Check retired posts in post_impression_state for user 51
    const retiredPosts = await pool.query(`
      SELECT pis.post_id, pis.unseen_count, pis.retired_at, p.caption, p.post_type
      FROM post_impression_state pis
      JOIN posts p ON pis.post_id = p.id
      WHERE pis.user_id = 51 AND pis.user_type = 'member' AND pis.retired_at IS NOT NULL
      ORDER BY pis.retired_at DESC
      LIMIT 5
    `);
    console.log(`Retired posts for user 51 (${retiredPosts.rows.length} active 15-day retirements):`);
    console.log(retiredPosts.rows.map(r => ({ post_id: r.post_id, unseen_count: r.unseen_count, retired_at: r.retired_at, caption: r.caption?.slice(0, 30) ?? '(null)' })));

    // ----------------------------------------------------------------
    // Scenario 6: Cross-cutting check — Blocked users
    // ----------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Blocked Users ---');
    // Test: User 51 blocks User 212
    await pool.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (51, 212) ON CONFLICT DO NOTHING`);
    // Check getFeed query
    const blockedInFeed = await pool.query(`
      SELECT p.id FROM posts p
      WHERE (
        EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = 51 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
        OR EXISTS (
          SELECT 1 FROM circles ci
          WHERE (ci.user_a_id = 51 AND ci.user_b_id = p.author_id)
             OR (ci.user_b_id = 51 AND ci.user_a_id = p.author_id)
        )
      )
      AND p.author_id = 212 AND p.author_type = 'member'
    `);
    console.log(`Blocked User 212 in getFeed for 51: ${blockedInFeed.rows.length} rows (Excluded because block removes follow/circle)`);

    // Check if getDiscoveryPosts query checks user_blocks
    const blockedInDiscovery = await pool.query(`
      SELECT p.id, p.caption, p.author_id
      FROM posts p
      WHERE p.author_id = 212 AND p.author_type = 'member'
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND NOT (p.author_id = 51 AND p.author_type = 'member')
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = 51 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
      LIMIT 3
    `);
    console.log(`Blocked User 212 in getDiscoveryPosts (WITHOUT explicit user_blocks filter in discovery query): ${blockedInDiscovery.rows.length} candidates found.`);
    if (blockedInDiscovery.rows.length > 0) {
      console.log('⚠️ AUDIT FINDING: getDiscoveryPosts currently lacks an explicit `AND NOT EXISTS (SELECT 1 FROM user_blocks ...)` WHERE condition!');
    }

    // Clean up test block
    await pool.query(`DELETE FROM user_blocks WHERE blocker_id = 51 AND blocked_id = 212`);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

runAudit();
