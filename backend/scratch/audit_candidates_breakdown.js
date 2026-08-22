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
  const c = await pool.connect();
  try {
    console.log('=== POSTS IN DB ===');
    console.log('Total posts in DB:', (await c.query('SELECT count(*) FROM posts')).rows[0].count);
    console.log('Posts within last 5 days:', (await c.query("SELECT count(*) FROM posts WHERE created_at >= NOW() - INTERVAL '5 days'")).rows[0].count);

    console.log('\n=== EVENTS IN DB ===');
    const evCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='events'");
    console.log('events cols:', evCols.rows.map(x => x.column_name).join(', '));
    console.log('Total events in DB:', (await c.query('SELECT count(*) FROM events')).rows[0].count);
    const events = await c.query('SELECT id, title, event_date, start_time, status FROM events LIMIT 5');
    console.log('Sample events:', events.rows);

    console.log('\n=== OPPORTUNITIES IN DB ===');
    const oppCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='opportunities'");
    console.log('opps cols:', oppCols.rows.map(x => x.column_name).join(', '));
    console.log('Total opps in DB:', (await c.query('SELECT count(*) FROM opportunities')).rows[0].count);
    const opps = await c.query('SELECT id, title, deadline, status FROM opportunities LIMIT 5');
    console.log('Sample opps:', opps.rows);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
