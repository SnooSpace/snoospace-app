'use strict';
/**
 * Phase 2d — Backend Verification Script
 *
 * Validates Phase 2d logic directly against the database:
 * 1. First-time follow: no-op on post_impression_state, follow succeeds cleanly.
 * 2. Refollow reset: retired post (two unseen strikes) gets retired_at cleared to NULL
 *    and unseen_count reset to 0 upon refollow, causing it to reappear in getFeed.
 * 3. Scoping sanity: non-target authors' impression states are unaffected.
 *
 * Usage: node tests/verify_phase2d.js
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

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  const mark = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${mark}  ${label}`);
  if (detail) console.log(`         ${detail}`);
  if (condition) passed++; else failed++;
}

const cleanup = {
  memberIds: [],
  postIds:   [],
  followIds: [],
  impressionIds: [],
};

const MEMBER_DEFAULTS = {
  gender:    'Male',
  interests: JSON.stringify(['sports', 'music', 'tech']),
  phone:     '1234567890',
  dob:       '2000-01-01',
};

async function insertMember(label) {
  const res = await pool.query(
    `INSERT INTO members (name, email, phone, dob, gender, interests)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [label, `${label.toLowerCase().replace(/\s+/g, '_')}@__verify2d__.local`,
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
  return res.rows[0].id;
}

/**
 * Replicates Phase 2d logic added to followController.js / creatorFollowController.js
 */
