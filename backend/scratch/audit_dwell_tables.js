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
      'event_views',
      'event_repeat_view_events',
      'opportunity_views',
      'opportunity_repeat_view_events',
      'open_plan_views',
    ];

    for (const t of tables) {
      console.log(`=== Table: ${t} ===`);
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t]);

      colRes.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });

      const countRes = await client.query(`SELECT count(*)::int AS cnt FROM ${t}`);
      console.log(`  Row count: ${countRes.rows[0].cnt}`);

      const sampleRes = await client.query(`SELECT * FROM ${t} LIMIT 5`);
      console.log('  Sample rows:', sampleRes.rows);
      console.log('');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
