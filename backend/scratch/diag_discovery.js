require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const c = await pool.connect();
  try {
    const r1 = await c.query("SELECT COUNT(*) AS n FROM posts WHERE post_type IN ('media','community_voice')");
    console.log('Total editorial posts:', r1.rows[0].n);

    const r2 = await c.query("SELECT DISTINCT author_id, author_type FROM posts WHERE post_type IN ('media','community_voice')");
    console.log('Distinct editorial authors:', r2.rows.length, r2.rows.map(r => r.author_type + ':' + r.author_id).join(', '));

    const r3 = await c.query('SELECT COUNT(*) AS n FROM follows WHERE follower_type=$1', ['member']);
    console.log('Total member follow rows:', r3.rows[0].n);

    const r4 = await c.query('SELECT COUNT(*) AS n FROM members');
    console.log('Total members:', r4.rows[0].n);

    // How many editorial authors does user 51 NOT follow?
    const r5 = await c.query(`
      SELECT COUNT(*) AS n
        FROM (
          SELECT DISTINCT author_id, author_type
            FROM posts
           WHERE post_type IN ('media','community_voice')
        ) authors
       WHERE NOT EXISTS (
         SELECT 1 FROM follows f
          WHERE f.follower_id = 51 AND f.follower_type = 'member'
            AND f.following_id = authors.author_id
            AND f.following_type = authors.author_type
            AND f.is_superseded_by_circle = false
       )
       AND NOT (authors.author_id = 51 AND authors.author_type = 'member')
    `);
    console.log('Editorial authors user 51 does NOT follow (non-own):', r5.rows[0].n);
  } finally {
    c.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
