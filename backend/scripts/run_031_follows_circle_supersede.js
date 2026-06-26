/**
 * Migration script to separate follows circle-superseded state (031)
 * Run: node scripts/run_031_follows_circle_supersede.js
 */

'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createPool } = require('../config/db');

const pool = createPool();

async function runMigration() {
  try {
    console.log('[Migration 031] Starting follows supersede migration...');
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/031_follows_circle_supersede.sql'),
      'utf8'
    );
    await pool.query(sql);
    console.log('[Migration 031] ✅ follows table updated, trigger fn_update_follow_counts replaced, and counts backfilled.');

    // Verify columns exist
    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'follows' AND column_name = 'is_superseded_by_circle'
    `);
    console.log('[Migration 031] Verified column exists:', check.rows.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error('[Migration 031] ❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
