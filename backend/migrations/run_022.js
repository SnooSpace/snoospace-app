/**
 * Run 022_circles.sql migration via the app's existing DB connection.
 * Run: node backend/migrations/run_022.js
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

async function run() {
  const pool = createPool();
  const sql = fs.readFileSync(path.join(__dirname, '022_circles.sql'), 'utf8');
  try {
    console.log('[run_022] Applying 022_circles.sql...');
    await pool.query(sql);
    console.log('[run_022] ✅ Done.');
  } catch (err) {
    console.error('[run_022] ❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
run();
