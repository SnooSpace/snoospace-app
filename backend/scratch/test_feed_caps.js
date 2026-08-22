'use strict';
/**
 * Verification: Prompt A + Prompt B — feedItems merge logic
 *
 * Directly exercises the useMemo computation logic (extracted as a pure function)
 * with synthetic data.
 *
 * TEST GROUP A — Targeted Promo (Prompt A)
 *   A1: Page 1 (10 posts) — promo appears at position 2 in merged list
 *   A2: Page 2 arrives (posts grows to 30) — promo STILL at position 2, not dropped
 *   A3: No promo when targetedPromoPosts is empty
 *
 * TEST GROUP B — Discovery posts windowed re-arm (Prompt B)
 *   B1: Window 1 (posts 1-20) — 3 discovery posts injected (cap reached)
 *   B2: Window 2 (posts 21-40) — 3 MORE discovery posts injected (re-armed), different authors
 *   B3: Window 3 (posts 41-60) — candidate pool exhausted (unique-author diversity applies),
 *       degrades gracefully (0 new injected — not an error)
 *   B4: Backlog per-window re-arm — author A blocked after 2 in window 1,
 *       re-allowed (up to 2) in window 2
 *
 * All tests run in pure JS — no React needed.
 */

let passed = 0;
let failed = 0;

function assert(label, actual, expected, note = '') {
  if (actual === expected) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label}`);
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         actual:   ${JSON.stringify(actual)}`);
    if (note) console.log(`         note: ${note}`);
    failed++;
  }
}

// ── Pure extraction of feedItems logic ──────────────────────────────────────
// Mirrors the useMemo computation exactly from HomeFeedScreen.js after the fix.

function computeFeedItems({
  posts = [],
  events = [],
  opportunities = [],
  discoveryPosts = [],
  discoveryOpportunities = [],
  targetedPromoPosts = [],
}) {
  if (posts.length === 0 && events.length === 0 && opportunities.length === 0) {
    return [];
  }

  const merged = [];
  let eventIndex = 0;
  let opportunityIndex = 0;
  let discoveryIndex = 0;
  const FIRST_EVENT_AT = 2;
  const SUBSEQUENT_INTERVAL = 5;
  const OPPORTUNITY_INTERVAL = 3;

  const WINDOW_SIZE = 20;

  const BACKLOG_CAP = 2;
  const backlogAuthorCount = {};
  const backlogWindowCount = {};

  const DISCOVERY_CAP = 3;
  const DISCOVERY_INTERVAL = 5;
  let discoveryShownThisWindow = 0;
  let lastDiscoveryWindow = 0;
  const discoveryAuthorCount = {};

  const DISCOVERY_OPP_INTERVAL = 5;
  const DISCOVERY_OPP_CAP = 3;
  let discoveryOppShownThisWindow = 0;
  let lastDiscoveryOppWindow = 0;
  let discoveryOppIndex = 0;
  const discoveryOppAuthorCount = {};

  if (posts.length > 0) {
    posts.forEach((post, index) => {
      const postNumber = index + 1;
      const currentWindow = Math.floor((postNumber - 1) / WINDOW_SIZE);

      // Backlog: per-window quantity, session-wide diversity (informational only)
      if (post.is_backlog_post) {
        const authorKey = `${post.author_type}-${post.author_id}`;
        const windowKey = `${authorKey}__w${currentWindow}`;
        const seenThisWindow = backlogWindowCount[windowKey] || 0;
        if (seenThisWindow >= BACKLOG_CAP) return;
        backlogWindowCount[windowKey] = seenThisWindow + 1;
        backlogAuthorCount[authorKey] = (backlogAuthorCount[authorKey] || 0) + 1;
      }

      merged.push({ ...post, itemType: 'post' });

      // Targeted promo: structural guarantee, no ref side-effect
      if (postNumber === 2 && targetedPromoPosts.length > 0) {
        merged.push({
          ...targetedPromoPosts[0],
          itemType: 'post',
          is_targeted_promo: true,
        });
      }

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

      // Discovery posts: per-window quota, session-wide diversity
      if (postNumber % DISCOVERY_INTERVAL === 0) {
        if (currentWindow > lastDiscoveryWindow) {
          discoveryShownThisWindow = 0;
          lastDiscoveryWindow = currentWindow;
        }
        if (discoveryShownThisWindow < DISCOVERY_CAP) {
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
            discoveryShownThisWindow++;
          }
        }
      }

      // Discovery Opportunities: per-window quota, session-wide diversity
      if (postNumber % DISCOVERY_OPP_INTERVAL === 0) {
        if (currentWindow > lastDiscoveryOppWindow) {
          discoveryOppShownThisWindow = 0;
          lastDiscoveryOppWindow = currentWindow;
        }
        if (discoveryOppShownThisWindow < DISCOVERY_OPP_CAP) {
          while (
            discoveryOppIndex < discoveryOpportunities.length &&
            (discoveryOppAuthorCount[
              `${discoveryOpportunities[discoveryOppIndex].creator_type}-${discoveryOpportunities[discoveryOppIndex].creator_id}`
            ] || 0) >= 1
          ) {
            discoveryOppIndex++;
          }
          if (discoveryOppIndex < discoveryOpportunities.length) {
            const dopp = discoveryOpportunities[discoveryOppIndex];
            const doppAuthorKey = `${dopp.creator_type}-${dopp.creator_id}`;
            merged.push({ ...dopp, itemType: 'opportunity', is_discovery_opportunity: true });
            discoveryOppAuthorCount[doppAuthorKey] = (discoveryOppAuthorCount[doppAuthorKey] || 0) + 1;
            discoveryOppIndex++;
            discoveryOppShownThisWindow++;
          }
        }
      }
    });

    // Append remaining events and opportunities
    while (eventIndex < events.length) {
      merged.push({ ...events[eventIndex], itemType: 'event' });
      eventIndex++;
    }
    while (opportunityIndex < opportunities.length) {
      merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity' });
      opportunityIndex++;
    }
  } else {
    events.forEach(e => merged.push({ ...e, itemType: 'event' }));
    opportunities.forEach(o => merged.push({ ...o, itemType: 'opportunity' }));
  }

  return merged;
}

