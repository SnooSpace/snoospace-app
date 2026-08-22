'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Import controllers
const postController = require('../controllers/postController');
const eventController = require('../controllers/eventController');
const opportunityController = require('../controllers/opportunityController');

// Mock req / res helpers
function createMockReqRes(userId, userType = 'member', query = {}) {
  const req = {
    user: { id: userId, type: userType },
    query,
    app: {
      locals: {
        pool,
      },
    },
  };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };
  return { req, res, getResult: () => ({ statusCode, data: responseData }) };
}

async function main() {
  const ZERO_FOLLOW_USER_ID = 130;
  console.log(`\n================ AUDIT: ZERO-FOLLOW COLD-START (Member ID=${ZERO_FOLLOW_USER_ID}) ================\n`);

  // 1. getFeed
  const feedMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
  await postController.getFeed(feedMock.req, feedMock.res);
  const feedResult = feedMock.getResult();
  const feedPosts = feedResult.data?.posts || [];
  console.log(`1. getFeed:`);
  console.log(`   Status: ${feedResult.statusCode}`);
  console.log(`   Returned posts count: ${feedPosts.length}`);
  console.log(`   Raw response:`, JSON.stringify(feedResult.data, null, 2));

  // 2. getDiscoveryPosts
  const discMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '10' });
  await postController.getDiscoveryPosts(discMock.req, discMock.res);
  const discResult = discMock.getResult();
  const discPosts = discResult.data?.posts || [];
  console.log(`\n2. getDiscoveryPosts (GET /posts/discovery):`);
  console.log(`   Status: ${discResult.statusCode}`);
  console.log(`   Returned posts count: ${discPosts.length}`);
  if (discPosts.length > 0) {
    console.log(`   Sample post IDs & types:`, discPosts.map(p => ({ id: p.id, post_type: p.post_type, author_id: p.author_id })));
  }

  // 3. discoverEvents
  const eventMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
  await eventController.discoverEvents(eventMock.req, eventMock.res);
  const eventResult = eventMock.getResult();
  const events = eventResult.data?.events || eventResult.data || [];
  const eventList = Array.isArray(events) ? events : (events.events || []);
  console.log(`\n3. discoverEvents (GET /events/discover):`);
  console.log(`   Status: ${eventResult.statusCode}`);
  console.log(`   Returned events count: ${eventList.length}`);
  if (eventList.length > 0) {
    console.log(`   Sample event IDs:`, eventList.slice(0, 5).map(e => ({ id: e.id, title: e.title })));
  }

  // 4. getDiscoveryOpportunities
  const oppMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
  await opportunityController.getDiscoveryOpportunities(oppMock.req, oppMock.res);
  const oppResult = oppMock.getResult();
  const opps = oppResult.data?.opportunities || oppResult.data || [];
  const oppList = Array.isArray(opps) ? opps : (opps.opportunities || []);
  console.log(`\n4. getDiscoveryOpportunities (GET /opportunities/discovery):`);
  console.log(`   Status: ${oppResult.statusCode}`);
  console.log(`   Returned opportunities count: ${oppList.length}`);
  if (oppList.length > 0) {
    console.log(`   Sample opp IDs:`, oppList.slice(0, 5).map(o => ({ id: o.id, title: o.title })));
  }

  // 5. getPromoTargeted
  const promoMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', {});
  await postController.getPromoTargeted(promoMock.req, promoMock.res);
  const promoResult = promoMock.getResult();
  const promoPosts = promoResult.data?.posts || [];
  console.log(`\n5. getPromoTargeted (GET /posts/promo-targeted):`);
  console.log(`   Status: ${promoResult.statusCode}`);
  console.log(`   Returned promo posts count: ${promoPosts.length}`);

  // 6. End-to-end feedItems simulation
  console.log(`\n================ END-TO-END FEEDITEMS SIMULATION ================\n`);
  
  // Extract pure feedItems useMemo logic as in HomeFeedScreen.js
  function simulateFeedItems({
    posts = [],
    events = [],
    opportunities = [],
    discoveryPosts = [],
    discoveryOpportunities = [],
    targetedPromoPosts = [],
  }) {
    if (
      posts.length === 0 &&
      events.length === 0 &&
      opportunities.length === 0
    ) {
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

        if (post.is_backlog_post) {
          const authorKey = `${post.author_type}-${post.author_id}`;
          const windowKey = `${authorKey}__w${currentWindow}`;
          const seenThisWindow = backlogWindowCount[windowKey] || 0;
          if (seenThisWindow >= BACKLOG_CAP) return;
          backlogWindowCount[windowKey] = seenThisWindow + 1;
          backlogAuthorCount[authorKey] = (backlogAuthorCount[authorKey] || 0) + 1;
        }

        merged.push({ ...post, itemType: 'post' });

        if (postNumber === 2 && targetedPromoPosts.length > 0) {
          merged.push({
            ...targetedPromoPosts[0],
            itemType: 'post',
            is_targeted_promo: true,
          });
        }

        const shouldInsertEvent =
          (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
          (eventIndex > 0 &&
            postNumber > FIRST_EVENT_AT &&
            (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);

        if (shouldInsertEvent && eventIndex < events.length) {
          merged.push({ ...events[eventIndex], itemType: 'event' });
          eventIndex++;
        }

        if (
          postNumber % OPPORTUNITY_INTERVAL === 0 &&
          opportunityIndex < opportunities.length
        ) {
          merged.push({
            ...opportunities[opportunityIndex],
            itemType: 'opportunity',
          });
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
              (discoveryAuthorCount[
                `${discoveryPosts[discoveryIndex].author_type}-${discoveryPosts[discoveryIndex].author_id}`
              ] || 0) >= 1
            ) {
              discoveryIndex++;
            }
            if (discoveryIndex < discoveryPosts.length) {
              const dp = discoveryPosts[discoveryIndex];
              const dpAuthorKey = `${dp.author_type}-${dp.author_id}`;
              merged.push({
                ...dp,
                itemType: 'post',
                is_discovery_post: true,
              });
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
              (discoveryOppAuthorCount[
                `${discoveryOpportunities[discoveryOppIndex].creator_type}-${discoveryOpportunities[discoveryOppIndex].creator_id}`
              ] || 0) >= 1
            ) {
              discoveryOppIndex++;
            }
            if (discoveryOppIndex < discoveryOpportunities.length) {
              const dopp = discoveryOpportunities[discoveryOppIndex];
              const doppAuthorKey = `${dopp.creator_type}-${dopp.creator_id}`;
              merged.push({
                ...dopp,
                itemType: 'opportunity',
                is_discovery_opportunity: true,
              });
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
        merged.push({
          ...opportunities[opportunityIndex],
          itemType: 'opportunity',
        });
        opportunityIndex++;
      }
    } else {
      // If no posts, just show events then opportunities
      events.forEach((event) => {
        merged.push({ ...event, itemType: 'event' });
      });
      opportunities.forEach((opp) => {
        merged.push({ ...opp, itemType: 'opportunity' });
      });
    }

    return merged;
  }

  const renderedArray = simulateFeedItems({
    posts: feedPosts,
    events: eventList,
    opportunities: oppList,
    discoveryPosts: discPosts,
    discoveryOpportunities: oppList,
    targetedPromoPosts: promoPosts,
  });

  console.log(`Feed state inputs to feedItems:`);
  console.log(`  posts: ${feedPosts.length}`);
  console.log(`  events: ${eventList.length}`);
  console.log(`  opportunities: ${oppList.length}`);
  console.log(`  discoveryPosts: ${discPosts.length}`);
  console.log(`  discoveryOpportunities: ${oppList.length}`);
  console.log(`  targetedPromoPosts: ${promoPosts.length}`);
  console.log(`\nResult of feedItems (merged array):`);
  console.log(`  merged.length: ${renderedArray.length}`);
  console.log(`  itemTypes in renderedArray:`, renderedArray.map(item => item.itemType));
  console.log(`  discoveryPosts rendered?`, renderedArray.some(item => item.is_discovery_post));
  console.log(`  targetedPromo rendered?`, renderedArray.some(item => item.is_targeted_promo));
  console.log(`  discoveryOpp rendered?`, renderedArray.some(item => item.is_discovery_opportunity));

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
