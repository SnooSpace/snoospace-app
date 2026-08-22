'use strict';
const { windowedShuffle } = require('../../frontend/utils/feedShuffle');

// Mock data matching real backend score shapes
const discoveryPosts = [
  { id: 1, author_type: 'community', author_id: 10, discovery_score: 8.2 },
  { id: 2, author_type: 'community', author_id: 10, discovery_score: 7.1 }, // same author (should be capped at 1)
  { id: 3, author_type: 'community', author_id: 11, discovery_score: 5.0 },
  { id: 4, author_type: 'member',    author_id: 22, discovery_score: 3.5 },
];

const events = [
  { id: 101, community_id: 101, score: 45 },
  { id: 102, community_id: 102, score: 38 },
  { id: 103, community_id: 103, score: 25 },
];

const discoveryOpportunities = [
  { id: 201, creator_type: 'community', creator_id: 201, discovery_score: 4.8 },
  { id: 202, creator_type: 'community', creator_id: 202, discovery_score: 3.0 },
];

const targetedPromoPosts = [
  { id: 999, post_type: 'media', author_type: 'community', author_id: 50 },
];

// Step 1: MinMax Norm
const minMaxNorm = (items, scoreField) => {
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

// Step 2: Author Diversity Cap = 1 (session-wide)
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

// Step 3: Pool & Sort
const pool = [
  ...filteredPosts,
  ...filteredEvents,
  ...filteredDiscoveryOpps,
].sort((a, b) => b._normalizedScore - a._normalizedScore);

// Step 4: Constraint walk
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

// Step 5: Shuffle non-promo pool
const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;

// Step 6: Insert Promo at index 1 (position 2) AFTER shuffle
const promoPost = targetedPromoPosts[0];
let finalZeroFollow = shuffled;
if (promoPost) {
  const promoItem = { ...promoPost, itemType: 'post', is_targeted_promo: true };
  finalZeroFollow = [
    ...finalZeroFollow.slice(0, 1),
    promoItem,
    ...finalZeroFollow.slice(1),
  ];
}

const feedItems = finalZeroFollow.map(item => {
  const { _normalizedScore, ...clean } = item;
  return clean;
});

console.log('\n── Zero-Follow Merge Verification ──────────────────────────────────\n');
console.log('Result length:', feedItems.length);
console.log('Promo at index 1?', feedItems[1]?.is_targeted_promo === true ? '✅ YES' : '❌ NO');
console.log('Author 10 count:', feedItems.filter(i => i.author_id === 10).length === 1 ? '✅ Exactly 1' : '❌ Failed');
feedItems.forEach((item, i) => {
  const label = item.is_targeted_promo ? 'PROMO' :
    item.is_discovery_post ? 'disc-post' :
    item.is_discovery_opportunity ? 'disc-opp' :
    item.itemType;
  console.log(`  [${i}] ${label.padEnd(12)} id=${item.id}`);
});
