'use strict';
/**
 * patch_step2.js — Re-ranking Step 2: applies all getFeed query-side changes
 * - Adds pis_rank LEFT JOIN
 * - Adds effective_sort_time computed column
 * - Rewrites cursorCondition to compound (effective_sort_time, id) tuple
 * - Rewrites ORDER BY to use effective_sort_time DESC, p.id DESC
 * - Rewrites queryParams to bind cursor_time + cursor_id
 * - Rewrites nextCursor output to next_cursor_time + next_cursor_id
 *
 * Run: node scripts/patch_step2.js
 * Dry-run (no write): node scripts/patch_step2.js --dry
 */

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '../controllers/postController.js');
let c = fs.readFileSync(FILE, 'utf8');

const patches = [];

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1: Replace cursor query param parsing + cursorCondition
// Old: const { cursor, limit = 20 } = req.query;
//      ...
//      const cursorCondition = cursor ? `AND p.created_at < $6` : "";
// New: parse cursor_time + cursor_id, build compound condition
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'cursor param + cursorCondition',
  old:
    '    // Support cursor-based pagination (preferred) with fallback to offset\r\n' +
    '    const { cursor, limit = 20 } = req.query;\r\n' +
    '    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50); // Clamp between 1-50\r\n' +
    '\r\n' +
    '    console.log(\r\n' +
    '      "Feed request - userId:",\r\n' +
    '      userId,\r\n' +
    '      "userType:",\r\n' +
    '      userType,\r\n' +
    '      "cursor:",\r\n' +
    '      cursor,\r\n' +
    '    );\r\n' +
    '\r\n' +
    '    if (!userId || !userType) {\r\n' +
    '      console.log("Authentication failed - missing userId or userType");\r\n' +
    '      return res.status(401).json({ error: "Authentication required" });\r\n' +
    '    }\r\n' +
    '\r\n' +
    '    // Get posts from followed entities AND own posts\r\n' +
    '    const viewerId = req.user?.id || null;\r\n' +
    '    const viewerType = req.user?.type || null;\r\n' +
    '\r\n' +
    '    // Build cursor condition for stable pagination\r\n' +
    '    const cursorCondition = cursor ? `AND p.created_at < $6` : "";',

  new:
    '    // Support compound cursor pagination: cursor_time (timestamptz) + cursor_id (int)\r\n' +
    '    // Both must be present to apply the cursor; if either is missing it is treated as first page.\r\n' +
    '    const { cursor_time, cursor_id, limit = 20 } = req.query;\r\n' +
    '    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50); // Clamp between 1-50\r\n' +
    '    const hasCursor = !!(cursor_time && cursor_id);\r\n' +
    '\r\n' +
    '    console.log(\r\n' +
    '      "Feed request - userId:",\r\n' +
    '      userId,\r\n' +
    '      "userType:",\r\n' +
    '      userType,\r\n' +
    '      "cursor_time:",\r\n' +
    '      cursor_time,\r\n' +
    '      "cursor_id:",\r\n' +
    '      cursor_id,\r\n' +
    '    );\r\n' +
    '\r\n' +
    '    if (!userId || !userType) {\r\n' +
    '      console.log("Authentication failed - missing userId or userType");\r\n' +
    '      return res.status(401).json({ error: "Authentication required" });\r\n' +
    '    }\r\n' +
    '\r\n' +
    '    // Get posts from followed entities AND own posts\r\n' +
    '    const viewerId = req.user?.id || null;\r\n' +
    '    const viewerType = req.user?.type || null;\r\n' +
    '\r\n' +
    '    // Compound cursor condition — must match ORDER BY (effective_sort_time DESC, p.id DESC).\r\n' +
    '    // PostgreSQL row comparison (a, b) < (x, y) is lexicographic: first compares a vs x,\r\n' +
    '    // only falls through to b vs y when a = x. This correctly pages through the ranked sort.\r\n' +
    '    // effective_sort_time is a CASE expression in the SELECT; it must be repeated here\r\n' +
    '    // (or the query wrapped in a CTE) because WHERE can\'t reference SELECT aliases directly.\r\n' +
    '    // We repeat the CASE inline to keep the query flat and avoid an extra subquery layer.\r\n' +
    '    const cursorCondition = hasCursor ? `AND (\r\n' +
    '        CASE\r\n' +
    '          WHEN pis_rank.rank_penalty_tier = \'heavy\'\r\n' +
    '           AND pis_rank.rank_penalty_until IS NOT NULL\r\n' +
    '           AND NOW() < pis_rank.rank_penalty_until\r\n' +
    '          THEN p.created_at - INTERVAL \'10 days\'\r\n' +
    '          WHEN pis_rank.rank_penalty_tier = \'light\'\r\n' +
    '           AND pis_rank.rank_penalty_until IS NOT NULL\r\n' +
    '           AND NOW() < pis_rank.rank_penalty_until\r\n' +
    '          THEN p.created_at - INTERVAL \'3 days\'\r\n' +
    '          ELSE p.created_at\r\n' +
    '        END,\r\n' +
    '        p.id\r\n' +
    '      ) < ($6::timestamptz, $7::int)` : "";',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2: Add pis_rank LEFT JOIN after the last existing LEFT JOIN
