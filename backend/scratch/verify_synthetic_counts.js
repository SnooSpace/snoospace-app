'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function verifyCounts() {
  const pool = createPool();
  try {
    const postsCount = await pool.query(`SELECT post_type, COUNT(*) FROM posts GROUP BY post_type ORDER BY post_type`);
    const eventsCount = await pool.query(`SELECT COUNT(*) FROM events`);
    const oppsCount = await pool.query(`SELECT COUNT(*) FROM opportunities`);
    const commsCount = await pool.query(`SELECT COUNT(*) FROM communities`);
    const membersCount = await pool.query(`SELECT COUNT(*) FROM members WHERE email LIKE 'member_%@snoospace.dev'`);
    const followsCount = await pool.query(`SELECT COUNT(*) FROM follows`);
    const totalPosts = await pool.query(`SELECT COUNT(*) FROM posts`);

    console.log('=== VERIFICATION SUMMARY ===');
    console.log(`Synthetic Communities: ${commsCount.rows[0].count}`);
    console.log(`Synthetic Members: ${membersCount.rows[0].count}`);
    console.log(`Events in DB: ${eventsCount.rows[0].count}`);
    console.log(`Opportunities in DB: ${oppsCount.rows[0].count}`);
    console.log(`Total Posts in DB: ${totalPosts.rows[0].count}`);
    console.log(`Total Follows in DB: ${followsCount.rows[0].count}`);
    console.log('\nPost Types breakdown:', JSON.stringify(postsCount.rows, null, 2));

    // Check multiple posts per author distribution
    const postsPerAuthor = await pool.query(`
      SELECT author_type, author_id, COUNT(*) as post_count
      FROM posts
      GROUP BY author_type, author_id
      HAVING COUNT(*) > 1
      ORDER BY post_count DESC
      LIMIT 15
    `);
    console.log('\nTop authors by post count (verifying multiple posts per user):', JSON.stringify(postsPerAuthor.rows, null, 2));

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await pool.end();
  }
}

verifyCounts();
