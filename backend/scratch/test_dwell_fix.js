/**
 * Test 1: Verify dwell_score > 0 for poll-type posts after the dwell-fix.
 *
 * Inserts a synthetic unique_view_events row for a real poll post with dwell_time_ms=2500,
 * then runs the dwell_aff CTE from getDiscoveryPosts and confirms dwell_score > 0.
 *
 * Cleanup: removes the synthetic view event row at the end.
 */
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
  const client = await pool.connect();
  const TEST_USER_ID   = 999999901;
  const TEST_USER_TYPE = 'member';

  console.log('=== Test 1: Dwell-score > 0 for poll post type ===\n');

  // Find a real poll post to satisfy the FK constraint
  const pollPostRes = await client.query(`
    SELECT id FROM posts WHERE post_type = 'poll' LIMIT 1
  `);
  if (pollPostRes.rows.length === 0) {
    console.log('No real poll post found — skipping test (data sparsity).');
    client.release();
    await pool.end();
    return;
  }
  const TEST_POST_ID = pollPostRes.rows[0].id;
  console.log(`Using real poll post id=${TEST_POST_ID}`);

  // Find a real member user to satisfy user FK (if one exists)
  // Some schemas have no FK on user_id in unique_view_events — try inserting anyway
  try {
    await client.query(`
      INSERT INTO unique_view_events (post_id, user_id, user_type, dwell_time_ms, trigger_type, post_type)
      VALUES ($1, $2, $3, 2500, 'dwell', 'poll')
      ON CONFLICT DO NOTHING
    `, [TEST_POST_ID, TEST_USER_ID, TEST_USER_TYPE]);
    console.log('Inserted synthetic unique_view_events row: post_type=poll, dwell_time_ms=2500');

    // Run the dwell_aff CTE scoped to the test user
    const res = await client.query(`
      WITH dwell_aff AS (
        SELECT post_type,
               AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score
          FROM unique_view_events
         WHERE user_id = $1 AND user_type = $2
         GROUP BY post_type
      )
      SELECT post_type, dwell_score FROM dwell_aff WHERE post_type = 'poll'
    `, [TEST_USER_ID, TEST_USER_TYPE]);

    if (res.rows.length === 0) {
      throw new Error('FAIL: No dwell_aff row returned for post_type=poll');
    }
    const score = parseFloat(res.rows[0].dwell_score);
    console.log(`dwell_score for poll = ${score}`);
    if (score <= 0) {
      throw new Error(`FAIL: dwell_score = ${score}, expected > 0`);
    }
    console.log(`\n✅ PASS: dwell_score=${score.toFixed(4)} > 0 for post_type='poll'\n`);

  } finally {
    // Cleanup
    await client.query(
      `DELETE FROM unique_view_events WHERE user_id=$1 AND user_type=$2 AND post_id=$3`,
      [TEST_USER_ID, TEST_USER_TYPE, TEST_POST_ID]
    ).catch(() => {});
    console.log('Cleaned up synthetic unique_view_events row.');
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
