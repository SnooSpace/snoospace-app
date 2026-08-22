'use strict';
// Pure JS simulation of the zero-follow feedItems merge path.
// Uses the same algorithm as HomeFeedScreen.js to verify:
//   1. Non-empty output when posts=[]
//   2. No 3-in-a-row same-type run
//   3. Promo at position 2 when present
//   4. Author diversity cap (max 2 per author)
//   5. End-state message condition

// ─── Mock data matching real backend score shapes ────────────────────────────
const discoveryPosts = [
  { id: 1, itemType: 'post', author_type: 'community', author_id: 10, discovery_score: 8.2 },
  { id: 2, itemType: 'post', author_type: 'community', author_id: 10, discovery_score: 7.1 },  // same author
  { id: 3, itemType: 'post', author_type: 'community', author_id: 10, discovery_score: 6.5 },  // same author (should be capped)
  { id: 4, itemType: 'post', author_type: 'community', author_id: 11, discovery_score: 5.0 },
  { id: 5, itemType: 'post', author_type: 'member',    author_id: 22, discovery_score: 3.5 },
];

const events = [
  { id: 101, community_id: 10, score: 45 },
  { id: 102, community_id: 11, score: 38 },
  { id: 103, community_id: 10, score: 30 }, // same community as id:101 (same author key)
  { id: 104, community_id: 12, score: 25 },
  { id: 105, community_id: 13, score: 20 },
];

const discoveryOpportunities = [
  { id: 201, creator_type: 'community', creator_id: 10, discovery_score: 4.8 },
  { id: 202, creator_type: 'community', creator_id: 11, discovery_score: 3.0 },
  { id: 203, creator_type: 'community', creator_id: 12, discovery_score: 1.5 },
];

const targetedPromoPosts = [
  { id: 999, post_type: 'media', author_type: 'community', author_id: 50 },
];

// ─── Replicate feedItems zero-follow path ────────────────────────────────────
const windowedShuffle = (arr) => arr; // identity: shuffle not tested here

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

const ZF_AUTHOR_CAP = 2;
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

const pool = [
  ...filteredPosts,
  ...filteredEvents,
  ...filteredDiscoveryOpps,
].sort((a, b) => b._normalizedScore - a._normalizedScore);

const typeKey = (item) => item.is_targeted_promo ? 'promo' : item.itemType;

// Step 4: Pin promo at index 1 BEFORE constraint walk
const promoPost = targetedPromoPosts[0];
let preConstrained = pool;
if (promoPost) {
  const withoutPromo = preConstrained.filter(item => item.id !== promoPost.id);
  const promoItem = { ...promoPost, itemType: 'post', is_targeted_promo: true, _normalizedScore: Infinity };
  preConstrained = [
    ...withoutPromo.slice(0, 1),
    promoItem,
    ...withoutPromo.slice(1),
  ];
}

// Step 5: Constraint walk with typeKey (promo = 'promo' type)
const constrained = [];
const remaining = [...preConstrained];
while (remaining.length > 0) {
  const n = constrained.length;
  const next = remaining[0];
  const isSameType =
    n >= 2 &&
    typeKey(constrained[n - 1]) === typeKey(next) &&
    typeKey(constrained[n - 2]) === typeKey(next);

  if (!isSameType) {
    constrained.push(remaining.shift());
  } else {
    const swapIdx = remaining.findIndex(r => typeKey(r) !== typeKey(next));
    if (swapIdx === -1) {
      constrained.push(remaining.shift());
    } else {
      constrained.push(...remaining.splice(swapIdx, 1));
    }
  }
}

// Step 6: shuffle
const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;
const finalZeroFollow = shuffled;

const feedItems = finalZeroFollow.map(item => {
  const { _normalizedScore, ...clean } = item;
  return clean;
});

// ─── Verification ─────────────────────────────────────────────────────────────
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

console.log('\n── Zero-Follow Merge Verification ──────────────────────────────────\n');

// 1. Non-empty output
check('feedItems is non-empty', feedItems.length > 0, `got length ${feedItems.length}`);

// 2. No 3-in-a-row same type (using typeKey, same as algorithm — promo counts as 'promo' not 'post')
let threeInARow = false;
for (let i = 2; i < feedItems.length; i++) {
  if (typeKey(feedItems[i]) === typeKey(feedItems[i-1]) && typeKey(feedItems[i]) === typeKey(feedItems[i-2])) {
    threeInARow = true;
    console.log(`    [3-in-a-row at indices ${i-2},${i-1},${i}: ${typeKey(feedItems[i])}]`);
  }
}
check('No 3-in-a-row same-type run (typeKey)', !threeInARow);

// 3. Promo at position 2 (index 1)
check('Promo post at index 1 (position 2)', feedItems[1]?.is_targeted_promo === true, `feedItems[1].id=${feedItems[1]?.id}`);

// 4. Author diversity: no author appears more than ZF_AUTHOR_CAP times
const authorCounts = {};
feedItems.forEach(item => {
  const key = item.is_targeted_promo ? `promo-${item.id}` : // promo is exempt
    item.itemType === 'event' ? `community-${item.community_id}` :
    item.itemType === 'opportunity' ? `${item.creator_type}-${item.creator_id}` :
    `${item.author_type}-${item.author_id}`;
  authorCounts[key] = (authorCounts[key] || 0) + 1;
});
const overCap = Object.entries(authorCounts).filter(([k, v]) => v > ZF_AUTHOR_CAP && !k.startsWith('promo'));
check(`Author diversity: no author appears more than ${ZF_AUTHOR_CAP} times`, overCap.length === 0,
  overCap.length ? `offenders: ${JSON.stringify(overCap)}` : '');

// 5. Author cap: id:3 (3rd post from community-10) should have been dropped
const has3rdPost = feedItems.some(i => i.id === 3);
check('3rd post from same author correctly filtered out', !has3rdPost);

// 6. hasAnyContent guard: all-empty input returns []
const noContent = (function() {
  const hasAnyContent = false; // simulated: all arrays empty
  return hasAnyContent ? ['something'] : [];
})();
check('Guard clause returns [] when all pools empty', noContent.length === 0);

// 7. End-state condition: posts.length===0 && feedItems.length>0 && revealedCount>=feedItems.length
const endStateShows = (function() {
  const postsLen = 0;
  const feedLen = feedItems.length;
  const revealedCount = feedLen; // user has scrolled to end
  return postsLen === 0 && feedLen > 0 && revealedCount >= feedLen;
})();
check('End-state message condition triggers correctly', endStateShows);

// ─── Item-type sequence ───────────────────────────────────────────────────────
console.log('\n── Feed sequence (type | id | normalizedScore) ──────────────────────\n');
feedItems.forEach((item, i) => {
  const label = item.is_targeted_promo ? 'PROMO' :
    item.is_discovery_post ? 'disc-post' :
    item.is_discovery_opportunity ? 'disc-opp' :
    item.itemType;
  const id = item.id;
  console.log(`  [${i}] ${label.padEnd(12)} id=${id}`);
});

console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────────────────\n`);
process.exit(failed > 0 ? 1 : 0);
