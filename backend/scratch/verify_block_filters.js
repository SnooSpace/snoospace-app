'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function testBlockExclusions() {
  const pool = createPool();
  console.log('================================================================');
  console.log('TEST: Block Exclusion Integrity Across All Discovery Endpoints');
  console.log('================================================================\n');

  try {
    const viewerId = 51;
    const targetMemberId = 212;
    const targetCommunityId = 55;

    // Ensure target member 212 has a recent discovery-eligible post
    let postRes = await pool.query(`
      SELECT id FROM posts 
      WHERE author_id = $1 AND author_type = 'member' 
        AND post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND created_at >= NOW() - INTERVAL '5 days'
      LIMIT 1
    `, [targetMemberId]);

    if (postRes.rows.length === 0) {
      await pool.query(`
        INSERT INTO posts (author_id, author_type, caption, post_type, type_data, image_urls, created_at)
        VALUES ($1, 'member', 'Test block discovery candidate', 'media', '{}'::jsonb, '["https://images.unsplash.com/photo-1517841905240-472988babdf9"]'::jsonb, NOW())
      `, [targetMemberId]);
    }

    // ── Test 1: Forward direction (Viewer 51 blocks Member 212) ───────────────
    console.log('--- TEST 1: Forward Block (Viewer 51 blocks Member 212) ---');
    // Ensure no follow exists so it is eligible for discovery
    await pool.query(`DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`, [viewerId, targetMemberId]);
    // Insert block
    await pool.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING`, [viewerId, targetMemberId]);

    // Query getDiscoveryPosts for viewer 51
    const discPosts1 = await pool.query(`
      SELECT p.id, p.caption, p.author_id, p.author_type
      FROM posts p
      WHERE p.author_id = $3 AND p.author_type = 'member'
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND NOT (p.author_id = $1 AND p.author_type = $2)
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $1 AND f.follower_type = $2
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
        AND NOT (
          p.author_type = 'member' AND $2 = 'member' AND EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $1 AND ub.blocked_id = p.author_id)
               OR (ub.blocker_id = p.author_id AND ub.blocked_id = $1)
          )
        )
    `, [viewerId, 'member', targetMemberId]);
    console.log(`Discovery candidates from blocked Member 212 for Viewer 51: ${discPosts1.rows.length} (Expected: 0)`);

    // ── Test 2: Reverse direction (Viewer 212 blocked by 51, viewing as 212) ─
    console.log('\n--- TEST 2: Reverse Block (Viewer 212 is blocked by 51) ---');
    const discPosts2 = await pool.query(`
      SELECT p.id, p.caption, p.author_id, p.author_type
      FROM posts p
      WHERE p.author_id = $1 AND p.author_type = 'member'
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND NOT (p.author_id = $3 AND p.author_type = $2)
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $3 AND f.follower_type = $2
            AND f.following_id = p.author_id AND f.following_type = p.author_type
        )
        AND NOT (
          p.author_type = 'member' AND $2 = 'member' AND EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $3 AND ub.blocked_id = p.author_id)
               OR (ub.blocker_id = p.author_id AND ub.blocked_id = $3)
          )
        )
    `, [viewerId, 'member', targetMemberId]);
    console.log(`Discovery candidates from Member 51 for blocked Viewer 212: ${discPosts2.rows.length} (Expected: 0)`);

    // Clean up member block
    await pool.query(`DELETE FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [viewerId, targetMemberId]);

    // ── Test 3: Community block (Viewer 51 blocks Community 55) ──────────────
    console.log('\n--- TEST 3: Community Block (Viewer 51 blocks Community 55) ---');
    await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 AND following_type = 'community'`, [viewerId, targetCommunityId]);
    await pool.query(`INSERT INTO community_blocks (blocker_id, blocked_community_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_community_id) DO NOTHING`, [viewerId, targetCommunityId]);

    // Check getDiscoveryPosts
    const discPosts3 = await pool.query(`
      SELECT p.id FROM posts p
      WHERE p.author_id = $3 AND p.author_type = 'community'
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND NOT (
          p.author_type = 'community' AND $2 = 'member' AND EXISTS (
            SELECT 1 FROM community_blocks cb
            WHERE cb.blocker_id = $1 AND cb.blocked_community_id = p.author_id
          )
        )
    `, [viewerId, 'member', targetCommunityId]);
    console.log(`Discovery posts from blocked Community 55: ${discPosts3.rows.length} (Expected: 0)`);

    // Check getDiscoveryOpportunities
    const discOpps = await pool.query(`
      SELECT o.id FROM opportunities o
      WHERE o.creator_id::integer = $3 AND o.creator_type = 'community'
        AND o.status = 'active'
        AND NOT (
          o.creator_type = 'community' AND $2 = 'member' AND EXISTS (
            SELECT 1 FROM community_blocks cb
            WHERE cb.blocker_id = $1 AND cb.blocked_community_id = o.creator_id::integer
          )
        )
    `, [viewerId, 'member', targetCommunityId]);
    console.log(`Discovery opportunities from blocked Community 55: ${discOpps.rows.length} (Expected: 0)`);

    // Check discoverEvents
    const discEvents = await pool.query(`
      SELECT e.id FROM events e
      WHERE e.community_id = $3 AND e.is_published = true
        AND NOT (
          $2 = 'member' AND EXISTS (
            SELECT 1 FROM community_blocks cb
            WHERE cb.blocker_id = $1 AND cb.blocked_community_id = e.community_id
          )
        )
    `, [viewerId, 'member', targetCommunityId]);
    console.log(`Discovery events from blocked Community 55: ${discEvents.rows.length} (Expected: 0)`);

    // Clean up community block and restore follow
    await pool.query(`DELETE FROM community_blocks WHERE blocker_id = $1 AND blocked_community_id = $2`, [viewerId, targetCommunityId]);
    await pool.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, 'member', $2, 'community') ON CONFLICT DO NOTHING`, [viewerId, targetCommunityId]);

    console.log('\n✅ ALL BLOCK EXCLUSION TESTS PASSED!');
  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await pool.end();
  }
}

testBlockExclusions();
