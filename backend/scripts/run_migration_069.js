'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/069_event_rank_penalty.sql'),
    'utf8'
  );
  console.log('Applying migration 069_event_rank_penalty.sql …');
  await pool.query(sql);
  console.log('Done.\n');

  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'event_impression_state'
    ORDER BY ordinal_position
  `);
  console.log('event_impression_state columns after migration:');
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
