'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function detailedAudit() {
  const pool = createPool();
  try {
    console.log('=== OPPORTUNITIES SCHEMA ===');
    const oppCols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'opportunities'`);
    console.log(oppCols.rows);

    console.log('\n=== OPPORTUNITIES SAMPLE ===');
    const opps = await pool.query(`SELECT * FROM opportunities LIMIT 10`);
    console.log(JSON.stringify(opps.rows, null, 2));

    console.log('\n=== NON-LOAD-TEST POSTS SAMPLE ===');
    const posts = await pool.query(`SELECT id, author_id, author_type, caption, post_type, created_at, is_load_test FROM posts WHERE is_load_test = false OR is_load_test IS NULL LIMIT 20`);
    console.log(JSON.stringify(posts.rows, null, 2));

    console.log('\n=== NON-LOAD-TEST MEMBERS SAMPLE ===');
    const members = await pool.query(`SELECT id, name, email, created_at, is_load_test FROM members WHERE is_load_test = false OR is_load_test IS NULL LIMIT 20`);
    console.log(JSON.stringify(members.rows, null, 2));

  } catch (err) {
    console.error('Audit error:', err);
  } finally {
    await pool.end();
  }
}

detailedAudit();
