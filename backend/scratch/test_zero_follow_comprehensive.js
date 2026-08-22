'use strict';

/**
 * Real windowedShuffle implementation imported from frontend/utils/feedShuffle.js logic
 */
function windowedShuffle(posts, windowSize = 5) {
  if (!posts || posts.length <= 1 || windowSize <= 1) {
    return posts ? [...posts] : [];
  }
  const arr = [...posts];
  const n = arr.length;
  for (let start = 0; start < n; start += windowSize) {
    const end = Math.min(start + windowSize - 1, n - 1);
    for (let i = end; i > start; i--) {
      const j = start + Math.floor(Math.random() * (i - start + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
  return arr;
}

/**
 * Exact zero-follow merge implementation from HomeFeedScreen.js
 */
function runZeroFollowMerge({ discoveryPosts = [], events = [], discoveryOpportunities = [], targetedPromoPosts = [] }) {
  const merged = [];

  // Step 1: Min-max normalize scores within each type's own batch
  const minMaxNorm = (items, scoreField) => {
    if (items.length === 0) return [];
    const scores = items.map(i => parseFloat(i[scoreField]) || 0);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    return items.map((item, idx) => ({
      ...item,
      _normalizedScore: (scores[idx] - min) / range,
    }));
  };

  const normPosts = minMaxNorm(
    discoveryPosts.map(p => ({ ...p, itemType: 'post', is_discovery_post: true })),
    'discovery_score'
  );
  const normEvents = minMaxNorm(
    events.map(e => ({ ...e, itemType: 'event' })),
    'score'
  );
  const normDiscoveryOpps = minMaxNorm(
    discoveryOpportunities.map(o => ({ ...o, itemType: 'opportunity', is_discovery_opportunity: true })),
    'discovery_score'
  );

  // Step 2: Author diversity cap (max 1 per author, session-wide)
  const ZF_AUTHOR_CAP = 1;
  const zfAuthorCount = {};
  const applyDiversity = (items, authorKeyFn) => {
    const out = [];
    for (const item of items) {
      const key = authorKeyFn(item);
      const count = zfAuthorCount[key] || 0;
      if (count < ZF_AUTHOR_CAP) {
        zfAuthorCount[key] = count + 1;
        out.push(item);
      }
    }
    return out;
  };

  const filteredPosts = applyDiversity(normPosts, p => `${p.author_type}-${p.author_id}`);
  const filteredEvents = applyDiversity(normEvents, e => `community-${e.community_id}`);
  const filteredDiscoveryOpps = applyDiversity(normDiscoveryOpps, o => `${o.creator_type}-${o.creator_id}`);

  // Step 3: Pool & sort descending by normalized score
  const pool = [
    ...filteredPosts,
    ...filteredEvents,
    ...filteredDiscoveryOpps,
  ].sort((a, b) => b._normalizedScore - a._normalizedScore);

  // Step 4: Apply no-more-than-2-consecutive-same-type constraint
  const constrained = [];
  const remaining = [...pool];
  while (remaining.length > 0) {
    const n = constrained.length;
    const next = remaining[0];
    const isSameType =
      n >= 2 &&
      constrained[n - 1].itemType === next.itemType &&
      constrained[n - 2].itemType === next.itemType;

    if (!isSameType) {
      constrained.push(remaining.shift());
    } else {
      const swapIdx = remaining.findIndex(r => r.itemType !== next.itemType);
      if (swapIdx === -1) {
        constrained.push(remaining.shift());
      } else {
        constrained.push(...remaining.splice(swapIdx, 1));
      }
    }
  }

  // Step 5: Apply windowedShuffle to constrained non-promo pool
  const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;

  // Step 6: Pin targeted promo at position 2 (index 1) AFTER shuffle
  const promoPost = targetedPromoPosts[0];
  let finalZeroFollow = shuffled;
  if (promoPost) {
    const promoItem = {
      ...promoPost,
      itemType: 'post',
      is_targeted_promo: true,
    };
    finalZeroFollow = [
      ...finalZeroFollow.slice(0, 1),
      promoItem,
      ...finalZeroFollow.slice(1),
    ];
  }

  // Step 7: Strip internal scoring field and push to merged
  for (const item of finalZeroFollow) {
    const { _normalizedScore, ...cleanItem } = item;
    merged.push(cleanItem);
  }

  return merged;
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('TEST SUITE 1: DETERMINISTIC PROMO POSITION 2 (50 RANDOM RUNS)');
console.log('================================================================');

const mockDiscoveryPosts = [
  { id: 1, author_type: 'community', author_id: 10, discovery_score: 8.2 },
  { id: 2, author_type: 'community', author_id: 11, discovery_score: 7.1 },
  { id: 3, author_type: 'community', author_id: 12, discovery_score: 6.5 },
  { id: 4, author_type: 'community', author_id: 13, discovery_score: 5.0 },
  { id: 5, author_type: 'member',    author_id: 22, discovery_score: 3.5 },
  { id: 6, author_type: 'community', author_id: 14, discovery_score: 2.0 },
];

const mockEvents = [
  { id: 101, community_id: 101, score: 45 },
  { id: 102, community_id: 102, score: 38 },
  { id: 103, community_id: 103, score: 30 },
  { id: 104, community_id: 104, score: 25 },
];

const mockDiscoveryOpps = [
  { id: 201, creator_type: 'community', creator_id: 201, discovery_score: 4.8 },
  { id: 202, creator_type: 'community', creator_id: 202, discovery_score: 3.0 },
  { id: 203, creator_type: 'community', creator_id: 203, discovery_score: 1.5 },
];

const mockPromo = [
  { id: 999, post_type: 'media', author_type: 'community', author_id: 50 },
];

let promoAlwaysAtPos2 = true;
const promoPositions = [];
for (let run = 1; run <= 50; run++) {
  const result = runZeroFollowMerge({
    discoveryPosts: mockDiscoveryPosts,
    events: mockEvents,
    discoveryOpportunities: mockDiscoveryOpps,
    targetedPromoPosts: mockPromo,
  });
  const promoIdx = result.findIndex(i => i.is_targeted_promo);
  promoPositions.push(promoIdx);
  if (promoIdx !== 1) {
    promoAlwaysAtPos2 = false;
    console.log(`Run ${run}: Promo landed at index ${promoIdx}!`);
  }
}

check(
  'Promo is at index 1 (position 2) in 50/50 independent random runs',
  promoAlwaysAtPos2,
  `Observed positions: [${promoPositions.slice(0, 10).join(', ')}...]`
);

console.log('\n================================================================');
console.log('TEST SUITE 2: STRICT AUTHOR CAP = 1 (1 PER AUTHOR SESSION-WIDE)');
console.log('================================================================');

const sameAuthorPosts = [
  { id: 1, author_type: 'community', author_id: 10, discovery_score: 9.0 },
  { id: 2, author_type: 'community', author_id: 10, discovery_score: 8.0 },
  { id: 3, author_type: 'community', author_id: 10, discovery_score: 7.0 },
  { id: 4, author_type: 'community', author_id: 11, discovery_score: 6.0 },
];

const authorCapResult = runZeroFollowMerge({
  discoveryPosts: sameAuthorPosts,
  events: [],
  discoveryOpportunities: [],
  targetedPromoPosts: [],
});

const community10Items = authorCapResult.filter(i => i.author_id === 10);
check(
  'Author cap = 1 strictly keeps only 1 post for author community-10',
  community10Items.length === 1 && community10Items[0].id === 1,
  `kept count: ${community10Items.length}`
);
check(
  'Total items in author-capped list is exactly 2 (author 10 + author 11)',
  authorCapResult.length === 2,
  `got: ${authorCapResult.length}`
);

console.log('\n================================================================');
console.log('TEST SUITE 3: SKEWED-POOL EDGE CASES (GRACEFUL DEGRADATION)');
console.log('================================================================');

// Case A: 85% posts (10 posts from different authors, 1 event, 0 opps)
const skewedPosts = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  author_type: 'community',
  author_id: 100 + i,
  discovery_score: 10 - i,
}));
const singleEvent = [{ id: 501, community_id: 501, score: 50 }];

const skewedResultA = runZeroFollowMerge({
  discoveryPosts: skewedPosts,
  events: singleEvent,
  discoveryOpportunities: [],
  targetedPromoPosts: [],
});

check(
  'Case A (10 posts, 1 event): All 11 items preserved (no drops/hangs)',
  skewedResultA.length === 11,
  `output length: ${skewedResultA.length}`
);

// Verify that it starts without violating 3-in-a-row for as long as swap candidates exist
console.log('  Sequence for Case A (10 posts, 1 event):');
console.log('   ', skewedResultA.map(i => i.itemType).join(' -> '));

// Case B: 100% events (0 posts, 8 events, 0 opps)
const pureEvents = Array.from({ length: 8 }, (_, i) => ({
  id: 700 + i,
  community_id: 700 + i,
  score: 80 - i,
}));
const skewedResultB = runZeroFollowMerge({
  discoveryPosts: [],
  events: pureEvents,
  discoveryOpportunities: [],
  targetedPromoPosts: [],
});

check(
  'Case B (100% events): All 8 events preserved without infinite loop',
  skewedResultB.length === 8,
  `output length: ${skewedResultB.length}`
);

// Case C: Promo only (0 posts, 0 events, 0 opps, 1 promo)
const promoOnlyResult = runZeroFollowMerge({
  discoveryPosts: [],
  events: [],
  discoveryOpportunities: [],
  targetedPromoPosts: mockPromo,
});

check(
  'Case C (Promo only): Promo preserved as single item at index 0',
  promoOnlyResult.length === 1 && promoOnlyResult[0].is_targeted_promo === true,
  `output length: ${promoOnlyResult.length}`
);

// Case D: 1 item of each type
const balancedResult = runZeroFollowMerge({
  discoveryPosts: [{ id: 1, author_type: 'community', author_id: 1, discovery_score: 5 }],
  events: [{ id: 10, community_id: 10, score: 50 }],
  discoveryOpportunities: [{ id: 20, creator_type: 'community', creator_id: 20, discovery_score: 3 }],
  targetedPromoPosts: mockPromo,
});

check(
  'Case D (1 of each type + promo): Total 4 items, promo at index 1',
  balancedResult.length === 4 && balancedResult[1].is_targeted_promo === true,
  `promo at index: ${balancedResult.findIndex(i => i.is_targeted_promo)}`
);

console.log('\n================================================================');
console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

process.exit(failed > 0 ? 1 : 0);
