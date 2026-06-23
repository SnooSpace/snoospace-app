const { Pool } = require('pg');
const p = new Pool({ host:'127.0.0.1', port:5432, user:'postgres', password:'postgressql1234', database:'snoospace' });

async function run() {
  // Veena's id = 155
  const userId = 155;
  const limit = 20;
  const offset = 0;

  const result = await p.query(`
    SELECT
      following_id, following_type, following_name, following_username,
      following_photo_url, created_at, true AS is_following
    FROM (
      SELECT
        f.following_id,
        f.following_type,
        CASE
          WHEN f.following_type = 'member'    THEN m.name
          WHEN f.following_type = 'community' THEN c.name
          WHEN f.following_type = 'sponsor'   THEN s.brand_name
          WHEN f.following_type = 'venue'     THEN v.name
        END AS following_name,
        CASE
          WHEN f.following_type = 'member'    THEN m.username
          WHEN f.following_type = 'community' THEN c.username
          WHEN f.following_type = 'sponsor'   THEN s.username
          WHEN f.following_type = 'venue'     THEN v.username
        END AS following_username,
        CASE
          WHEN f.following_type = 'member'    THEN m.profile_photo_url
          WHEN f.following_type = 'community' THEN c.logo_url
          WHEN f.following_type = 'sponsor'   THEN s.logo_url
          WHEN f.following_type = 'venue'     THEN NULL
        END AS following_photo_url,
        f.created_at
      FROM follows f
      LEFT JOIN members     m ON f.following_type = 'member'    AND f.following_id = m.id
      LEFT JOIN communities c ON f.following_type = 'community' AND f.following_id = c.id
      LEFT JOIN sponsors    s ON f.following_type = 'sponsor'   AND f.following_id = s.id
      LEFT JOIN venues      v ON f.following_type = 'venue'     AND f.following_id = v.id
      WHERE f.follower_id = $1 AND f.follower_type = 'member'

      UNION ALL

      SELECT
        cf.creator_id  AS following_id,
        'member'       AS following_type,
        cr.name        AS following_name,
        cr.username    AS following_username,
        cr.profile_photo_url AS following_photo_url,
        cf.created_at
      FROM creator_follows cf
      JOIN members cr ON cr.id = cf.creator_id
      WHERE cf.follower_id = $1 AND cf.is_dormant = false
    ) combined
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  console.log(`Following list for Veena (${result.rows.length} entries):`);
  result.rows.forEach(r => console.log(`  type=${r.following_type} name=${r.following_name} username=${r.following_username}`));
  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
