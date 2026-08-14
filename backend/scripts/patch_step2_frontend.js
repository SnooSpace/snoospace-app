'use strict';
/**
 * patch_step2_frontend.js — Update HomeFeedScreen.js to use compound cursor
 * (cursor_time + cursor_id instead of single cursor field)
 */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const FILE = path.join(__dirname, '../../frontend/screens/home/HomeFeedScreen.js');
let c = fs.readFileSync(FILE, 'utf8');

const patches = [];

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1: Replace cursor state with cursorTime + cursorId
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'cursor state → cursorTime + cursorId',
  old:
    '  // Cursor-based pagination state\r\n' +
    '  const [cursor, setCursor] = useState(null);\r\n' +
    '  const [hasMore, setHasMore] = useState(true);',
  new:
    '  // Compound cursor-based pagination state (Step 2: effective_sort_time + id)\r\n' +
    '  const [cursorTime, setCursorTime] = useState(null);\r\n' +
    '  const [cursorId, setCursorId] = useState(null);\r\n' +
    '  const [hasMore, setHasMore] = useState(true);',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2: Rewrite loadFeed cursor usage
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'loadFeed cursor reset + URL construction + response parsing',
  old:
    '      if (reset) {\r\n' +
    '        if (!skipSetLoading) setLoading(true);\r\n' +
    '        setCursor(null);\r\n' +
    '        setHasMore(true);\r\n' +
    '      } else {\r\n' +
    '        setLoadingMore(true);\r\n' +
    '      }\r\n' +
    '      setErrorMsg("");\r\n' +
    '      const token = await getAuthToken();\r\n' +
    '      if (!token) throw new Error("Authentication token not found.");\r\n' +
    '\r\n' +
    '      // Build URL with cursor param for pagination\r\n' +
    '      const cursorToUse = reset ? null : cursor;\r\n' +
    '      const url = cursorToUse\r\n' +
    '        ? `/posts/feed?cursor=${encodeURIComponent(cursorToUse)}&limit=20`\r\n' +
    '        : "/posts/feed?limit=20";',
  new:
    '      if (reset) {\r\n' +
    '        if (!skipSetLoading) setLoading(true);\r\n' +
    '        setCursorTime(null);\r\n' +
    '        setCursorId(null);\r\n' +
    '        setHasMore(true);\r\n' +
    '      } else {\r\n' +
    '        setLoadingMore(true);\r\n' +
    '      }\r\n' +
    '      setErrorMsg("");\r\n' +
    '      const token = await getAuthToken();\r\n' +
    '      if (!token) throw new Error("Authentication token not found.");\r\n' +
    '\r\n' +
    '      // Build URL with compound cursor params (cursor_time + cursor_id) for pagination.\r\n' +
    '      // Cursor values are opaque tokens received from the server — never reconstructed here.\r\n' +
    '      const ctToUse = reset ? null : cursorTime;\r\n' +
    '      const ciToUse = reset ? null : cursorId;\r\n' +
    '      const hasCursor = !!(ctToUse && ciToUse);\r\n' +
    '      const url = hasCursor\r\n' +
    '        ? `/posts/feed?cursor_time=${encodeURIComponent(ctToUse)}&cursor_id=${encodeURIComponent(ciToUse)}&limit=20`\r\n' +
    '        : "/posts/feed?limit=20";',
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3: Rewrite response parsing (next_cursor → next_cursor_time/id)
// ─────────────────────────────────────────────────────────────────────────────
patches.push({
  name: 'response parsing next_cursor → next_cursor_time + next_cursor_id',
  old:
    '      // Update pagination state from API response\r\n' +
    '      setCursor(response.next_cursor || null);\r\n' +
    '      setHasMore(response.has_more === true);',
  new:
    '      // Update compound cursor from API response (opaque tokens — treat as-is)\r\n' +
    '      setCursorTime(response.next_cursor_time || null);\r\n' +
    '      setCursorId(response.next_cursor_id ?? null);\r\n' +
    '      setHasMore(response.has_more === true);',
});

// ─────────────────────────────────────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────────────────────────────────────
let failCount = 0;
for (const patch of patches) {
  if (!c.includes(patch.old)) {
    console.error(`❌ PATCH FAILED — "${patch.name}"`);
    const snippet = patch.old.slice(0, 80).replace(/\r\n/g, '↵');
    console.error(`   Target: ${snippet}`);
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
  console.log('\n[DRY RUN] All patches would succeed.');
} else {
  fs.writeFileSync(FILE, c, 'utf8');
  console.log('\nHomeFeedScreen.js written successfully.');
}