async function performFollowWithReset(followerId, followerType, followingId, followingType) {
  // 1. Follow insert
  const fRes = await pool.query(
    `INSERT INTO follows (follower_id, follower_type, following_id, following_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [followerId, followerType, followingId, followingType]
  );
  cleanup.followIds.push(fRes.rows[0].id);

  // 2. Phase 2d UPDATE reset query
  await pool.query(
    `UPDATE post_impression_state
     SET retired_at = NULL, unseen_count = 0
     WHERE user_id = $1 AND user_type = $2
       AND post_id IN (
         SELECT id FROM posts
         WHERE author_id = $3 AND author_type = $4
       )`,
    [followerId, followerType, followingId, followingType]
  );

  return fRes.rows[0].id;
}

async function runFeedCheck(viewerId, viewerType, postId) {
  const res = await pool.query(`
    SELECT p.id, p.caption
    FROM posts p
    WHERE p.id = $3
      AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.follower_type = $2
          AND f.following_id = p.author_id AND f.following_type = p.author_type
      )
      AND NOT (
        (p.author_id != $1 OR p.author_type != $2)
        AND EXISTS (
          SELECT 1 FROM post_impression_state pis
          WHERE pis.user_id = $1
            AND pis.user_type = $2
            AND pis.post_id = p.id
            AND pis.retired_at IS NOT NULL
            AND pis.retired_at > NOW() - INTERVAL '30 days'
        )
      )
  `, [viewerId, viewerType, postId]);
  return res.rows.length > 0;
}

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Phase 2d — Backend Verification Script');
  console.log('══════════════════════════════════════════════════════════════\n');

  try {
    console.log('▶ Creating test accounts and posts...\n');
    const viewerId        = await insertMember('2D Viewer');
    const targetAuthorId  = await insertMember('2D TargetAuthor');
    const otherAuthorId   = await insertMember('2D OtherAuthor');

    const targetPostId    = await insertPost('Target post (to be retired then reset)', targetAuthorId, 'member', new Date());
    const otherPostId     = await insertPost('Other post (should remain untouched)', otherAuthorId, 'member', new Date());

    console.log(`  viewerId:       ${viewerId}`);
    console.log(`  targetAuthorId: ${targetAuthorId}`);
    console.log(`  otherAuthorId:  ${otherAuthorId}`);
    console.log(`  targetPostId:   ${targetPostId}`);
    console.log(`  otherPostId:    ${otherPostId}`);

    // ── CHECK 1: First-time follow ──────────────────────────────────────────
    console.log('\n══ Check 1: First-time follow (0-row UPDATE no-op) ══\n');

    const follow1Id = await performFollowWithReset(viewerId, 'member', targetAuthorId, 'member');
    console.log(`  Follow created (id=${follow1Id})`);

    const inFeed1 = await runFeedCheck(viewerId, 'member', targetPostId);
    assert(
      'First-time follow succeeds and target post appears in feed',
      inFeed1,
      `targetPostId=${targetPostId} in feed: ${inFeed1}`
    );

    // ── CHECK 2: Retire target post & verify feed exclusion ──────────────────
    console.log('\n══ Check 2: Retire target post (two unseen strikes) ══\n');

    await pool.query(
      `INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, retired_at)
       VALUES ($1, 'member', $2, 2, NOW())`,
      [viewerId, targetPostId]
    );

    // Also retire otherAuthor's post to verify scoping
    await pool.query(
      `INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, retired_at)
       VALUES ($1, 'member', $2, 2, NOW())`,
      [viewerId, otherPostId]
    );

    const inFeed2 = await runFeedCheck(viewerId, 'member', targetPostId);
    assert(
      'Retired target post is excluded from getFeed',
      !inFeed2,
      `targetPostId=${targetPostId} in feed: ${inFeed2} (expected false)`
    );

    // ── CHECK 3: Unfollow & Refollow with Phase 2d Reset ─────────────────────
    console.log('\n══ Check 3: Unfollow and Refollow (Phase 2d Reset) ══\n');

    // Unfollow target author
    await pool.query(
      `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [viewerId, targetAuthorId]
    );
    console.log('  Unfollowed target author');

    // Refollow target author (runs Phase 2d UPDATE reset)
    const follow2Id = await performFollowWithReset(viewerId, 'member', targetAuthorId, 'member');
    console.log(`  Refollowed target author (follow id=${follow2Id})`);

    // Verify DB state for target post
    const dbStateRes = await pool.query(
      `SELECT unseen_count, retired_at FROM post_impression_state WHERE user_id = $1 AND post_id = $2`,
      [viewerId, targetPostId]
    );
    const targetState = dbStateRes.rows[0];

    assert(
      'targetPost impression state retired_at cleared to NULL',
      targetState && targetState.retired_at === null,
      `retired_at = ${targetState ? targetState.retired_at : 'no row'}`
    );
    assert(
      'targetPost impression state unseen_count reset to 0',
      targetState && targetState.unseen_count === 0,
      `unseen_count = ${targetState ? targetState.unseen_count : 'no row'}`
    );

    // Verify getFeed now INCLUDES the refollowed target post
    const inFeed3 = await runFeedCheck(viewerId, 'member', targetPostId);
    assert(
      'Refollowed target post REAPPEARS in getFeed',
      inFeed3,
      `targetPostId=${targetPostId} in feed: ${inFeed3}`
    );

    // ── CHECK 4: Scoping sanity — other author post remains retired ────────
    console.log('\n══ Check 4: Scoping Sanity Check ══\n');

    const otherStateRes = await pool.query(
      `SELECT unseen_count, retired_at FROM post_impression_state WHERE user_id = $1 AND post_id = $2`,
      [viewerId, otherPostId]
    );
    const otherState = otherStateRes.rows[0];

    assert(
      'otherAuthor post remains retired (retired_at IS NOT NULL)',
      otherState && otherState.retired_at !== null,
      `otherPost retired_at = ${otherState ? otherState.retired_at : 'no row'}`
    );

  } catch (err) {
    console.error('\n❌ Error running Phase 2d verification:', err.message);
    if (err.code) console.error('   PG code:', err.code, '| detail:', err.detail);
  } finally {
    console.log('\n▶ Cleaning up test fixtures...');
    try {
      if (cleanup.memberIds.length) {
        await pool.query('DELETE FROM post_impression_state WHERE user_id = ANY($1::bigint[])', [cleanup.memberIds]);
        console.log('  Deleted post_impression_state rows');
      }
      if (cleanup.followIds.length) {
        await pool.query('DELETE FROM follows WHERE id = ANY($1::bigint[])', [cleanup.followIds]);
        console.log(`  Deleted ${cleanup.followIds.length} follow row(s)`);
      }
      if (cleanup.postIds.length) {
        await pool.query('DELETE FROM posts WHERE id = ANY($1::bigint[])', [cleanup.postIds]);
        console.log(`  Deleted ${cleanup.postIds.length} post(s)`);
      }
      if (cleanup.memberIds.length) {
        await pool.query('DELETE FROM members WHERE id = ANY($1::bigint[])', [cleanup.memberIds]);
        console.log(`  Deleted ${cleanup.memberIds.length} member(s)`);
      }
    } catch (e) {
      console.error('  ⚠ Cleanup error:', e.message);
    }

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`  TOTAL: ${passed + failed} checks  |  ${passed} PASSED  |  ${failed} FAILED`);
    console.log('══════════════════════════════════════════════════════════════\n');

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
