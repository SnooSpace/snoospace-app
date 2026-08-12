'use strict';
/**
 * Phase 2e — Backend Verification Script
 *
 * Runs directly against the database (no app server needed).
 * Creates isolated test fixtures, asserts Phase 2e SQL behaviour,
 * then deletes all test rows regardless of outcome.
 *
 * Usage:  node tests/verify_phase2e.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     parseInt(process.env.DB_PORT, 10),
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const days = (n) => n * 24 * 60 * 60 * 1000;
const mins = (n) => n * 60 * 1000;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  const mark = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${mark}  ${label}`);
  if (detail) console.log(`         ${detail}`);
  if (condition) passed++; else failed++;
}

// Fixture IDs — deleted in finally regardless of how the script exits
const cleanup = {
  memberIds: [],
  postIds:   [],
  likeIds:   [],
  followIds: [],
  circleIds: [],
};

/**
 * Members table constraints (verified against live schema):
 *   gender_allowed : ('Male','Female','Non-binary')
 *   interests_len  : jsonb array, 3–7 elements
 *   phone_10_digits: exactly 10 digits
 */
const MEMBER_DEFAULTS = {
  gender:    'Male',
  interests: JSON.stringify(['sports', 'music', 'tech']),  // 3 elements ✓
  phone:     '1234567890',                                  // 10 digits ✓
  dob:       '2000-01-01',
};

