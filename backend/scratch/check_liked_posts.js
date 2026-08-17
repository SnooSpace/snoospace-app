require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
  password: process.env.DB_PASS, port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  // Find ALL untimed posts that have been liked by member 51, regardless of retired_at
  const r = await pool.query(`
    SELECT pl.post_id, pl.liker_id, pl.liker_type, p.expires_at, pis.retired_at,
           p.author_id, p.author_type, LEFT(p.caption, 40) as caption,
           pl.created_at as liked_at
    FROM post_likes pl
    JOIN posts p ON p.id = pl.post_id
    LEFT JOIN post_impression_state pis
      ON pis.post_id = pl.post_id AND pis.user_id = pl.liker_id AND pis.user_type = pl.liker_type
    WHERE pl.liker_id = 51 AND pl.liker_type = 'member'
      AND (p.expires_at IS NULL OR p.expires_at <= NOW())
    ORDER BY pl.created_at DESC
    LIMIT 20
  `);
  console.log('All untimed posts liked by member 51:');
  console.table(r.rows.map(row => ({
    post_id: row.post_id,
    is_own_post: String(row.author_id) === '51' && row.author_type === 'member',
    liked_at: row.liked_at?.toISOString().slice(0,10),
    retired_at: row.retired_at?.toISOString().slice(0,10) || 'NULL',
    caption: row.caption,
  })));

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
