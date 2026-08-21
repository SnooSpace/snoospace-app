'use strict';
/**
 * Verification for getPlanById visibility fix.
 * Mirrors the audit's audit_leak_test.js setup exactly.
 *
 * Creator: Member 52 ("Harsh")    — creates a community_members plan
 * Viewer:  Member 51 ("Harshith") — no shared communities with creator
 * Host:    Member 52              — should always succeed
 *
 * Tests:
 *  TEST 1: getPlans feed query as non-member → must still be blocked (unchanged)
 *  TEST 2: getPlanById as non-member → must now return 0 rows (404 gate)
 *  TEST 3: getPlanById as HOST (creator) → must still succeed (host bypass)
 *  TEST 4: getPlans gap check → confirm host bypass EXISTS in visibility clause or flag its absence
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

async function main() {
  const client = await pool.connect();
  const synthetic = { planId: null };

  try {
    const CREATOR_ID = 52; // "Harsh"
    const VIEWER_ID  = 51; // "Harshith S Gowda" — no shared communities with creator

    // Confirm pre-condition: no shared communities between viewer and creator
    const sharedRes = await client.query(`
      SELECT COUNT(*)::int AS cnt
      FROM follows f1
      JOIN follows f2
        ON f1.following_id = f2.following_id
       AND f1.following_type = 'community'
       AND f2.following_type = 'community'
      WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
        AND f2.follower_id = $2 AND f2.follower_type = 'member'
    `, [VIEWER_ID, CREATOR_ID]);
    console.log(`\nPre-condition: shared communities between Viewer ${VIEWER_ID} and Creator ${CREATOR_ID}: ${sharedRes.rows[0].cnt}`);
    assert('No shared communities (pre-condition)', sharedRes.rows[0].cnt, 0,
      'If > 0, test is invalid — viewer would legitimately see the plan');

    // Insert synthetic plan
    const planRes = await client.query(`
      INSERT INTO open_plans (
        created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status
      ) VALUES (
        $1, '__test_visibility_fix__', 'sports', 'free', 'community_members',
        'Public Area', 'Private Room 101', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active'
      ) RETURNING id
    `, [CREATOR_ID]);
    synthetic.planId = planRes.rows[0].id;
    console.log(`\nSynthetic plan created: id=${synthetic.planId} (visibility=community_members, scoped_community_id=NULL)\n`);

    // ── TEST 1: getPlans (list) still blocks non-member ─────────────────────────
    console.log('TEST 1: getPlans (feed) as non-member — should still be blocked (unchanged behavior)');
    const getPlansRes = await client.query(`
      SELECT op.id
      FROM open_plans op
      WHERE op.id = $1
        AND (
          op.visibility = 'everyone'
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NULL
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2
                ON f1.following_id = f2.following_id
               AND f1.following_type = 'community'
               AND f2.following_type = 'community'
              WHERE f1.follower_id = $2 AND f1.follower_type = 'member'
                AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = $2
                AND follower_type = 'member'
                AND following_id = op.scoped_community_id
                AND following_type = 'community'
            )
          )
        )
    `, [synthetic.planId, VIEWER_ID]);
    assert('getPlans blocks non-member (unchanged)', getPlansRes.rows.length, 0);

    // ── TEST 2: getPlanById (new query) blocks non-member ───────────────────────
    console.log('\nTEST 2: getPlanById as non-member — should now return 0 rows (404 gate AFTER FIX)');
    const getPlanByIdNonMemberRes = await client.query(`
      SELECT * FROM open_plans
      WHERE id = $1
        AND (
          created_by = $2
          OR visibility = 'everyone'
          OR (
            visibility = 'community_members'
            AND scoped_community_id IS NULL
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2
                ON f1.following_id = f2.following_id
               AND f1.following_type = 'community'
               AND f2.following_type = 'community'
              WHERE f1.follower_id = $2 AND f1.follower_type = 'member'
                AND f2.follower_id = open_plans.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            visibility = 'community_members'
            AND scoped_community_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = $2
                AND follower_type = 'member'
                AND following_id = open_plans.scoped_community_id
                AND following_type = 'community'
            )
          )
        )
    `, [synthetic.planId, VIEWER_ID]);
    assert('getPlanById returns 0 rows for non-member (→ 404)', getPlanByIdNonMemberRes.rows.length, 0);
    if (getPlanByIdNonMemberRes.rows.length > 0) {
      console.log('  LEAK: Plan data still returned:', JSON.stringify({
        id: getPlanByIdNonMemberRes.rows[0].id,
        title: getPlanByIdNonMemberRes.rows[0].title,
        location_private: getPlanByIdNonMemberRes.rows[0].location_private,
      }));
    }

    // ── TEST 3: getPlanById as HOST — should succeed (host bypass) ──────────────
    console.log('\nTEST 3: getPlanById as HOST (creator) — should succeed (host bypass via created_by = $2)');
    const getPlanByIdHostRes = await client.query(`
      SELECT id, title, visibility, location_private FROM open_plans
      WHERE id = $1
        AND (
          created_by = $2
          OR visibility = 'everyone'
          OR (
            visibility = 'community_members'
            AND scoped_community_id IS NULL
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2
                ON f1.following_id = f2.following_id
               AND f1.following_type = 'community'
               AND f2.following_type = 'community'
              WHERE f1.follower_id = $2 AND f1.follower_type = 'member'
                AND f2.follower_id = open_plans.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            visibility = 'community_members'
            AND scoped_community_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = $2
                AND follower_type = 'member'
                AND following_id = open_plans.scoped_community_id
                AND following_type = 'community'
            )
          )
        )
    `, [synthetic.planId, CREATOR_ID]);
    assert('getPlanById returns 1 row for host (host bypass works)', getPlanByIdHostRes.rows.length, 1);
    if (getPlanByIdHostRes.rows.length > 0) {
      console.log('  Host data returned correctly:', JSON.stringify({
        id: getPlanByIdHostRes.rows[0].id,
        visibility: getPlanByIdHostRes.rows[0].visibility,
      }));
    }

    // ── TEST 4: Check host bypass in getPlans visibility clause ─────────────────
    console.log('\nTEST 4: getPlans visibility clause host bypass check');
    // In getPlans: the visibility block is L220-246 — it does NOT include created_by = $1.
    // The only created_by = $1 bypass is in the GENDER filter (L248-252), not visibility.
    // Confirm: does getPlans admit a creator to see their own community_members plan
    // even when they share NO community with themselves?
    const getPlansHostRes = await client.query(`
      SELECT op.id
      FROM open_plans op
      WHERE op.id = $1
        AND (
          op.visibility = 'everyone'
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NULL
            AND EXISTS (
              SELECT 1 FROM follows f1
              JOIN follows f2
                ON f1.following_id = f2.following_id
               AND f1.following_type = 'community'
               AND f2.following_type = 'community'
              WHERE f1.follower_id = $2 AND f1.follower_type = 'member'
                AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
            )
          )
          OR (
            op.visibility = 'community_members'
            AND op.scoped_community_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = $2
                AND follower_type = 'member'
                AND following_id = op.scoped_community_id
                AND following_type = 'community'
            )
          )
        )
    `, [synthetic.planId, CREATOR_ID]);
    // This should return 1 only IF creator follows >= 1 community (self-join on f1=f2=creator succeeds)
    // For creator 52 who follows 1 community: f1.follower_id = 52, f2.follower_id = 52 → SAME ROW → true
    const getPlansAdmitsHost = getPlansHostRes.rows.length === 1;
    console.log(`  getPlans visibility clause admits creator as viewer: ${getPlansAdmitsHost ? 'YES' : 'NO (GAP DETECTED)'}`);
    if (!getPlansAdmitsHost) {
      console.log('  ⚠️  GAP: getPlans visibility clause does NOT have a host bypass.');
      console.log('     A creator who shares no community with themselves (edge case when they follow 0 communities)');
      console.log('     would not see their own plan in the /plans feed. This is a pre-existing gap, not fixed here.');
    } else {
      console.log('  NOTE: getPlans appears to admit the host via the self-join (creator follows ≥1 community,');
      console.log('     so f1.follower_id=creator and f2.follower_id=creator share the same community_id row).');
      console.log('     This is incidental — not an explicit host bypass. A creator who follows 0 communities');
      console.log('     would still not see their own community_members plan in getPlans. Pre-existing gap.');
    }

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } finally {
    if (synthetic.planId) {
      await client.query(`DELETE FROM open_plans WHERE id = $1`, [synthetic.planId]);
      console.log(`\nCleanup: deleted synthetic plan ${synthetic.planId}`);
    }
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
