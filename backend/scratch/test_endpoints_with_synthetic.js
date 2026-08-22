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

const postController = require('../controllers/postController');
const eventController = require('../controllers/eventController');
const opportunityController = require('../controllers/opportunityController');

function createMockReqRes(userId, userType = 'member', query = {}) {
  const req = {
    user: { id: userId, type: userType },
    query,
    app: { locals: { pool } },
  };
  let responseData = null;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; },
  };
  return { req, res, getResult: () => ({ statusCode, data: responseData }) };
}

async function main() {
  const c = await pool.connect();
  const ZERO_FOLLOW_USER_ID = 130;

  // Pre-cleanup any previous test artifacts
  await c.query("DELETE FROM posts WHERE caption = 'Fresh discovery post'");
  await c.query("DELETE FROM events WHERE title = 'Fresh future event'");
  await c.query("DELETE FROM opportunities WHERE title = 'Fresh discovery opportunity'");

  try {
    console.log('--- TEST 1: REAL LIVE DATA IN DB (AS IS) ---');
    // getFeed
    const fMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
    await postController.getFeed(fMock.req, fMock.res);
    console.log('1. getFeed rows:', fMock.getResult().data?.posts?.length ?? 0);

    // getDiscoveryPosts
    const dMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '10' });
    await postController.getDiscoveryPosts(dMock.req, dMock.res);
    console.log('2. getDiscoveryPosts rows:', dMock.getResult().data?.posts?.length ?? 0);

    // discoverEvents
    const eMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
    await eventController.discoverEvents(eMock.req, eMock.res);
    const evs = eMock.getResult().data?.events || [];
    console.log('3. discoverEvents rows:', evs.length);

    // getDiscoveryOpportunities
    const oMock = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
    await opportunityController.getDiscoveryOpportunities(oMock.req, oMock.res);
    const opps = oMock.getResult().data?.opportunities || [];
    console.log('4. getDiscoveryOpportunities rows:', opps.length);

    console.log('\n--- TEST 2: WITH FRESH ACTIVE SYNTHETIC CANDIDATES (NO FOLLOWS) ---');
    // Insert:
    // 1. Fresh post (< 5 days old) by member 51
    const pRes = await c.query(`
      INSERT INTO posts (author_id, author_type, post_type, caption, image_urls, media_types, status, created_at)
      VALUES (51, 'member', 'media', 'Fresh discovery post', '{}', '{}', 'active', NOW() - INTERVAL '1 hour')
      RETURNING id
    `);
    const synthPostId = pRes.rows[0].id;

    // 2. Future public event by community 54
    const eRes = await c.query(`
      INSERT INTO events (community_id, title, is_published, event_date, start_datetime, end_datetime, access_type, status, created_at)
      VALUES (54, 'Fresh future event', true, '2026-08-24', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 'public', 'active', NOW())
      RETURNING id
    `);
    const synthEventId = eRes.rows[0].id;

    // 3. Active opportunity by community 54
    const oRes = await c.query(`
      INSERT INTO opportunities (creator_id, creator_type, title, status, created_at, expires_at, opportunity_types, availability, turnaround)
      VALUES ('54', 'community', 'Fresh discovery opportunity', 'active', NOW(), NOW() + INTERVAL '10 days', '{"internship"}', 'part_time', 'standard')
      RETURNING id
    `);
    const synthOppId = oRes.rows[0].id;

    try {
      // Re-query with fresh data
      // 1. getFeed (should STILL be 0 because 0 follows)
      const fMock2 = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
      await postController.getFeed(fMock2.req, fMock2.res);
      const feedPosts = fMock2.getResult().data?.posts || [];
      console.log('1. getFeed rows (0 follows):', feedPosts.length);

      // 2. getDiscoveryPosts (should return the fresh post!)
      const dMock2 = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '10' });
      await postController.getDiscoveryPosts(dMock2.req, dMock2.res);
      const discPosts = dMock2.getResult().data?.posts || [];
      console.log('2. getDiscoveryPosts rows (independent discovery):', discPosts.length);
      console.log('   discovery post id:', discPosts.map(p => p.id));

      // 3. discoverEvents (should return the future event!)
      const eMock2 = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
      await eventController.discoverEvents(eMock2.req, eMock2.res);
      const discEvents = eMock2.getResult().data?.events || [];
      console.log('3. discoverEvents rows (independent discovery):', discEvents.length);
      console.log('   event id:', discEvents.map(e => e.id));

      // 4. getDiscoveryOpportunities (should return the active opportunity!)
      const oMock2 = createMockReqRes(ZERO_FOLLOW_USER_ID, 'member', { limit: '20' });
      await opportunityController.getDiscoveryOpportunities(oMock2.req, oMock2.res);
      const discOpps = oMock2.getResult().data?.opportunities || [];
      console.log('4. getDiscoveryOpportunities rows (independent discovery):', discOpps.length);
      console.log('   opp id:', discOpps.map(o => o.id));

      // 5. NOW SIMULATE feedItems useMemo:
      // What happens when posts = [] (0 follows), but discoveryPosts = [1], events = [1], opportunities = [1] ???
      console.log('\n--- TEST 3: FEEDITEMS useMemo WITH posts=[] BUT DISCOVERY CONTENT AVAILABLE ---');
      
      // FeedItems simulation function exactly matching HomeFeedScreen.js:
      function simulateFeedItems({ posts, events, opportunities, discoveryPosts, discoveryOpportunities, targetedPromoPosts }) {
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

      // Case A: posts = [] (0 follows), but discoveryPosts=[1], events=[1], opportunities=[1]
      const renderedA = simulateFeedItems({
        posts: [],
        events: discEvents,
        opportunities: discOpps,
        discoveryPosts: discPosts,
        discoveryOpportunities: discOpps,
        targetedPromoPosts: [],
      });
      console.log('Case A: posts=0, events=1, opportunities=1, discoveryPosts=1');
      console.log('  Rendered items count:', renderedA.length);
      console.log('  Rendered items breakdown:', renderedA.map(i => ({ itemType: i.itemType, id: i.id, is_discovery_post: i.is_discovery_post })));

      // Case B: posts = [] (0 follows), events = [], opportunities = [] (only discoveryPosts = [1])
      const renderedB = simulateFeedItems({
        posts: [],
        events: [],
        opportunities: [],
        discoveryPosts: discPosts,
        discoveryOpportunities: discOpps,
        targetedPromoPosts: [],
      });
      console.log('\nCase B: posts=0, events=0, opportunities=0 (ONLY discoveryPosts=1 available)');
      console.log('  Rendered items count:', renderedB.length);
      console.log('  Rendered items breakdown:', renderedB);

    } finally {
      // Clean up synthetic rows
      await c.query('DELETE FROM posts WHERE id = $1', [synthPostId]);
      await c.query('DELETE FROM events WHERE id = $1', [synthEventId]);
      await c.query('DELETE FROM opportunities WHERE id = $1', [synthOppId]);
      console.log('\nSynthetic test data cleaned up.');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
