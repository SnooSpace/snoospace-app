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
    console.log('--- POSTS AUDIT ---');
    const posts = await c.query(`SELECT id, author_type, author_id, post_type, created_at, status FROM posts ORDER BY id DESC LIMIT 10`);
    console.log(posts.rows);

    console.log('\n--- EVENTS AUDIT ---');
    const events = await c.query(`SELECT id, title, is_published, start_datetime, is_cancelled, access_type, invite_public_visibility, start_datetime > NOW() as is_future FROM events ORDER BY id DESC LIMIT 10`);
    console.log(events.rows);

    console.log('\n--- OPPORTUNITIES AUDIT ---');
    const opps = await c.query(`SELECT id, title, creator_type, status, expires_at, closed_at, (expires_at IS NULL OR expires_at > NOW()) as not_expired FROM opportunities ORDER BY id DESC LIMIT 10`);
    console.log(opps.rows);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
