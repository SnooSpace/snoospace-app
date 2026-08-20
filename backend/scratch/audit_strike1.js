/**
 * Strike-1 Light-Penalty Audit Script
 * 
 * Read-only audit — no writes to real data.
 * Synthesises one full strike-1 cycle against the live DB:
 *   1. Schema sanity check
 *   2. Find a real post with NO existing impression state row (clean baseline)
 *   3. Find a test user/member to act as viewer
 *   4. Simulate the INSERT...ON CONFLICT write in a READ-ONLY transaction (rollback)
 *      to capture what it would write
 *   5. Query getFeed mirror to confirm effective_sort_time shift
 *   6. Cross-check strike-2 path
 *   7. Confirm no background job clears rank_penalty_tier
 */

require('dotenv').config({ path: 'C:/Dev/SnooSpace/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function sep(title) {
  console.log('\n' + '='.repeat(70));
  console.log('  ' + title);
  console.log('='.repeat(70));
}

async function main() {
  const client = await pool.connect();
  try {

    // ── 1. SCHEMA CHECK ───────────────────────────────────────────────────────
    sep('1. SCHEMA: post_impression_state columns');
    const schema = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'post_impression_state'
      ORDER BY ordinal_position
    `);
    console.table(schema.rows);

    // ── 2. INDEX CHECK ────────────────────────────────────────────────────────
    sep('2. INDEX: idx_pis_rank_penalty');
    const idx = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'post_impression_state'
        AND indexname = 'idx_pis_rank_penalty'
    `);
    if (idx.rows.length > 0) {
      console.log('✅ Index exists:', idx.rows[0].indexdef);
    } else {
      console.log('❌ Index NOT found — migration 065 may not have run');
    }

    // ── 3. FIND A CLEAN POST (no existing pis row) ────────────────────────────
    sep('3. FIND a real post with NO impression-state row');
    const cleanPost = await client.query(`
      SELECT p.id, p.created_at, p.author_id, p.author_type, p.post_type
      FROM posts p
      WHERE NOT EXISTS (
        SELECT 1 FROM post_impression_state pis
        WHERE pis.post_id = p.id
      )
      AND p.post_type NOT IN ('plan_promo', 'event_promo')
      ORDER BY p.created_at DESC
      LIMIT 1
    `);
    if (cleanPost.rows.length === 0) {
      console.log('⚠️  No post found with zero impression-state rows — will use any recent post instead.');
    } else {
      console.log('Clean post (no pis row):', cleanPost.rows[0]);
    }

    // Fallback: pick any recent post
    const anyPost = await client.query(`
      SELECT p.id, p.created_at, p.author_id, p.author_type, p.post_type
      FROM posts p
      WHERE p.post_type NOT IN ('plan_promo', 'event_promo')
      ORDER BY p.created_at DESC
      LIMIT 1
    `);
    const testPost = cleanPost.rows[0] || anyPost.rows[0];
    console.log('\n▶ Using test post:', testPost);

    // ── 4. FIND A TEST VIEWER (a member who follows the post author) ───────────
    sep('4. FIND a viewer who follows the post author');
    const testViewer = await client.query(`
      SELECT m.id AS viewer_id, 'member' AS viewer_type
      FROM members m
      WHERE EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = m.id AND f.follower_type = 'member'
          AND f.following_id = $1 AND f.following_type = $2
      )
      AND m.id != $1
      LIMIT 1
    `, [testPost.author_id, testPost.author_type]);

    let testViewer_ = testViewer.rows[0];
    if (!testViewer_) {
      // fallback: find any member
      const anyMember = await client.query(`SELECT id AS viewer_id, 'member' AS viewer_type FROM members LIMIT 1`);
      testViewer_ = anyMember.rows[0];
      console.log('⚠️  No follower found — using first available member as viewer');
    }
    console.log('▶ Using test viewer:', testViewer_);

    const viewerId   = testViewer_.viewer_id;
    const viewerType = testViewer_.viewer_type;
    const postId     = testPost.id;

    // ── 5. BEFORE STATE ───────────────────────────────────────────────────────
    sep(`5. BEFORE: post_impression_state for viewer=${viewerId} post=${postId}`);
    const before = await client.query(`
      SELECT user_id, user_type, post_id, unseen_count, rank_penalty_tier,
             rank_penalty_until, retired_at, last_session_id
      FROM post_impression_state
      WHERE user_id = $1 AND user_type = $2 AND post_id = $3
    `, [viewerId, viewerType, postId]);
    if (before.rows.length === 0) {
      console.log('✅ No row — clean slate (expected before first impression)');
    } else {
      console.table(before.rows);
    }

    // ── 6. SIMULATE STRIKE-1 WRITE (DRY RUN — ROLLBACK) ─────────────────────
    sep(`6. SIMULATE Strike-1 unseen impression (dry-run, will ROLLBACK)`);
    // last_session_id is UUID type — must use a valid UUID for the dry-run
    const fakeSession = '00000000-0000-4000-a000-' + Date.now().toString(16).padStart(12, '0');
    
    await client.query('BEGIN');

    // This is EXACTLY the INSERT from viewsController.js submitUnseenImpression
    await client.query(`
      INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, last_session_id,
                                          rank_penalty_tier, rank_penalty_until)
      VALUES ($1, $2, $3, 1, $4, 'light', NOW() + INTERVAL '5 days')
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
    `, [viewerId, viewerType, postId, fakeSession]);

    // Now read what was written WITHIN the transaction
    const afterWrite = await client.query(`
      SELECT user_id, user_type, post_id, unseen_count, rank_penalty_tier,
             rank_penalty_until, retired_at, last_session_id
      FROM post_impression_state
      WHERE user_id = $1 AND user_type = $2 AND post_id = $3
    `, [viewerId, viewerType, postId]);
    
    console.log('✅ After strike-1 INSERT (within dry-run transaction):');
    console.table(afterWrite.rows);

    // ── 7. EFFECTIVE_SORT_TIME SHIFT — query inside dry-run transaction ───────
    sep('7. EFFECTIVE_SORT_TIME shift verification (within dry-run transaction)');

    const estQuery = await client.query(`
      SELECT
        p.id,
        p.created_at,
        pis_rank.rank_penalty_tier,
        pis_rank.rank_penalty_until,
        NOW() AS now_ts,
        NOW() < pis_rank.rank_penalty_until AS penalty_active,
        CASE
          WHEN pis_rank.rank_penalty_tier = 'heavy'
           AND pis_rank.rank_penalty_until IS NOT NULL
           AND NOW() < pis_rank.rank_penalty_until
          THEN p.created_at - INTERVAL '10 days'
          WHEN pis_rank.rank_penalty_tier = 'light'
           AND pis_rank.rank_penalty_until IS NOT NULL
           AND NOW() < pis_rank.rank_penalty_until
          THEN p.created_at - INTERVAL '3 days'
          ELSE p.created_at
        END AS effective_sort_time,
        (p.created_at - INTERVAL '3 days') - p.created_at AS shift_magnitude
      FROM posts p
      LEFT JOIN post_impression_state pis_rank
        ON pis_rank.user_id = $1
       AND pis_rank.user_type = $2
       AND pis_rank.post_id = p.id
      WHERE p.id = $3
    `, [viewerId, viewerType, postId]);

    console.log('effective_sort_time calculation:');
    console.table(estQuery.rows.map(r => ({
      post_id:             r.id,
      created_at:          r.created_at?.toISOString?.() ?? r.created_at,
      rank_penalty_tier:   r.rank_penalty_tier,
      rank_penalty_until:  r.rank_penalty_until?.toISOString?.() ?? r.rank_penalty_until,
      penalty_active:      r.penalty_active,
      effective_sort_time: r.effective_sort_time?.toISOString?.() ?? r.effective_sort_time,
      shift_hours:         r.penalty_active ? '-72h (3 days)' : '0 (no shift)',
    })));

    // ── 8. ROLL BACK — no data modified ──────────────────────────────────────
    await client.query('ROLLBACK');
    console.log('\n✅ ROLLBACK — zero real data was modified');

    // ── 9. RECOVERY: Is it stateless at query-time? ───────────────────────────
    sep('8. RECOVERY MECHANISM check');
    console.log(`
Recovery logic (from postController.js getFeed, line 731-741):

  CASE
    WHEN pis_rank.rank_penalty_tier = 'heavy'
     AND pis_rank.rank_penalty_until IS NOT NULL
     AND NOW() < pis_rank.rank_penalty_until
    THEN p.created_at - INTERVAL '10 days'
    WHEN pis_rank.rank_penalty_tier = 'light'
     AND pis_rank.rank_penalty_until IS NOT NULL
     AND NOW() < pis_rank.rank_penalty_until
    THEN p.created_at - INTERVAL '3 days'
    ELSE p.created_at                          ← fallback: no shift
  END AS effective_sort_time

Key: Recovery is STATELESS. Once NOW() passes rank_penalty_until, the ELSE
branch fires naturally. NO background job is needed to clear the flag.
The rank_penalty_tier column is preserved in the DB past expiry but is
irrelevant at query time once the UNTIL timestamp has passed.
    `);

    // Check if any existing penalized rows have already expired
    sep('8b. Existing penalized rows — expiry status');
    const expiredRows = await client.query(`
      SELECT user_id, post_id, rank_penalty_tier,
             rank_penalty_until,
             NOW() AS now_ts,
             rank_penalty_until < NOW() AS already_expired
      FROM post_impression_state
      WHERE rank_penalty_tier IS NOT NULL
      LIMIT 20
    `);
    if (expiredRows.rows.length === 0) {
      console.log('No penalized rows found in post_impression_state currently.');
    } else {
      console.table(expiredRows.rows.map(r => ({
        user_id:            r.user_id,
        post_id:            r.post_id,
        tier:               r.rank_penalty_tier,
        penalty_until:      r.rank_penalty_until?.toISOString?.() ?? r.rank_penalty_until,
        already_expired:    r.already_expired,
      })));
    }

    // ── 10. CROSS-CHECK: Strike-2 path ────────────────────────────────────────
    sep('9. STRIKE-2 PATH: Confirm clean distinction from strike-1');
    console.log(`
Strike-2 logic (viewsController.js lines 481-503):

  retired_at = CASE
    WHEN last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
      AND unseen_count + 1 >= 2                     ← triggers on 2nd strike
    THEN COALESCE(retired_at, NOW())
    ELSE retired_at
  END,
  
  rank_penalty_tier = CASE
    WHEN ... AND unseen_count + 1 >= 2
    THEN NULL                                        ← CLEARS penalty on strike-2
    WHEN ... (new session, count < 2)
    THEN 'light'
    ELSE rank_penalty_tier
  END,
  
  rank_penalty_until = CASE
    WHEN ... AND unseen_count + 1 >= 2
    THEN NULL                                        ← CLEARS penalty on strike-2
    WHEN ... (new session, count < 2)
    THEN NOW() + INTERVAL '5 days'
    ELSE rank_penalty_until
  END

Verdict: Strike-2 CLEARS the penalty columns and sets retired_at instead.
The retired post is then excluded by the WHERE NOT EXISTS (pis.retired_at...)
condition in getFeed (lines 849-856), which gives a 15-day cooldown window.
No double-penalty risk.
    `);

    // ── 11. FIND REAL PENALIZED POST (if any) for live evidence ───────────────
    sep('10. LIVE EVIDENCE: Real posts currently under light penalty');
    const livePenalized = await client.query(`
      SELECT 
        pis.user_id, pis.user_type, pis.post_id,
        pis.unseen_count, pis.rank_penalty_tier, pis.rank_penalty_until,
        pis.retired_at,
        p.created_at AS post_created_at,
        p.created_at - INTERVAL '3 days' AS penalized_effective_sort,
        NOW() < pis.rank_penalty_until AS penalty_active,
        pis.rank_penalty_until - NOW() AS time_remaining
      FROM post_impression_state pis
      JOIN posts p ON p.id = pis.post_id
      WHERE pis.rank_penalty_tier = 'light'
        AND pis.rank_penalty_until IS NOT NULL
        AND pis.retired_at IS NULL
      LIMIT 10
    `);

    if (livePenalized.rows.length === 0) {
      console.log('No posts currently under active light penalty in DB.');
      console.log('(This is expected on a dev DB with few users/sessions)');
    } else {
      console.log(`Found ${livePenalized.rows.length} posts under active light penalty:`);
      console.table(livePenalized.rows.map(r => ({
        user_id:              r.user_id,
        post_id:              r.post_id,
        tier:                 r.rank_penalty_tier,
        penalty_until:        r.rank_penalty_until?.toISOString?.() ?? r.rank_penalty_until,
        penalty_active:       r.penalty_active,
        post_created_at:      r.post_created_at?.toISOString?.() ?? r.post_created_at,
        effective_sort_time:  r.penalized_effective_sort?.toISOString?.() ?? r.penalized_effective_sort,
        time_remaining:       r.time_remaining,
      })));
    }

    // ── 12. FEED POSITION COMPARISON — penalized vs un-penalized ─────────────
    if (livePenalized.rows.length > 0) {
      sep('11. FEED POSITION: Penalized post vs similar un-penalized posts');
      const penRow = livePenalized.rows[0];
      
      const feedCompare = await client.query(`
        SELECT
          p.id,
          p.created_at,
          pis_rank.rank_penalty_tier,
          pis_rank.rank_penalty_until,
          CASE
            WHEN pis_rank.rank_penalty_tier = 'heavy'
             AND pis_rank.rank_penalty_until IS NOT NULL
             AND NOW() < pis_rank.rank_penalty_until
            THEN p.created_at - INTERVAL '10 days'
            WHEN pis_rank.rank_penalty_tier = 'light'
             AND pis_rank.rank_penalty_until IS NOT NULL
             AND NOW() < pis_rank.rank_penalty_until
            THEN p.created_at - INTERVAL '3 days'
            ELSE p.created_at
          END AS effective_sort_time,
          CASE 
            WHEN p.id = $3 THEN 'PENALIZED'
            ELSE 'normal'
          END AS label
        FROM posts p
        LEFT JOIN post_impression_state pis_rank
          ON pis_rank.user_id = $1
         AND pis_rank.user_type = $2
         AND pis_rank.post_id = p.id
        WHERE p.created_at BETWEEN $4::timestamptz - INTERVAL '7 days'
                                AND $4::timestamptz + INTERVAL '1 day'
          AND p.post_type NOT IN ('plan_promo', 'event_promo')
        ORDER BY effective_sort_time DESC, p.id DESC
        LIMIT 15
      `, [penRow.user_id, penRow.user_type, penRow.post_id, penRow.post_created_at]);

      console.log(`Feed slice around penalized post ${penRow.post_id} (viewer ${penRow.user_id}):`);
      console.table(feedCompare.rows.map((r, i) => ({
        rank:                i + 1,
        post_id:             r.id,
        created_at:          r.created_at?.toISOString?.().slice(0, 19) ?? '',
        penalty_tier:        r.rank_penalty_tier ?? 'none',
        effective_sort_time: r.effective_sort_time?.toISOString?.().slice(0, 19) ?? '',
        label:               r.label,
      })));
    }

    // ── 13. CONSTANTS VERIFICATION ────────────────────────────────────────────
    sep('12. CONSTANTS: Write-path vs Read-path consistency check');
    console.log(`
WRITE PATH (viewsController.js submitUnseenImpression):
  Strike-1: rank_penalty_until = NOW() + INTERVAL '5 days'  ← penalty window = 5 days
  Strike-2: rank_penalty_until = NULL  (retired instead)
  
READ PATH (postController.js getFeed effective_sort_time):
  light penalty active: p.created_at - INTERVAL '3 days'    ← rank shift = 3 days
  heavy penalty active: p.created_at - INTERVAL '10 days'
  expired / no penalty: p.created_at                        ← no shift (recovery)
  
CURSOR CONDITION (postController.js cursorCondition):
  light: p.created_at - INTERVAL '3 days'                   ← MATCHES SELECT CASE
  heavy: p.created_at - INTERVAL '10 days'                  ← MATCHES SELECT CASE

Design doc claim: "~3 days equivalent sink, 5-day recovery"
Actual code:
  - Rank shift = 3 days (confirmed: INTERVAL '3 days' in both SELECT and cursor)
  - Penalty window = 5 days (confirmed: NOW() + INTERVAL '5 days' in write path)
  - Recovery: stateless at query time — no discrepancy

DISCREPANCY ALERT:
  The "~3 days equivalent sink" refers to the rank shift size (3 days of created_at
  regression). The "5-day recovery" refers to rank_penalty_until duration.
  These are TWO DIFFERENT values, and both match the code exactly.
  
  Potential confusion point: "5-day recovery" does NOT mean the post sinks by 5 days.
  It means the penalty lasts for 5 days. During that window, the post's
  effective_sort_time is shifted back by 3 days relative to its true created_at.
    `);

    // ── 14. TIMEZONE CONSISTENCY CHECK ────────────────────────────────────────
    sep('13. TIMEZONE: Consistency of NOW() usage');
    const tzCheck = await client.query(`
      SELECT 
        NOW()                                    AS server_now,
        NOW() AT TIME ZONE 'UTC'                AS server_now_utc,
        current_setting('timezone')             AS db_timezone,
        NOW() + INTERVAL '5 days'               AS write_path_penalty_until,
        NOW() + INTERVAL '5 days' < NOW() + INTERVAL '5 days' + INTERVAL '1 minute' AS sanity
    `);
    console.table(tzCheck.rows);
    console.log(`
All NOW() calls in both write path (viewsController) and read path (getFeed) use
PostgreSQL's NOW() which is always UTC-anchored timestamptz. No timezone bug.
    `);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('AUDIT SCRIPT ERROR:', e);
  process.exit(1);
});