// The last JOIN before WHERE is:
//   LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'pis_rank LEFT JOIN',
  old:
    '      LEFT JOIN venues v ON p.author_type = \'venue\' AND p.author_id = v.id\r\n' +
    '      WHERE (',
  new:
    '      LEFT JOIN venues v ON p.author_type = \'venue\' AND p.author_id = v.id\r\n' +
    '      -- Re-ranking Step 2: join impression state for penalty-weighted sort.\r\n' +
    '      -- Alias pis_rank is distinct from the pis alias used inside the Phase 2a\r\n' +
    '      -- retirement-exclusion EXISTS subquery (Condition 3). Unique PK on\r\n' +
    '      -- (user_id, user_type, post_id) guarantees at most 1 matching row — no row duplication.\r\n' +
    '      LEFT JOIN post_impression_state pis_rank\r\n' +
    '        ON pis_rank.user_id = $1\r\n' +
    '       AND pis_rank.user_type = $2\r\n' +
    '       AND pis_rank.post_id = p.id\r\n' +
    '      WHERE (',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3: Add effective_sort_time computed column to SELECT
// Insert it just before the is_backlog_post CASE (the last computed column before FROM)
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'effective_sort_time SELECT column',
  old:
    '        -- Phase 2e: is_backlog_post — true when the post was created before any',
  new:
    '        -- Re-ranking Step 2: effective_sort_time — p.created_at shifted back by\r\n' +
    '        -- penalty interval when an active penalty exists. Posts without a penalty\r\n' +
    '        -- (or with an expired penalty) fall through to ELSE p.created_at, making\r\n' +
    '        -- the sort identical to pure reverse-chronological for unpenalized posts.\r\n' +
    '        CASE\r\n' +
    '          WHEN pis_rank.rank_penalty_tier = \'heavy\'\r\n' +
    '           AND pis_rank.rank_penalty_until IS NOT NULL\r\n' +
    '           AND NOW() < pis_rank.rank_penalty_until\r\n' +
    '          THEN p.created_at - INTERVAL \'10 days\'\r\n' +
    '          WHEN pis_rank.rank_penalty_tier = \'light\'\r\n' +
    '           AND pis_rank.rank_penalty_until IS NOT NULL\r\n' +
    '           AND NOW() < pis_rank.rank_penalty_until\r\n' +
    '          THEN p.created_at - INTERVAL \'3 days\'\r\n' +
    '          ELSE p.created_at\r\n' +
    '        END AS effective_sort_time,\r\n' +
    '        -- Phase 2e: is_backlog_post — true when the post was created before any',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 4: Rewrite ORDER BY
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'ORDER BY rewrite',
  old:
    '      ${cursorCondition}\r\n' +
    '      ORDER BY p.created_at DESC\r\n' +
    '      LIMIT $3',
  new:
    '      ${cursorCondition}\r\n' +
    '      ORDER BY effective_sort_time DESC, p.id DESC\r\n' +
    '      LIMIT $3',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 5: Rewrite queryParams binding
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'queryParams binding',
  old:
    '    // Build query params: $1=userId, $2=userType, $3=limit, $4=viewerId, $5=viewerType, $6=cursor (optional)\r\n' +
    '    const queryParams = cursor\r\n' +
    '      ? [userId, userType, parsedLimit + 1, viewerId, viewerType, cursor]\r\n' +
    '      : [userId, userType, parsedLimit + 1, viewerId, viewerType];',
  new:
    '    // $1=userId, $2=userType, $3=limit, $4=viewerId, $5=viewerType\r\n' +
    '    // $6=cursor_time (timestamptz), $7=cursor_id (int) — only bound when hasCursor=true\r\n' +
    '    const queryParams = hasCursor\r\n' +
    '      ? [userId, userType, parsedLimit + 1, viewerId, viewerType, cursor_time, parseInt(cursor_id)]\r\n' +
    '      : [userId, userType, parsedLimit + 1, viewerId, viewerType];',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 6: Rewrite nextCursor construction
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'nextCursor → next_cursor_time + next_cursor_id',
  old:
    '    // Determine pagination metadata\r\n' +
    '    const hasMore = posts.length > parsedLimit;\r\n' +
    '    const trimmedPosts = hasMore ? posts.slice(0, parsedLimit) : posts;\r\n' +
    '    const nextCursor =\r\n' +
    '      trimmedPosts.length > 0\r\n' +
    '        ? trimmedPosts[trimmedPosts.length - 1].created_at\r\n' +
    '        : null;\r\n' +
    '\r\n' +
    '    console.log("Parsed posts:", trimmedPosts.length, "hasMore:", hasMore);\r\n' +
    '    res.json({\r\n' +
    '      posts: trimmedPosts,\r\n' +
    '      next_cursor: nextCursor,\r\n' +
    '      has_more: hasMore,\r\n' +
    '    });',
  new:
    '    // Determine pagination metadata\r\n' +
    '    const hasMore = posts.length > parsedLimit;\r\n' +
    '    const trimmedPosts = hasMore ? posts.slice(0, parsedLimit) : posts;\r\n' +
    '    // Compound cursor: encode (effective_sort_time, id) of the last post in this page.\r\n' +
    '    // effective_sort_time is in the SELECT result as a Date object (pg casts TIMESTAMPTZ → JS Date).\r\n' +
    '    // We ISO-stringify it so the frontend can round-trip it back as a URL query param.\r\n' +
    '    const lastPost = trimmedPosts.length > 0 ? trimmedPosts[trimmedPosts.length - 1] : null;\r\n' +
    '    const nextCursorTime = lastPost?.effective_sort_time\r\n' +
    '      ? (lastPost.effective_sort_time instanceof Date\r\n' +
    '          ? lastPost.effective_sort_time.toISOString()\r\n' +
    '          : String(lastPost.effective_sort_time))\r\n' +
    '      : null;\r\n' +
    '    const nextCursorId = lastPost?.id ?? null;\r\n' +
    '\r\n' +
    '    console.log("Parsed posts:", trimmedPosts.length, "hasMore:", hasMore,\r\n' +
    '      "nextCursorTime:", nextCursorTime, "nextCursorId:", nextCursorId);\r\n' +
    '    res.json({\r\n' +
    '      posts: trimmedPosts,\r\n' +
    '      next_cursor_time: nextCursorTime,\r\n' +
    '      next_cursor_id: nextCursorId,\r\n' +
    '      has_more: hasMore,\r\n' +
    '    });',
});

// ─────────────────────────────────────────────────────────────────────────────
// Apply all patches
// ─────────────────────────────────────────────────────────────────────────────
let failCount = 0;
for (const patch of patches) {
  if (!c.includes(patch.old)) {
    console.error(`❌ PATCH FAILED — target not found: "${patch.name}"`);
    // Print context around where it might be
    const snippet = patch.old.slice(0, 60).replace(/\r\n/g, '↵').replace(/\n/g, '↵');
    console.error(`   First 60 chars of target: ${snippet}`);
    failCount++;
  } else {
    c = c.replace(patch.old, patch.new);
    console.log(`✅ ${patch.name}`);
  }
}

if (failCount > 0) {
  console.error(`\n${failCount} patch(es) failed — file NOT written.`);
  process.exit(1);
}

if (DRY) {
  console.log('\n[DRY RUN] File not written. All patches would succeed.');
} else {
  fs.writeFileSync(FILE, c, 'utf8');
  console.log('\nFile written successfully.');
}
