'use strict';
/**
 * Verification: Opportunities Discovery Phase 2
 *
 * TEST 1 — Engagement affinity: likes(×1)/comments(×2)/saves(×3) normalize correctly.
 *           Insert synthetic engagement rows, run the engagement CTE, print normalized scores.
 *
 * TEST 2 — Category-match: viewer following a 'networking' community sees
 *           category_score=1.0 for an opp from that community, 0.0 for one from an 'art'
 *           community (unfollowed).
 *
 * TEST 3 — Strike-1 penalty: opp with rank_penalty_tier='light' scores ≈ 0.3 × raw_score.
 *           Real before/after numbers printed for both penalised and clean opp.
 *
 * TEST 4 — Trickle cap (5/24h): insert 6 OIS rows with first_discovered_at=NOW() for viewer,
 *           then insert 1 candidate WITHOUT first_discovered_at. Confirm the cap WHERE-clause
 *           blocks the new candidate but would allow already-stamped ones.
 *
 * TEST 5 — Diversity cap (1/author/session), including scan-forward:
 *           Simulated in JS (mirrors HomeFeedScreen useMemo) — not SQL-only.
 *           Confirm that two candidates from the same author: only first is shown.
 *           Confirm that a third candidate from a different author IS shown (scan-forward).
 *
 * All data is synthetic and self-cleaning.
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let passed = 0;
let failed = 0;

const synth = {
  communityIds: [],
  followIds:    [],
  oppIds:       [],
  oisRows:      [],  // {user_id, opportunity_id}
  likeIds:      [],
  commentIds:   [],
  saveIds:      [],
};

const VIEWER_ID   = 51;
const VIEWER_TYPE = 'member';

function assert(label, actual, expected, comparator = 'eq') {
  let ok = false;
  if (comparator === 'eq')   ok = actual === expected;
  if (comparator === 'lt')   ok = actual < expected;
  if (comparator === 'gt')   ok = actual > expected;
  if (comparator === 'near') ok = Math.abs(Number(actual) - Number(expected)) < 0.001;
  if (comparator === 'gte')  ok = actual >= expected;
  if (ok) {
    console.log(`  ✅ PASS — ${label} [actual: ${actual}]`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label} [actual: ${actual}, expected ${comparator} ${expected}]`);
    failed++;
  }
}

async function main() {
  const client = await pool.connect();
  const uid = randomUUID().slice(0, 8);

  try {
    // ── Shared setup: create synthetic communities ───────────────────────────────
    const netComRes = await client.query(
      `INSERT INTO communities (name, category) VALUES ($1, 'networking') RETURNING id`,
      [`__test_opp_disco_net_${uid}__`]
    );
    const artComRes = await client.query(
      `INSERT INTO communities (name, category) VALUES ($1, 'art') RETURNING id`,
      [`__test_opp_disco_art_${uid}__`]
    );
    const netComId = netComRes.rows[0].id;
    const artComId = artComRes.rows[0].id;
    synth.communityIds.push(netComId, artComId);
    console.log(`Setup: networking community id=${netComId}, art community id=${artComId}`);

    // Viewer follows the networking community (but NOT the art community)
    const folRes = await client.query(
      `INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
       VALUES ($1, 'member', $2, 'community', false) RETURNING id`,
      [VIEWER_ID, netComId]
    );
    synth.followIds.push(folRes.rows[0].id);
    console.log(`Setup: viewer ${VIEWER_ID} follows networking community (NOT art)\n`);

    // Insert 4 synthetic opportunities:
    //   O1: from networking community (followed → should NOT appear in discovery)
    //   O2: from networking community (unfollowed — we'll remove follow for this one later)
    //       Actually: let's make a 3rd unfollowed networking community for O2
    //   Better plan:
    //   O1: from networking community — penalised (for TEST 1 + TEST 3 scoring)
    //   O2: from networking community — clean (for TEST 3 comparison)
    //   O3: from networking community — category match (for TEST 2)
    //   O4: from art community — no category match (for TEST 2)
    //   O5+: for trickle cap (TEST 4)
    //   Note: networking community IS followed, so O1-O3 won't appear in discovery.
    //   We need a SEPARATE unfollowed networking community for category-match scoring.

    // Create a THIRD community: also 'networking' category, NOT followed — discovery candidates
    const netCom2Res = await client.query(
      `INSERT INTO communities (name, category) VALUES ($1, 'networking') RETURNING id`,
      [`__test_opp_disco_net2_${uid}__`]
    );
    const artCom2Res = await client.query(
      `INSERT INTO communities (name, category) VALUES ($1, 'art') RETURNING id`,
      [`__test_opp_disco_art2_${uid}__`]
    );
    const netCom2Id = netCom2Res.rows[0].id;
    const artCom2Id = artCom2Res.rows[0].id;
    synth.communityIds.push(netCom2Id, artCom2Id);
    console.log(`Setup: net2 community id=${netCom2Id} (networking, NOT followed), art2 id=${artCom2Id}`);

    // Helper: insert opp
    const insertOpp = async (comId, title) => {
      const r = await client.query(
        `INSERT INTO opportunities (id, creator_id, creator_type, title, status, availability, turnaround, opportunity_types, created_at)
         VALUES ($1, $2, 'community', $3, 'active', 'full_time', 'two_weeks', '{design}', NOW() - INTERVAL '2 hours')
         RETURNING id`,
        [randomUUID(), String(comId), title]
      );
      const id = r.rows[0].id;
      synth.oppIds.push(id);
      return id;
    };

    const oppA = await insertOpp(netCom2Id, `__test_opp_disco_A_${uid}__`); // penalised (TEST 1/3)
    const oppB = await insertOpp(netCom2Id, `__test_opp_disco_B_${uid}__`); // clean (TEST 3)
    const oppC = await insertOpp(netCom2Id, `__test_opp_disco_C_${uid}__`); // category match (TEST 2)
    const oppD = await insertOpp(artCom2Id, `__test_opp_disco_D_${uid}__`); // no category match (TEST 2)
    console.log(`Opps: A(penalised)=${oppA}, B(clean)=${oppB}, C(net-match)=${oppC}, D(art-nomatch)=${oppD}`);

    // ── TEST 1: Engagement affinity ─────────────────────────────────────────────
    console.log('\n=== TEST 1: Engagement affinity CTE normalization ===\n');

    // Give opp A: 1 like (weight 1), 1 comment (weight 2), 1 save (weight 3) → total 6
    // Give opp B: 2 likes (weight 2) → total 2
    // Max weight = 6. Normalized: A = 6/6 = 1.0, B = 2/6 = 0.333
    const likeA = await client.query(
      `INSERT INTO opportunity_likes (opportunity_id, liker_id, liker_type) VALUES ($1, $2, $3) RETURNING id`,
      [oppA, VIEWER_ID, VIEWER_TYPE]
    );
    synth.likeIds.push(likeA.rows[0].id);

    const commentA = await client.query(
      `INSERT INTO opportunity_comments (opportunity_id, commenter_id, commenter_type, comment_text) VALUES ($1, $2, $3, 'test') RETURNING id`,
      [oppA, VIEWER_ID, VIEWER_TYPE]
    );
    synth.commentIds.push(commentA.rows[0].id);

    const saveA = await client.query(
      `INSERT INTO opportunity_saves (opportunity_id, saver_id, saver_type) VALUES ($1, $2, $3) RETURNING id`,
      [oppA, VIEWER_ID, VIEWER_TYPE]
    );
    synth.saveIds.push(saveA.rows[0].id);

    // 2 likes for opp B
    for (let i = 0; i < 2; i++) {
      const r = await client.query(
        `INSERT INTO opportunity_likes (opportunity_id, liker_id, liker_type) VALUES ($1, $2, $3) RETURNING id`,
        [oppB, VIEWER_ID + i, VIEWER_TYPE]  // different liker_ids to avoid unique constraint
      );
      synth.likeIds.push(r.rows[0].id);
    }

    const engRes = await client.query(`
      WITH engagement_raw AS (
        SELECT opportunity_id, 1.0 AS weight
          FROM opportunity_likes WHERE liker_id = $1 AND liker_type = $2
        UNION ALL
        SELECT opportunity_id, 2.0 AS weight
          FROM opportunity_comments WHERE commenter_id = $1 AND commenter_type = $2
        UNION ALL
        SELECT opportunity_id, 3.0 AS weight
          FROM opportunity_saves WHERE saver_id = $1 AND saver_type = $2
      ),
      engagement_agg AS (
        SELECT opportunity_id, SUM(weight) AS total_weight FROM engagement_raw GROUP BY opportunity_id
      ),
      engagement_max AS (
        SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
      )
      SELECT ea.opportunity_id, ea.total_weight, ea.total_weight / em.max_weight AS engagement_score
      FROM engagement_agg ea CROSS JOIN engagement_max em
      WHERE ea.opportunity_id = ANY($3)
      ORDER BY ea.total_weight DESC
    `, [VIEWER_ID, VIEWER_TYPE, [oppA, oppB]]);

    const eA = engRes.rows.find(r => r.opportunity_id === oppA);
    const eB = engRes.rows.find(r => r.opportunity_id === oppB);
    console.log(`  Opp A: total_weight=${eA?.total_weight}, engagement_score=${eA?.engagement_score}`);
    console.log(`  Opp B: total_weight=${eB?.total_weight}, engagement_score=${eB?.engagement_score}`);
    assert('Opp A total_weight = 6.0 (like×1 + comment×2 + save×3)', parseFloat(eA?.total_weight), 6.0, 'near');
    assert('Opp A engagement_score = 1.0 (max-normalized)',           parseFloat(eA?.engagement_score), 1.0, 'near');
    assert('Opp B total_weight = 1.0 (only viewer 51 like counted — other liker_id skipped)', parseFloat(eB?.total_weight), 1.0, 'near');
    assert('Opp B engagement_score = 1/6 ≈ 0.167',                   parseFloat(eB?.engagement_score), 1/6, 'near');

    // ── TEST 2: Category-match ───────────────────────────────────────────────────
    console.log('\n=== TEST 2: Category-match (binary 1.0 / 0.0) ===\n');

    const catRes = await client.query(`
      WITH viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id
                                AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id = $1 AND f_aff.follower_type = $2
           AND f_aff.is_superseded_by_circle = false AND com_f.category IS NOT NULL
        UNION
        SELECT LOWER(com_c.category) AS category
          FROM community_member_circles cmc_aff
          JOIN communities com_c ON cmc_aff.community_id = com_c.id
         WHERE cmc_aff.member_id = $1 AND com_c.category IS NOT NULL
      )
      SELECT
        o.id,
        c.category AS community_category,
        CASE
          WHEN c.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)
          ) THEN 1.0 ELSE 0.0
        END AS category_score
      FROM opportunities o
      JOIN communities c ON o.creator_id::integer = c.id
      WHERE o.id = ANY($3)
    `, [VIEWER_ID, VIEWER_TYPE, [oppC, oppD]]);

    const rowC = catRes.rows.find(r => r.id === oppC);
    const rowD = catRes.rows.find(r => r.id === oppD);
    console.log(`  Opp C (net-match):    community_category=${rowC?.community_category}, category_score=${rowC?.category_score}`);
    console.log(`  Opp D (art-no-match): community_category=${rowD?.community_category}, category_score=${rowD?.category_score}`);
    assert("Opp C (networking community, followed) category_score = 1.0", parseFloat(rowC?.category_score), 1.0, 'near');
    assert("Opp D (art community, unfollowed) category_score = 0.0",      parseFloat(rowD?.category_score), 0.0, 'near');

    // ── TEST 3: Strike-1 penalty ──────────────────────────────────────────────────
    console.log('\n=== TEST 3: Strike-1 penalty → score ≈ 0.3 × raw_score ===\n');

    // Apply light penalty to oppA, none to oppB
    await client.query(
      `INSERT INTO opportunity_impression_state (user_id, user_type, opportunity_id, unseen_count, last_session_id, rank_penalty_tier, rank_penalty_until)
       VALUES ($1, $2, $3, 1, $4, 'light', NOW() + INTERVAL '5 days')`,
      [VIEWER_ID, VIEWER_TYPE, oppA, randomUUID()]
    );
    synth.oisRows.push({ user_id: VIEWER_ID, opportunity_id: oppA });

    const penaltyRes = await client.query(`
      WITH engagement_raw AS (
        SELECT opportunity_id, 1.0 AS weight FROM opportunity_likes WHERE liker_id = $1 AND liker_type = $2
        UNION ALL
        SELECT opportunity_id, 2.0 AS weight FROM opportunity_comments WHERE commenter_id = $1 AND commenter_type = $2
        UNION ALL
        SELECT opportunity_id, 3.0 AS weight FROM opportunity_saves WHERE saver_id = $1 AND saver_type = $2
      ),
      engagement_agg AS (SELECT opportunity_id, SUM(weight) AS total_weight FROM engagement_raw GROUP BY opportunity_id),
      engagement_max AS (SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg),
      engagement_norm AS (
        SELECT ea.opportunity_id, ea.total_weight / em.max_weight AS engagement_score
        FROM engagement_agg ea CROSS JOIN engagement_max em
      ),
      viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id = $1 AND f_aff.follower_type = $2
           AND f_aff.is_superseded_by_circle = false AND com_f.category IS NOT NULL
      )
      SELECT
        o.id,
        COALESCE(en.engagement_score, 0)
          + ((COALESCE(o.like_count,0) + COALESCE(o.comment_count,0) + COALESCE(o.save_count,0) + COALESCE(o.share_count,0))::float
             / GREATEST(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600.0, 1.0))
          + CASE WHEN c.category IS NOT NULL AND EXISTS (SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)) THEN 1.0 ELSE 0.0 END
        AS raw_score,
        CASE
          WHEN ois.rank_penalty_tier = 'light' AND ois.rank_penalty_until IS NOT NULL AND NOW() < ois.rank_penalty_until
          THEN (
            COALESCE(en.engagement_score, 0)
            + ((COALESCE(o.like_count,0) + COALESCE(o.comment_count,0) + COALESCE(o.save_count,0) + COALESCE(o.share_count,0))::float
               / GREATEST(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600.0, 1.0))
            + CASE WHEN c.category IS NOT NULL AND EXISTS (SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)) THEN 1.0 ELSE 0.0 END
          ) * 0.3
          ELSE (
            COALESCE(en.engagement_score, 0)
            + ((COALESCE(o.like_count,0) + COALESCE(o.comment_count,0) + COALESCE(o.save_count,0) + COALESCE(o.share_count,0))::float
               / GREATEST(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600.0, 1.0))
            + CASE WHEN c.category IS NOT NULL AND EXISTS (SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)) THEN 1.0 ELSE 0.0 END
          )
        END AS discovery_score,
        ois.rank_penalty_tier
      FROM opportunities o
      JOIN communities c ON o.creator_id::integer = c.id
      LEFT JOIN engagement_norm en ON en.opportunity_id = o.id
      LEFT JOIN opportunity_impression_state ois ON ois.user_id = $1 AND ois.user_type = $2 AND ois.opportunity_id = o.id
      WHERE o.id = ANY($3)
    `, [VIEWER_ID, VIEWER_TYPE, [oppA, oppB]]);

    const pA = penaltyRes.rows.find(r => r.id === oppA);
    const pB = penaltyRes.rows.find(r => r.id === oppB);
    console.log(`  Opp A: raw_score=${parseFloat(pA.raw_score).toFixed(4)}, discovery_score=${parseFloat(pA.discovery_score).toFixed(4)}, tier=${pA.rank_penalty_tier}`);
    console.log(`  Opp B: raw_score=${parseFloat(pB.raw_score).toFixed(4)}, discovery_score=${parseFloat(pB.discovery_score).toFixed(4)}, tier=${pB.rank_penalty_tier}`);
    assert('Opp A raw_score > 0 (engagement affinity present)',     parseFloat(pA.raw_score), 0, 'gt');
    assert('Opp A discovery_score < raw_score (penalty applied)',   parseFloat(pA.discovery_score), parseFloat(pA.raw_score), 'lt');
    assert('Opp A discovery_score ≈ raw_score × 0.3',              parseFloat(pA.discovery_score), parseFloat(pA.raw_score) * 0.3, 'near');
    assert('Opp A penalty_tier = light',                            pA.rank_penalty_tier, 'light');
    assert('Opp B discovery_score = raw_score (no penalty)',        parseFloat(pB.discovery_score), parseFloat(pB.raw_score), 'near');
    assert('Opp B penalty_tier = null',                             pB.rank_penalty_tier, null);

    // ── TEST 4: Trickle cap (5/24h gate) ────────────────────────────────────────
    console.log('\n=== TEST 4: Trickle cap — 5 per 24h gate ===\n');

    // Insert 5 OIS rows with first_discovered_at = NOW() for 5 DIFFERENT opps
    const trickleCandidates = [];
    for (let i = 0; i < 5; i++) {
      const oppId = await insertOpp(netCom2Id, `__test_opp_trickle_${uid}_${i}__`);
      trickleCandidates.push(oppId);
      await client.query(
        `INSERT INTO opportunity_impression_state (user_id, user_type, opportunity_id, first_discovered_at)
         VALUES ($1, $2, $3, NOW())`,
        [VIEWER_ID, VIEWER_TYPE, oppId]
      );
      synth.oisRows.push({ user_id: VIEWER_ID, opportunity_id: oppId });
    }

    // 6th candidate: NO first_discovered_at — should be blocked by cap (count already = 5)
    const newCandidateId = await insertOpp(netCom2Id, `__test_opp_trickle_new_${uid}__`);

    // Run daily_discovery_count
    const countRes = await client.query(`
      SELECT COUNT(DISTINCT opportunity_id) AS cnt
        FROM opportunity_impression_state
       WHERE user_id = $1 AND user_type = $2
         AND first_discovered_at >= NOW() - INTERVAL '24 hours'
    `, [VIEWER_ID, VIEWER_TYPE]);
    const dailyCount = parseInt(countRes.rows[0].cnt, 10);
    console.log(`  Daily discovery count for viewer ${VIEWER_ID}: ${dailyCount}`);

    // Check: new candidate (no first_discovered_at) BLOCKED when count >= 5
    const newCandidateGateRes = await client.query(`
      SELECT
        (SELECT COUNT(DISTINCT opportunity_id) FROM opportunity_impression_state
         WHERE user_id = $1 AND user_type = $2
           AND first_discovered_at >= NOW() - INTERVAL '24 hours') >= 5 AS cap_reached,
        EXISTS (
          SELECT 1 FROM opportunity_impression_state
          WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3
            AND first_discovered_at IS NOT NULL
        ) AS already_stamped
    `, [VIEWER_ID, VIEWER_TYPE, newCandidateId]);

    const gate = newCandidateGateRes.rows[0];
    console.log(`  Cap reached: ${gate.cap_reached}, new candidate already stamped: ${gate.already_stamped}`);
    // Gate logic: include if (count < 5) OR already_stamped
    const newCandidateAllowed = !gate.cap_reached || gate.already_stamped;
    console.log(`  New candidate allowed by gate: ${newCandidateAllowed} (should be FALSE)`);
    assert('Daily count ≥ 5 (cap reached)',                      dailyCount, 5, 'gte');
    assert('Cap reached flag = true',                             gate.cap_reached, true);
    assert('New candidate not stamped',                           gate.already_stamped, false);
    assert('New candidate blocked by trickle gate',               newCandidateAllowed, false);

    // Check: an already-stamped candidate IS allowed through even when cap is reached
    const stampedCandidateGateRes = await client.query(`
      SELECT
        (SELECT COUNT(DISTINCT opportunity_id) FROM opportunity_impression_state
         WHERE user_id = $1 AND user_type = $2
           AND first_discovered_at >= NOW() - INTERVAL '24 hours') >= 5 AS cap_reached,
        EXISTS (
          SELECT 1 FROM opportunity_impression_state
          WHERE user_id = $1 AND user_type = $2 AND opportunity_id = $3
            AND first_discovered_at IS NOT NULL
        ) AS already_stamped
    `, [VIEWER_ID, VIEWER_TYPE, trickleCandidates[0]]);

    const stampedGate = stampedCandidateGateRes.rows[0];
    const stampedAllowed = !stampedGate.cap_reached || stampedGate.already_stamped;
    console.log(`  Stamped candidate allowed through cap: ${stampedAllowed} (should be TRUE)`);
    assert('Already-stamped candidate passes gate when cap reached', stampedAllowed, true);

    // ── TEST 5: Diversity cap (1/author/session) — JS simulation ────────────────
    console.log('\n=== TEST 5: Diversity cap (1/author/session, scan-forward) ===\n');

    // Simulate 3 discovery opp candidates:
    // [0]: creator_type='community', creator_id='100'  (AUTHOR X)
    // [1]: creator_type='community', creator_id='100'  (AUTHOR X — should be blocked)
    // [2]: creator_type='community', creator_id='200'  (AUTHOR Y — should be shown after scan-forward)
    const mockCandidates = [
      { id: 'uuid-1', creator_type: 'community', creator_id: '100' },
      { id: 'uuid-2', creator_type: 'community', creator_id: '100' },
      { id: 'uuid-3', creator_type: 'community', creator_id: '200' },
    ];

    const DISCOVERY_OPP_CAP = 3;
    let discoveryOppShown = 0;
    let discoveryOppIndex = 0;
    const discoveryOppAuthorCount = {};
    const injected = [];

    // Simulate 15 "post positions", inject at every 5th (DISCOVERY_OPP_INTERVAL=5)
    for (let postNumber = 1; postNumber <= 15; postNumber++) {
      if (postNumber % 5 === 0 && discoveryOppShown < DISCOVERY_OPP_CAP) {
        // Scan-forward past blocked authors
        while (
          discoveryOppIndex < mockCandidates.length &&
          (discoveryOppAuthorCount[
            `${mockCandidates[discoveryOppIndex].creator_type}-${mockCandidates[discoveryOppIndex].creator_id}`
          ] || 0) >= 1
        ) {
          discoveryOppIndex++;
        }
        if (discoveryOppIndex < mockCandidates.length) {
          const dopp = mockCandidates[discoveryOppIndex];
          const key = `${dopp.creator_type}-${dopp.creator_id}`;
          injected.push({ ...dopp, at_post: postNumber });
          discoveryOppAuthorCount[key] = (discoveryOppAuthorCount[key] || 0) + 1;
          discoveryOppIndex++;
          discoveryOppShown++;
        }
      }
    }

    console.log('  Injected discovery opps:', injected.map(o => `id=${o.id} creator=${o.creator_id} at_post=${o.at_post}`));
    assert('Exactly 2 opps injected (not 3: X shown once, Y shown once)',  injected.length, 2);
    assert('First injection is AUTHOR X (uuid-1)',                          injected[0]?.id, 'uuid-1');
    assert('Second injection is AUTHOR Y (uuid-3, scan-forward past uuid-2)', injected[1]?.id, 'uuid-3');
    assert('uuid-2 (duplicate AUTHOR X) never injected',
      injected.some(o => o.id === 'uuid-2'), false);

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } finally {
    console.log('\n[CLEANUP] Removing synthetic test data …');
    // Clean OIS rows first
    if (synth.oisRows.length) {
      for (const row of synth.oisRows) {
        await client.query(
          `DELETE FROM opportunity_impression_state WHERE user_id=$1 AND user_type=$2 AND opportunity_id=$3`,
          [row.user_id, VIEWER_TYPE, row.opportunity_id]
        );
      }
    }
    // Clean all OIS for all synth opps (catches any stragglers)
    if (synth.oppIds.length) {
      await client.query(`DELETE FROM opportunity_impression_state WHERE opportunity_id = ANY($1)`, [synth.oppIds]);
    }
    // Clean engagement
    for (const id of synth.likeIds)    await client.query(`DELETE FROM opportunity_likes WHERE id = $1`,    [id]);
    for (const id of synth.commentIds) await client.query(`DELETE FROM opportunity_comments WHERE id = $1`, [id]);
    for (const id of synth.saveIds)    await client.query(`DELETE FROM opportunity_saves WHERE id = $1`,    [id]);
    // Clean opps
    if (synth.oppIds.length) {
      await client.query(`DELETE FROM opportunities WHERE id = ANY($1)`, [synth.oppIds]);
      console.log(`  Deleted ${synth.oppIds.length} synthetic opportunities`);
    }
    // Clean follows
    for (const id of synth.followIds) await client.query(`DELETE FROM follows WHERE id = $1`, [id]);
    // Clean communities
    if (synth.communityIds.length) {
      await client.query(`DELETE FROM communities WHERE id = ANY($1)`, [synth.communityIds]);
      console.log(`  Deleted ${synth.communityIds.length} synthetic communities`);
    }
    client.release();
    await pool.end();
    console.log('  Cleanup complete.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
