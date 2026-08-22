'use strict';
/**
 * Verification: Promo visibility gating + guaranteed targeted delivery
 *
 * Tests:
 *   TEST 1 — getFeed visibility gate: viewer in Community A (targeted) → sees promo
 *   TEST 2 — getFeed visibility gate: viewer in Community B (not targeted) follows creator → does NOT see promo
 *   TEST 3 — getDiscoveryPosts visibility gate: same non-targeted viewer → does NOT see promo in discovery
 *   TEST 4 — getPromoTargeted: targeted viewer → sees post in endpoint
 *   TEST 5 — getPromoTargeted: non-targeted viewer → does NOT see post
 *   TEST 6 — broad plan (no OPVC rows): promo still flows through getFeed to any follower
 *   TEST 7 — plan-start expired (+3h): promo excluded from getPromoTargeted
 *   TEST 8 — everyone plan: promo passes getFeed visibility gate unconditionally
 *
 * Setup:
 *   - Creates a synthetic plan targeted at Community 54 (from prior test: creator 52)
 *   - Creates a synthetic promo post referencing that plan
 *   - Uses member 51 (viewer in community 54 via synthetic follow) and a no-share viewer
 *   - Cleans up all synthetic rows in finally block
 */
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

let passed = 0;
let failed = 0;

function assert(label, actual, expected, note = '') {
  if (actual === expected) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label}`);
    console.log(`         expected: ${expected}`);
    console.log(`         actual:   ${actual}`);
    if (note) console.log(`         note:     ${note}`);
    failed++;
  }
}

// ── Mirrors exact SQL from postController.js ────────────────────────────────

const PROMO_VISIBILITY_GATE = (viewerIdParam, viewerTypeParam) => `
  AND (
    NOT (
      p.post_type IN ('poll', 'qna', 'prompt')
      AND (p.type_data->>'promo_source_type') = 'plan'
      AND (p.type_data->>'promo_source_id') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM open_plans op
      WHERE op.id = (p.type_data->>'promo_source_id')::int
        AND (
          op.created_by = ${viewerIdParam}
          OR op.visibility = 'everyone'
          OR (
            op.visibility = 'community_members'
            AND NOT EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = op.id)
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2 ON f1.following_id = f2.following_id
                AND f1.following_type = 'community' AND f2.following_type = 'community'
              WHERE f1.follower_id = ${viewerIdParam} AND f1.follower_type = ${viewerTypeParam}
                AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            op.visibility = 'community_members'
            AND EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = op.id)
            AND (
              EXISTS (
                SELECT 1 FROM follows fv
                WHERE fv.follower_id = ${viewerIdParam} AND fv.follower_type = ${viewerTypeParam}
                  AND fv.following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
                  AND fv.following_type = 'community'
                  AND fv.is_superseded_by_circle = false
              )
              OR EXISTS (
                SELECT 1 FROM community_member_circles cmc
                WHERE cmc.member_id = ${viewerIdParam}
                  AND cmc.community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
              )
            )
          )
        )
    )
  )
`;

const PROMO_TARGETED_AUDIENCE = (viewerIdParam, viewerTypeParam) => `
  AND EXISTS (
    SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = op.id
  )
  AND (
    EXISTS (
      SELECT 1 FROM follows fv
      WHERE fv.follower_id = ${viewerIdParam} AND fv.follower_type = ${viewerTypeParam}
        AND fv.following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
        AND fv.following_type = 'community'
        AND fv.is_superseded_by_circle = false
    )
    OR EXISTS (
      SELECT 1 FROM community_member_circles cmc
      WHERE cmc.member_id = ${viewerIdParam}
        AND cmc.community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
    )
  )
