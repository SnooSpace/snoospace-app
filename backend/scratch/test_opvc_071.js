'use strict';
/**
 * Verification: open_plan_visible_communities join table (Migration 071)
 *
 * Uses synthetic plan rows + synthetic follow rows to force all code paths.
 * All synthetic data is cleaned up in the finally block.
 *
 * Tests:
 *   TEST 1  — broad community_members: non-shared viewer blocked
 *   TEST 2  — broad community_members: shared viewer allowed
 *   TEST 3  — getPlans broad: explicit host bypass (created_by = viewer)
 *   TEST 4  — targeted: non-member viewer blocked (scoped rows exist, viewer not in them)
 *   TEST 5  — targeted: member viewer allowed (scoped rows exist, viewer follows the community)
 *   TEST 6  — everyone plan: visible to any viewer (including non-shared)
 *   TEST 7  — getPlanById: host always sees their own targeted plan
 *   TEST 8  — getPlanById: targeted non-member → 0 rows (→ 404)
 *   TEST 9  — getPlanById: broad non-shared → 0 rows (→ 404)
 *   TEST 10 — OPVC atomic replace: delete + insert simulated correctly
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

// ── Visibility SQL (mirrors plansController.js exactly) ──────────────────────

function getPlansVisibilityClause(viewerParam) {
  return `(
    op.created_by = ${viewerParam}
    OR op.visibility = 'everyone'
    OR (
      op.visibility = 'community_members'
      AND NOT EXISTS (SELECT 1 FROM open_plan_visible_communities WHERE plan_id = op.id)
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2
          ON f1.following_id = f2.following_id
         AND f1.following_type = 'community'
         AND f2.following_type = 'community'
        WHERE f1.follower_id = ${viewerParam} AND f1.follower_type = 'member'
          AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
      )
    )
    OR (
      op.visibility = 'community_members'
      AND EXISTS (SELECT 1 FROM open_plan_visible_communities WHERE plan_id = op.id)
      AND (
        EXISTS (
          SELECT 1 FROM follows
          WHERE follower_id = ${viewerParam}
            AND follower_type = 'member'
            AND following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
            AND following_type = 'community'
            AND is_superseded_by_circle = false
        )
        OR EXISTS (
          SELECT 1 FROM community_member_circles
          WHERE member_id = ${viewerParam}
            AND community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = op.id)
        )
      )
    )
  )`;
}

function getPlanByIdVisibilityClause(viewerParam) {
  return `(
    created_by = ${viewerParam}
    OR visibility = 'everyone'
    OR (
      visibility = 'community_members'
      AND NOT EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = open_plans.id)
      AND EXISTS (
        SELECT 1 FROM follows f1
        JOIN follows f2
          ON f1.following_id = f2.following_id
         AND f1.following_type = 'community'
         AND f2.following_type = 'community'
        WHERE f1.follower_id = ${viewerParam} AND f1.follower_type = 'member'
          AND f2.follower_id = open_plans.created_by AND f2.follower_type = 'member'
      )
    )
    OR (
      visibility = 'community_members'
      AND EXISTS (SELECT 1 FROM open_plan_visible_communities opvc WHERE opvc.plan_id = open_plans.id)
      AND (
        EXISTS (
          SELECT 1 FROM follows
          WHERE follower_id = ${viewerParam}
            AND follower_type = 'member'
            AND following_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = open_plans.id)
            AND following_type = 'community'
            AND is_superseded_by_circle = false
        )
        OR EXISTS (
          SELECT 1 FROM community_member_circles
          WHERE member_id = ${viewerParam}
            AND community_id IN (SELECT community_id FROM open_plan_visible_communities WHERE plan_id = open_plans.id)
        )
      )
    )
  )`;
}

async function main() {
  const client = await pool.connect();
  const synthetic = {
    planId: null,
    scopedPlanId: null,
    everyonePlanId: null,
    synthFollowIds: [],  // IDs of synthetic follow rows to clean up
  };

  try {
    const CREATOR_ID = 52;   // "Harsh"
    const VIEWER_ID  = 51;   // "Harshith" — no shared communities with creator

    // Community 54 is the one creator 52 belongs to (via circles)
    // We know this from the audit: community_member_circles has (member_id=52, community_id=54)
    // and follows has (follower_id=52, following_id=54, is_superseded_by_circle=true)
    const SCOPED_COMMUNITY_ID = 54;

    console.log(`\nSetup: CREATOR=${CREATOR_ID}, VIEWER=${VIEWER_ID}, SCOPED_COMMUNITY=${SCOPED_COMMUNITY_ID}`);
    console.log('Inserting synthetic follow rows to force all code paths...\n');

    // Synthetic follow: CREATOR → community 54 (non-superseded), for broad mutual-community test
    // Use ON CONFLICT DO NOTHING in case it exists (then we don't need to clean it up specially)
    const synthFollow1 = await client.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
      VALUES ($1, 'member', $2, 'community', false)
      ON CONFLICT (follower_id, follower_type, following_id, following_type) DO NOTHING
      RETURNING id
    `, [CREATOR_ID, SCOPED_COMMUNITY_ID]);
    if (synthFollow1.rows.length > 0) {
      synthetic.synthFollowIds.push(synthFollow1.rows[0].id);
      console.log(`  Inserted synthetic follow: CREATOR ${CREATOR_ID} → community ${SCOPED_COMMUNITY_ID} (non-superseded)`);
    } else {
      console.log(`  CREATOR ${CREATOR_ID} already follows community ${SCOPED_COMMUNITY_ID} (skipped insert)`);
    }

    // Synthetic follow: VIEWER → community 54 (non-superseded), for broad + targeted "allowed" tests
    const synthFollow2 = await client.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
      VALUES ($1, 'member', $2, 'community', false)
      ON CONFLICT (follower_id, follower_type, following_id, following_type) DO NOTHING
      RETURNING id
    `, [VIEWER_ID, SCOPED_COMMUNITY_ID]);
    if (synthFollow2.rows.length > 0) {
      synthetic.synthFollowIds.push(synthFollow2.rows[0].id);
      console.log(`  Inserted synthetic follow: VIEWER ${VIEWER_ID} → community ${SCOPED_COMMUNITY_ID}`);
    }

    // ── Insert synthetic plans ──────────────────────────────────────────────
    const broadPlanR = await client.query(`
      INSERT INTO open_plans (
        created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status
      ) VALUES (
        $1, '__test_071_broad__', 'sports', 'free', 'community_members',
        'Public', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active'
      ) RETURNING id
    `, [CREATOR_ID]);
    synthetic.planId = broadPlanR.rows[0].id;
    console.log(`  Broad plan created: id=${synthetic.planId}`);

    const scopedPlanR = await client.query(`
      INSERT INTO open_plans (
        created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status
      ) VALUES (
        $1, '__test_071_scoped__', 'sports', 'free', 'community_members',
        'Public', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active'
      ) RETURNING id
    `, [CREATOR_ID]);
    synthetic.scopedPlanId = scopedPlanR.rows[0].id;
    await client.query(
      'INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [synthetic.scopedPlanId, SCOPED_COMMUNITY_ID]
    );
    console.log(`  Scoped plan created: id=${synthetic.scopedPlanId} → community ${SCOPED_COMMUNITY_ID}`);

    const everyonePlanR = await client.query(`
      INSERT INTO open_plans (
        created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status
      ) VALUES (
        $1, '__test_071_everyone__', 'sports', 'free', 'everyone',
        'Public', 'Private', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active'
      ) RETURNING id
    `, [CREATOR_ID]);
    synthetic.everyonePlanId = everyonePlanR.rows[0].id;
    console.log(`  Everyone plan created: id=${synthetic.everyonePlanId}\n`);

    // ── TEST 1: broad — non-member (no shared follow) blocked ───────────────
    // Temporarily remove viewer's synthetic follow to create a "no-share" scenario
    // Actually: the viewer NOW follows community 54 — so for test 1 we need a viewer
    // who does NOT follow community 54. Use a 3rd ID that has no follows.
    // Find any member who follows zero communities:
    const noFollowR = await client.query(`
      SELECT id FROM members
      WHERE id NOT IN (
        SELECT DISTINCT follower_id FROM follows WHERE follower_type = 'member' AND following_type = 'community'
      )
      AND id != $1
      LIMIT 1
    `, [CREATOR_ID]);
    const NO_SHARE_VIEWER = noFollowR.rows[0]?.id || null;
    if (!NO_SHARE_VIEWER) {
      console.log('  ⚠️  Could not find a member with zero community follows for TEST 1 — using synthetic NULL-member (id=0)');
    }

    console.log('TEST 1: getPlans broad — non-shared viewer blocked');
    if (NO_SHARE_VIEWER) {
      const t1 = await client.query(`
        SELECT op.id FROM open_plans op
        WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
      `, [synthetic.planId, NO_SHARE_VIEWER]);
      assert('broad community_members blocks non-shared viewer', t1.rows.length, 0);
    } else {
      console.log('  ⚠️  SKIP (no suitable no-share viewer found)');
    }

    // ── TEST 2: broad — shared viewer allowed ──────────────────────────────
    // Viewer (51) now has synthetic follow to community 54.
    // Creator (52) now has non-superseded follow to community 54.
    // So mutual-community join should match.
    console.log('\nTEST 2: getPlans broad — shared viewer allowed');
    const t2 = await client.query(`
      SELECT op.id FROM open_plans op
      WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
    `, [synthetic.planId, VIEWER_ID]);
    assert('broad community_members allows viewer who shares community 54', t2.rows.length, 1);

    // ── TEST 3: explicit host bypass ───────────────────────────────────────
    console.log('\nTEST 3: getPlans — host bypass (created_by = viewer)');
    const t3 = await client.query(`
      SELECT op.id FROM open_plans op
      WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
    `, [synthetic.planId, CREATOR_ID]);
    assert('host bypass admits creator even with/without community join', t3.rows.length, 1);

    // ── TEST 4: targeted — non-member viewer blocked ───────────────────────
    // For this test we need a viewer who does NOT follow community 54.
    // Use NO_SHARE_VIEWER from above (if found), or skip.
    console.log('\nTEST 4: getPlans targeted — non-member viewer blocked');
    if (NO_SHARE_VIEWER) {
      const t4 = await client.query(`
        SELECT op.id FROM open_plans op
        WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
      `, [synthetic.scopedPlanId, NO_SHARE_VIEWER]);
      assert('targeted community_members blocks non-member of scoped community', t4.rows.length, 0);
    } else {
      console.log('  ⚠️  SKIP (no suitable non-member viewer found)');
    }

    // ── TEST 5: targeted — community member allowed ────────────────────────
    // Viewer (51) now follows community 54 via synthetic follow.
    console.log('\nTEST 5: getPlans targeted — community member allowed');
    const t5 = await client.query(`
      SELECT op.id FROM open_plans op
      WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
    `, [synthetic.scopedPlanId, VIEWER_ID]);
    assert('targeted community_members allows viewer who follows scoped community', t5.rows.length, 1);

    // ── TEST 6: everyone — visible to any viewer ───────────────────────────
    console.log('\nTEST 6: getPlans everyone — visible to any viewer');
    const viewerForTest6 = NO_SHARE_VIEWER || VIEWER_ID;
    const t6 = await client.query(`
      SELECT op.id FROM open_plans op
      WHERE op.id = $1 AND ${getPlansVisibilityClause('$2')}
    `, [synthetic.everyonePlanId, viewerForTest6]);
    assert('everyone plan visible to any viewer', t6.rows.length, 1);

    // ── TEST 7: getPlanById — host bypass ──────────────────────────────────
    console.log('\nTEST 7: getPlanById — host sees their own targeted plan');
    const t7 = await client.query(`
      SELECT id FROM open_plans
      WHERE id = $1 AND ${getPlanByIdVisibilityClause('$2')}
    `, [synthetic.scopedPlanId, CREATOR_ID]);
    assert('getPlanById allows host to view their own scoped plan', t7.rows.length, 1);

    // ── TEST 8: getPlanById — targeted non-member → 0 rows ─────────────────
    console.log('\nTEST 8: getPlanById — targeted non-member → 0 rows (→ 404)');
    if (NO_SHARE_VIEWER) {
      const t8 = await client.query(`
        SELECT id FROM open_plans
        WHERE id = $1 AND ${getPlanByIdVisibilityClause('$2')}
      `, [synthetic.scopedPlanId, NO_SHARE_VIEWER]);
      assert('getPlanById returns 0 rows for non-member of targeted plan (→ 404)', t8.rows.length, 0);
    } else {
      console.log('  ⚠️  SKIP (no suitable non-member viewer found)');
    }

    // ── TEST 9: getPlanById — targeted community member → 1 row ───────────
    console.log('\nTEST 9: getPlanById — targeted community member → 1 row');
    const t9 = await client.query(`
      SELECT id FROM open_plans
      WHERE id = $1 AND ${getPlanByIdVisibilityClause('$2')}
    `, [synthetic.scopedPlanId, VIEWER_ID]);
    assert('getPlanById allows viewer who follows scoped community', t9.rows.length, 1);

    // ── TEST 10: OPVC atomic replace ────────────────────────────────────────
    console.log('\nTEST 10: OPVC atomic replace (delete + insert)');
    // Confirm 1 row exists currently
    const opvcBefore = await client.query(
      'SELECT COUNT(*) AS cnt FROM open_plan_visible_communities WHERE plan_id = $1',
      [synthetic.scopedPlanId]
    );
    assert('OPVC has 1 row before replace', parseInt(opvcBefore.rows[0].cnt, 10), 1);

    // Simulate the UPDATE path: delete all, re-insert
    await client.query('BEGIN');
    await client.query('DELETE FROM open_plan_visible_communities WHERE plan_id = $1', [synthetic.scopedPlanId]);
    await client.query(
      'INSERT INTO open_plan_visible_communities (plan_id, community_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [synthetic.scopedPlanId, SCOPED_COMMUNITY_ID]
    );
    await client.query('COMMIT');

    const opvcAfter = await client.query(
      'SELECT COUNT(*) AS cnt FROM open_plan_visible_communities WHERE plan_id = $1',
      [synthetic.scopedPlanId]
    );
    assert('OPVC has 1 row after atomic replace', parseInt(opvcAfter.rows[0].cnt, 10), 1);

    // ── Results ─────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } finally {
    // Cleanup plans first (CASCADE removes OPVC rows)
    for (const key of ['everyonePlanId', 'scopedPlanId', 'planId']) {
      if (synthetic[key]) {
        await client.query('DELETE FROM open_plans WHERE id = $1', [synthetic[key]]);
        console.log(`\nCleanup: deleted plan ${synthetic[key]}`);
      }
    }
    // Cleanup synthetic follow rows
    for (const fid of synthetic.synthFollowIds) {
      await client.query('DELETE FROM follows WHERE id = $1', [fid]);
      console.log(`Cleanup: deleted synthetic follow id=${fid}`);
    }
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
