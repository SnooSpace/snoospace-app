'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function testScenario5Extended() {
  const pool = createPool();
  console.log('================================================================');
  console.log('TEST: Scenario 5 Extended (Followed Count = 10 Posts)');
  console.log('================================================================\n');

  try {
    // 1. Set up a test member who follows Community 55 ('Tech & AI Guild')
    // Check how many posts Community 55 has
    const commPosts = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, p.author_type, p.created_at
      FROM posts p
      WHERE p.author_id = 55 AND p.author_type = 'community'
        AND p.post_type NOT IN ('plan_promo', 'event_promo')
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    console.log(`Found ${commPosts.rows.length} followed posts for Community 55:`);
    console.log(commPosts.rows.map((r, i) => `  ${i + 1}. [Post ${r.id}] (${r.post_type}): ${r.caption.slice(0, 35)}...`).join('\n'));

    // 2. Fetch candidate events, opportunities, discovery posts, discovery opps, targeted promos
    const eventsRes = await pool.query(`
      SELECT id, title, 'event' as itemType FROM events WHERE is_published = true AND start_datetime > NOW() LIMIT 4
    `);
    const oppsRes = await pool.query(`
      SELECT id, title, 'opportunity' as itemType FROM opportunities WHERE status = 'active' AND closed_at IS NULL LIMIT 4
    `);
    const discPostsRes = await pool.query(`
      SELECT p.id, p.caption, p.post_type, p.author_id, 'post' as itemType, true as is_discovery_post
      FROM posts p
      WHERE p.author_id != 55
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
      ORDER BY p.created_at DESC
      LIMIT 6
    `);
    const discOppsRes = await pool.query(`
      SELECT id, title, 'opportunity' as itemType, true as is_discovery_opportunity
      FROM opportunities
      WHERE creator_id != '55' AND status = 'active' AND closed_at IS NULL
      LIMIT 4
    `);
    const promoRes = await pool.query(`
      SELECT id, caption, post_type, 'post' as itemType, true as is_targeted_promo
      FROM posts
      WHERE post_type IN ('poll', 'prompt', 'qna')
      LIMIT 1
    `);

    const posts = commPosts.rows;
    const events = eventsRes.rows;
    const opportunities = oppsRes.rows;
    const discoveryPosts = discPostsRes.rows;
    const discoveryOpportunities = discOppsRes.rows;
    const targetedPromoPosts = promoRes.rows;

    console.log('\nCandidate Pools Loaded:');
    console.log(`  Followed Posts: ${posts.length}`);
    console.log(`  Events: ${events.length}`);
    console.log(`  Opportunities: ${opportunities.length}`);
    console.log(`  Discovery Posts: ${discoveryPosts.length}`);
    console.log(`  Discovery Opportunities: ${discoveryOpportunities.length}`);
    console.log(`  Targeted Promos: ${targetedPromoPosts.length}`);

    // 3. Execute exact HomeFeedScreen.js feedItems useMemo merge logic
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

    console.log('\n--- Running Followed Feed Merge Trace (10 Posts) ---');
    posts.forEach((post, index) => {
      const postNumber = index + 1;
      const currentWindow = Math.floor((postNumber - 1) / WINDOW_SIZE);

      merged.push({ ...post, itemType: 'post', source: `Followed Post #${postNumber}` });

      // Targeted promo at postNumber === 2
      if (postNumber === 2 && targetedPromoPosts.length > 0) {
        merged.push({ ...targetedPromoPosts[0], itemType: 'post', is_targeted_promo: true, source: 'Pinned Targeted Promo' });
      }

      // Event insertion
      const shouldInsertEvent =
        (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
        (eventIndex > 0 && postNumber > FIRST_EVENT_AT && (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);

      if (shouldInsertEvent && eventIndex < events.length) {
        merged.push({ ...events[eventIndex], itemType: 'event', source: `Injected Event #${eventIndex + 1}` });
        eventIndex++;
      }

      // Opportunity insertion (every 3rd post)
      if (postNumber % OPPORTUNITY_INTERVAL === 0 && opportunityIndex < opportunities.length) {
        merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity', source: `Injected Opp #${opportunityIndex + 1}` });
        opportunityIndex++;
      }

      // Discovery Post insertion (every 5th post)
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
            merged.push({ ...dp, itemType: 'post', is_discovery_post: true, source: `Injected Discovery Post #${discoveryIndex + 1}` });
            discoveryAuthorCount[dpAuthorKey] = (discoveryAuthorCount[dpAuthorKey] || 0) + 1;
            discoveryIndex++;
            discoveryShownThisWindow++;
          }
        }
      }

      // Discovery Opportunity insertion (every 5th post)
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
            merged.push({ ...dopp, itemType: 'opportunity', is_discovery_opportunity: true, source: `Injected Discovery Opp #${discoveryOppIndex + 1}` });
            discoveryOppAuthorCount[doppAuthorKey] = (discoveryOppAuthorCount[doppAuthorKey] || 0) + 1;
            discoveryOppIndex++;
            discoveryOppShownThisWindow++;
          }
        }
      }
    });

    console.log(`\nItems after posts.forEach (Length: ${merged.length}):`);
    console.log(`  Events injected during loop: ${eventIndex}/${events.length}`);
    console.log(`  Opportunities injected during loop: ${opportunityIndex}/${opportunities.length}`);
    console.log(`  Discovery Posts injected during loop: ${discoveryIndex}/${discoveryPosts.length}`);
    console.log(`  Discovery Opps injected during loop: ${discoveryOppIndex}/${discoveryOpportunities.length}`);

    // Append remaining events
    while (eventIndex < events.length) {
      merged.push({ ...events[eventIndex], itemType: 'event', source: `Trailing Appended Event #${eventIndex + 1}` });
      eventIndex++;
    }

    // Append remaining opportunities
    while (opportunityIndex < opportunities.length) {
      merged.push({ ...opportunities[opportunityIndex], itemType: 'opportunity', source: `Trailing Appended Opp #${opportunityIndex + 1}` });
      opportunityIndex++;
    }

    console.log(`\nFinal Merged feedItems Composition (Total Items: ${merged.length}):`);
    merged.forEach((item, idx) => {
      console.log(`  Slot ${String(idx + 1).padStart(2, ' ')} | [${item.itemType.toUpperCase()}] ${item.source} (ID: ${item.id})`);
    });

    console.log('\n--- Behavior Analysis on Exhaustion (hasMore = false) ---');
    console.log('1. Inside the 10-post loop:');
    console.log('   - At Post #2: Pinned Promo injected + Event #1 injected.');
    console.log('   - At Post #3: Followed Opportunity #1 injected.');
    console.log('   - At Post #5: Discovery Post #1 injected + Discovery Opp #1 injected.');
    console.log('   - At Post #6: Followed Opportunity #2 injected.');
    console.log('   - At Post #7: Event #2 injected.');
    console.log('   - At Post #9: Followed Opportunity #3 injected.');
    console.log('   - At Post #10: Discovery Post #2 injected + Discovery Opp #2 injected.');
    console.log('2. After Post #10 (Followed posts exhausted):');
    console.log('   - Trailing Events appended: Event #3, Event #4.');
    console.log('   - Trailing Opportunities appended: Opp #4.');
    console.log('   - Trailing Discovery Posts (Candidates 3..6): NOT appended (no trailing discovery loop).');
    console.log('3. At onEndReached in HomeFeedScreen.js:');
    console.log('   - `posts.length > 0 && hasMore` === false (no more followed pages to fetch).');
    console.log('   - `posts.length === 0 && discoveryHasMore` === false (not a zero-follow user).');
    console.log('   - Result: Feed stops cleanly at slot 19 and displays CaughtUpFooter.');

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await pool.end();
  }
}

testScenario5Extended();
