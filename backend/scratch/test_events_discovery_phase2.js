'use strict';
/**
 * Verification: Events Discovery Phase 2
 *
 * TEST 1 — Strike-1 penalty: event with rank_penalty_tier='light' must score ~30%
 *           of an identical event without the penalty (0.3× raw_score).
 *           To guarantee non-zero raw_score, the viewer follows the hosting community
 *           so both events receive the +100 follow bonus.
 * TEST 2 — Category-match: viewer following a 'networking' community sees
 *           category_score=1.0 for a 'networking' event, 0.0 for an 'art' event.
 * TEST 3 — Strike progression (write-path): session-1 → strike-1 penalty set,
 *           same session idempotent, session-2 → strike-2 retired + penalty cleared.
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
const synth = { eventIds: [], communityId: null, com2Id: null, followIds: [] };

function assert(label, actual, expected, comparator = 'eq') {
  let ok = false;
  if (comparator === 'eq')   ok = actual === expected;
  if (comparator === 'lt')   ok = actual < expected;
  if (comparator === 'gt')   ok = actual > expected;
  if (comparator === 'near') ok = Math.abs(Number(actual) - Number(expected)) < 0.001;
  if (ok) {
    console.log(`  ✅ PASS — ${label} [actual: ${actual}]`);
    passed++;
  } else {
    console.log(`  ❌ FAIL — ${label} [actual: ${actual}, expected ${comparator} ${expected}]`);
    failed++;
  }
}

// The exact CASE WHEN penalty logic from discoverEvents (extracted for inline use)
function scoreSql(penaltyCols) {
  return `
    CASE
      WHEN ${penaltyCols}.rank_penalty_tier = 'light'
       AND ${penaltyCols}.rank_penalty_until IS NOT NULL
       AND NOW() < ${penaltyCols}.rank_penalty_until
      THEN (
        (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
        (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int +
        (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 2) +
        CASE
          WHEN e.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(e.category)
          ) THEN 1.0
          WHEN c.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)
          ) THEN 1.0
          ELSE 0.0
        END
      ) * 0.3
      ELSE (
        (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
        (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int +
        (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 2) +
        CASE
          WHEN e.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(e.category)
          ) THEN 1.0
          WHEN c.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)
          ) THEN 1.0
          ELSE 0.0
        END
      )
    END`;
}

async function main() {
  const client = await pool.connect();
  const VIEWER_ID   = 51;
  const VIEWER_TYPE = 'member';
  const uid = randomUUID().slice(0, 8);
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();

  try {
    // ── Setup: create a synthetic community, make viewer follow it ──────────────
    // This guarantees the +100 follow_bonus fires for all test events,
    // giving a non-zero raw_score independent of registrations.
    const synComRes = await client.query(`
      INSERT INTO communities (name, category)
      VALUES ($1, 'networking')
      RETURNING id
    `, [`__test_p2_com_${uid}__`]);
    synth.communityId = synComRes.rows[0].id;
    console.log(`Setup: synthetic community id=${synth.communityId} (category='networking')`);

    const folRes = await client.query(`
      INSERT INTO follows (follower_id, follower_type, following_id, following_type, is_superseded_by_circle)
      VALUES ($1, 'member', $2, 'community', false)
      RETURNING id
    `, [VIEWER_ID, synth.communityId]);
    synth.followIds.push(folRes.rows[0].id);
    console.log(`Setup: viewer ${VIEWER_ID} follows synthetic community\n`);

    // ── Insert 4 test events ─────────────────────────────────────────────────────
    // eventA: will receive light penalty  | category='networking' (→ +1.0 category bonus)
    // eventB: no penalty                  | category='networking'
    // eventC: matching category           | category='networking' (for TEST 2)
    // eventD: non-matching case           | category='art', hosted by UNFOLLOWED 'art' community
    //          (must be hosted by an unfollowed community to test true negative — if
    //           event D were hosted by the 'networking' community the fallback branch would match)

    // Second synthetic community: category='art', viewer does NOT follow it
    const synCom2Res = await client.query(`
      INSERT INTO communities (name, category) VALUES ($1, 'art') RETURNING id
    `, [`__test_p2_com2_${uid}__`]);
    synth.com2Id = synCom2Res.rows[0].id;
    console.log(`Setup: synthetic community 2 id=${synth.com2Id} (category='art', NOT followed)`);

    const eventTitles = [
      [synth.communityId, `__test_p2_eventA_${uid}__`, 'networking'],  // penalised
      [synth.communityId, `__test_p2_eventB_${uid}__`, 'networking'],  // no penalty (baseline)
      [synth.communityId, `__test_p2_eventC_${uid}__`, 'networking'],  // category match test
      [synth.com2Id,      `__test_p2_eventD_${uid}__`, 'art'],         // true negative: unfollowed community + non-matching category
    ];
    for (const [comId, title, cat] of eventTitles) {
      const r = await client.query(`
        INSERT INTO events (community_id, title, event_date, start_datetime, end_datetime,
                            is_published, access_type, is_cancelled, created_at, creator_id, category)
        VALUES ($1, $2, $3, $3, $3, true, 'public', false, NOW() - INTERVAL '1 hour', $1, $4)
        RETURNING id
      `, [comId, title, futureDate, cat]);
      synth.eventIds.push(r.rows[0].id);
    }
    const [eventA, eventB, eventC, eventD] = synth.eventIds;
    console.log(`Events: A(penalised)=${eventA}, B(clean)=${eventB}, C(net-match)=${eventC}, D(art-nomatch)=${eventD}`);

    // Apply light penalty to event A only
    await client.query(`
      INSERT INTO event_impression_state (user_id, user_type, event_id, unseen_count, last_session_id, rank_penalty_tier, rank_penalty_until)
      VALUES ($1, $2, $3, 1, $4, 'light', NOW() + INTERVAL '5 days')
    `, [VIEWER_ID, VIEWER_TYPE, eventA, randomUUID()]);
    console.log(`Setup: light penalty applied to event A (${eventA})\n`);

    // ── Shared scoring query ────────────────────────────────────────────────────
    const viewerCatCte = `
      WITH viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id
                                AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id   = $1
           AND f_aff.follower_type = $2
           AND f_aff.is_superseded_by_circle = false
           AND com_f.category IS NOT NULL
        UNION
        SELECT LOWER(com_c.category) AS category
          FROM community_member_circles cmc_aff
          JOIN communities com_c ON cmc_aff.community_id = com_c.id
         WHERE cmc_aff.member_id = $1
           AND com_c.category IS NOT NULL
      )`;

    // ────────────────────────────────────────────────────────────────────────────
    console.log('=== TEST 1: Strike-1 penalty → event A score = 0.3 × event B score ===\n');

    const t1Res = await client.query(`
      ${viewerCatCte},
      followed_communities AS (
        SELECT following_id FROM follows
        WHERE follower_id = $1 AND follower_type = $2 AND following_type = 'community'
      )
      SELECT
        e.id,
        e.category AS event_category,
        (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
        (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int +
        (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 2) +
        CASE
          WHEN e.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(e.category)
          ) THEN 1.0
          WHEN c.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)
          ) THEN 1.0
          ELSE 0.0
        END AS raw_score,
        ${scoreSql('eis_rank')} AS final_score,
        eis_rank.rank_penalty_tier,
        eis_rank.rank_penalty_until
      FROM events e
      JOIN communities c ON e.community_id = c.id
      LEFT JOIN followed_communities fc ON e.community_id = fc.following_id
      LEFT JOIN event_impression_state eis_rank
        ON eis_rank.user_id = $1 AND eis_rank.user_type = $2 AND eis_rank.event_id = e.id
      WHERE e.id = ANY($3)
      ORDER BY e.id
    `, [VIEWER_ID, VIEWER_TYPE, [eventA, eventB]]);

    const rowA = t1Res.rows.find(r => r.id == eventA);
    const rowB = t1Res.rows.find(r => r.id == eventB);
    console.log(`  Event A: raw_score=${rowA.raw_score}, final_score=${rowA.final_score}, tier=${rowA.rank_penalty_tier}`);
    console.log(`  Event B: raw_score=${rowB.raw_score}, final_score=${rowB.final_score}, tier=${rowB.rank_penalty_tier}`);

    assert('Event A raw_score = Event B raw_score (identical inputs)',
      parseFloat(rowA.raw_score), parseFloat(rowB.raw_score), 'near');
    assert('Event A raw_score > 0 (follow bonus present)',
      parseFloat(rowA.raw_score), 0, 'gt');
    assert('Event A final_score < Event B final_score (penalty applied)',
      parseFloat(rowA.final_score), parseFloat(rowB.final_score), 'lt');
    assert('Event A final_score ≈ raw_score × 0.3',
      parseFloat(rowA.final_score), parseFloat(rowA.raw_score) * 0.3, 'near');
    assert('Event A penalty_tier = light',  rowA.rank_penalty_tier, 'light');
    assert('Event B penalty_tier = null',   rowB.rank_penalty_tier, null);

    // ────────────────────────────────────────────────────────────────────────────
    console.log('\n=== TEST 2: Category-match signal (binary 1.0 / 0.0) ===\n');

    const t2Res = await client.query(`
      ${viewerCatCte}
      SELECT
        e.id,
        e.category AS event_category,
        CASE
          WHEN e.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(e.category)
          ) THEN 1.0
          WHEN c.category IS NOT NULL AND EXISTS (
            SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(c.category)
          ) THEN 1.0
          ELSE 0.0
        END AS category_score
      FROM events e
      JOIN communities c ON e.community_id = c.id
      WHERE e.id = ANY($3)
    `, [VIEWER_ID, VIEWER_TYPE, [eventC, eventD]]);

    const rowC = t2Res.rows.find(r => r.id == eventC);
    const rowD = t2Res.rows.find(r => r.id == eventD);
    console.log(`  Event C (networking): category_score=${rowC.category_score}`);
    console.log(`  Event D (art):        category_score=${rowD.category_score}`);
    assert("Networking event category_score = 1.0 (viewer follows 'networking' community)",
      parseFloat(rowC.category_score), 1.0, 'near');
    assert("Art event category_score = 0.0 (no 'art' community followed)",
      parseFloat(rowD.category_score), 0.0, 'near');

    // ────────────────────────────────────────────────────────────────────────────
    console.log('\n=== TEST 3: Strike progression (write-path, mirrors Opportunity logic) ===\n');

    const testEventId = eventA;
    // Clear existing eis row (was set during TEST 1 setup)
    await client.query(`DELETE FROM event_impression_state WHERE user_id=$1 AND user_type=$2 AND event_id=$3`,
      [VIEWER_ID, VIEWER_TYPE, testEventId]);

    // Shared upsert query — exact copy of updated submitUnseenEventImpression
    const unseenUpsert = `
      INSERT INTO event_impression_state (user_id, user_type, event_id, unseen_count, last_session_id,
                                         rank_penalty_tier, rank_penalty_until)
      VALUES ($1, $2, $3, 1, $4, 'light', NOW() + INTERVAL '5 days')
      ON CONFLICT (user_id, user_type, event_id)
      DO UPDATE SET
        unseen_count = CASE
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          THEN LEAST(event_impression_state.unseen_count + 1, 2)
          ELSE event_impression_state.unseen_count
        END,
        last_session_id = EXCLUDED.last_session_id,
        retired_at = CASE
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
            AND event_impression_state.unseen_count + 1 >= 2
          THEN COALESCE(event_impression_state.retired_at, NOW())
          ELSE event_impression_state.retired_at
        END,
        rank_penalty_tier = CASE
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
            AND event_impression_state.unseen_count + 1 >= 2
          THEN NULL
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          THEN 'light'
          ELSE event_impression_state.rank_penalty_tier
        END,
        rank_penalty_until = CASE
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
            AND event_impression_state.unseen_count + 1 >= 2
          THEN NULL
          WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
          THEN NOW() + INTERVAL '5 days'
          ELSE event_impression_state.rank_penalty_until
        END
      WHERE event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id`;

    const readState = async () => {
      const r = await client.query(`
        SELECT unseen_count, rank_penalty_tier, rank_penalty_until, retired_at
        FROM event_impression_state WHERE user_id=$1 AND user_type=$2 AND event_id=$3
      `, [VIEWER_ID, VIEWER_TYPE, testEventId]);
      return r.rows[0] || null;
    };

    // Strike 1 — session S1
    const S1 = randomUUID();
    await client.query(unseenUpsert, [VIEWER_ID, VIEWER_TYPE, testEventId, S1]);
    const after1 = await readState();
    console.log(`  After Strike 1 (S1): ${JSON.stringify(after1)}`);
    assert('Strike 1: unseen_count = 1',         after1.unseen_count, 1);
    assert('Strike 1: rank_penalty_tier = light', after1.rank_penalty_tier, 'light');
    assert('Strike 1: rank_penalty_until set',    after1.rank_penalty_until !== null, true);
    assert('Strike 1: retired_at = null',         after1.retired_at, null);

    // Replay same session — idempotent
    await client.query(unseenUpsert, [VIEWER_ID, VIEWER_TYPE, testEventId, S1]);
    const afterReplay = await readState();
    assert('Same-session replay idempotent (count stays 1)', afterReplay.unseen_count, 1);

    // Strike 2 — session S2 → retire, clear penalty
    const S2 = randomUUID();
    await client.query(unseenUpsert, [VIEWER_ID, VIEWER_TYPE, testEventId, S2]);
    const after2 = await readState();
    console.log(`  After Strike 2 (S2): ${JSON.stringify(after2)}`);
    assert('Strike 2: unseen_count = 2',              after2.unseen_count, 2);
    assert('Strike 2: rank_penalty_tier cleared NULL', after2.rank_penalty_tier, null);
    assert('Strike 2: rank_penalty_until cleared NULL', after2.rank_penalty_until, null);
    assert('Strike 2: retired_at is set',              after2.retired_at !== null, true);

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`Results: ${passed} passed, ${failed} failed`);

  } finally {
    console.log('\n[CLEANUP] Removing synthetic test data …');
    if (synth.eventIds.length) {
      await client.query(`DELETE FROM event_impression_state WHERE event_id = ANY($1)`, [synth.eventIds]);
      await client.query(`DELETE FROM events WHERE id = ANY($1)`, [synth.eventIds]);
      console.log(`  Deleted ${synth.eventIds.length} synthetic events + eis rows`);
    }
    if (synth.followIds.length) {
      for (const fid of synth.followIds) {
        await client.query(`DELETE FROM follows WHERE id = $1`, [fid]);
      }
    }
    if (synth.communityId) {
      await client.query(`DELETE FROM communities WHERE id = $1`, [synth.communityId]);
      console.log(`  Deleted synthetic community id=${synth.communityId}`);
    }
    if (synth.com2Id) {
      await client.query(`DELETE FROM communities WHERE id = $1`, [synth.com2Id]);
      console.log(`  Deleted synthetic community 2 id=${synth.com2Id}`);
    }
    client.release();
    await pool.end();
    console.log('  Cleanup complete.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
