const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgressql1234',
  database: 'snoospace'
});

async function run() {
  try {
    // Backfill creator_follower_count from live count
    const r = await pool.query(`
      UPDATE members m
      SET creator_follower_count = (
        SELECT COUNT(*) FROM creator_follows cf
        WHERE cf.creator_id = m.id AND cf.is_dormant = false
      )
      WHERE m.is_creator_mode_enabled = true
    `);
    console.log('[Backfill] Updated', r.rowCount, 'creator member(s)');

    // Verify
    const check = await pool.query(`
      SELECT id, name, creator_follower_count
      FROM members
      WHERE is_creator_mode_enabled = true
      ORDER BY id
    `);
    console.log('[Backfill] Creator counts after update:');
    check.rows.forEach(row => {
      console.log(`  id=${row.id} name=${row.name} creator_follower_count=${row.creator_follower_count}`);
    });
  } catch (e) {
    console.error('[Backfill] Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
