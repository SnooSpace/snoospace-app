/**
 * Run Migration 068: Add first_discovered_at to post_impression_state
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/068_discovery_first_seen.sql'),
    'utf8'
  );

  const client = await pool.connect();
  try {
    console.log('Running migration 068_discovery_first_seen...');
    await client.query(sql);
    console.log('Migration 068 applied successfully.');

    // Verify
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'post_impression_state'
        AND column_name = 'first_discovered_at'
    `);
    if (res.rows.length === 0) {
      throw new Error('Column first_discovered_at not found after migration!');
    }
    console.log('Verified column:', res.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration 068 failed:', err.message);
  process.exit(1);
});
