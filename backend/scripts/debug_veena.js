const { Pool } = require('pg');
const p = new Pool({ host:'127.0.0.1', port:5432, user:'postgres', password:'postgressql1234', database:'snoospace' });

async function run() {
  const r = await p.query(`
    SELECT m.id, m.name, m.following_count,
      (SELECT COUNT(*) FROM creator_follows WHERE follower_id = m.id AND is_dormant = false)::int AS creator_following
    FROM members m
    WHERE m.name ILIKE '%veena%'
  `);
  const row = r.rows[0];
  console.log('Veena DB row:', JSON.stringify(row));
  const combined = parseInt(row.following_count) + parseInt(row.creator_following);
  console.log('Combined following that API should return:', combined);
  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
