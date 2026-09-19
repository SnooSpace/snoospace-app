require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const sql = fs.readFileSync(__dirname + '/../migrations/094_community_disruptions.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 094 applied successfully');

  const tableCheck = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_disruptions')"
  );
  console.log('community_disruptions exists:', tableCheck.rows[0].exists);

  const colsCheck = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'communities' AND column_name IN ('non_genuine_cancellation_count', 'cancellation_flagged')"
  );
  console.log('communities columns added:', colsCheck.rows);

  await pool.end();
}

run().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
