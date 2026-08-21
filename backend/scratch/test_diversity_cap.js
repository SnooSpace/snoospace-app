/**
 * Test 4: Verify per-author diversity cap (1 per author) in feedItems merge logic.
 *
 * This is a pure JS logic test — no DB connection needed.
 * Replicates the exact feedItems useMemo merge logic from HomeFeedScreen.js
 * and asserts that when discoveryPosts has 3 posts from the same author + 1 from another:
 *   - Exactly 1 post from author A appears in merged output
 *   - Exactly 1 post from author B appears in merged output
 *   - At most DISCOVERY_CAP total discovery posts appear
 *   - discoveryIndex correctly advances past blocked candidates so injection doesn't stall
 *
 * Also verifies the stall case: without the scan-forward fix, the 2nd injection slot
 * would re-evaluate the same blocked candidate and silently skip, producing 0 injection.
 * The fixed logic should produce injection for author B even when author A's posts
 * are all at the front of the queue.
 */

console.log('=== Test 4: Per-author diversity cap in feedItems merge logic ===\n');

// ── Replicated merge logic (exact copy of HomeFeedScreen feedItems useMemo body) ──────

function mergeFeeds({ posts, events, opportunities, discoveryPosts }) {
  if (posts.length === 0 && events.length === 0 && opportunities.length === 0) return [];

  const merged = [];
  let eventIndex = 0;
  let opportunityIndex = 0;
  let discoveryIndex = 0;
  const FIRST_EVENT_AT = 2;
  const SUBSEQUENT_INTERVAL = 5;
  const OPPORTUNITY_INTERVAL = 3;
  const BACKLOG_CAP = 2;
  const backlogAuthorCount = {};
  const DISCOVERY_CAP = 3;
  const DISCOVERY_INTERVAL = 5;
  let discoveryShown = 0;
  const discoveryAuthorCount = {};

  if (posts.length > 0) {
    posts.forEach((post, index) => {
      if (post.is_backlog_post) {
        const authorKey = `${post.author_type}-${post.author_id}`;
        const seen = backlogAuthorCount[authorKey] || 0;
        if (seen >= BACKLOG_CAP) return;
        backlogAuthorCount[authorKey] = seen + 1;
      }

      merged.push({ ...post, itemType: 'post' });
      const postNumber = index + 1;

      // Events
      const shouldInsertEvent =
        (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
        (eventIndex > 0 && postNumber > FIRST_EVENT_AT &&
          (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);
      if (shouldInsertEvent && eventIndex < events.length) {
        merged.push({ ...events[eventIndex], itemType: 'event' });
        eventIndex++;
      }

      // Opportunities
      if (postNumber % OPPORTUNITY_INTERVAL === 0 && opportunityIndex < opportunities.length) {
        merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity' });
        opportunityIndex++;
      }

      // Discovery — fixed scan-forward logic
      if (postNumber % DISCOVERY_INTERVAL === 0 && discoveryShown < DISCOVERY_CAP) {
        while (
          discoveryIndex < discoveryPosts.length &&
          (discoveryAuthorCount[
            `${discoveryPosts[discoveryIndex].author_type}-${discoveryPosts[discoveryIndex].author_id}`
          ] || 0) >= 1
        ) {
          discoveryIndex++;
        }
        if (discoveryIndex < discoveryPosts.length) {
          const dp = discoveryPosts[discoveryIndex];
          const dpAuthorKey = `${dp.author_type}-${dp.author_id}`;
          merged.push({ ...dp, itemType: 'post', is_discovery_post: true });
          discoveryAuthorCount[dpAuthorKey] = (discoveryAuthorCount[dpAuthorKey] || 0) + 1;
          discoveryIndex++;
          discoveryShown++;
        }
      }
    });
  }

  return merged;
}

// ── Test helpers ──────────────────────────────────────────────────────────────────────

function makePost(id, authorId = 1, authorType = 'community') {
  return { id, author_id: authorId, author_type: authorType, itemType: 'post' };
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ── Test A: 3 posts from author A, 1 from author B — expect 1 of A, 1 of B ─────────
console.log('--- Scenario A: [A1, A2, A3, B1] — expect 1 from A, 1 from B ---');
{
  // 15 followed posts ensures 3 injection slots (positions 5, 10, 15)
  const followedPosts = Array.from({ length: 15 }, (_, i) => makePost(100 + i, 999, 'member'));
  const discoveryPostsA = [
    makePost(201, 'author_a', 'community'),
    makePost(202, 'author_a', 'community'),
    makePost(203, 'author_a', 'community'),
    makePost(204, 'author_b', 'community'),
  ];

  const merged = mergeFeeds({
    posts: followedPosts,
    events: [],
    opportunities: [],
    discoveryPosts: discoveryPostsA,
  });

  const discoveryItems = merged.filter(i => i.is_discovery_post);
  const authorACnt = discoveryItems.filter(i => i.author_id === 'author_a').length;
  const authorBCnt = discoveryItems.filter(i => i.author_id === 'author_b').length;

  console.log(`  Discovery items injected: ${discoveryItems.length}`);
  console.log(`  From author_a: ${authorACnt}, from author_b: ${authorBCnt}`);

  assert(authorACnt === 1, 'Exactly 1 post from author_a (diversity cap enforced)');
  assert(authorBCnt === 1, 'Exactly 1 post from author_b (scan-forward advanced past blocked candidates)');
  assert(discoveryItems.length <= 3, `Total discovery ≤ DISCOVERY_CAP(3): got ${discoveryItems.length}`);
}

// ── Test B: All 3 discovery posts from same author — expect exactly 1 ───────────────
console.log('\n--- Scenario B: [A1, A2, A3] — expect exactly 1 from A, no stall ---');
{
  const followedPosts = Array.from({ length: 15 }, (_, i) => makePost(200 + i, 999, 'member'));
  const discoveryPostsB = [
    makePost(301, 'author_x', 'community'),
    makePost(302, 'author_x', 'community'),
    makePost(303, 'author_x', 'community'),
  ];

  const merged = mergeFeeds({
    posts: followedPosts,
    events: [],
    opportunities: [],
    discoveryPosts: discoveryPostsB,
  });

  const discoveryItems = merged.filter(i => i.is_discovery_post);
  const authorXCnt = discoveryItems.filter(i => i.author_id === 'author_x').length;

  console.log(`  Discovery items injected: ${discoveryItems.length}`);
  console.log(`  From author_x: ${authorXCnt}`);

  assert(authorXCnt === 1, 'Exactly 1 post from author_x (diversity cap blocks duplicates)');
  assert(discoveryItems.length === 1, 'Only 1 injection total when all remaining candidates are from blocked author');
}

// ── Test C: DISCOVERY_CAP respected when diversity allows more ───────────────────────
console.log('\n--- Scenario C: [A1, B1, C1, D1] — expect DISCOVERY_CAP(3) total ---');
{
  const followedPosts = Array.from({ length: 20 }, (_, i) => makePost(400 + i, 999, 'member'));
  const discoveryPostsC = [
    makePost(401, 'author_a', 'community'),
    makePost(402, 'author_b', 'community'),
    makePost(403, 'author_c', 'community'),
    makePost(404, 'author_d', 'community'),
  ];

  const merged = mergeFeeds({
    posts: followedPosts,
    events: [],
    opportunities: [],
    discoveryPosts: discoveryPostsC,
  });

  const discoveryItems = merged.filter(i => i.is_discovery_post);
  console.log(`  Discovery items injected: ${discoveryItems.length}`);
  assert(discoveryItems.length === 3, `DISCOVERY_CAP of 3 respected (got ${discoveryItems.length})`);
}

// ── Summary ───────────────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
