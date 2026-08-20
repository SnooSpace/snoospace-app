require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER, password: process.env.DB_PASS,
  database: process.env.DB_NAME, ssl: { rejectUnauthorized: false }
});

async function main() {
  const c = await pool.connect();

  // ── 1. Real penalized rows with detailed expiry status ──────────────────────
  console.log('\n=== REAL PENALIZED ROWS (with expired-penalty detail) ===');
  const r1 = await c.query(`
    SELECT user_id, post_id, rank_penalty_tier, rank_penalty_until, retired_at,
           NOW() AS now_ts,
           NOW() < rank_penalty_until AS penalty_still_active,
           (rank_penalty_until - NOW()) AS time_until_expiry
    FROM post_impression_state
    WHERE rank_penalty_tier IS NOT NULL
  `);
  r1.rows.forEach(r => console.log(JSON.stringify({
    user_id:              r.user_id,
    post_id:              r.post_id,
    tier:                 r.rank_penalty_tier,
    penalty_until:        r.rank_penalty_until,
    now_ts:               r.now_ts,
    penalty_still_active: r.penalty_still_active,
    time_until_expiry:    r.time_until_expiry
  }, null, 2)));

  // ── 2. Confirm EXPIRED penalty → ELSE branch (no shift) ─────────────────────
  console.log('\n=== EFFECTIVE_SORT_TIME for expired-penalty rows (read-path verification) ===');
  const r2 = await c.query(`
    SELECT
      p.id AS post_id,
      p.created_at,
      pis.rank_penalty_tier,
      pis.rank_penalty_until,
      NOW() < pis.rank_penalty_until AS penalty_active,
      CASE
        WHEN pis.rank_penalty_tier = 'heavy'
         AND pis.rank_penalty_until IS NOT NULL
         AND NOW() < pis.rank_penalty_until
        THEN p.created_at - INTERVAL '10 days'
        WHEN pis.rank_penalty_tier = 'light'
         AND pis.rank_penalty_until IS NOT NULL
         AND NOW() < pis.rank_penalty_until
        THEN p.created_at - INTERVAL '3 days'
        ELSE p.created_at
      END AS effective_sort_time,
      CASE
        WHEN NOW() < pis.rank_penalty_until THEN 'SHIFTED -3 days'
        ELSE 'RECOVERED: ELSE p.created_at'
      END AS verdict
    FROM post_impression_state pis
    JOIN posts p ON p.id = pis.post_id
    WHERE pis.rank_penalty_tier IS NOT NULL
  `);
  r2.rows.forEach(r => console.log(JSON.stringify({
    post_id:             r.post_id,
    created_at:          r.created_at,
    effective_sort_time: r.effective_sort_time,
    penalty_active:      r.penalty_active,
    verdict:             r.verdict
  }, null, 2)));

  // ── 3. Dry-run strike-2 on post 171 (user 54 already has unseen_count=1) ────
  console.log('\n=== DRY-RUN: Strike-2 on post 171 (user 54, already unseen_count=1) ===');
  await c.query('BEGIN');
  const before = await c.query(
    `SELECT unseen_count, rank_penalty_tier, rank_penalty_until, retired_at, last_session_id
     FROM post_impression_state WHERE user_id=54 AND user_type='member' AND post_id=171`
  );
  console.log('Before (current real DB state):', before.rows[0]);

  const fakeSession2 = '11111111-0000-4000-b000-' + Date.now().toString(16).padStart(12, '0');
  await c.query(`
    INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, last_session_id, rank_penalty_tier, rank_penalty_until)
    VALUES (54, 'member', 171, 1, $1, 'light', NOW() + INTERVAL '5 days')
    ON CONFLICT (user_id, user_type, post_id)
    DO UPDATE SET
      unseen_count = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN LEAST(post_impression_state.unseen_count + 1, 2)
        ELSE post_impression_state.unseen_count
      END,
      last_session_id = EXCLUDED.last_session_id,
      retired_at = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN COALESCE(post_impression_state.retired_at, NOW())
        ELSE post_impression_state.retired_at
      END,
      rank_penalty_tier = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN NULL
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN 'light'
        ELSE post_impression_state.rank_penalty_tier
      END,
      rank_penalty_until = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN NULL
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN NOW() + INTERVAL '5 days'
        ELSE post_impression_state.rank_penalty_until
      END
    WHERE post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
  `, [fakeSession2]);

  const after = await c.query(
    `SELECT unseen_count, rank_penalty_tier, rank_penalty_until, retired_at, last_session_id
     FROM post_impression_state WHERE user_id=54 AND user_type='member' AND post_id=171`
  );
  console.log('After strike-2 (within dry-run txn):', after.rows[0]);
  await c.query('ROLLBACK');
  console.log('ROLLBACK complete — no data modified');

  // ── 4. Dry-run strike-1 on clean post 179 with active check ─────────────────
  console.log('\n=== DRY-RUN: Strike-1 on clean post 179 (viewer=155) — active penalty verification ===');
  await c.query('BEGIN');
  const fakeSession1 = '22222222-0000-4000-c000-' + Date.now().toString(16).padStart(12, '0');
  await c.query(`
    INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, last_session_id, rank_penalty_tier, rank_penalty_until)
    VALUES (155, 'member', 179, 1, $1, 'light', NOW() + INTERVAL '5 days')
    ON CONFLICT (user_id, user_type, post_id)
    DO UPDATE SET
      unseen_count = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN LEAST(post_impression_state.unseen_count + 1, 2)
        ELSE post_impression_state.unseen_count
      END,
      last_session_id = EXCLUDED.last_session_id,
      retired_at = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN COALESCE(post_impression_state.retired_at, NOW())
        ELSE post_impression_state.retired_at
      END,
      rank_penalty_tier = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN NULL
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN 'light'
        ELSE post_impression_state.rank_penalty_tier
      END,
      rank_penalty_until = CASE
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          AND post_impression_state.unseen_count + 1 >= 2
        THEN NULL
        WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
        THEN NOW() + INTERVAL '5 days'
        ELSE post_impression_state.rank_penalty_until
      END
    WHERE post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
  `, [fakeSession1]);

  // Read back written values
  const s1row = await c.query(`
    SELECT user_id, post_id, unseen_count, rank_penalty_tier, rank_penalty_until, retired_at
    FROM post_impression_state WHERE user_id=155 AND user_type='member' AND post_id=179
  `);
  console.log('Written PIS row (post 179, viewer 155):', s1row.rows[0]);

  // Now compute effective_sort_time within same txn
  const est = await c.query(`
    SELECT
      p.id AS post_id,
      p.created_at,
      pis.rank_penalty_tier,
      pis.rank_penalty_until,
      NOW() < pis.rank_penalty_until AS penalty_active,
      CASE
        WHEN pis.rank_penalty_tier = 'light'
         AND pis.rank_penalty_until IS NOT NULL
         AND NOW() < pis.rank_penalty_until
        THEN p.created_at - INTERVAL '3 days'
        ELSE p.created_at
      END AS effective_sort_time,
      p.created_at - (
        CASE
          WHEN pis.rank_penalty_tier = 'light'
           AND pis.rank_penalty_until IS NOT NULL
           AND NOW() < pis.rank_penalty_until
          THEN p.created_at - INTERVAL '3 days'
          ELSE p.created_at
        END
      ) AS delta
    FROM posts p
    LEFT JOIN post_impression_state pis
      ON pis.user_id = 155 AND pis.user_type = 'member' AND pis.post_id = p.id
    WHERE p.id = 179
  `);
  const row = est.rows[0];
  console.log('effective_sort_time breakdown:');
  console.log('  post_id:            ', row.post_id);
  console.log('  created_at:         ', row.created_at);
  console.log('  rank_penalty_tier:  ', row.rank_penalty_tier);
  console.log('  rank_penalty_until: ', row.rank_penalty_until);
  console.log('  penalty_active:     ', row.penalty_active);
  console.log('  effective_sort_time:', row.effective_sort_time);
  console.log('  delta (shift):      ', row.delta);

  await c.query('ROLLBACK');
  console.log('ROLLBACK complete — no data modified');

  c.release();
  await pool.end();
}

main().catch(e => { console.error('AUDIT2 ERROR:', e); process.exit(1); });
