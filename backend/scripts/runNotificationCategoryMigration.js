const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');
require('dotenv').config();

async function run() {
  const pool = createPool();
  try {
    console.log('[Migration] Reading migration file...');
    const sqlPath = path.join(__dirname, '../migrations/043_add_notification_category.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('[Migration] Executing migration SQL...');
    await pool.query(sql);
    console.log('[Migration] ✅ Migration successful!');
  } catch (err) {
    console.error('[Migration] ❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
