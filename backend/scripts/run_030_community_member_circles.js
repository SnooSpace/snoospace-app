/**
 * Migration script for Community-Member Circle system (030)
 * Run: node scripts/run_030_community_member_circles.js
 */

'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createPool } = require('../config/db');

const pool = createPool();

async function runMigration() {
  try {
    console.log('[Migration 030] Starting community_member_circles migration...');
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/030_community_member_circles.sql'),
      'utf8'
    );
    await pool.query(sql);
    console.log('[Migration 030] ✅ Tables created successfully:');
    console.log('  - community_member_circle_invites');
    console.log('  - community_member_circles');

    // Verify tables exist
    const check = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('community_member_circle_invites', 'community_member_circles')
      ORDER BY table_name
    `);
    console.log('[Migration 030] Verified tables:', check.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error('[Migration 030] ❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
