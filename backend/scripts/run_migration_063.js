require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const sql = fs.readFileSync('migrations/063_opportunity_rerank.sql', 'utf8');
  await pool.query(sql);
  console.log('✅ Migration 063 applied successfully.');

  const cols = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = 'opportunity_impression_state'
     ORDER BY ordinal_position`
  );
  console.log('Columns in opportunity_impression_state:', cols.rows);
  await pool.end();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
