require('dotenv').config();
const { createPool } = require("../config/db");
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = createPool();
  try {
    console.log('[Migration 032] Starting community circles member count trigger migration...');
    const sqlPath = path.join(__dirname, '../migrations/032_community_circles_count_trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('[Migration 032] ✅ trigger function, trigger, and member circle counts updated.');

    const res = await pool.query(`
      SELECT m.username, m.circle_count 
      FROM members m 
      WHERE m.username IN ('veens', 'nexarc01', 'harshithsgowda')
    `);
    console.log('[Migration 032] Verified member circle counts:', res.rows);
  } catch (err) {
    console.error('[Migration 032] Failed:', err);
  } finally {
    await pool.end();
  }
}

main();