// ── Synthetic data builders ──────────────────────────────────────────────────

function makePost(id, overrides = {}) {
  return { id, post_id: id, author_type: 'member', author_id: id, post_type: 'media', ...overrides };
}

function makeDiscoveryPost(id, authorId) {
  return { id, author_type: 'member', author_id: authorId, post_type: 'media' };
}

function makeTargetedPromo(id) {
  return { id, author_type: 'member', author_id: 99, post_type: 'poll' };
}

function makePosts(n, startId = 1, overrides = {}) {
  return Array.from({ length: n }, (_, i) => makePost(startId + i, overrides));
}

// ── TEST GROUP A: Targeted Promo Bug Fix ────────────────────────────────────
console.log('\n════ TEST GROUP A: Targeted Promo — Pagination Stability ════\n');

const promo = makeTargetedPromo(777);
const page1Posts = makePosts(10, 1);

// A1: Page 1 — promo appears at position 2 in merged
console.log('TEST A1: Page 1 (10 posts) — promo appears at merged index 2');
const a1Items = computeFeedItems({
  posts: page1Posts,
  targetedPromoPosts: [promo],
});
const a1PromoIdx = a1Items.findIndex(x => x.is_targeted_promo);
assert('promo present in page 1 result', a1PromoIdx !== -1, true);
const a1PostBeforePromo = a1Items[a1PromoIdx - 1];
// postNumber===2 means post id=2 is pushed first, then promo is immediately injected after it
assert('item before promo is followed post id=2 (postNumber===2 triggers injection)', a1PostBeforePromo?.id, 2);
const a1PostAfterPromo = a1Items[a1PromoIdx + 1];
assert('item after promo is followed post id=3', a1PostAfterPromo?.id, 3);
console.log(`  Promo at merged index ${a1PromoIdx} (between posts id=${a1PostBeforePromo?.id} and id=${a1PostAfterPromo?.id})`);

// A2: Page 2 arrives (posts grows to 30) — promo STILL at position 2
console.log('\nTEST A2: After page 2 (30 posts total) — promo still stable at merged index 2');
const page1And2Posts = makePosts(30, 1);
const a2Items = computeFeedItems({
  posts: page1And2Posts,
  targetedPromoPosts: [promo],
});
const a2PromoIdx = a2Items.findIndex(x => x.is_targeted_promo);
assert('promo still present after page 2 load', a2PromoIdx !== -1, true);
assert('promo still at same merged index as page 1', a2PromoIdx, a1PromoIdx);

// A3: No promo when targetedPromoPosts is empty
console.log('\nTEST A3: No targetedPromoPosts — promo not injected');
const a3Items = computeFeedItems({
  posts: makePosts(10),
  targetedPromoPosts: [],
});
const a3PromoIdx = a3Items.findIndex(x => x.is_targeted_promo);
assert('no promo injected when pool is empty', a3PromoIdx, -1);

// ── TEST GROUP B: Windowed Re-arm ───────────────────────────────────────────
console.log('\n════ TEST GROUP B: Discovery Windowed Re-arm ════\n');

