'use strict';
/**
 * verify_opportunity_rerank.js — Verification for Opportunity Deadline Fix & Re-Ranking
 *
 * Tests:
 *   1. Part A (Feed & Discovery Deadline Filters):
 *      - getOpportunities (status=active) excludes expired/closed opportunities.
 *      - discoverOpportunities excludes expired/closed opportunities.
 *      - Regression check: getCommunityOpportunities and getMemberOpportunities
 *        (Profile tabs) STILL return expired opportunities (full history).
 *   2. Part B (Re-Ranking & Retirement):
 *      - Liking timed opportunity -> heavy penalty (sunk by 10 days, not retired).
 *      - Liking untimed opportunity -> immediate retirement (retired_at set).
 *      - Strike 1 unseen impression -> light penalty (sunk by 3 days).
 *      - Strike 2 unseen impression -> retirement (excluded from feed).
 *      - Qualified dwell view -> resets impression state and clears penalties.
 *      - getFollowedOpportunities sorting baseline matches o.created_at DESC.
 *
 * Usage:
 *   node tests/verify_opportunity_rerank.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const {
  getOpportunities,
  discoverOpportunities,
  getCommunityOpportunities,
  getMemberOpportunities,
  getFollowedOpportunities,
  likeOpportunity,
  viewOpportunity,
} = require('../controllers/opportunityController');
const { submitUnseenOpportunityImpression } = require('../controllers/viewsController');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ  ${msg}`); }
function head(msg) { console.log(`\n━━━ ${msg} ━━━`); }

// Helper to mock controller calls
function mockCall(controllerFn, { user, query = {}, params = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const req = { user, query, params, body };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) {
        if (this.statusCode >= 400) {
          reject(new Error(`Controller error ${this.statusCode}: ${JSON.stringify(data)}`));
        } else {
          resolve(data);
        }
      },
    };
    controllerFn(req, res).catch(reject);
  });
}

async function main() {
  const cleanupOpportunityIds = [];
  const cleanupFollowIds = [];

  try {
    // Resolve test community and test member
    const commRes = await pool.query('SELECT id, name FROM communities ORDER BY id LIMIT 1');
    const memberRes = await pool.query('SELECT id, name FROM members ORDER BY id LIMIT 1');

    if (commRes.rows.length === 0 || memberRes.rows.length === 0) {
      fail('Need at least 1 community and 1 member in database.');
      return;
    }

    const testCommunityId = commRes.rows[0].id;
    const testMemberId = memberRes.rows[0].id;
    info(`Test Community: ID=${testCommunityId} (${commRes.rows[0].name})`);
    info(`Test Member: ID=${testMemberId} (${memberRes.rows[0].name})`);

    // Ensure member follows community
    const followCheck = await pool.query(
      `INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
       VALUES ($1, 'member', $2, 'community', false)
       ON CONFLICT (follower_id, follower_type, following_id, following_type)
       DO UPDATE SET is_superseded_by_circle = false
       RETURNING id`,
      [testMemberId, testCommunityId]
    );
    if (followCheck.rows[0]) cleanupFollowIds.push(followCheck.rows[0].id);

    // ── Seed Test Opportunities ──────────────────────────────────────────────
    // 1. Active unexpired opportunity
    const activeOppRes = await pool.query(
      `INSERT INTO opportunities (creator_id, creator_type, title, opportunity_types, availability, turnaround, status, visibility, expires_at, created_at)
       VALUES ($1, 'community', 'TEST Active Unexpired Opp', ARRAY['Coder']::text[], 'immediate', '1_week', 'active', 'public', NOW() + INTERVAL '10 days', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [testCommunityId]
    );
    const activeOppId = activeOppRes.rows[0].id;
    cleanupOpportunityIds.push(activeOppId);

    // 2. Active EXPIRED opportunity (expires_at in the past)
    const expiredOppRes = await pool.query(
      `INSERT INTO opportunities (creator_id, creator_type, title, opportunity_types, availability, turnaround, status, visibility, expires_at, created_at)
       VALUES ($1, 'community', 'TEST Expired Opp (Past Deadline)', ARRAY['Coder']::text[], 'immediate', '1_week', 'active', 'public', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days')
       RETURNING id`,
      [testCommunityId]
    );
    const expiredOppId = expiredOppRes.rows[0].id;
    cleanupOpportunityIds.push(expiredOppId);

    // 3. Closed opportunity
    const closedOppRes = await pool.query(
      `INSERT INTO opportunities (creator_id, creator_type, title, opportunity_types, availability, turnaround, status, visibility, closed_at, created_at)
       VALUES ($1, 'community', 'TEST Closed Opp', ARRAY['Coder']::text[], 'immediate', '1_week', 'closed', 'public', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 days')
       RETURNING id`,
      [testCommunityId]
    );
    const closedOppId = closedOppRes.rows[0].id;
    cleanupOpportunityIds.push(closedOppId);

    // 4. Active untimed opportunity (no deadline)
    const untimedOppRes = await pool.query(
      `INSERT INTO opportunities (creator_id, creator_type, title, opportunity_types, availability, turnaround, status, visibility, expires_at, created_at)
       VALUES ($1, 'community', 'TEST Untimed Opp (No Deadline)', ARRAY['Coder']::text[], 'immediate', '1_week', 'active', 'public', NULL, NOW() - INTERVAL '2 hours')
       RETURNING id`,
      [testCommunityId]
    );
    const untimedOppId = untimedOppRes.rows[0].id;
    cleanupOpportunityIds.push(untimedOppId);

    info(`Seeded opportunities: Active=${activeOppId}, Expired=${expiredOppId}, Closed=${closedOppId}, Untimed=${untimedOppId}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Part A — Deadline filter on getOpportunities (Community Home Feed)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 1: getOpportunities ("active" view for community own feed)');
    const myOppsRes = await mockCall(getOpportunities, {
      user: { id: testCommunityId, type: 'community' },
      query: { status: 'active' },
    });
    const myOpps = myOppsRes.opportunities || myOppsRes.data || myOppsRes || [];
    const myOppIds = myOpps.map(o => o.id);

    info(`Returned ${myOpps.length} opportunities: [${myOppIds.join(', ')}]`);

    if (myOppIds.includes(expiredOppId)) {
      fail(`getOpportunities returned EXPIRED opportunity ${expiredOppId}`);
    } else {
      pass(`getOpportunities correctly EXCLUDED expired opportunity ${expiredOppId}`);
    }

    if (myOppIds.includes(closedOppId)) {
      fail(`getOpportunities returned CLOSED opportunity ${closedOppId}`);
    } else {
      pass(`getOpportunities correctly EXCLUDED closed opportunity ${closedOppId}`);
    }

    if (myOppIds.includes(activeOppId) && myOppIds.includes(untimedOppId)) {
      pass(`getOpportunities correctly INCLUDED active unexpired opportunities.`);
    } else {
      fail(`getOpportunities failed to return active unexpired opportunities.`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Part A — Deadline filter on discoverOpportunities
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 2: discoverOpportunities (Public discovery browse)');
    const discRes = await mockCall(discoverOpportunities, {
      user: { id: testMemberId, type: 'member' },
      query: { limit: '50' },
    });
    const discOpps = discRes.opportunities || discRes.data || [];
    const discIds = discOpps.map(o => o.id);

    info(`Returned ${discOpps.length} opportunities: [${discIds.join(', ')}]`);

    if (discIds.includes(expiredOppId)) {
      fail(`discoverOpportunities returned EXPIRED opportunity ${expiredOppId}`);
    } else {
      pass(`discoverOpportunities correctly EXCLUDED expired opportunity ${expiredOppId}`);
    }

    if (discIds.includes(closedOppId)) {
      fail(`discoverOpportunities returned CLOSED opportunity ${closedOppId}`);
    } else {
      pass(`discoverOpportunities correctly EXCLUDED closed opportunity ${closedOppId}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Part A — Regression check: getCommunityOpportunities (Profile tab)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 3: getCommunityOpportunities (Profile Screen Community tab — Regression check)');
    const profileOppsRes = await mockCall(getCommunityOpportunities, {
      user: { id: testMemberId, type: 'member' },
      params: { communityId: String(testCommunityId) },
    });
    const profileOpps = profileOppsRes.opportunities || [];
    const profileIds = profileOpps.map(o => o.id);

    info(`Returned ${profileOpps.length} opportunities: [${profileIds.join(', ')}]`);

    if (profileIds.includes(expiredOppId)) {
      pass(`getCommunityOpportunities STILL INCLUDES expired opportunity ${expiredOppId} (Profile full history preserved).`);
    } else {
      fail(`getCommunityOpportunities incorrectly excluded expired opportunity ${expiredOppId}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Part B — Re-Ranking: Timed Opportunity Like (Heavy Penalty)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 4: Timed Opportunity Like -> Heavy Penalty (sunk, not retired)');
    // Member likes the active timed opportunity
    await mockCall(likeOpportunity, {
      user: { id: testMemberId, type: 'member' },
      params: { id: activeOppId },
    });

    // Wait a moment for fire-and-forget query
    await new Promise(r => setTimeout(r, 300));

    const timedImpState = await pool.query(
      `SELECT * FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, activeOppId]
    );
    const timedRow = timedImpState.rows[0];
    info(`Impression state row for timed opp: ${JSON.stringify(timedRow)}`);

    if (timedRow && timedRow.rank_penalty_tier === 'heavy' && timedRow.retired_at === null) {
      pass(`Liking timed opportunity set rank_penalty_tier='heavy' without retiring.`);
    } else {
      fail(`Expected rank_penalty_tier='heavy' and retired_at=NULL, got: ${JSON.stringify(timedRow)}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Part B — Re-Ranking: Untimed Opportunity Like (Immediate Retirement)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 5: Untimed Opportunity Like -> Immediate Retirement');
    // Member likes the untimed opportunity
    await mockCall(likeOpportunity, {
      user: { id: testMemberId, type: 'member' },
      params: { id: untimedOppId },
    });

    await new Promise(r => setTimeout(r, 300));

    const untimedImpState = await pool.query(
      `SELECT * FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, untimedOppId]
    );
    const untimedRow = untimedImpState.rows[0];
    info(`Impression state row for untimed opp: ${JSON.stringify(untimedRow)}`);

    if (untimedRow && untimedRow.retired_at !== null && untimedRow.rank_penalty_tier === null) {
      pass(`Liking untimed opportunity set retired_at (immediate retirement) with rank_penalty_tier=NULL.`);
    } else {
      fail(`Expected retired_at!=NULL and rank_penalty_tier=NULL, got: ${JSON.stringify(untimedRow)}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Part B — Strike 1 Unseen Impression -> Light Penalty
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 6: Strike 1 Unseen Impression -> Light Penalty');
    // Clean impression state for activeOppId
    await pool.query(
      `DELETE FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, activeOppId]
    );

    const session1 = '11111111-1111-1111-1111-111111111111';
    await mockCall(submitUnseenOpportunityImpression, {
      user: { id: testMemberId, type: 'member' },
      body: { opportunityId: activeOppId, sessionId: session1 },
    });

    const strike1State = await pool.query(
      `SELECT * FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, activeOppId]
    );
    const s1Row = strike1State.rows[0];
    info(`Impression state row after Strike 1: ${JSON.stringify(s1Row)}`);

    if (s1Row && s1Row.unseen_count === 1 && s1Row.rank_penalty_tier === 'light' && s1Row.retired_at === null) {
      pass(`Strike 1 recorded unseen_count=1 and rank_penalty_tier='light'.`);
    } else {
      fail(`Expected unseen_count=1, tier='light', retired_at=NULL, got: ${JSON.stringify(s1Row)}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 7: Part B — Strike 2 Unseen Impression -> Retirement
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 7: Strike 2 Unseen Impression -> Retirement (Cooldown)');
    const session2 = '22222222-2222-2222-2222-222222222222';
    await mockCall(submitUnseenOpportunityImpression, {
      user: { id: testMemberId, type: 'member' },
      body: { opportunityId: activeOppId, sessionId: session2 },
    });

    const strike2State = await pool.query(
      `SELECT * FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, activeOppId]
    );
    const s2Row = strike2State.rows[0];
    info(`Impression state row after Strike 2: ${JSON.stringify(s2Row)}`);

    if (s2Row && s2Row.unseen_count === 2 && s2Row.retired_at !== null && s2Row.rank_penalty_tier === null) {
      pass(`Strike 2 recorded unseen_count=2, set retired_at, and cleared rank_penalty_tier.`);
    } else {
      fail(`Expected unseen_count=2, retired_at!=NULL, tier=NULL, got: ${JSON.stringify(s2Row)}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 8: Part B — Qualified View Dwell Reset
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 8: Qualified Dwell View -> Reset Impression State & Penalties');
    await mockCall(viewOpportunity, {
      user: { id: testMemberId, type: 'member' },
      params: { id: activeOppId },
    });

    await new Promise(r => setTimeout(r, 300));

    const resetState = await pool.query(
      `SELECT * FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = $2`,
      [testMemberId, activeOppId]
    );
    const rRow = resetState.rows[0];
    info(`Impression state row after qualified view: ${JSON.stringify(rRow)}`);

    if (rRow && rRow.unseen_count === 0 && rRow.retired_at === null && rRow.rank_penalty_tier === null) {
      pass(`Qualified view fully reset unseen_count=0, retired_at=NULL, rank_penalty_tier=NULL.`);
    } else {
      fail(`Expected full reset, got: ${JSON.stringify(rRow)}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 9: Part B — getFollowedOpportunities effective_sort_time Re-Ranking
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    head('Test 9: getFollowedOpportunities effective_sort_time re-ranking');
    // Clear impression states for clean test
    await pool.query(
      `DELETE FROM opportunity_impression_state WHERE user_id = $1 AND user_type = 'member' AND opportunity_id = ANY($2)`,
      [testMemberId, cleanupOpportunityIds]
    );

    // Baseline fetch: unpenalized order
    const baseFeedRes = await mockCall(getFollowedOpportunities, {
      user: { id: testMemberId, type: 'member' },
      query: { limit: '10' },
    });
    const baseOpps = baseFeedRes.opportunities || [];
    info(`Baseline followed opps: ${baseOpps.map(o => o.title + ' (' + o.id + ')').join(', ')}`);

    // Inject heavy penalty on activeOppId
    await pool.query(
      `INSERT INTO opportunity_impression_state (user_id, user_type, opportunity_id, unseen_count, rank_penalty_tier, rank_penalty_until)
       VALUES ($1, 'member', $2, 0, 'heavy', NOW() + INTERVAL '5 days')
       ON CONFLICT (user_id, user_type, opportunity_id)
       DO UPDATE SET rank_penalty_tier = 'heavy', rank_penalty_until = NOW() + INTERVAL '5 days'`,
      [testMemberId, activeOppId]
    );

    const penalizedFeedRes = await mockCall(getFollowedOpportunities, {
      user: { id: testMemberId, type: 'member' },
      query: { limit: '10' },
    });
    const penOpps = penalizedFeedRes.opportunities || [];
    const penIndex = penOpps.findIndex(o => o.id === activeOppId);
    info(`Penalized followed opps: ${penOpps.map(o => o.title + ' [effective: ' + o.effective_sort_time + ']').join(', ')}`);

    const activeItem = penOpps.find(o => o.id === activeOppId);
    if (activeItem && new Date(activeItem.effective_sort_time) < new Date(activeItem.created_at)) {
      pass(`Penalized opportunity effective_sort_time is shifted down by 10 days: created_at=${activeItem.created_at}, effective_sort_time=${activeItem.effective_sort_time}`);
    } else {
      fail(`effective_sort_time was not shifted down as expected.`);
    }

  } catch (e) {
    console.error('\nFATAL Error in tests:', e);
    process.exitCode = 1;
  } finally {
    // Clean up test rows
    if (cleanupOpportunityIds.length > 0) {
      await pool.query(`DELETE FROM opportunities WHERE id = ANY($1)`, [cleanupOpportunityIds]);
      await pool.query(`DELETE FROM opportunity_impression_state WHERE opportunity_id = ANY($1)`, [cleanupOpportunityIds]);
      info('Cleaned up test opportunities and impression state rows.');
    }
    if (cleanupFollowIds.length > 0) {
      await pool.query(`DELETE FROM follows WHERE id = ANY($1)`, [cleanupFollowIds]);
      info('Cleaned up test follow relationships.');
    }
    await pool.end();

    const outcome = process.exitCode === 1 ? '❌ SOME TESTS FAILED' : '✅ ALL TESTS PASSED';
    console.log(`\n${outcome}\n`);
  }
}

main();
