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
  const sql = fs.readFileSync(__dirname + '/../migrations/095_per_photo_verification_matching.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 095 applied successfully');

  const colsCheck = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_verifications' AND column_name IN ('matched_photo_urls', 'match_diagnostics', 'rejection_type') ORDER BY column_name"
  );
  console.log('user_verifications columns added:', colsCheck.rows);

  await pool.end();
}

run().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
