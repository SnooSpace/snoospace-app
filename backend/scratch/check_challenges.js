require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const c = await pool.connect();
  try {
    const chalPosts = await c.query(`
      SELECT id, post_type, author_id, author_type, caption, type_data
      FROM posts
      WHERE post_type = 'challenge'
    `);
    console.log('Challenge posts in posts table:');
    console.log(JSON.stringify(chalPosts.rows, null, 2));

    // Check community_voice posts
    const cvPosts = await c.query(`
      SELECT id, post_type, author_id, author_type, caption, type_data
      FROM posts
      WHERE post_type = 'community_voice'
    `);
    console.log('\nCommunity Voice posts:');
    console.log(JSON.stringify(cvPosts.rows, null, 2));

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
