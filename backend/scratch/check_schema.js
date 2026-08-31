'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function checkCols() {
  const pool = createPool();
  for (const t of ['post_likes', 'post_comments', 'post_shares', 'post_saves']) {
    const cols = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [t]);
    console.log(t, cols.rows.map(r => r.column_name));
  }
  await pool.end();
}

checkCols();