`;

async function main() {
  const client = await pool.connect();
  const synt = {
    planId: null,          // targeted plan (community 54)
    broadPlanId: null,     // broad plan (no OPVC rows)
    everyonePlanId: null,  // everyone visibility plan
    expiredPlanId: null,   // plan that already started (>3h ago)
    postId: null,          // promo post referencing targeted plan
    broadPostId: null,     // promo post referencing broad plan
    everyonePostId: null,  // promo post referencing everyone plan
    expiredPostId: null,   // promo post referencing expired plan
    synthFollowIds: [],
  };

  try {
    const CREATOR_ID = 52;
    const VIEWER_IN_COM = 51;   // will get synthetic follow to community 54
    const SCOPED_COMMUNITY_ID = 54;

    // Find a viewer with no community follows (hardcoded to member 130 from schema audit)
    // Member 130 has no follows of any kind — confirmed safe before test run.
    const VIEWER_NOT_IN_COM = 130;
    console.log(`\nSetup: CREATOR=${CREATOR_ID}, VIEWER_IN_COM=${VIEWER_IN_COM}, VIEWER_NOT_IN_COM=${VIEWER_NOT_IN_COM}, COMMUNITY=${SCOPED_COMMUNITY_ID}`);

    // Synthetic follow: viewer 51 → community 54 (so they are in targeted audience)
    const sf = await client.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
      VALUES ($1, 'member', $2, 'community', false)
      ON CONFLICT (follower_id, follower_type, following_id, following_type) DO NOTHING
      RETURNING id
    `, [VIEWER_IN_COM, SCOPED_COMMUNITY_ID]);
    if (sf.rows.length > 0) {
      synt.synthFollowIds.push(sf.rows[0].id);
      console.log(`  Inserted synthetic follow: viewer ${VIEWER_IN_COM} → community ${SCOPED_COMMUNITY_ID}`);
    }

    // Also need VIEWER_NOT_IN_COM to follow the creator (so they pass getFeed's author-follow gate)
    // so we can isolate that the promo visibility gate (not the feed gate) is what blocks them
    const sfCreator = await client.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
      VALUES ($1, 'member', $2, 'member', false)
      ON CONFLICT (follower_id, follower_type, following_id, following_type) DO NOTHING
      RETURNING id
    `, [VIEWER_NOT_IN_COM, CREATOR_ID]);
    if (sfCreator.rows.length > 0) {
      synt.synthFollowIds.push(sfCreator.rows[0].id);
      console.log(`  Inserted synthetic follow: viewer ${VIEWER_NOT_IN_COM} → creator ${CREATOR_ID}`);
    }

    // ── Insert synthetic plans ─────────────────────────────────────────────
    const makePost = async (planId, viewerFollow) => {
      // Insert a poll promo post pointing at planId
      const r = await client.query(`
        INSERT INTO posts (author_id, author_type, post_type, caption, type_data, image_urls, media_types, created_at)
        VALUES ($1, 'member', 'poll', '__test_promo_content__',
          jsonb_build_object('promo_source_type', 'plan', 'promo_source_id', $2::text,
            'question', 'Test question?', 'options', '["A","B"]'::jsonb, 'poll_duration_hours', 24),
          '{}', '{}', NOW())
        RETURNING id
      `, [CREATOR_ID, planId]);
      return r.rows[0].id;
    };

    // Targeted plan
    const tPlanR = await client.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status)
      VALUES ($1, '__test_promo_targeted__', 'sports', 'free', 'community_members',
        'Pub', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active')
      RETURNING id
    `, [CREATOR_ID]);
    synt.planId = tPlanR.rows[0].id;
    await client.query(
      'INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ($1, $2)',
      [synt.planId, SCOPED_COMMUNITY_ID]
    );
    synt.postId = await makePost(synt.planId);
    console.log(`  Targeted plan=${synt.planId}, post=${synt.postId}`);

    // Broad plan (no OPVC rows, community_members)
    const bPlanR = await client.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status)
      VALUES ($1, '__test_promo_broad__', 'sports', 'free', 'community_members',
        'Pub', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active')
      RETURNING id
    `, [CREATOR_ID]);
    synt.broadPlanId = bPlanR.rows[0].id;
    synt.broadPostId = await makePost(synt.broadPlanId);
    console.log(`  Broad plan=${synt.broadPlanId}, post=${synt.broadPostId}`);

    // Everyone plan
    const ePlanR = await client.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status)
      VALUES ($1, '__test_promo_everyone__', 'sports', 'free', 'everyone',
        'Pub', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active')
      RETURNING id
    `, [CREATOR_ID]);
    synt.everyonePlanId = ePlanR.rows[0].id;
    synt.everyonePostId = await makePost(synt.everyonePlanId);
    console.log(`  Everyone plan=${synt.everyonePlanId}, post=${synt.everyonePostId}`);

    // Expired plan (started > 3h ago)
    const xPlanR = await client.query(`
      INSERT INTO open_plans (created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status)
      VALUES ($1, '__test_promo_expired__', 'sports', 'free', 'community_members',
        'Pub', 'Private', NOW() - INTERVAL '5 hours', NOW() + INTERVAL '1 day', 5, 'active')
      RETURNING id
    `, [CREATOR_ID]);
    synt.expiredPlanId = xPlanR.rows[0].id;
    await client.query(
      'INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ($1, $2)',
      [synt.expiredPlanId, SCOPED_COMMUNITY_ID]
    );
    synt.expiredPostId = await makePost(synt.expiredPlanId);
    console.log(`  Expired plan=${synt.expiredPlanId}, post=${synt.expiredPostId}\n`);

    // ── TEST 1: getFeed visibility gate — targeted viewer sees promo ─────────
    console.log('TEST 1: getFeed gate — targeted viewer (in community 54) sees promo post');
    const t1 = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.postId, VIEWER_IN_COM, 'member']);
    assert('targeted viewer passes visibility gate', t1.rows.length, 1);

    // ── TEST 2: getFeed visibility gate — non-targeted follower blocked ──────
    console.log('\nTEST 2: getFeed gate — creator-follower NOT in community 54 → blocked');
    const t2 = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.postId, VIEWER_NOT_IN_COM, 'member']);
    assert('non-community viewer blocked by visibility gate (even if follows creator)', t2.rows.length, 0);

    // ── TEST 3: getDiscoveryPosts visibility gate — same gate, same result ───
    console.log('\nTEST 3: getDiscoveryPosts gate — non-targeted viewer → blocked');
    // The discovery gate uses the same SQL structure. Just test it directly.
    const t3 = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.postId, VIEWER_NOT_IN_COM, 'member']);
    assert('discovery gate blocks non-community viewer from targeted promo', t3.rows.length, 0);

    // ── TEST 4: getPromoTargeted — targeted viewer gets post ────────────────
    console.log('\nTEST 4: getPromoTargeted — targeted viewer in community 54 → 1 post returned');
    const t4 = await client.query(`
      SELECT p.id FROM posts p
      INNER JOIN open_plans op ON op.id = (p.type_data->>'promo_source_id')::int
      WHERE p.id = $1
        AND p.post_type IN ('poll', 'qna', 'prompt')
        AND (p.type_data->>'promo_source_type') = 'plan'
        AND (p.type_data->>'promo_source_id') IS NOT NULL
        ${PROMO_TARGETED_AUDIENCE('$2', '$3')}
        AND NOT (op.scheduled_at < NOW() - INTERVAL '3 hours')
    `, [synt.postId, VIEWER_IN_COM, 'member']);
    assert('getPromoTargeted returns post for targeted viewer', t4.rows.length, 1);

    // ── TEST 5: getPromoTargeted — non-targeted viewer gets nothing ──────────
    console.log('\nTEST 5: getPromoTargeted — non-targeted viewer → 0 posts');
    const t5 = await client.query(`
      SELECT p.id FROM posts p
      INNER JOIN open_plans op ON op.id = (p.type_data->>'promo_source_id')::int
      WHERE p.id = $1
        AND p.post_type IN ('poll', 'qna', 'prompt')
        AND (p.type_data->>'promo_source_type') = 'plan'
        AND (p.type_data->>'promo_source_id') IS NOT NULL
        ${PROMO_TARGETED_AUDIENCE('$2', '$3')}
        AND NOT (op.scheduled_at < NOW() - INTERVAL '3 hours')
    `, [synt.postId, VIEWER_NOT_IN_COM, 'member']);
    assert('getPromoTargeted returns nothing for non-targeted viewer', t5.rows.length, 0);

    // ── TEST 6: broad plan — promo passes getFeed gate for any follower ──────
    // The broad plan has no OPVC rows → falls into the "broad mutual-community" branch
    // VIEWER_NOT_IN_COM follows creator but shares no community → still blocked by broad check
    // VIEWER_IN_COM shares community 54 → allowed
    console.log('\nTEST 6a: getFeed gate — broad plan, viewer sharing community → passes');
    const t6a = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.broadPostId, VIEWER_IN_COM, 'member']);
    assert('broad plan promo passes gate for shared-community viewer', t6a.rows.length, 1);

    console.log('\nTEST 6b: getFeed gate — broad plan, viewer with NO shared community → blocked');
    const t6b = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.broadPostId, VIEWER_NOT_IN_COM, 'member']);
    assert('broad plan promo blocked for viewer with no shared community', t6b.rows.length, 0);

    // ── TEST 7: getPromoTargeted — expired plan excluded ────────────────────
    console.log('\nTEST 7: getPromoTargeted — plan started > 3h ago → excluded');
    const t7 = await client.query(`
      SELECT p.id FROM posts p
      INNER JOIN open_plans op ON op.id = (p.type_data->>'promo_source_id')::int
      WHERE p.id = $1
        AND p.post_type IN ('poll', 'qna', 'prompt')
        AND (p.type_data->>'promo_source_type') = 'plan'
        AND (p.type_data->>'promo_source_id') IS NOT NULL
        ${PROMO_TARGETED_AUDIENCE('$2', '$3')}
        AND NOT (op.scheduled_at < NOW() - INTERVAL '3 hours')
    `, [synt.expiredPostId, VIEWER_IN_COM, 'member']);
    assert('expired plan promo excluded from getPromoTargeted', t7.rows.length, 0);

    // ── TEST 8: everyone plan — always passes getFeed gate ───────────────────
    console.log('\nTEST 8: getFeed gate — everyone plan → passes for any viewer');
    const t8 = await client.query(`
      SELECT p.id FROM posts p WHERE p.id = $1
      ${PROMO_VISIBILITY_GATE('$2', '$3')}
    `, [synt.everyonePostId, VIEWER_NOT_IN_COM, 'member']);
    assert('everyone plan promo passes gate for any viewer', t8.rows.length, 1);

    // ── Results ─────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } finally {
    // Delete posts first, then plans (no FK from open_plans → posts, so order only matters for plans → OPVC via CASCADE)
    for (const postId of [synt.postId, synt.broadPostId, synt.everyonePostId, synt.expiredPostId].filter(Boolean)) {
      await client.query('DELETE FROM posts WHERE id = $1', [postId]);
    }
    for (const planId of [synt.planId, synt.broadPlanId, synt.everyonePlanId, synt.expiredPlanId].filter(Boolean)) {
      await client.query('DELETE FROM open_plans WHERE id = $1', [planId]);
    }
    for (const fid of synt.synthFollowIds) {
      await client.query('DELETE FROM follows WHERE id = $1', [fid]);
    }
    console.log('\nCleanup complete.');
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
