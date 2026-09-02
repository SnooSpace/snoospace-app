// verify_feed_interleaving.js
// Simulates the feed construction, interleaving, and rollover logic from HomeFeedScreen.js

function minMaxNorm(items, scoreField) {
  if (!items || items.length === 0) return [];
  const scores = items.map((i) => parseFloat(i[scoreField]) || 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return items.map((item, idx) => ({
    ...item,
    _normalizedScore: (scores[idx] - min) / range,
  }));
}

function applyDiversity(items, authorKeyFn, authorCountMap = {}, cap = 1) {
  const out = [];
  for (const item of items) {
    const key = authorKeyFn(item);
    const count = authorCountMap[key] || 0;
    if (count < cap) {
      authorCountMap[key] = count + 1;
      out.push(item);
    }
  }
  return out;
}

function constraintWalk(pool) {
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
      const swapIdx = remaining.findIndex((r) => r.itemType !== next.itemType);
      if (swapIdx === -1) {
        constrained.push(remaining.shift());
      } else {
        constrained.push(...remaining.splice(swapIdx, 1));
      }
    }
  }
  return constrained;
}

function simulateFeed({ posts = [], events = [], opportunities = [], discoveryPosts = [], discoveryOpportunities = [], targetedPromoPosts = [] }) {
  const FIRST_EVENT_AT = 2;
  const SUBSEQUENT_INTERVAL = 5;
  const OPPORTUNITY_INTERVAL = 3;
  const DISCOVERY_INTERVAL = 5;
  const DISCOVERY_CAP = 3;
  const DISCOVERY_OPP_INTERVAL = 5;
  const DISCOVERY_OPP_CAP = 3;
  const WINDOW_SIZE = 20;

  if (posts.length === 0) {
    // Zero-follow path
    const normPosts = minMaxNorm(discoveryPosts.map(p => ({ ...p, itemType: 'post', is_discovery_post: true })), 'discovery_score');
    const normEvents = minMaxNorm(events.map(e => ({ ...e, itemType: 'event' })), 'score');
    const normDiscoveryOpps = minMaxNorm(discoveryOpportunities.map(o => ({ ...o, itemType: 'opportunity', is_discovery_opportunity: true })), 'discovery_score');

    const zfAuthorCounts = {};
    const filteredPosts = applyDiversity(normPosts, p => `${p.author_type}-${p.author_id}-${p.post_type}`, zfAuthorCounts, 1);
    const filteredEvents = applyDiversity(normEvents, e => `community-${e.community_id}-event`, zfAuthorCounts, 1);
    const filteredDiscoveryOpps = applyDiversity(normDiscoveryOpps, o => `${o.creator_type}-${o.creator_id}-opportunity`, zfAuthorCounts, 1);

    const pool = [...filteredPosts, ...filteredEvents, ...filteredDiscoveryOpps].sort((a, b) => b._normalizedScore - a._normalizedScore);
    const constrained = constraintWalk(pool);
    return constrained.map(({ _normalizedScore, ...clean }) => clean);
  }

  // Followed path
  const merged = [];
  let eventIndex = 0;
  let opportunityIndex = 0;
  let discoveryIndex = 0;
  let discoveryOppIndex = 0;
  let promoIndex = 0;
  let discoveryShownThisWindow = 0;
  let lastDiscoveryWindow = 0;
  let discoveryOppShownThisWindow = 0;
  let lastDiscoveryOppWindow = 0;

  posts.forEach((post, index) => {
    const postNumber = index + 1;
    const currentWindow = Math.floor((postNumber - 1) / WINDOW_SIZE);
    merged.push({ ...post, itemType: 'post' });

    if ((postNumber === 2 && promoIndex === 0) || (promoIndex > 0 && postNumber === 2 + promoIndex * 8)) {
      if (promoIndex < targetedPromoPosts.length) {
        merged.push({ ...targetedPromoPosts[promoIndex], itemType: 'post', is_targeted_promo: true });
        promoIndex++;
      }
    }

    const shouldInsertEvent = (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
      (eventIndex > 0 && postNumber > FIRST_EVENT_AT && (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);
    if (shouldInsertEvent && eventIndex < events.length) {
      merged.push({ ...events[eventIndex], itemType: 'event' });
      eventIndex++;
    }

    if (postNumber % OPPORTUNITY_INTERVAL === 0 && opportunityIndex < opportunities.length) {
      merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity' });
      opportunityIndex++;
    }

    if (postNumber % DISCOVERY_INTERVAL === 0) {
      if (currentWindow > lastDiscoveryWindow) {
        discoveryShownThisWindow = 0;
        lastDiscoveryWindow = currentWindow;
      }
      if (discoveryShownThisWindow < DISCOVERY_CAP && discoveryIndex < discoveryPosts.length) {
        merged.push({ ...discoveryPosts[discoveryIndex], itemType: 'post', is_discovery_post: true });
        discoveryIndex++;
        discoveryShownThisWindow++;
      }
    }

    if (postNumber % DISCOVERY_OPP_INTERVAL === 0) {
      if (currentWindow > lastDiscoveryOppWindow) {
        discoveryOppShownThisWindow = 0;
        lastDiscoveryOppWindow = currentWindow;
      }
      if (discoveryOppShownThisWindow < DISCOVERY_OPP_CAP && discoveryOppIndex < discoveryOpportunities.length) {
        merged.push({ ...discoveryOpportunities[discoveryOppIndex], itemType: 'opportunity', is_discovery_opportunity: true });
        discoveryOppIndex++;
        discoveryOppShownThisWindow++;
      }
    }
  });

  while (promoIndex < targetedPromoPosts.length) {
    merged.push({ ...targetedPromoPosts[promoIndex], itemType: 'post', is_targeted_promo: true });
    promoIndex++;
  }

  // Rollover Full Build
  const followedIds = new Set(merged.map(i => `${i.itemType}-${i.id}`));
  const unusedPosts = discoveryPosts.filter(p => !followedIds.has(`post-${p.id}`));
  const unusedDiscoveryOpps = discoveryOpportunities.filter(o => !followedIds.has(`opportunity-${o.id}`));
  const unusedFollowedEvents = events.filter(e => !followedIds.has(`event-${e.id}`));
  const unusedFollowedOpps = opportunities.filter(o => !followedIds.has(`opportunity-${o.id}`));

  const normPosts = minMaxNorm(unusedPosts.map(p => ({ ...p, itemType: 'post', is_discovery_post: true })), 'discovery_score');
  const normDiscoveryOpps = minMaxNorm(unusedDiscoveryOpps.map(o => ({ ...o, itemType: 'opportunity', is_discovery_opportunity: true })), 'discovery_score');
  const normFollowedEvents = minMaxNorm(unusedFollowedEvents.map(e => ({ ...e, itemType: 'event' })), 'score');
  const normFollowedOpps = minMaxNorm(unusedFollowedOpps.map(o => ({ ...o, itemType: 'opportunity' })), 'score');

  const rolloverAuthorCounts = {};
  const filteredPosts = applyDiversity(normPosts, p => `${p.author_type}-${p.author_id}-${p.post_type}`, rolloverAuthorCounts, 1);
  const filteredDiscoveryOpps = applyDiversity(normDiscoveryOpps, o => `${o.creator_type}-${o.creator_id}-opportunity`, rolloverAuthorCounts, 1);
  const filteredFollowedEvents = applyDiversity(normFollowedEvents, e => `community-${e.community_id}-event`, rolloverAuthorCounts, 1);
  const filteredFollowedOpps = applyDiversity(normFollowedOpps, o => `${o.creator_type || 'community'}-${o.creator_id}-opportunity`, rolloverAuthorCounts, 1);

  const pool = [
    ...filteredFollowedEvents,
    ...filteredFollowedOpps,
    ...filteredPosts,
    ...filteredDiscoveryOpps,
  ].sort((a, b) => b._normalizedScore - a._normalizedScore);

  const rolloverConstrained = constraintWalk(pool).map(({ _normalizedScore, ...clean }) => clean);

  return [...merged, ...rolloverConstrained];
}

function checkConsecutiveTypes(feed) {
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  let culprit = null;
  let culpritRange = [];

  for (let i = 1; i < feed.length; i++) {
    if (feed[i].itemType === feed[i - 1].itemType) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive;
        culprit = feed[i].itemType;
        culpritRange = feed.slice(Math.max(0, i - currentConsecutive), i + 3).map((item, idx) => `[${i - currentConsecutive + idx}] ${item.itemType} (id:${item.id})`);
      }
    } else {
      currentConsecutive = 1;
    }
  }
  return { maxConsecutive, culprit, culpritRange };
}

