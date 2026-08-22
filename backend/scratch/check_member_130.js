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
    // Check member 130 follows count
    const follows = await c.query('SELECT count(*) FROM follows WHERE follower_id = 130');
    const creatorFollows = await c.query('SELECT count(*) FROM creator_follows WHERE follower_id = 130');
    const circles = await c.query('SELECT count(*) FROM circles WHERE user_a_id = 130 OR user_b_id = 130');
    const commCircles = await c.query('SELECT count(*) FROM community_member_circles WHERE member_id = 130');
    const ownPosts = await c.query("SELECT count(*) FROM posts WHERE author_id = 130 AND author_type = 'member'");

    console.log(`Member 130 stats:`);
    console.log(`  follows: ${follows.rows[0].count}`);
    console.log(`  creator_follows: ${creatorFollows.rows[0].count}`);
    console.log(`  circles: ${circles.rows[0].count}`);
    console.log(`  community_member_circles: ${commCircles.rows[0].count}`);
    console.log(`  own_posts: ${ownPosts.rows[0].count}`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
