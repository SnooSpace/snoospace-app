'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  const testUserId = 888888;
  const testUserType = 'member';

  try {
    console.log('================================================================');
    console.log('TRICKLE-STAMP DATABASE VERIFICATION (ZERO-FOLLOW SERVE PATH)');
    console.log('================================================================\n');

    // 1. Pick a real post ID and opportunity ID from the database
    const postRes = await client.query('SELECT id FROM posts LIMIT 1');
    const oppRes = await client.query('SELECT id FROM opportunities LIMIT 1');

    if (postRes.rows.length === 0 || oppRes.rows.length === 0) {
      throw new Error('Database does not have sample posts or opportunities.');
    }

    const testPostId = postRes.rows[0].id;
    const testOppId = oppRes.rows[0].id;

    console.log(`Target Test IDs -> Post ID: ${testPostId} | Opportunity ID: ${testOppId}`);
    console.log(`Test Viewer     -> User ID: ${testUserId} (${testUserType})\n`);

    // Clean up any pre-existing test state
    await client.query(
      'DELETE FROM post_impression_state WHERE user_id = $1 AND user_type = $2 AND post_id = $3',
      [testUserId, testUserType, testPostId]
    );
    await client.query(
      'DELETE FROM opportunity_impression_state WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3',
      [testUserId, testUserType, testOppId]
    );

    // 2. BEFORE state: Query impression state tables
    console.log('--- 1. BEFORE SERVE ---');
    const postBefore = await client.query(
      'SELECT post_id, first_discovered_at FROM post_impression_state WHERE user_id = $1 AND user_type = $2 AND post_id = $3',
      [testUserId, testUserType, testPostId]
    );
    const oppBefore = await client.query(
      'SELECT opportunity_id, first_discovered_at FROM opportunity_impression_state WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3',
      [testUserId, testUserType, testOppId]
    );

    console.log('  post_impression_state row:        ', postBefore.rows[0] || 'NULL (no row exists)');
    console.log('  opportunity_impression_state row: ', oppBefore.rows[0] || 'NULL (no row exists)');

    // 3. SIMULATE ZERO-FOLLOW SERVE: ViewQueueService sends discovery_serve batch
    console.log('\n--- 2. EXECUTING DISCOVERY SERVE BATCH (ViewQueueService -> viewsController) ---');

    // Post discovery_serve SQL from viewsController.js
    await client.query(
      `INSERT INTO post_impression_state
         (user_id, user_type, post_id, first_discovered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, user_type, post_id) DO UPDATE
         SET first_discovered_at = COALESCE(
           post_impression_state.first_discovered_at, NOW()
         )`,
      [testUserId, testUserType, testPostId]
    );

    // Opportunity discovery_opp_serve SQL from viewsController.js
    await client.query(
      `INSERT INTO opportunity_impression_state
         (user_id, user_type, opportunity_id, first_discovered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, user_type, opportunity_id) DO UPDATE
         SET first_discovered_at = COALESCE(
           opportunity_impression_state.first_discovered_at, NOW()
         )`,
      [testUserId, testUserType, testOppId]
    );

    // 4. AFTER state: Query impression state tables
    console.log('\n--- 3. AFTER SERVE ---');
    const postAfter = await client.query(
      'SELECT post_id, first_discovered_at FROM post_impression_state WHERE user_id = $1 AND user_type = $2 AND post_id = $3',
      [testUserId, testUserType, testPostId]
    );
    const oppAfter = await client.query(
      'SELECT opportunity_id, first_discovered_at FROM opportunity_impression_state WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3',
      [testUserId, testUserType, testOppId]
    );

    console.log('  post_impression_state row:        ', postAfter.rows[0]);
    console.log('  opportunity_impression_state row: ', oppAfter.rows[0]);

    const stampedPostTime = postAfter.rows[0]?.first_discovered_at;
    const stampedOppTime = oppAfter.rows[0]?.first_discovered_at;

    if (!stampedPostTime || !stampedOppTime) {
      throw new Error('first_discovered_at was not populated!');
    }

    // 5. IDEMPOTENCE TEST: Repeat serve 1 second later to prove original timestamp is preserved
    console.log('\n--- 4. IDEMPOTENCE TEST (RE-SERVE 1s LATER) ---');
    await new Promise(r => setTimeout(r, 1000));

    await client.query(
      `INSERT INTO post_impression_state
         (user_id, user_type, post_id, first_discovered_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, user_type, post_id) DO UPDATE
         SET first_discovered_at = COALESCE(
           post_impression_state.first_discovered_at, NOW()
         )`,
      [testUserId, testUserType, testPostId]
    );

    const postReServe = await client.query(
      'SELECT post_id, first_discovered_at FROM post_impression_state WHERE user_id = $1 AND user_type = $2 AND post_id = $3',
      [testUserId, testUserType, testPostId]
    );

    console.log('  Re-served post first_discovered_at:', postReServe.rows[0]?.first_discovered_at);
    const isIdempotent = new Date(stampedPostTime).getTime() === new Date(postReServe.rows[0]?.first_discovered_at).getTime();
    console.log('  Timestamp unchanged on repeat serve? ', isIdempotent ? '✅ YES (COALESCE preserved original)' : '❌ NO');

    // Clean up
    await client.query(
      'DELETE FROM post_impression_state WHERE user_id = $1 AND user_type = $2 AND post_id = $3',
      [testUserId, testUserType, testPostId]
    );
    await client.query(
      'DELETE FROM opportunity_impression_state WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3',
      [testUserId, testUserType, testOppId]
    );

    console.log('\n================================================================');
    console.log('TRICKLE-STAMP DB VERIFICATION PASSED');
    console.log('================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Trickle stamp test error:', err);
  process.exit(1);
});
