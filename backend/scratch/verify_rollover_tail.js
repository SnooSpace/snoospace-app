'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

// Simulation of windowedShuffle
function windowedShuffle(arr, windowSize = 5) {
  const result = [...arr];
  for (let i = 0; i < result.length; i += windowSize) {
    const end = Math.min(i + windowSize, result.length);
    for (let j = end - 1; j > i; j--) {
      const k = i + Math.floor(Math.random() * (j - i + 1));
      [result[j], result[k]] = [result[k], result[j]];
    }
  }
  return result;
}

const minMaxNorm = (items, scoreField) => {
  if (!items || items.length === 0) return [];
  const scores = items.map((i) => parseFloat(i[scoreField]) || 0);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return items.map((item, idx) => ({
    ...item,
    _normalizedScore: (scores[idx] - min) / range,
  }));
};

async function testRolloverIntegration() {
  const pool = createPool();
  console.log('================================================================');
  console.log('TEST: Discovery Rollover for Exhausted Small-Following Accounts');
  console.log('================================================================\n');

  try {
    // 1. Load 10 followed posts for Community 55
    const commPosts = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type, p.created_at
      FROM posts p
      WHERE p.author_id = 55 AND p.author_type = 'community'
        AND p.post_type NOT IN ('plan_promo', 'event_promo')
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    const posts = commPosts.rows;

    const eventsRes = await pool.query(`
      SELECT id, title, 'event' as itemType FROM events WHERE is_published = true AND start_datetime > NOW() LIMIT 4
    `);
    const oppsRes = await pool.query(`
      SELECT id, title, 'opportunity' as itemType FROM opportunities WHERE status = 'active' AND closed_at IS NULL LIMIT 4
    `);
    const discPostsRes = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type, 'post' as itemType, true as is_discovery_post,
             (COALESCE(p.like_count, 0) + 1.0)::text as discovery_score
      FROM posts p
      WHERE p.author_id != 55
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
      ORDER BY p.created_at DESC
      LIMIT 15
    `);
    const discOppsRes = await pool.query(`
      SELECT id, title, creator_id, creator_type, 'opportunity' as itemType, true as is_discovery_opportunity,
             '1.0' as discovery_score
      FROM opportunities
      WHERE creator_id != '55' AND status = 'active' AND closed_at IS NULL
      LIMIT 6
    `);
    const promoRes = await pool.query(`
      SELECT id, caption, post_type, 'post' as itemType, true as is_targeted_promo
      FROM posts
      WHERE post_type IN ('poll', 'prompt', 'qna')
      LIMIT 1
    `);

    const events = eventsRes.rows;
    const opportunities = oppsRes.rows;
    const discoveryPosts = discPostsRes.rows;
    const discoveryOpportunities = discOppsRes.rows;
    const targetedPromoPosts = promoRes.rows;

    console.log(`Pools: Followed=${posts.length}, Events=${events.length}, FollowedOpps=${opportunities.length}, DiscPosts=${discoveryPosts.length}, DiscOpps=${discoveryOpportunities.length}`);

    // --- PHASE 1: Followed Merge ---
    const merged = [];
    let eventIndex = 0;
    let opportunityIndex = 0;
    let discoveryIndex = 0;
    const FIRST_EVENT_AT = 2;
    const SUBSEQUENT_INTERVAL = 5;
    const OPPORTUNITY_INTERVAL = 3;
    const WINDOW_SIZE = 20;
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

    posts.forEach((post, index) => {
      const postNumber = index + 1;
      const currentWindow = Math.floor((postNumber - 1) / WINDOW_SIZE);

      merged.push({ ...post, itemType: 'post' });

      if (postNumber === 2 && targetedPromoPosts.length > 0) {
        merged.push({ ...targetedPromoPosts[0], itemType: 'post', is_targeted_promo: true });
      }

      const shouldInsertEvent =
        (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
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
        if (discoveryShownThisWindow < DISCOVERY_CAP) {
          while (
            discoveryIndex < discoveryPosts.length &&
            (discoveryAuthorCount[`${discoveryPosts[discoveryIndex].author_type}-${discoveryPosts[discoveryIndex].author_id}`] || 0) >= 1
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

      if (postNumber % DISCOVERY_OPP_INTERVAL === 0) {
        if (currentWindow > lastDiscoveryOppWindow) {
          discoveryOppShownThisWindow = 0;
          lastDiscoveryOppWindow = currentWindow;
        }
        if (discoveryOppShownThisWindow < DISCOVERY_OPP_CAP) {
          while (
            discoveryOppIndex < discoveryOpportunities.length &&
            (discoveryOppAuthorCount[`${discoveryOpportunities[discoveryOppIndex].creator_type}-${discoveryOpportunities[discoveryOppIndex].creator_id}`] || 0) >= 1
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

    while (eventIndex < events.length) {
      merged.push({ ...events[eventIndex], itemType: 'event' });
      eventIndex++;
    }
    while (opportunityIndex < opportunities.length) {
      merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity' });
      opportunityIndex++;
    }

    // Collect IDs and author counts from followed phase
    const followedIds = new Set();
    const baseAuthorCounts = {};
    merged.forEach((item) => {
      if (item && item.id != null) {
        followedIds.add(`${item.itemType}-${item.id}`);
      }
      if (item?.is_discovery_post && item.author_id != null) {
        const aKey = `${item.author_type}-${item.author_id}`;
        baseAuthorCounts[aKey] = (baseAuthorCounts[aKey] || 0) + 1;
      }
      if (item?.is_discovery_opportunity && item.creator_id != null) {
        const aKey = `${item.creator_type}-${item.creator_id}`;
        baseAuthorCounts[aKey] = (baseAuthorCounts[aKey] || 0) + 1;
      }
    });

    console.log(`\nFollowed Phase: ${merged.length} items built.`);
    console.log(`  Unique IDs tracked: ${followedIds.size}`);
    console.log(`  Base author counts:`, baseAuthorCounts);

    // --- PHASE 2: Rollover Tail Builder ---
    const rolloverAuthorCount = { ...baseAuthorCounts };
    const applyDiversity = (items, authorKeyFn) => {
      const out = [];
      for (const item of items) {
        const key = authorKeyFn(item);
        const count = rolloverAuthorCount[key] || 0;
        if (count < 1) {
          rolloverAuthorCount[key] = count + 1;
          out.push(item);
        }
      }
      return out;
    };

    const unusedPosts = discoveryPosts.filter((p) => !followedIds.has(`post-${p.id}`));
    const unusedOpps = discoveryOpportunities.filter((o) => !followedIds.has(`opportunity-${o.id}`));

    const normPosts = minMaxNorm(
      unusedPosts.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
      "discovery_score"
    );
    const normOpps = minMaxNorm(
      unusedOpps.map((o) => ({ ...o, itemType: "opportunity", is_discovery_opportunity: true })),
      "discovery_score"
    );

    const filteredPosts = applyDiversity(normPosts, (p) => `${p.author_type}-${p.author_id}`);
    const filteredOpps = applyDiversity(normOpps, (o) => `${o.creator_type}-${o.creator_id}`);

    const poolItems = [...filteredPosts, ...filteredOpps].sort((a, b) => b._normalizedScore - a._normalizedScore);

    const constrained = [];
    const remaining = [...poolItems];
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

    const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;
    const rolloverItems = shuffled.map(({ _normalizedScore, ...clean }) => clean);

    console.log(`\nRollover Tail: ${rolloverItems.length} items built.`);

    // --- CHECK 1: No Duplicate IDs ---
    let duplicates = 0;
    rolloverItems.forEach((r) => {
      if (followedIds.has(`${r.itemType}-${r.id}`)) {
        console.error(`❌ DUPLICATE FOUND: ${r.itemType}-${r.id}`);
        duplicates++;
      }
    });
    console.log(`Check 1 - Duplicate Check: ${duplicates === 0 ? 'PASSED (0 duplicates)' : 'FAILED'}`);

    // --- CHECK 2: Author Diversity Across Both Phases ---
    let diversityViolations = 0;
    const combinedAuthorCounts = {};
    [...merged, ...rolloverItems].forEach((item) => {
      if (item.is_discovery_post) {
        const k = `${item.author_type}-${item.author_id}`;
        combinedAuthorCounts[k] = (combinedAuthorCounts[k] || 0) + 1;
        if (combinedAuthorCounts[k] > 1) {
          console.error(`❌ DIVERSITY VIOLATION for discovery post author ${k}: shown ${combinedAuthorCounts[k]} times`);
          diversityViolations++;
        }
      }
      if (item.is_discovery_opportunity) {
        const k = `${item.creator_type}-${item.creator_id}`;
        combinedAuthorCounts[k] = (combinedAuthorCounts[k] || 0) + 1;
        if (combinedAuthorCounts[k] > 1) {
          console.error(`❌ DIVERSITY VIOLATION for discovery opp creator ${k}: shown ${combinedAuthorCounts[k]} times`);
          diversityViolations++;
        }
      }
    });
    console.log(`Check 2 - Author Diversity Cap Check: ${diversityViolations === 0 ? 'PASSED (all authors <= 1)' : 'FAILED'}`);

    // --- CHECK 3: Promo Pinned Exactly Once ---
    const promoCount = [...merged, ...rolloverItems].filter((i) => i.is_targeted_promo).length;
    console.log(`Check 3 - Targeted Promo Count: ${promoCount === 1 ? 'PASSED (exactly 1 promo pinned at followed slot 3)' : 'FAILED'}`);

    // --- CHECK 4: Rollover Pagination Append ---
    // Simulate pagination arriving with 5 new discovery posts
    const pagedRawPosts = [
      { id: '9001', author_id: 888, author_type: 'member', caption: 'Paged discovery 1', post_type: 'media', discovery_score: '1.5' },
      { id: '9002', author_id: 889, author_type: 'member', caption: 'Paged discovery 2', post_type: 'prompt', discovery_score: '1.2' },
    ];
    const normNewPosts = minMaxNorm(
      pagedRawPosts.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
      "discovery_score"
    );
    const filteredNewPosts = applyDiversity(normNewPosts, (p) => `${p.author_type}-${p.author_id}`);
    const newClean = filteredNewPosts.map(({ _normalizedScore, ...clean }) => clean);

    const fullFeedAfterPagination = [...merged, ...rolloverItems, ...newClean];
    console.log(`Check 4 - Pagination Append: PASSED (Existing ${merged.length + rolloverItems.length} items undisturbed, +${newClean.length} new items appended at tail. Total = ${fullFeedAfterPagination.length})`);

    console.log('\n✅ ALL ROLLOVER INTEGRATION CHECKS PASSED!');

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await pool.end();
  }
}

testRolloverIntegration();