async function insertMember(label) {
  const res = await pool.query(
    `INSERT INTO members (name, email, phone, dob, gender, interests)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [label, `${label.toLowerCase().replace(/\s+/g, '_')}@__verify2e__.local`,
     MEMBER_DEFAULTS.phone, MEMBER_DEFAULTS.dob,
     MEMBER_DEFAULTS.gender, MEMBER_DEFAULTS.interests]
  );
  cleanup.memberIds.push(res.rows[0].id);
  return res.rows[0].id;
}

async function insertPost(caption, authorId, authorType, timestamp) {
  const res = await pool.query(
    `INSERT INTO posts (author_id, author_type, caption, image_urls, created_at)
     VALUES ($1, $2, $3, '[]'::jsonb, $4)
     RETURNING id, created_at`,
    [authorId, authorType, caption, timestamp]
  );
  cleanup.postIds.push(res.rows[0].id);
  return res.rows[0];
}

/**
 * Runs the Phase-2e-relevant portion of getFeed for the given viewer,
 * scoped to a specific set of post IDs so production data is invisible.
 *
 * WHERE clause and is_backlog_post CASE are copied verbatim from
 * postController.js getFeed (follows + circles branches; creator_follows
 * and community_member_circles omitted — no such relationships between
 * test accounts).
 */
async function runFeedQuery(viewerId, viewerType, postIds) {
  const res = await pool.query(`
    SELECT
      p.id,
      p.caption,
      p.created_at,
      p.author_id,
      p.author_type,
      CASE
        WHEN p.author_id = $1 AND p.author_type = $2 THEN false
        ELSE NOT EXISTS (
          SELECT 1 FROM follows f_bp
          WHERE f_bp.follower_id = $1 AND f_bp.follower_type = $2
            AND f_bp.following_id = p.author_id AND f_bp.following_type = p.author_type
            AND f_bp.created_at <= p.created_at
          UNION ALL
          SELECT 1 FROM circles ci_bp
          WHERE ((ci_bp.user_a_id = $1 AND ci_bp.user_b_id = p.author_id)
              OR (ci_bp.user_b_id = $1 AND ci_bp.user_a_id = p.author_id))
            AND ci_bp.created_at <= p.created_at
        )
      END AS is_backlog_post
    FROM posts p
    WHERE (
      -- Own posts: always eligible, no date constraint
      (p.author_id = $1 AND p.author_type = $2)

      -- Standard follows: 7-day retroactive window (Phase 2e)
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.follower_type = $2
          AND f.following_id = p.author_id AND f.following_type = p.author_type
          AND f.is_superseded_by_circle = false
          AND p.created_at >= f.created_at - INTERVAL '7 days'
      )

      -- Mutual circles: 7-day retroactive window, parenthesization fix (Phase 2e)
      OR ($2 = 'member' AND p.author_type = 'member' AND EXISTS (
        SELECT 1 FROM circles ci
        WHERE ((ci.user_a_id = $1 AND ci.user_b_id = p.author_id)
           OR (ci.user_b_id = $1 AND ci.user_a_id = p.author_id))
          AND p.created_at >= ci.created_at - INTERVAL '7 days'
      ))
    )
    -- Engagement exclusion: backlog posts the viewer already liked or commented on
    AND NOT (
      (p.author_id != $1 OR p.author_type != $2)
      AND (
        EXISTS (SELECT 1 FROM post_likes   pl WHERE pl.post_id = p.id AND pl.liker_id     = $1 AND pl.liker_type     = $2)
        OR
        EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = $1 AND pc.commenter_type = $2)
      )
      AND NOT EXISTS (
        SELECT 1 FROM follows f_e
        WHERE f_e.follower_id = $1 AND f_e.follower_type = $2
          AND f_e.following_id = p.author_id AND f_e.following_type = p.author_type
          AND f_e.created_at <= p.created_at
        UNION ALL
        SELECT 1 FROM circles ci_e
        WHERE ((ci_e.user_a_id = $1 AND ci_e.user_b_id = p.author_id)
            OR (ci_e.user_b_id = $1 AND ci_e.user_a_id = p.author_id))
          AND ci_e.created_at <= p.created_at
      )
    )
    -- Scope strictly to test post IDs — production rows are invisible
    AND p.id = ANY($3::bigint[])
    ORDER BY p.created_at DESC
  `, [viewerId, viewerType, postIds]);
  return res.rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Phase 2e — Backend Verification Script');
  console.log('══════════════════════════════════════════════════════════════\n');

  let scriptError = null;

  try {

    // ── 0. Create test members ────────────────────────────────────────────────
    console.log('▶ Creating test members...\n');
    const viewerId       = await insertMember('2E Viewer');
    const authorId       = await insertMember('2E Author');
    const circleAuthorId = await insertMember('2E CircleAuthor');
    console.log(`  viewerId:       ${viewerId}`);
    console.log(`  authorId:       ${authorId}`);
    console.log(`  circleAuthorId: ${circleAuthorId}`);

    // ── 1. Create follows row ─────────────────────────────────────────────────
    // Follow was created 2 days ago.
    // 7-day eligibility window: posts ≤ 9 days ago are eligible.
    console.log('\n▶ Creating follows row (created_at = NOW() − 2 days)...\n');
    const fRes = await pool.query(
      `INSERT INTO follows (follower_id, follower_type, following_id, following_type, created_at)
       VALUES ($1, 'member', $2, 'member', NOW() - INTERVAL '2 days')
       RETURNING id, created_at`,
      [viewerId, authorId]
    );
    const followId        = fRes.rows[0].id;
    const followCreatedAt = fRes.rows[0].created_at;
    cleanup.followIds.push(followId);
    console.log(`  followId:       ${followId}`);
    console.log(`  followCreatedAt: ${followCreatedAt.toISOString()}`);

    // ── 2. Create test posts ──────────────────────────────────────────────────
    console.log('\n▶ Creating test posts...\n');
    const f = followCreatedAt.getTime();

    const label = (s) => s.padEnd(52);

    const { id: p_old }        = await insertPost(label('p_old         −10d before follow → EXCLUDE'), authorId, 'member', new Date(f - days(10)));
    const { id: p_backlog }    = await insertPost(label('p_backlog      −5d before follow → INCLUDE (backlog)'), authorId, 'member', new Date(f - days(5)));
    const { id: p_postfollow } = await insertPost(label('p_postfollow   +1d after  follow → INCLUDE (normal)'), authorId, 'member', new Date(f + days(1)));
    const { id: p_liked }      = await insertPost(label('p_liked        −5d before follow + liked → EXCLUDE'), authorId, 'member', new Date(f - days(5)));
    // p_bound_in: timestamp computed IN SQL to use the exact stored follow created_at with full
    // microsecond precision, avoiding JS Date millisecond-truncation shifting it fractionally
    // before the cutoff. This ensures p.created_at == follow.created_at - INTERVAL '7 days'.
    const bInRes = await pool.query(
      `INSERT INTO posts (author_id, author_type, caption, image_urls, created_at)
       VALUES ($1, 'member', $2, '[]'::jsonb,
               (SELECT created_at FROM follows WHERE id = $3) - INTERVAL '7 days')
       RETURNING id, created_at`,
      [authorId, label('p_bound_in   exactly −7d → INCLUDE (boundary inclusive)'), followId]
    );
    cleanup.postIds.push(bInRes.rows[0].id);
    const p_bound_in = bInRes.rows[0].id;
    console.log(`  p_bound_in SQL-computed ts: ${bInRes.rows[0].created_at.toISOString()}`);

    const { id: p_bound_out }  = await insertPost(label('p_bound_out  −7d−1min → EXCLUDE (just outside window)'), authorId, 'member', new Date(f - days(7) - mins(1)));
    const { id: p_own }        = await insertPost(label("p_own          −30d (viewer's own) → INCLUDE (own-post exempt)"), viewerId, 'member', new Date(f - days(30)));

    [p_old, p_backlog, p_postfollow, p_liked, p_bound_in, p_bound_out, p_own].forEach(id =>
      console.log(`  id=${String(id).padStart(6)}`));

    // Add like for the engagement-exclusion test
    const lRes = await pool.query(
      `INSERT INTO post_likes (post_id, liker_id, liker_type) VALUES ($1, $2, 'member') RETURNING id`,
      [p_liked, viewerId]
    );
    cleanup.likeIds.push(lRes.rows[0].id);
    console.log(`\n  Viewer liked p_liked (post ${p_liked}) — like id=${lRes.rows[0].id}`);

    // ── Section A: Follows — 7-day window + engagement exclusion ─────────────
    console.log('\n══ Section A: Follows — 7-day window + engagement exclusion ══\n');

    const postIdsA = [p_old, p_backlog, p_postfollow, p_liked, p_bound_in, p_bound_out, p_own];
    const rowsA    = await runFeedQuery(viewerId, 'member', postIdsA);
    const setA     = new Set(rowsA.map(r => r.id));
    const mapA     = Object.fromEntries(rowsA.map(r => [r.id, r]));

    console.log('  Raw results:');
    if (!rowsA.length) {
      console.log('    (none returned)');
    } else {
      rowsA.forEach(r =>
        console.log(`    id=${String(r.id).padStart(6)}  is_backlog=${String(r.is_backlog_post).padEnd(5)}  ${r.caption.trim()}`)
      );
    }
    console.log('');

    assert(
      'p_old (−10d) NOT in feed        [7-day window excludes it]',
      !setA.has(p_old),
      `id=${p_old} → ${setA.has(p_old) ? 'WRONGLY PRESENT' : 'absent ✓'}`
    );
    assert(
      'p_backlog (−5d) IN feed         [within 7-day window]',
      setA.has(p_backlog),
      `id=${p_backlog} → ${setA.has(p_backlog) ? 'present ✓' : 'MISSING'}`
    );
    assert(
      'p_backlog is_backlog_post = true',
      mapA[p_backlog]?.is_backlog_post === true,
      `is_backlog_post = ${mapA[p_backlog]?.is_backlog_post}`
    );
    assert(
      'p_postfollow (+1d) IN feed      [post-follow post]',
      setA.has(p_postfollow),
      `id=${p_postfollow} → ${setA.has(p_postfollow) ? 'present ✓' : 'MISSING'}`
    );
    assert(
      'p_postfollow is_backlog_post = false',
      mapA[p_postfollow]?.is_backlog_post === false,
      `is_backlog_post = ${mapA[p_postfollow]?.is_backlog_post}`
    );
    assert(
      'p_liked (−5d, liked) NOT in feed [engagement exclusion]',
      !setA.has(p_liked),
      `id=${p_liked} → ${setA.has(p_liked) ? 'WRONGLY PRESENT' : 'absent ✓'}`
    );

    // Boundary: p.created_at >= f.created_at - '7 days' → inclusive
    const boundIn  = setA.has(p_bound_in);
    const boundOut = setA.has(p_bound_out);
    assert(
      'p_bound_in (exactly −7d) IN feed [boundary is inclusive >=]',
      boundIn,
      boundIn
        ? `id=${p_bound_in} → present ✓  (>= is inclusive as intended)`
        : `id=${p_bound_in} → ABSENT — boundary appears to be EXCLUSIVE, not inclusive — flag for review`
    );
    assert(
      'p_bound_out (−7d−1min) NOT in feed [just outside window]',
      !boundOut,
      !boundOut
        ? `id=${p_bound_out} → absent ✓`
        : `id=${p_bound_out} → WRONGLY PRESENT — window is wider than 7 days`
    );

    assert(
      "p_own (−30d, viewer's own) IN feed  [own-post exempt]",
      setA.has(p_own),
      `id=${p_own} → ${setA.has(p_own) ? 'present ✓' : 'MISSING — own-post exemption broken'}`
    );
    assert(
      'p_own is_backlog_post = false        [own posts never backlog]',
      mapA[p_own]?.is_backlog_post === false,
      `is_backlog_post = ${mapA[p_own]?.is_backlog_post}`
    );

    // ── Section B: Circles regression — both user_a and user_b orderings ─────
    console.log('\n══ Section B: Circles — parenthesization fix, both orderings ══\n');
    //
    // The circles table enforces CHECK(user_a_id < user_b_id), meaning the canonical
    // ordering is always smaller_id=user_a, larger_id=user_b. We cannot INSERT (larger, smaller).
    //
    // To test both branches of the OR, we create ONE row with (user_a=viewerId, user_b=circleAuthorId)
    // — which works because viewerId (218) < circleAuthorId (220) in this run — and then:
    //   Ordering A: query as viewerId   looking at circleAuthorId's posts → viewer is user_a ✓
    //   Ordering B: query as circleAuthorId looking at viewerId's posts  → viewer is user_b ✓
    // Each direction exercises a different OR branch in the EXISTS subquery.

    const circleCreatedAt = new Date(Date.now() - days(1));  // circle formed 1 day ago
    const c = circleCreatedAt.getTime();

    // Posts authored by circleAuthorId (seen from viewerId=user_a perspective)
    const { id: p_circ_a_old    } = await insertPost(label('p_circ_a_old    −10d before circle → EXCLUDE [user_a branch]'), circleAuthorId, 'member', new Date(c - days(10)));
    const { id: p_circ_a_recent } = await insertPost(label('p_circ_a_recent  −3d before circle → INCLUDE [user_a branch]'), circleAuthorId, 'member', new Date(c - days(3)));

    // Posts authored by viewerId (seen from circleAuthorId=user_b perspective)
    const { id: p_circ_b_old    } = await insertPost(label('p_circ_b_old    −10d before circle → EXCLUDE [user_b branch]'), viewerId, 'member', new Date(c - days(10)));
    const { id: p_circ_b_recent } = await insertPost(label('p_circ_b_recent  −3d before circle → INCLUDE [user_b branch]'), viewerId, 'member', new Date(c - days(3)));

    // Insert the single circles row: user_a=viewerId (smaller), user_b=circleAuthorId (larger)
    const circleRes = await pool.query(
      `INSERT INTO circles (user_a_id, user_b_id, created_at) VALUES ($1, $2, $3) RETURNING id`,
      [viewerId, circleAuthorId, circleCreatedAt]
    );
    const circleId = circleRes.rows[0].id;
    cleanup.circleIds.push(circleId);
    console.log(`  circles row id: ${circleId}  (user_a=${viewerId}, user_b=${circleAuthorId})`);

    // ── Ordering A: viewer=viewerId is user_a ──────────────────────────────────
    console.log(`\n  Ordering A: viewer(${viewerId}) = user_a, looking at posts by circleAuthor(${circleAuthorId})`);
    const rowsBA = await runFeedQuery(viewerId, 'member', [p_circ_a_old, p_circ_a_recent]);
    const setBA  = new Set(rowsBA.map(r => r.id));
    rowsBA.forEach(r => console.log(`    id=${r.id}  is_backlog=${r.is_backlog_post}  ${r.caption.trim()}`));
    if (!rowsBA.length) console.log('    (none)');
    console.log('');

    assert(
      '[user_a branch] p_circ_a_old (−10d) NOT in feed',
      !setBA.has(p_circ_a_old),
      setBA.has(p_circ_a_old)
        ? `id=${p_circ_a_old} → WRONGLY PRESENT — 7-day window NOT applying on user_a branch!`
        : `id=${p_circ_a_old} → absent ✓`
    );
    assert(
      '[user_a branch] p_circ_a_recent (−3d) IN feed',
      setBA.has(p_circ_a_recent),
      `id=${p_circ_a_recent} → ${setBA.has(p_circ_a_recent) ? 'present ✓' : 'MISSING'}`
    );

    // ── Ordering B: viewer=circleAuthorId is user_b ────────────────────────────
    console.log(`  Ordering B: viewer(${circleAuthorId}) = user_b, looking at posts by viewer(${viewerId})`);
    const rowsBB = await runFeedQuery(circleAuthorId, 'member', [p_circ_b_old, p_circ_b_recent]);
    const setBB  = new Set(rowsBB.map(r => r.id));
    rowsBB.forEach(r => console.log(`    id=${r.id}  is_backlog=${r.is_backlog_post}  ${r.caption.trim()}`));
    if (!rowsBB.length) console.log('    (none)');
    console.log('');

    assert(
      '[user_b branch] p_circ_b_old (−10d) NOT in feed',
      !setBB.has(p_circ_b_old),
      setBB.has(p_circ_b_old)
        ? `id=${p_circ_b_old} → WRONGLY PRESENT — 7-day window NOT applying on user_b branch!`
        : `id=${p_circ_b_old} → absent ✓`
    );
    assert(
      '[user_b branch] p_circ_b_recent (−3d) IN feed',
      setBB.has(p_circ_b_recent),
      `id=${p_circ_b_recent} → ${setBB.has(p_circ_b_recent) ? 'present ✓' : 'MISSING'}`
    );

  } catch (err) {
    scriptError = err;
    console.error('\n❌ Script error during test run:', err.message);
    if (err.code) console.error('   PG code:', err.code, '| detail:', err.detail);
  } finally {

    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log('\n▶ Cleaning up test fixtures...');
    const cleanupErrors = [];
    try {
      if (cleanup.likeIds.length)   { await pool.query('DELETE FROM post_likes WHERE id = ANY($1::bigint[])', [cleanup.likeIds]);   console.log(`  Deleted ${cleanup.likeIds.length} like(s)`);   }
      if (cleanup.postIds.length)   { await pool.query('DELETE FROM posts WHERE id = ANY($1::bigint[])',       [cleanup.postIds]);   console.log(`  Deleted ${cleanup.postIds.length} post(s)`);   }
      if (cleanup.followIds.length) { await pool.query('DELETE FROM follows WHERE id = ANY($1::bigint[])',     [cleanup.followIds]); console.log(`  Deleted ${cleanup.followIds.length} follow(s)`); }
      for (const cid of cleanup.circleIds) {
        await pool.query('DELETE FROM circles WHERE id = $1', [cid]);
        console.log(`  Deleted circle id=${cid}`);
      }
      if (cleanup.memberIds.length) { await pool.query('DELETE FROM members WHERE id = ANY($1::bigint[])',     [cleanup.memberIds]); console.log(`  Deleted ${cleanup.memberIds.length} member(s)`); }
    } catch (e) {
      cleanupErrors.push(e);
      console.error('  ⚠ Cleanup error:', e.message);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  TOTAL: ${passed + failed} checks  |  ${passed} PASSED  |  ${failed} FAILED`);
    if (scriptError) console.log(`  ⚠  Script aborted early due to error above.`);
    console.log('══════════════════════════════════════════════════════════════\n');

    await pool.end();
    process.exit(failed > 0 || scriptError ? 1 : 0);
  }
}

main();
