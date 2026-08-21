/**
 * Diagnostic Script: Audit Schema for Discovery Phase 2
 * Inspects schemas, columns, counts, and sample records for:
 *   - Events & event_impression_state & engagement tables
 *   - Opportunities & opportunity_impression_state & engagement tables
 *   - Open Plans & engagement tables
 */
'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    const tables = [
      'events',
      'event_impression_state',
      'event_likes',
      'event_comments',
      'event_interests',
      'event_views',
      'event_repeat_view_events',
      'opportunities',
      'opportunity_impression_state',
      'opportunity_likes',
      'opportunity_comments',
      'opportunity_saves',
      'opportunity_views',
      'opportunity_repeat_view_events',
      'open_plans',
      'open_plan_likes',
      'open_plan_comments',
      'open_plan_interests',
      'open_plan_shares',
      'open_plan_views',
      'open_plan_requests',
    ];

    console.log('=== PHASE 2 DISCOVERY SCHEMA AUDIT ===\n');

    for (const t of tables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t]);

      if (colRes.rows.length === 0) {
        console.log(`❌ Table '${t}' DOES NOT EXIST in information_schema.\n`);
        continue;
      }

      const countRes = await client.query(`SELECT count(*)::int AS cnt FROM ${t}`).catch(e => ({ rows: [{ cnt: 'ERR: ' + e.message }] }));

      console.log(`Table: ${t} (${countRes.rows[0].cnt} rows)`);
      console.log('Columns:');
      colRes.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`);
      });
      console.log('');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
