'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     parseInt(process.env.DB_PORT, 10),
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  console.log('Running migration 065: rank_penalty columns...');

  await pool.query(
    `ALTER TABLE post_impression_state
       ADD COLUMN IF NOT EXISTS rank_penalty_tier VARCHAR(10) DEFAULT NULL,
       ADD COLUMN IF NOT EXISTS rank_penalty_until TIMESTAMPTZ DEFAULT NULL`
  );
  console.log('  ALTER TABLE done');

  // CONCURRENTLY must run outside a transaction — standalone query
  await pool.query(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pis_rank_penalty
       ON post_impression_state (user_id, user_type, post_id)
       WHERE rank_penalty_tier IS NOT NULL`
  );
  console.log('  CREATE INDEX CONCURRENTLY done');

  const verify = await pool.query(
    `SELECT column_name, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_name = 'post_impression_state'
       AND column_name IN ('rank_penalty_tier', 'rank_penalty_until')
     ORDER BY column_name`
  );
  console.log('  Verified columns:', JSON.stringify(verify.rows, null, 2));
  await pool.end();
}

run().catch(e => { console.error('Migration FAIL:', e.message, e.code || ''); pool.end(); process.exit(1); });
