'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function auditTestData() {
  const pool = createPool();
  console.log('================================================================');
  console.log('AUDIT: Test Data & Synthetic Contamination Analysis');
  console.log('================================================================\n');

  try {
    // 1. Members audit
    const membersTotal = await pool.query(`SELECT COUNT(*) FROM members`);
    const realMembers = await pool.query(`
      SELECT id, name, username, email FROM members 
      WHERE email IN ('harshiths440@gmail.com', 'veenas127@gmail.com', 'nexarc01@gmail.com')
         OR username IN ('veena', 'harshith')
    `);
    const syntheticMembers = await pool.query(`
      SELECT id, name, username, email FROM members 
      WHERE email LIKE 'member_%@snoospace.dev'
         OR email LIKE 'loadtest_%'
         OR email LIKE '%@snoospace-test.internal'
         OR username IN ('aarav_dev', 'kabir_photo', 'rohan_ai', 'vikram_m', 'priya_design', 'ananya_art', 'neha_writes', 'riya_music', 'aditi_dance', 'tanvi_fit')
      LIMIT 10
    `);
    console.log(`Members: Total in DB = ${membersTotal.rows[0].count}`);
    console.log(`  Real Dev Accounts (${realMembers.rows.length}):`, realMembers.rows);
    console.log(`  Synthetic / Test Accounts Sample (${syntheticMembers.rows.length} of many):`, syntheticMembers.rows.map(r => `${r.name} (@${r.username}, ID:${r.id})`));

    // 2. Communities audit
    const commTotal = await pool.query(`SELECT COUNT(*) FROM communities`);
    const syntheticComms = await pool.query(`
      SELECT id, name, username, email FROM communities
      WHERE email LIKE 'community_%@snoospace.dev'
         OR username IN ('tech_ai_guild', 'fitness_run_club', 'music_lab_blr', 'uiux_craft', 'indie_film_society', 'book_club_blr', 'startup_founders_hub', 'culinary_arts_blr', 'gaming_esports_blr', 'dance_movement_co')
    `);
    console.log(`\nCommunities: Total in DB = ${commTotal.rows[0].count}`);
    console.log(`  Synthetic / Test Communities (${syntheticComms.rows.length}):`, syntheticComms.rows.map(r => `${r.name} (ID:${r.id})`));

    // 3. Posts audit
    const postsTotal = await pool.query(`SELECT COUNT(*) FROM posts`);
    const postsBySynthetic = await pool.query(`
      SELECT COUNT(*) FROM posts
      WHERE author_id IN (SELECT id FROM members WHERE email LIKE 'member_%@snoospace.dev' OR username IN ('aarav_dev', 'kabir_photo', 'rohan_ai', 'vikram_m', 'priya_design', 'ananya_art', 'neha_writes', 'riya_music', 'aditi_dance', 'tanvi_fit'))
         OR author_id IN (SELECT id FROM communities WHERE email LIKE 'community_%@snoospace.dev' OR username IN ('tech_ai_guild', 'fitness_run_club', 'music_lab_blr', 'uiux_craft', 'indie_film_society', 'book_club_blr', 'startup_founders_hub', 'culinary_arts_blr', 'gaming_esports_blr', 'dance_movement_co'))
    `);
    console.log(`\nPosts: Total in DB = ${postsTotal.rows[0].count}`);
    console.log(`  Posts Authored by Synthetic Entities: ${postsBySynthetic.rows[0].count}`);

    // 4. Opportunities audit
    const oppsTotal = await pool.query(`SELECT COUNT(*) FROM opportunities`);
    console.log(`\nOpportunities: Total in DB = ${oppsTotal.rows[0].count}`);

    // 5. Events audit
    const eventsTotal = await pool.query(`SELECT COUNT(*) FROM events`);
    console.log(`\nEvents: Total in DB = ${eventsTotal.rows[0].count}`);

    // 6. Check what user 51 ('harshiths440@gmail.com') sees in Discovery
    const discPostsFor51 = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type
      FROM posts p
      WHERE p.author_id != 51
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
      LIMIT 5
    `);
    console.log(`\nDiscovery Candidates for User 51 (${discPostsFor51.rows.length} sampled):`);
    console.log(discPostsFor51.rows.map(r => `  ID ${r.id} (${r.post_type}, author ${r.author_type}-${r.author_id}): ${r.caption.slice(0, 40)}`));

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

auditTestData();