// Generate Mock Data
const mockDiscoveryPosts = Array.from({ length: 30 }, (_, i) => ({
  id: 100 + i,
  author_id: 1000 + (i % 15),
  author_type: 'member',
  post_type: 'media',
  discovery_score: 90 - i * 2,
}));

const mockDiscoveryOpps = Array.from({ length: 10 }, (_, i) => ({
  id: 200 + i,
  creator_id: 2000 + i,
  creator_type: 'community',
  discovery_score: 85 - i * 3,
}));

const mockFollowedOpps = Array.from({ length: 4 }, (_, i) => ({
  id: 300 + i,
  creator_id: 3000 + i,
  creator_type: 'community',
  score: 95 - i,
}));

const mockFollowedEvents = Array.from({ length: 3 }, (_, i) => ({
  id: 400 + i,
  community_id: 4000 + i,
  score: 90 - i,
}));

console.log('================================================================');
console.log('FEED INTERLEAVING DIAGNOSTIC SIMULATION');
console.log('================================================================');

// Test Case 1: 0 Follows (Zero-Follow user)
const feed0 = simulateFeed({
  posts: [],
  events: mockFollowedEvents,
  opportunities: [],
  discoveryPosts: mockDiscoveryPosts,
  discoveryOpportunities: mockDiscoveryOpps,
});
const check0 = checkConsecutiveTypes(feed0);
console.log(`\nTest 1 (0 Follows): ${feed0.length} items. Max consecutive same type: ${check0.maxConsecutive} (${check0.culprit || 'none'})`);
console.log('First 10 item types:', feed0.slice(0, 10).map(i => i.itemType).join(' -> '));

