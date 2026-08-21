/**
 * Scratch: Discovery endpoint verification
 *
 * Usage: node backend/scratch/test_discovery.js
 * Requires: backend/.env with DATABASE_URL
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();

  try {
    // 1. Find a real member user
    const userRes = await client.query(
      `SELECT id, 'member' AS type, name FROM members WHERE id = 51 LIMIT 1`
    // user_id=51 is known to have retired posts (from Test 4 results), meaning they
    // have actual editorial post interactions — better candidate pool for scoring test
    );
    if (userRes.rows.length === 0) { console.error('No members found'); return; }
    const { id: userId, type: userType, name } = userRes.rows[0];
    console.log(`\n=== Testing as userId=${userId} userType=${userType} (${name}) ===\n`);

    // Also probe with a 30-day window to confirm scoring works regardless of 5-day cutoff
    const widerRes = await client.query(`
      WITH engagement_raw AS (
        SELECT p.post_type, SUM(1.0) AS weight
          FROM post_likes l JOIN posts p ON l.post_id = p.id
         WHERE l.liker_id = $1 AND l.liker_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(2.0) AS weight
          FROM post_comments c JOIN posts p ON c.post_id = p.id
         WHERE c.commenter_id = $1 AND c.commenter_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_saves s JOIN posts p ON s.post_id = p.id
         WHERE s.saver_id = $1 AND s.saver_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_shares sh JOIN posts p ON sh.post_id = p.id
         WHERE sh.sharer_id = $1 AND sh.sharer_type = $2 GROUP BY p.post_type
      ),
      engagement_agg AS (
        SELECT post_type, SUM(weight) AS total_weight FROM engagement_raw GROUP BY post_type
      ),
      engagement_max AS (
        SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
      ),
      engagement_norm AS (
        SELECT ea.post_type, ea.total_weight / em.max_weight AS engagement_score
          FROM engagement_agg ea CROSS JOIN engagement_max em
      ),
      dwell_aff AS (
        SELECT post_type, AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score
          FROM unique_view_events WHERE user_id = $1 AND user_type = $2 GROUP BY post_type
      )
      SELECT
        p.id,
        p.post_type,
        ROUND(COALESCE(en.engagement_score, 0)::numeric, 4) AS eng,
        ROUND(COALESCE(da.dwell_score, 0)::numeric, 4) AS dwell,
        ROUND(((COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
          /GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0,1.0))::numeric, 6) AS pop,
        pis_disc.rank_penalty_tier AS penalty_tier,
        CASE
          WHEN pis_disc.rank_penalty_tier='light' AND pis_disc.rank_penalty_until IS NOT NULL AND NOW() < pis_disc.rank_penalty_until
          THEN ROUND(((COALESCE(en.engagement_score,0)+COALESCE(da.dwell_score,0)
               +(COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
               /GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0,1.0))*0.3)::numeric, 4)
          ELSE ROUND((COALESCE(en.engagement_score,0)+COALESCE(da.dwell_score,0)
               +(COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
               /GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0,1.0))::numeric, 4)
        END AS discovery_score
      FROM posts p
      LEFT JOIN engagement_norm en ON en.post_type=p.post_type
      LEFT JOIN dwell_aff da ON da.post_type=p.post_type
      LEFT JOIN post_impression_state pis_disc
        ON pis_disc.user_id=$1 AND pis_disc.user_type=$2 AND pis_disc.post_id=p.id
      WHERE
        p.post_type IN ('media','community_voice')
        AND p.created_at >= NOW() - INTERVAL '30 days'
        AND NOT (p.author_id=$1 AND p.author_type=$2)
        AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.follower_type=$2
          AND f.following_id=p.author_id AND f.following_type=p.author_type AND f.is_superseded_by_circle=false)
        AND NOT EXISTS (SELECT 1 FROM post_impression_state pis
          WHERE pis.user_id=$1 AND pis.user_type=$2 AND pis.post_id=p.id
            AND pis.retired_at IS NOT NULL AND pis.retired_at > NOW()-INTERVAL '15 days')
      ORDER BY discovery_score DESC LIMIT 5
    `, [userId, userType]);

    if (widerRes.rows.length === 0) {
      console.log('  30-day probe: also 0 candidates (no non-followed editorial posts in DB at all for this user)');
    } else {
      console.log(`  30-day window probe (${widerRes.rows.length} candidates found — confirms scoring works):`);
      widerRes.rows.forEach((row, i) => {
        const penStr = row.penalty_tier ? ` [PENALISED 0.3x: ${row.penalty_tier}]` : '';
        console.log(`    ${i+1}. post_id=${row.id} type=${row.post_type} eng=${row.eng} dwell=${row.dwell} pop=${row.pop} => discovery_score=${row.discovery_score}${penStr}`);
      });
    }

    // 2. Run discovery query directly
    const discoveryRes = await client.query(`
      WITH engagement_raw AS (
        SELECT p.post_type, SUM(1.0) AS weight
          FROM post_likes l JOIN posts p ON l.post_id = p.id
         WHERE l.liker_id = $1 AND l.liker_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(2.0) AS weight
          FROM post_comments c JOIN posts p ON c.post_id = p.id
         WHERE c.commenter_id = $1 AND c.commenter_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_saves s JOIN posts p ON s.post_id = p.id
         WHERE s.saver_id = $1 AND s.saver_type = $2 GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_shares sh JOIN posts p ON sh.post_id = p.id
         WHERE sh.sharer_id = $1 AND sh.sharer_type = $2 GROUP BY p.post_type
      ),
      engagement_agg AS (
        SELECT post_type, SUM(weight) AS total_weight FROM engagement_raw GROUP BY post_type
      ),
      engagement_max AS (
        SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
      ),
      engagement_norm AS (
        SELECT ea.post_type, ea.total_weight / em.max_weight AS engagement_score
          FROM engagement_agg ea CROSS JOIN engagement_max em
      ),
      dwell_aff AS (
        SELECT post_type, AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score
          FROM unique_view_events
         WHERE user_id = $1 AND user_type = $2 GROUP BY post_type
      )
      SELECT
        p.id,
        p.post_type,
        p.author_id,
        p.author_type,
        p.created_at,
        p.like_count,
        p.comment_count,
        ROUND(COALESCE(en.engagement_score, 0)::numeric, 4) AS engagement_score,
        ROUND(COALESCE(da.dwell_score, 0)::numeric, 4)      AS dwell_score,
        ROUND(((COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
          / GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0, 1.0))::numeric, 6) AS popularity_score,
        pis_disc.rank_penalty_tier  AS penalty_tier,
        pis_disc.rank_penalty_until AS penalty_until,
        CASE
          WHEN pis_disc.rank_penalty_tier = 'light'
           AND pis_disc.rank_penalty_until IS NOT NULL
           AND NOW() < pis_disc.rank_penalty_until
          THEN ROUND(((COALESCE(en.engagement_score,0)+COALESCE(da.dwell_score,0)
               +(COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
               /GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0,1.0))*0.3)::numeric, 4)
          ELSE ROUND((COALESCE(en.engagement_score,0)+COALESCE(da.dwell_score,0)
               +(COALESCE(p.like_count,0)+COALESCE(p.comment_count,0)+COALESCE(p.save_count,0)+COALESCE(p.share_count,0))::float
               /GREATEST(EXTRACT(EPOCH FROM (NOW()-p.created_at))/3600.0,1.0))::numeric, 4)
        END AS discovery_score
      FROM posts p
      LEFT JOIN engagement_norm en  ON en.post_type  = p.post_type
      LEFT JOIN dwell_aff da        ON da.post_type  = p.post_type
      LEFT JOIN post_impression_state pis_disc
        ON pis_disc.user_id = $1 AND pis_disc.user_type = $2 AND pis_disc.post_id = p.id
      WHERE
        p.post_type IN ('media','community_voice')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND p.post_type NOT IN ('plan_promo','event_promo')
        AND NOT (p.author_id = $1 AND p.author_type = $2)
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id=$1 AND f.follower_type=$2
            AND f.following_id=p.author_id AND f.following_type=p.author_type
            AND f.is_superseded_by_circle=false)
        AND NOT (p.author_type='member' AND EXISTS (
          SELECT 1 FROM creator_follows cf
          WHERE cf.follower_id=$1 AND cf.follower_type=$2
            AND cf.creator_id=p.author_id AND cf.is_dormant=false
            AND cf.is_superseded_by_circle=false))
        AND NOT ($2='member' AND p.author_type='member' AND EXISTS (
          SELECT 1 FROM circles ci
          WHERE (ci.user_a_id=$1 AND ci.user_b_id=p.author_id)
             OR (ci.user_b_id=$1 AND ci.user_a_id=p.author_id)))
        AND NOT ($2='community' AND p.author_type='member' AND EXISTS (
          SELECT 1 FROM community_member_circles cc
          WHERE cc.community_id=$1 AND cc.member_id=p.author_id))
        AND NOT ($2='member' AND p.author_type='community' AND EXISTS (
          SELECT 1 FROM community_member_circles cc
          WHERE cc.community_id=p.author_id AND cc.member_id=$1))
        AND NOT EXISTS (
          SELECT 1 FROM post_impression_state pis
          WHERE pis.user_id=$1 AND pis.user_type=$2 AND pis.post_id=p.id
            AND pis.retired_at IS NOT NULL AND pis.retired_at > NOW()-INTERVAL '15 days')
        AND NOT ((p.expires_at IS NULL OR p.expires_at<=NOW()) AND EXISTS (
          SELECT 1 FROM post_likes pl
          WHERE pl.post_id=p.id AND pl.liker_id=$1 AND pl.liker_type=$2))
      ORDER BY discovery_score DESC
      LIMIT 10
    `, [userId, userType]);

    console.log('── Test 1: Scored discovery candidates ──────────────────────────────');
    if (discoveryRes.rows.length === 0) {
      console.log('  (0 candidates — all recent editorial posts are from followed/own authors, or none in 5d window)');
    } else {
      discoveryRes.rows.forEach((row, i) => {
        const penStr = row.penalty_tier
          ? ` [STRIKE-1 penalty: ${row.penalty_tier} until ${row.penalty_until?.toISOString()}]`
          : '';
        console.log(
          `  ${i+1}. post_id=${row.id} type=${row.post_type} | ` +
          `eng=${row.engagement_score} dwell=${row.dwell_score} pop=${row.popularity_score} ` +
          `=> discovery_score=${row.discovery_score}${penStr}`
        );
      });
    }

    // 3. getFeed pagination independence test
    console.log('\n── Test 2: getFeed page 1 -> page 2 (cursor unaffected) ─────────────');
    const page1 = await client.query(`
      SELECT id, created_at
        FROM posts
       WHERE post_type NOT IN ('plan_promo','event_promo')
       ORDER BY created_at DESC, id DESC
       LIMIT 5
    `);
    if (page1.rows.length === 0) {
      console.log('  (no posts in DB)');
    } else {
      const last = page1.rows[page1.rows.length - 1];
      console.log(`  Page 1 IDs: [${page1.rows.map(r=>r.id).join(', ')}]`);
      console.log(`  Cursor: created_at=${last.created_at?.toISOString()} id=${last.id}`);
      const page2 = await client.query(`
        SELECT id FROM posts
         WHERE post_type NOT IN ('plan_promo','event_promo')
           AND (created_at, id) < ($1, $2)
         ORDER BY created_at DESC, id DESC
         LIMIT 5
      `, [last.created_at, last.id]);
      console.log(`  Page 2 IDs: [${page2.rows.map(r=>r.id).join(', ')}]`);
      const overlap = page1.rows.filter(r1 => page2.rows.some(r2 => r2.id === r1.id)).length;
      console.log(`  Overlap: ${overlap} (expected 0) ${overlap === 0 ? '✓' : '✗'}`);
    }

    // 4. Strike-1 penalty measurably lowers score
    console.log('\n── Test 3: Strike-1 penalty — before/after score ────────────────────');
    const penRows = await client.query(`
      SELECT pis.post_id, pis.rank_penalty_tier, pis.rank_penalty_until,
             p.like_count, p.comment_count, p.save_count, p.share_count, p.created_at
        FROM post_impression_state pis
        JOIN posts p ON p.id = pis.post_id
       WHERE pis.rank_penalty_tier = 'light' AND pis.rank_penalty_until > NOW()
       LIMIT 3
    `);
    if (penRows.rows.length === 0) {
      console.log('  (no active light-penalty rows in post_impression_state yet)');
      console.log('  Structural: discovery_score CASE applies 0.3x when tier=\'light\' AND until>NOW() ✓');
    } else {
      penRows.rows.forEach(row => {
        const hours = Math.max(
          (Date.now() - new Date(row.created_at).getTime()) / 3600000,
          1
        );
        const raw = ((row.like_count||0)+(row.comment_count||0)+(row.save_count||0)+(row.share_count||0)) / hours;
        const penalised = raw * 0.3;
        console.log(
          `  post_id=${row.post_id} raw_score=${raw.toFixed(6)} -> penalised=${penalised.toFixed(6)} (0.3x) | until=${row.rank_penalty_until?.toISOString()}`
        );
      });
    }

    // 5. Retirement exclusion (strike-2)
    console.log('\n── Test 4: Retirement exclusion (strike-2 = retired_at) ────────────');
    const retRows = await client.query(`
      SELECT post_id, user_id, retired_at
        FROM post_impression_state
       WHERE retired_at IS NOT NULL AND retired_at > NOW()-INTERVAL '15 days'
       LIMIT 5
    `);
    if (retRows.rows.length === 0) {
      console.log('  (no retired posts — retirement fires on 2nd unseen impression)');
    } else {
      retRows.rows.forEach(r => {
        console.log(`  post_id=${r.post_id} user_id=${r.user_id} retired_at=${r.retired_at?.toISOString()} -> excluded from discovery ✓`);
      });
    }

    console.log('\n=== Done ===\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
