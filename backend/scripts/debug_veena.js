const { Pool } = require('pg');
const p = new Pool({ host:'127.0.0.1', port:5432, user:'postgres', password:'postgressql1234', database:'snoospace' });

async function run() {
  // Dormant any creator_follows where both members are already in a circle
  const r = await p.query(`
    UPDATE creator_follows cf
    SET is_dormant = true
    FROM circles ci
    WHERE cf.is_dormant = false
      AND (
        (cf.follower_id = ci.user_a_id AND cf.creator_id = ci.user_b_id)
        OR
        (cf.follower_id = ci.user_b_id AND cf.creator_id = ci.user_a_id)
      )
  `);
  console.log('[Backfill] Dormanted', r.rowCount, 'creator_follows row(s) where members are in a circle');

  // Verify
  const check = await p.query(`
    SELECT cf.follower_id, cf.creator_id, cf.is_dormant,
           f.name AS follower_name, c.name AS creator_name
    FROM creator_follows cf
    JOIN members f ON f.id = cf.follower_id
    JOIN members c ON c.id = cf.creator_id
  `);
  console.log('[Backfill] All creator_follows rows:');
  check.rows.forEach(row => {
    console.log(`  ${row.follower_name} -> ${row.creator_name}: is_dormant=${row.is_dormant}`);
  });

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