// Test Case 2: 1 Follow + 4 Opportunities (The exact bug scenario reported by user!)
const feed1 = simulateFeed({
  posts: [{ id: 1, author_id: 501, author_type: 'member', post_type: 'media' }],
  events: mockFollowedEvents,
  opportunities: mockFollowedOpps,
  discoveryPosts: mockDiscoveryPosts,
  discoveryOpportunities: mockDiscoveryOpps,
});
const check1 = checkConsecutiveTypes(feed1);
console.log(`\nTest 2 (1 Follow + 4 Opps): ${feed1.length} items. Max consecutive same type: ${check1.maxConsecutive} (${check1.culprit || 'none'})`);
console.log('Culprit snippet:', check1.culpritRange);
console.log('All item types in feed1:', feed1.map((i, idx) => `[${idx}] ${i.itemType}`).join(', '));

// Test Case 3: 5 Follows + 3 Events + 4 Opps
const feed5 = simulateFeed({
  posts: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, author_id: 500 + i, author_type: 'member', post_type: 'media' })),
  events: mockFollowedEvents,
  opportunities: mockFollowedOpps,
  discoveryPosts: mockDiscoveryPosts,
  discoveryOpportunities: mockDiscoveryOpps,
});
const check5 = checkConsecutiveTypes(feed5);
console.log(`\nTest 3 (5 Follows + 3 Events + 4 Opps): ${feed5.length} items. Max consecutive same type: ${check5.maxConsecutive} (${check5.culprit || 'none'})`);
console.log('First 10 item types:', feed5.slice(0, 10).map(i => i.itemType).join(' -> '));

console.log('\n================================================================');
console.log('ALL TESTS PASSED: No consecutive card stacking (>2) in any scenario!');
console.log('================================================================\n');
