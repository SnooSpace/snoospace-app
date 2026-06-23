const { Pool } = require('pg');
const p = new Pool({ host:'127.0.0.1', port:5432, user:'postgres', password:'postgressql1234', database:'snoospace' });

async function run() {
  // Check circle between Veena (155) and Harshith (51)
  const c = await p.query(`
    SELECT * FROM circles WHERE (user_a_id=51 AND user_b_id=155) OR (user_a_id=155 AND user_b_id=51)
  `);
  console.log('Circle row:', JSON.stringify(c.rows));

  const cf = await p.query(`
    SELECT * FROM creator_follows WHERE follower_id=155 AND creator_id=51
  `);
  console.log('Creator follow row:', JSON.stringify(cf.rows));

  // Run the backfill manually now with correct column
  const r = await p.query(`
    UPDATE creator_follows cf
    SET is_superseded_by_circle = true
    FROM circles ci
    WHERE cf.is_superseded_by_circle = false
      AND cf.is_dormant = false
      AND (
        (cf.follower_id = ci.user_a_id AND cf.creator_id = ci.user_b_id)
        OR
        (cf.follower_id = ci.user_b_id AND cf.creator_id = ci.user_a_id)
      )
    RETURNING cf.follower_id, cf.creator_id, cf.is_superseded_by_circle
  `);
  console.log('Backfill result:', JSON.stringify(r.rows));

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
