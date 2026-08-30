'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function run12ItemAudit() {
  const pool = createPool();
  console.log('================================================================');
  console.log('AUDIT: 12-Item Deep Ground Truth & Second-Guess Verification');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------------------
    // PART A: Backlog Ground Truth (Items 1, 2, 3)
    // ----------------------------------------------------------------
    console.log('════ PART A: Backlog Ground Truth ════');
    
    // Item 1: Real query for backlog posts
    const backlogSample = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type, p.created_at, f.created_at as followed_at
      FROM posts p
      JOIN follows f ON f.following_id = p.author_id AND f.following_type = p.author_type
      WHERE f.follower_id = 51 AND f.follower_type = 'member'
        AND p.created_at < f.created_at
        AND p.created_at >= f.created_at - INTERVAL '15 days'
      LIMIT 3
    `);
    console.log(`Item 1 - Backlog Eligibility Query (${backlogSample.rows.length} rows found for user 51):`);
    console.log(backlogSample.rows.map(r => ({
      post_id: r.id,
      post_type: r.post_type,
      created_at: r.created_at,
      followed_at: r.followed_at,
      is_backlog: r.created_at < r.followed_at
    })));

    // Item 2 & 3: Covered via code audit (key structure and independence)

    // ----------------------------------------------------------------
    // PART B: Multi-Promo Delivery (Items 4, 5)
    // ----------------------------------------------------------------
    console.log('\n════ PART B: Multi-Promo Delivery ════');
    // Item 4: Real query for getPromoTargeted
    const promoRes = await pool.query(`
      SELECT p.id, p.caption, p.post_type, op.id as plan_id, op.title as plan_title, op.scheduled_at
      FROM posts p
      INNER JOIN open_plans op ON op.id = (p.type_data->>'promo_source_id')::int
      WHERE p.post_type IN ('poll', 'qna', 'prompt')
        AND (p.type_data->>'promo_source_type') = 'plan'
        AND (p.type_data->>'promo_source_id') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = op.id
        )
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    console.log(`Item 4 - getPromoTargeted Candidate Query (${promoRes.rows.length} rows found in DB):`);
    console.log(promoRes.rows.map(r => ({
      post_id: r.id,
      post_type: r.post_type,
      plan_id: r.plan_id,
      plan_title: r.plan_title,
      scheduled_at: r.scheduled_at
    })));

    // ----------------------------------------------------------------
    // PART D: Second-Guesses (Items 8, 9, 10, 11, 12)
    // ----------------------------------------------------------------
    console.log('\n════ PART D: Second-Guesses & Live Diagnostics ════');

    // Item 8: post_community_voice samples
    const cvPosts = await pool.query(`
      SELECT id, caption, image_urls, aspect_ratios, post_type, author_type, author_id
      FROM posts
      WHERE post_type = 'community_voice'
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log(`Item 8 - post_community_voice Sample Data (${cvPosts.rows.length} rows):`);
    console.log(cvPosts.rows.map(r => ({
      id: r.id,
      has_images: !!(r.image_urls && r.image_urls.length > 0 && r.image_urls !== '[]'),
      image_urls: r.image_urls,
      caption_length: r.caption ? r.caption.length : 0,
      caption_preview: r.caption ? r.caption.slice(0, 40) : '(empty)'
    })));

    // Item 9: Key collision simulation under ev=30 zero-follow candidate load
    console.log('\nItem 9 - Key Collision Simulation (ev=30 Zero-Follow candidates):');
    const discPosts30 = await pool.query(`
      SELECT id, 'post' as itemType FROM posts ORDER BY id DESC LIMIT 30
    `);
    const events30 = await pool.query(`
      SELECT id, 'event' as itemType FROM events ORDER BY id DESC LIMIT 15
    `);
    const opps30 = await pool.query(`
      SELECT id, 'opportunity' as itemType FROM opportunities ORDER BY id DESC LIMIT 15
    `);

    const combinedPool = [
      ...discPosts30.rows.map(p => ({ ...p, is_discovery_post: true })),
      ...events30.rows,
      ...opps30.rows.map(o => ({ ...o, is_discovery_opportunity: true }))
    ];

    const keySet = new Set();
    let collisionCount = 0;
    const collisions = [];
    combinedPool.forEach((item, idx) => {
      // FlashList keyExtractor logic:
      const key = item.itemType === 'event'
        ? `event-${item.id}`
        : item.itemType === 'opportunity'
        ? `opportunity-${item.id}`
        : `post-${item.id}`;
      if (keySet.has(key)) {
        collisionCount++;
        collisions.push({ key, idx });
      }
      keySet.add(key);
    });
    console.log(`  Combined Pool Size: ${combinedPool.length} items`);
    console.log(`  Unique Keys: ${keySet.size}`);
    console.log(`  Collisions: ${collisionCount} ${collisionCount === 0 ? '✓ (No collisions with itemType prefixing)' : '❌'}`);

    // Item 10: Trickle pacing stamps
    const trickleStats = await pool.query(`
      SELECT user_id, user_type, COUNT(*) as stamped_count,
             MIN(first_discovered_at) as earliest_stamp,
             MAX(first_discovered_at) as latest_stamp
      FROM post_impression_state
      WHERE first_discovered_at IS NOT NULL
      GROUP BY user_id, user_type
      LIMIT 5
    `);
    console.log(`\nItem 10 - Trickle Pacing Stamped Counts in DB:`);
    console.log(trickleStats.rows);

    // Item 11: Impression / retirement state check for test user 51 & others
    const impressionAudit = await pool.query(`
      SELECT post_id, unseen_count, ignored_view_count, retired_at, rank_penalty_tier
      FROM post_impression_state
      WHERE user_id = 51 AND user_type = 'member'
      ORDER BY retired_at DESC NULLS LAST, unseen_count DESC
      LIMIT 10
    `);
    console.log(`\nItem 11 - Post Impression State for User 51 (${impressionAudit.rows.length} rows):`);
    console.log(impressionAudit.rows);

    const eventImpressionAudit = await pool.query(`
      SELECT event_id, unseen_count, retired_at, rank_penalty_tier
      FROM event_impression_state
      WHERE user_id = 51 AND user_type = 'member'
      ORDER BY retired_at DESC NULLS LAST, unseen_count DESC
      LIMIT 10
    `);
    console.log(`Event Impression State for User 51 (${eventImpressionAudit.rows.length} rows):`);
    console.log(eventImpressionAudit.rows);

    const highUnseenCheck = await pool.query(`
      SELECT 'post' as type, post_id as id, unseen_count, ignored_view_count, retired_at
      FROM post_impression_state
      WHERE unseen_count > 3 OR ignored_view_count > 5
      UNION ALL
      SELECT 'event' as type, event_id as id, unseen_count, 0, retired_at
      FROM event_impression_state
      WHERE unseen_count > 3
    `);
    console.log(`\nAnomalously High Impression Counts Across DB (${highUnseenCheck.rows.length} rows):`);
    console.log(highUnseenCheck.rows);

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

run12ItemAudit();