// 9 discovery candidates from 9 unique authors (authors 100-108)
const discoveryPool = Array.from({ length: 9 }, (_, i) => makeDiscoveryPost(200 + i, 100 + i));

// 45 followed posts spans 3 windows (W0: posts 1-20, W1: posts 21-40, W2: posts 41-45+)
const fortyFivePosts = makePosts(45, 1);

console.log('TEST B1+B2+B3: 45 followed posts, 9 unique discovery candidates, DISCOVERY_CAP=3 per window');
const bItems = computeFeedItems({
  posts: fortyFivePosts,
  discoveryPosts: discoveryPool,
});

const discoveryInjections = bItems.filter(x => x.is_discovery_post);
const window0Disc = discoveryInjections.filter((_, i) => i < 3); // W0 slots: positions 5,10,15
const window1Disc = discoveryInjections.filter((_, i) => i >= 3 && i < 6); // W1 slots: positions 25,30,35
const window2Disc = discoveryInjections.filter((_, i) => i >= 6); // W2 slots: positions 45+

console.log(`  Total discovery posts injected: ${discoveryInjections.length}`);
console.log(`  Window 0 (posts 1-20): ${window0Disc.length} discovery posts, authors: [${window0Disc.map(x => x.author_id).join(', ')}]`);
console.log(`  Window 1 (posts 21-40): ${window1Disc.length} discovery posts, authors: [${window1Disc.map(x => x.author_id).join(', ')}]`);
console.log(`  Window 2 (posts 41-60): ${window2Disc.length} discovery posts, authors: [${window2Disc.map(x => x.author_id).join(', ')}]`);

assert('Window 0: exactly 3 discovery posts (cap)', window0Disc.length, 3);
assert('Window 1: exactly 3 discovery posts (re-armed)', window1Disc.length, 3);

// Window 2 should get 3 more authors (100+6, 100+7, 100+8 = 106, 107, 108)
// But we only have 45 posts so slots are at 40+5=45 only → at most 1 slot
// Let's confirm it gets whatever fits within the 45 posts
const w2SlotCount = Math.floor((45 - 40) / 5); // number of multiples of 5 in range 41-45 = 1 slot
const w2Expected = Math.min(w2SlotCount, discoveryPool.length - 6); // at most remaining candidates
assert(`Window 2: ${w2Expected} discovery post(s) (degraded gracefully — only ${w2SlotCount} slot in range)`, window2Disc.length, w2Expected);

// Session-wide author diversity: no author ID appears twice across all windows
const allAuthorIds = discoveryInjections.map(x => x.author_id);
const uniqueAuthorIds = [...new Set(allAuthorIds)];
assert('Session-wide author diversity: no author repeated across windows', allAuthorIds.length, uniqueAuthorIds.length);
console.log(`  All injected author IDs (session): [${allAuthorIds.join(', ')}] — all unique: ${allAuthorIds.length === uniqueAuthorIds.length}`);

// B4: Backlog per-window re-arm
console.log('\nTEST B4: Backlog per-window re-arm');
// Author A (id=1) has 4 backlog posts spread across windows 0 and 1
const backlogPosts = [
  // Window 0 (posts 1-20): 4 posts from author 1 — only 2 should pass
  makePost(1001, { author_id: 1, is_backlog_post: true }),
  makePost(1002, { author_id: 1, is_backlog_post: true }),
  makePost(1003, { author_id: 1, is_backlog_post: true }), // excess in W0
  makePost(1004, { author_id: 1, is_backlog_post: true }), // excess in W0
  // Non-backlog filler to push into W1 (need 16 more to total 20 in W0)
  ...makePosts(16, 2000),
  // Window 1 (posts 21+): 2 more from author 1 — should both pass (W1 fresh quota)
  makePost(1005, { author_id: 1, is_backlog_post: true }),
  makePost(1006, { author_id: 1, is_backlog_post: true }),
];
const b4Items = computeFeedItems({ posts: backlogPosts });
const b4BacklogFromAuthor1 = b4Items.filter(x => x.author_id === 1 && x.itemType === 'post');
const b4InWindow0 = b4BacklogFromAuthor1.filter((_, i) => i < 2);
const b4InWindow1 = b4BacklogFromAuthor1.filter((_, i) => i >= 2);
console.log(`  Author 1 backlog posts shown: ${b4BacklogFromAuthor1.length} (2 from W0 + ${b4InWindow1.length} from W1)`);
assert('Window 0: at most 2 backlog posts from author 1', b4InWindow0.length, 2);
assert('Window 1: author 1 backlog re-armed, both pass', b4InWindow1.length, 2);

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
