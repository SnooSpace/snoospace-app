'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const c = await pool.connect();
  const userId = 130; // 0-follow user
  const userWithFollows = 52;

  await c.query("DELETE FROM posts WHERE caption LIKE 'Score Test%'");
  await c.query("DELETE FROM events WHERE title LIKE 'Event %'");
  await c.query("DELETE FROM opportunities WHERE title LIKE 'Opp Test%'");

  try {
    console.log('=== 1. POST DISCOVERY SCORES ===');
    // Temporarily insert a few posts with different ages & engagement to see real score distribution
    const p1 = await c.query(`
      INSERT INTO posts (author_id, author_type, post_type, caption, image_urls, media_types, status, created_at, like_count, comment_count)
      VALUES 
        (51, 'member', 'media', 'Score Test 1 - High Eng', '{}', '{}', 'active', NOW() - INTERVAL '2 hours', 15, 5),
        (51, 'member', 'poll', 'Score Test 2 - Mid Eng', '{}', '{}', 'active', NOW() - INTERVAL '12 hours', 3, 1),
        (51, 'member', 'prompt', 'Score Test 3 - Low Eng', '{}', '{}', 'active', NOW() - INTERVAL '2 days', 0, 0)
      RETURNING id, caption
    `);

    const postController = require('../controllers/postController');
    const dMock = {
      user: { id: userId, type: 'member' },
      query: { limit: '10' },
      app: { locals: { pool } }
    };
    let discPosts = [];
    await postController.getDiscoveryPosts(dMock, {
      status() { return this; },
      json(d) { discPosts = d.posts || []; }
    });
    console.log('Discovery Posts real scores:');
    discPosts.forEach(p => {
      console.log(`  Post #${p.id} (${p.caption}): raw_score=${p.raw_discovery_score}, final_score=${p.discovery_score}`);
    });

    console.log('\n=== 2. EVENT DISCOVERY SCORES ===');
    // Insert test events: community 54
    const e1 = await c.query(`
      INSERT INTO events (community_id, title, is_published, event_date, start_datetime, end_datetime, access_type, status, created_at)
      VALUES 
        (54, 'Event 1 - Fresh', true, '2026-08-24', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 'public', 'active', NOW() - INTERVAL '1 day'),
        (54, 'Event 2 - Older', true, '2026-08-25', NOW() + INTERVAL '3 days', NOW() + INTERVAL '4 days', 'public', 'active', NOW() - INTERVAL '3 days')
      RETURNING id, title, community_id
    `);

    const eventController = require('../controllers/eventController');
    // Test as user 52 (who follows community 54) to see follow bonus
    let evUser52 = [];
    await eventController.discoverEvents({
      user: { id: userWithFollows, type: 'member' },
      query: { limit: 10, offset: 0 },
      app: { locals: { pool } }
    }, {
      status() { return this; },
      json(d) { evUser52 = d.events || []; }
    });
    console.log('Events real scores (for user with follow to comm 54):');
    evUser52.filter(e => e.title?.startsWith('Event ')).forEach(e => {
      console.log(`  Event #${e.id} (${e.title}): is_following=${e.is_following_community}, raw_score=${e.raw_score}, final_score=${e.score}`);
    });

    // Test as user 130 (0 follows)
    let evUser130 = [];
    await eventController.discoverEvents({
      user: { id: userId, type: 'member' },
      query: { limit: 10, offset: 0 },
      app: { locals: { pool } }
    }, {
      status() { return this; },
      json(d) { evUser130 = d.events || []; }
    });
    console.log('Events real scores (for 0-follow user 130):');
    evUser130.filter(e => e.title?.startsWith('Event ')).forEach(e => {
      console.log(`  Event #${e.id} (${e.title}): is_following=${e.is_following_community}, raw_score=${e.raw_score}, final_score=${e.score}`);
    });

    console.log('\n=== 3. OPPORTUNITY DISCOVERY SCORES ===');
    const o1 = await c.query(`
      INSERT INTO opportunities (creator_id, creator_type, title, status, created_at, expires_at, opportunity_types, availability, turnaround, like_count, comment_count)
      VALUES 
        ('54', 'community', 'Opp Test 1 - High Eng', 'active', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '10 days', '{"internship"}', 'part_time', 'standard', 8, 2),
        ('54', 'community', 'Opp Test 2 - Low Eng', 'active', NOW() - INTERVAL '2 days', NOW() + INTERVAL '10 days', '{"internship"}', 'part_time', 'standard', 0, 0)
      RETURNING id, title
    `);

    const opportunityController = require('../controllers/opportunityController');
    let discOpps = [];
    await opportunityController.getDiscoveryOpportunities({
      user: { id: userId, type: 'member' },
      query: { limit: 10 },
      app: { locals: { pool } }
    }, {
      status() { return this; },
      json(d) { discOpps = d.opportunities || []; }
    });
    console.log('Opportunity real scores:');
    discOpps.filter(o => o.title?.startsWith('Opp Test')).forEach(o => {
      console.log(`  Opp #${o.id} (${o.title}): raw_score=${o.raw_discovery_score}, final_score=${o.discovery_score}`);
    });

    // Cleanup
    await c.query(`DELETE FROM posts WHERE caption LIKE 'Score Test%'`);
    await c.query(`DELETE FROM events WHERE title LIKE 'Event %'`);
    await c.query(`DELETE FROM opportunities WHERE title LIKE 'Opp Test%'`);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
