const { Pool } = require('pg');
const pool = new Pool({ host:'127.0.0.1', port:5432, user:'postgres', password:'postgressql1234', database:'snoospace' });

async function check() {
  // Find Veena's account
  const veena = await pool.query(
    `SELECT id, name, follower_count, creator_follower_count, circle_count, is_creator_mode_enabled FROM members WHERE LOWER(name) LIKE '%veena%'`
  );
  console.log('\n--- Veena member rows ---');
  console.table(veena.rows);

  if (veena.rows.length === 0) { console.log('No Veena found.'); await pool.end(); return; }
  const veenaId = veena.rows[0].id;

  // All follows rows targeting Veena
  const fol = await pool.query(
    `SELECT f.id, f.follower_id, f.follower_type, f.following_id, f.following_type, f.is_superseded_by_circle, f.created_at,
            COALESCE(m.name, 'non-member') AS follower_name
     FROM follows f
     LEFT JOIN members m ON m.id = f.follower_id AND f.follower_type = 'member'
     WHERE f.following_id = $1`,
    [veenaId]
  );
  console.log('\n--- follows rows targeting Veena ---');
  console.table(fol.rows);

  // ALL creator_follows rows (including dormant)
  const cf = await pool.query(
    `SELECT cf.id, cf.follower_id, cf.follower_type, cf.creator_id, cf.is_dormant, cf.is_superseded_by_circle, cf.created_at,
            m.name AS follower_name
     FROM creator_follows cf
     LEFT JOIN members m ON m.id = cf.follower_id
     WHERE cf.creator_id = $1`,
    [veenaId]
  );
  console.log('\n--- creator_follows rows targeting Veena (ALL incl. dormant) ---');
  console.table(cf.rows);

  // Circle membership for Veena
  const circles = await pool.query(
    `SELECT * FROM circles WHERE user_a_id = $1 OR user_b_id = $1`,
    [veenaId]
  );
  console.log('\n--- circles rows containing Veena ---');
  console.table(circles.rows);

  // Live counts
  const live = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM creator_follows WHERE creator_id = $1 AND is_dormant = false AND is_superseded_by_circle = false) AS live_creator_followers,
       (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'member') AS live_follows
    `,
    [veenaId]
  );
  console.log('\n--- Live counts for Veena ---');
  console.table(live.rows);

  await pool.end();
}

check().catch(e => { console.error(e.message); process.exit(1); });
