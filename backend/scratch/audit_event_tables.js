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
    const eventTables = [
      'event_impression_state',
      'event_likes',
      'event_comments',
      'event_interests',
      'event_views',
      'event_repeat_view_events',
    ];

    for (const t of eventTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t]);

      const countRes = await client.query(`SELECT count(*)::int AS cnt FROM ${t}`).catch(e => ({ rows: [{ cnt: 'ERR: ' + e.message }] }));

      console.log(`Table: ${t} (${countRes.rows[0].cnt} rows)`);
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
  console.error(err);
  process.exit(1);
});
