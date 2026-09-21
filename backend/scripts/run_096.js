const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const fs = require('fs');

const pool = createPool();

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/096_tier_switch_rules.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration 096 applied successfully');

  const colsCheck = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'tier_switch_rules'"
  );
  console.log('events column checked:', colsCheck.rows);

  await pool.end();
}

run().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
