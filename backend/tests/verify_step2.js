'use strict';
/**
 * verify_step2.js — Task 4b: Skip/Duplicate check for Re-ranking Step 2
 *
 * Tests:
 *   4a. No-penalty baseline: feed order matches pure p.created_at DESC, p.id DESC
 *   4b. Skip/duplicate: paginate full feed with multiple small page sizes (e.g., pageSize=2 and pageSize=3),
 *       calling the ACTUAL postController.getFeed() implementation across all pages,
 *       and comparing against direct DB query.
 *   4c. Penalty position: light penalty moves post lower in effective order
 *   4d. Penalty expiry: expired penalty → post returns to natural position
 *
 * Usage:
 *   node tests/verify_step2.js [userId] [userType] [pageSize]
 *   e.g.: node tests/verify_step2.js 51 member 2
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getFeed } = require('../controllers/postController');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// CLI parameters
let TARGET_USER_ID   = process.argv[2] ? parseInt(process.argv[2]) : null;
let TARGET_USER_TYPE = process.argv[3] || 'member';
let TEST_PAGE_SIZE   = process.argv[4] ? parseInt(process.argv[4]) : 2; // Default to 2 to force multi-page traversal

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ  ${msg}`); }
function head(msg) { console.log(`\n━━━ ${msg} ━━━`); }

// Build the same WHERE clause that getFeed uses (without cursor condition)
function buildFeedWhere(userId, userType) {
  return `
      (p.author_id = $1 AND p.author_type = $2)
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = $1 AND f.follower_type = $2
          AND f.following_id = p.author_id AND f.following_type = p.author_type
          AND f.is_superseded_by_circle = false
          AND p.created_at >= f.created_at - INTERVAL '7 days'
      )
      OR (p.author_type = 'member' AND EXISTS (
        SELECT 1 FROM creator_follows cf
        WHERE cf.follower_id = $1 AND cf.follower_type = $2
          AND cf.creator_id = p.author_id
          AND cf.is_dormant = false
          AND cf.is_superseded_by_circle = false
          AND p.created_at >= cf.created_at - INTERVAL '7 days'
      ))
      OR ($2 = 'member' AND p.author_type = 'member' AND EXISTS (
        SELECT 1 FROM circles ci
        WHERE ((ci.user_a_id = $1 AND ci.user_b_id = p.author_id)
           OR  (ci.user_b_id = $1 AND ci.user_a_id = p.author_id))
          AND p.created_at >= ci.created_at - INTERVAL '7 days'
      ))
      OR ($2 = 'community' AND p.author_type = 'member' AND EXISTS (
        SELECT 1 FROM community_member_circles cc
        WHERE cc.community_id = $1 AND cc.member_id = p.author_id
          AND p.created_at >= cc.created_at - INTERVAL '7 days'
      ))
      OR ($2 = 'member' AND p.author_type = 'community' AND EXISTS (
        SELECT 1 FROM community_member_circles cc
        WHERE cc.community_id = p.author_id AND cc.member_id = $1
          AND p.created_at >= cc.created_at - INTERVAL '7 days'
      ))
  `;
}

// The effective_sort_time expression — must match getFeed SELECT exactly
const EFFECTIVE_SORT_TIME_EXPR = `
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
  END
`;

// Ground truth direct DB query
async function getExpectedIds(userId, userType) {
  const feedWhere = buildFeedWhere(userId, userType);
  const q = `
    SELECT
      p.id,
      p.created_at,
      ${EFFECTIVE_SORT_TIME_EXPR} AS effective_sort_time,
      pis_rank.rank_penalty_tier
    FROM posts p
    LEFT JOIN members m    ON p.author_type = 'member'    AND p.author_id = m.id
    LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
    LEFT JOIN sponsors s   ON p.author_type = 'sponsor'   AND p.author_id = s.id
    LEFT JOIN venues v     ON p.author_type = 'venue'     AND p.author_id = v.id
    LEFT JOIN post_impression_state pis_rank
      ON pis_rank.user_id   = $1
     AND pis_rank.user_type = $2
     AND pis_rank.post_id   = p.id
    WHERE (${feedWhere})
      AND p.post_type NOT IN ('plan_promo', 'event_promo')
      AND NOT (
        p.post_type IN ('poll', 'qna', 'prompt')
        AND (p.type_data->>'promo_source_type') = 'plan'
        AND (p.type_data->>'promo_source_id') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM open_plans op
          WHERE op.id = (p.type_data->>'promo_source_id')::int
            AND op.scheduled_at < NOW() - INTERVAL '3 hours'
        )
      )
      AND NOT (
        (p.author_id != $1 OR p.author_type != $2)
        AND EXISTS (
          SELECT 1 FROM post_impression_state pis
          WHERE pis.user_id   = $1
            AND pis.user_type = $2
            AND pis.post_id   = p.id
            AND pis.retired_at IS NOT NULL
            AND pis.retired_at > NOW() - INTERVAL '15 days'
        )
      )
      AND NOT (
        (p.author_id != $1 OR p.author_type != $2)
        AND (
          EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.liker_id = $1 AND pl.liker_type = $2)
          OR EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = $1 AND pc.commenter_type = $2)
        )
        AND NOT EXISTS (
          SELECT 1 FROM follows f_e
          WHERE f_e.follower_id = $1 AND f_e.follower_type = $2
            AND f_e.following_id = p.author_id AND f_e.following_type = p.author_type
            AND f_e.created_at <= p.created_at
          UNION ALL
          SELECT 1 FROM creator_follows cf_e
          WHERE cf_e.follower_id = $1 AND cf_e.follower_type = $2
            AND cf_e.creator_id = p.author_id
            AND cf_e.created_at <= p.created_at
          UNION ALL
          SELECT 1 FROM circles ci_e
          WHERE ((ci_e.user_a_id = $1 AND ci_e.user_b_id = p.author_id)
              OR (ci_e.user_b_id = $1 AND ci_e.user_a_id = p.author_id))
            AND ci_e.created_at <= p.created_at
          UNION ALL
          SELECT 1 FROM community_member_circles cc_e
          WHERE ((cc_e.community_id = $1 AND cc_e.member_id = p.author_id)
              OR (cc_e.community_id = p.author_id AND cc_e.member_id = $1))
            AND cc_e.created_at <= p.created_at
        )
      )
    ORDER BY effective_sort_time DESC, p.id DESC
  `;
  const r = await pool.query(q, [userId, userType]);
  return r.rows;
}

// Call the actual getFeed controller method via mock req/res
async function callGetFeedController(userId, userType, { limit, cursor_time, cursor_id }) {
  return new Promise((resolve, reject) => {
    const req = {
      user: { id: userId, type: userType },
      query: {
        limit: limit ? String(limit) : undefined,
        cursor_time: cursor_time || undefined,
        cursor_id: cursor_id != null ? String(cursor_id) : undefined,
      },
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode >= 400) {
          reject(new Error(`getFeed failed with status ${this.statusCode}: ${JSON.stringify(data)}`));
        } else {
          resolve(data);
        }
      },
    };

    getFeed(req, res).catch(reject);
  });
}

// Paginate using the actual postController.getFeed()
async function paginateViaController(userId, userType, pageSize, maxPages = 20) {
  const allPosts = [];
  let cursorTime = null;
  let cursorId   = null;
  let page = 0;

  while (page < maxPages) {
    page++;
    const response = await callGetFeedController(userId, userType, {
      limit: pageSize,
      cursor_time: cursorTime,
      cursor_id: cursorId,
    });

    const pagePosts = response.posts || [];
    const hasMore   = response.has_more === true;
    const postIds   = pagePosts.map(p => p.id);

    console.log(`    Page ${page}: ${pagePosts.length} posts (hasMore=${hasMore}) IDs: [${postIds.join(', ')}]`);
    console.log(`            next_cursor_time=${response.next_cursor_time || 'null'}, next_cursor_id=${response.next_cursor_id != null ? response.next_cursor_id : 'null'}`);

    allPosts.push(...pagePosts);

    if (!hasMore || pagePosts.length === 0) {
      break;
    }

    cursorTime = response.next_cursor_time;
    cursorId   = response.next_cursor_id;
  }

  return allPosts;
}

async function runSkipDuplicateTest(userId, userType, pageSize, expectedRows) {
  info(`Testing pagination with PAGE_SIZE = ${pageSize} (Controller execution)`);
  const paginatedPosts = await paginateViaController(userId, userType, pageSize);

  const dbIds        = expectedRows.map(r => r.id);
  const controllerIds = paginatedPosts.map(p => p.id);

  console.log(`\n  DB Ground Truth Order : [${dbIds.join(', ')}] (${dbIds.length} posts)`);
  console.log(`  Controller Paged Order: [${controllerIds.join(', ')}] (${controllerIds.length} posts)`);

  // Check duplicates
  const seenIds = new Set();
  const dupes = [];
  for (const id of controllerIds) {
    if (seenIds.has(id)) dupes.push(id);
    seenIds.add(id);
  }
  if (dupes.length > 0) {
    fail(`DUPLICATES FOUND: [${dupes.join(', ')}]`);
  } else {
    pass(`No duplicates across all pages (total ${controllerIds.length} posts).`);
  }

  // Check order match
  const matches = JSON.stringify(controllerIds) === JSON.stringify(dbIds);
  if (matches) {
    pass(`Order matches ground truth DB exactly across all page boundaries!`);
  } else {
    fail(`ORDER MISMATCH between controller pagination and DB ground truth.`);
    for (let i = 0; i < Math.max(controllerIds.length, dbIds.length); i++) {
      if (controllerIds[i] !== dbIds[i]) {
        console.error(`    Mismatch at index ${i}: controller=${controllerIds[i]} vs db=${dbIds[i]}`);
        break;
      }
    }
  }

  // Check skipped
  const skipped = dbIds.filter(id => !seenIds.has(id));
  if (skipped.length > 0) {
    fail(`SKIPPED POSTS (in DB but missing from feed): [${skipped.join(', ')}]`);
  } else {
    pass(`No skipped posts — 100% of eligible posts retrieved.`);
  }
}

async function main() {
  try {
    if (!TARGET_USER_ID) {
      const r = await pool.query(`SELECT id FROM members ORDER BY id LIMIT 1`);
      if (r.rows.length === 0) { console.error('No members in DB'); process.exit(1); }
      TARGET_USER_ID = r.rows[0].id;
      info(`No userId provided — using first member: id=${TARGET_USER_ID}`);
    }

    const userId   = TARGET_USER_ID;
    const userType = TARGET_USER_TYPE;
    console.log(`\nTest viewer: id=${userId} type=${userType}`);

    // ── 4a: DB query sanity ──────────────────────────────────────────────────
    head('4a — Basic query sanity & Ground Truth fetch');
    const expectedRows = await getExpectedIds(userId, userType);
    const totalEligible = expectedRows.length;
    info(`Total eligible posts for viewer ${userId} (${userType}): ${totalEligible}`);
    if (totalEligible === 0) {
      fail('No eligible posts found for this viewer.');
      return;
    }
    pass(`Query executed cleanly. ${totalEligible} posts found.`);

    // ── 4b: Multi-page pagination tests with different page sizes ────────────
    head(`4b — Skip / Duplicate check with PAGE_SIZE = ${TEST_PAGE_SIZE} (forcing ${Math.ceil(totalEligible / TEST_PAGE_SIZE)} pages)`);
    await runSkipDuplicateTest(userId, userType, TEST_PAGE_SIZE, expectedRows);

    // Also run with PAGE_SIZE = 3 if TEST_PAGE_SIZE was 2
    if (TEST_PAGE_SIZE === 2 && totalEligible >= 3) {
      head(`4b — Supplementary check with PAGE_SIZE = 3 (forcing ${Math.ceil(totalEligible / 3)} pages)`);
      await runSkipDuplicateTest(userId, userType, 3, expectedRows);
    }

    // ── 4c: Penalty position check ───────────────────────────────────────────
    head('4c — Penalty position (light penalty moves post lower)');
    if (expectedRows.length >= 3) {
      const targetPostId = expectedRows[2].id; // post near the top (index 2)
      info(`Injecting light penalty on post id=${targetPostId} (currently at position index 2)`);

      await pool.query(`
        INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, rank_penalty_tier, rank_penalty_until)
        VALUES ($1, $2, $3, 0, 'light', NOW() + INTERVAL '5 days')
        ON CONFLICT (user_id, user_type, post_id)
        DO UPDATE SET
          rank_penalty_tier  = 'light',
          rank_penalty_until = NOW() + INTERVAL '5 days'
      `, [userId, userType, targetPostId]);

      const penalizedRows = await getExpectedIds(userId, userType);
      const newPos = penalizedRows.findIndex(r => r.id === targetPostId);
      info(`Post ${targetPostId}: was at index 2, now at index ${newPos}`);

      if (newPos > 2) {
        pass(`Post moved DOWN from index 2 → index ${newPos} (penalty applied correctly).`);
      } else {
        fail(`Post did not move down as expected.`);
      }

      // Also verify pagination with penalty active
      info(`Verifying pagination with active penalty using PAGE_SIZE = ${TEST_PAGE_SIZE}...`);
      await runSkipDuplicateTest(userId, userType, TEST_PAGE_SIZE, penalizedRows);

      // ── 4d: Penalty expiry check ───────────────────────────────────────────
      head('4d — Penalty expiry (expired penalty → natural position restored)');
      await pool.query(`
        UPDATE post_impression_state
        SET rank_penalty_until = NOW() - INTERVAL '1 minute'
        WHERE user_id = $1 AND user_type = $2 AND post_id = $3
      `, [userId, userType, targetPostId]);

      const expiredRows = await getExpectedIds(userId, userType);
      const expiredPos = expiredRows.findIndex(r => r.id === targetPostId);
      info(`Post ${targetPostId} after expiry: index ${expiredPos}`);

      if (expiredPos <= 2) {
        pass(`Post returned to original index ${expiredPos} after penalty expiry.`);
      } else {
        fail(`Post did not return to original position after expiry.`);
      }

      // Cleanup
      await pool.query(`
        UPDATE post_impression_state
        SET rank_penalty_tier = NULL, rank_penalty_until = NULL
        WHERE user_id = $1 AND user_type = $2 AND post_id = $3
      `, [userId, userType, targetPostId]);
      info('Test penalty row cleaned up.');
    }

    // ── 4a Baseline check ────────────────────────────────────────────────────
    head('4a — Baseline check: effective_sort_time order matches pure created_at DESC');
    const cleanRows = await getExpectedIds(userId, userType);
    const cleanIds  = cleanRows.map(r => r.id);

    const pureQ = `
      SELECT p.id FROM posts p
      LEFT JOIN members m    ON p.author_type = 'member'    AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s   ON p.author_type = 'sponsor'   AND p.author_id = s.id
      LEFT JOIN venues v     ON p.author_type = 'venue'     AND p.author_id = v.id
      WHERE (${buildFeedWhere(userId, userType)})
        AND p.post_type NOT IN ('plan_promo', 'event_promo')
        AND NOT (
          p.post_type IN ('poll', 'qna', 'prompt')
          AND (p.type_data->>'promo_source_type') = 'plan'
          AND (p.type_data->>'promo_source_id') IS NOT NULL
          AND EXISTS (SELECT 1 FROM open_plans op WHERE op.id = (p.type_data->>'promo_source_id')::int AND op.scheduled_at < NOW() - INTERVAL '3 hours')
        )
        AND NOT (
          (p.author_id != $1 OR p.author_type != $2)
          AND EXISTS (
            SELECT 1 FROM post_impression_state pis
            WHERE pis.user_id = $1 AND pis.user_type = $2 AND pis.post_id = p.id
              AND pis.retired_at IS NOT NULL AND pis.retired_at > NOW() - INTERVAL '15 days'
          )
        )
        AND NOT (
          (p.author_id != $1 OR p.author_type != $2)
          AND (
            EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.liker_id = $1 AND pl.liker_type = $2)
            OR EXISTS (SELECT 1 FROM post_comments pc WHERE pc.post_id = p.id AND pc.commenter_id = $1 AND pc.commenter_type = $2)
          )
          AND NOT EXISTS (
            SELECT 1 FROM follows f_e WHERE f_e.follower_id = $1 AND f_e.follower_type = $2 AND f_e.following_id = p.author_id AND f_e.following_type = p.author_type AND f_e.created_at <= p.created_at
            UNION ALL SELECT 1 FROM creator_follows cf_e WHERE cf_e.follower_id = $1 AND cf_e.follower_type = $2 AND cf_e.creator_id = p.author_id AND cf_e.created_at <= p.created_at
            UNION ALL SELECT 1 FROM circles ci_e WHERE ((ci_e.user_a_id = $1 AND ci_e.user_b_id = p.author_id) OR (ci_e.user_b_id = $1 AND ci_e.user_a_id = p.author_id)) AND ci_e.created_at <= p.created_at
            UNION ALL SELECT 1 FROM community_member_circles cc_e WHERE ((cc_e.community_id = $1 AND cc_e.member_id = p.author_id) OR (cc_e.community_id = p.author_id AND cc_e.member_id = $1)) AND cc_e.created_at <= p.created_at
          )
        )
      ORDER BY p.created_at DESC, p.id DESC
    `;
    const pureRows = (await pool.query(pureQ, [userId, userType])).rows;
    const pureIds  = pureRows.map(r => r.id);

    if (JSON.stringify(cleanIds) === JSON.stringify(pureIds)) {
      pass('No-penalty baseline: effective_sort_time order is 100% IDENTICAL to pure created_at DESC, p.id DESC.');
    } else {
      fail('Baseline order mismatch.');
    }

  } catch (e) {
    console.error('\nFATAL:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
    const res = process.exitCode === 1 ? '❌ SOME TESTS FAILED' : '✅ ALL TESTS PASSED';
    console.log(`\n${res}\n`);
  }
}

main();
