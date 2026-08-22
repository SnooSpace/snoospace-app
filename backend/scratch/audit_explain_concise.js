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

async function main() {
  const c = await pool.connect();
  const userId = 130;
  const userType = 'member';

  const runExplain = async (name, queryFn) => {
    console.log(`\n================ ${name} ================`);
    for (const lim of [10, 30]) {
      const q = queryFn(lim);
      const res = await c.query(q);
      const lines = res.rows.map(r => r['QUERY PLAN']);
      const planTime = lines.find(l => l.includes('Planning Time:'));
      const execTime = lines.find(l => l.includes('Execution Time:'));
      console.log(`LIMIT ${lim} -> ${planTime} | ${execTime}`);
      // Find all Seq Scans
      const seqScans = lines.filter(l => l.includes('Seq Scan on'));
      console.log(`  Seq scans (${seqScans.length}):`);
      seqScans.forEach(s => console.log('    ' + s.trim()));
    }
  };

  try {
    // 1. Post discovery
    await runExplain('1. POSTS DISCOVERY', (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH engagement_raw AS (
        SELECT p.post_type, SUM(1.0) AS weight FROM post_likes l JOIN posts p ON l.post_id = p.id WHERE l.liker_id = ${userId} AND l.liker_type = '${userType}' GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(2.0) AS weight FROM post_comments c JOIN posts p ON c.post_id = p.id WHERE c.commenter_id = ${userId} AND c.commenter_type = '${userType}' GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight FROM post_saves s JOIN posts p ON s.post_id = p.id WHERE s.saver_id = ${userId} AND s.saver_type = '${userType}' GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight FROM post_shares sh JOIN posts p ON sh.post_id = p.id WHERE sh.sharer_id = ${userId} AND sh.sharer_type = '${userType}' GROUP BY p.post_type
      ),
      engagement_agg AS (SELECT post_type, SUM(weight) AS total_weight FROM engagement_raw GROUP BY post_type),
      engagement_max AS (SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg),
      engagement_norm AS (SELECT ea.post_type, ea.total_weight / em.max_weight AS engagement_score FROM engagement_agg ea CROSS JOIN engagement_max em),
      dwell_aff AS (SELECT post_type, AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score FROM unique_view_events WHERE user_id = ${userId} AND user_type = '${userType}' GROUP BY post_type),
      daily_discovery_count AS (SELECT COUNT(DISTINCT post_id) AS cnt FROM post_impression_state WHERE user_id = ${userId} AND user_type = '${userType}' AND first_discovered_at >= NOW() - INTERVAL '24 hours')
      SELECT p.id, COALESCE(en.engagement_score, 0) + COALESCE(da.dwell_score, 0) AS discovery_score
      FROM posts p
      LEFT JOIN engagement_norm en ON en.post_type = p.post_type
      LEFT JOIN dwell_aff da ON da.post_type = p.post_type
      WHERE p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND p.post_type NOT IN ('plan_promo', 'event_promo')
        AND NOT (p.author_id = ${userId} AND p.author_type = '${userType}')
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = ${userId} AND f.follower_type = '${userType}'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
            AND f.is_superseded_by_circle = false
        )
      ORDER BY discovery_score DESC
      LIMIT ${limit}
    `);

    // 2. Event discovery
    await runExplain('2. EVENTS DISCOVERY', (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH followed_communities AS (
        SELECT following_id FROM follows WHERE follower_id = ${userId} AND follower_type = '${userType}' AND following_type = 'community'
      ),
      event_scores AS (
        SELECT e.id,
          (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
          (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int AS score
        FROM events e
        INNER JOIN communities c ON e.community_id = c.id
        LEFT JOIN followed_communities fc ON e.community_id = fc.following_id
        WHERE e.is_published = true AND e.start_datetime > NOW() AND (e.is_cancelled = false OR e.is_cancelled IS NULL)
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT ${limit} OFFSET 0
      )
      SELECT * FROM event_scores
    `);

    // 3. Opportunity discovery
    await runExplain('3. OPPORTUNITIES DISCOVERY', (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH engagement_raw AS (
        SELECT opportunity_id, 1.0 AS weight FROM opportunity_likes WHERE liker_id = ${userId} AND liker_type = '${userType}'
        UNION ALL
        SELECT opportunity_id, 2.0 AS weight FROM opportunity_comments WHERE commenter_id = ${userId} AND commenter_type = '${userType}'
        UNION ALL
        SELECT opportunity_id, 3.0 AS weight FROM opportunity_saves WHERE saver_id = ${userId} AND saver_type = '${userType}'
      ),
      engagement_agg AS (SELECT opportunity_id, SUM(weight) AS total_weight FROM engagement_raw GROUP BY opportunity_id),
      engagement_max AS (SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg),
      engagement_norm AS (SELECT ea.opportunity_id, ea.total_weight / em.max_weight AS engagement_score FROM engagement_agg ea CROSS JOIN engagement_max em)
      SELECT o.id, COALESCE(en.engagement_score, 0) AS discovery_score
      FROM opportunities o
      JOIN communities c ON o.creator_id::integer = c.id
      LEFT JOIN engagement_norm en ON en.opportunity_id = o.id
      WHERE o.status = 'active' AND o.creator_type = 'community' AND (o.expires_at IS NULL OR o.expires_at > NOW()) AND o.closed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM follows f WHERE f.follower_id = ${userId} AND f.follower_type = '${userType}' AND f.following_id = o.creator_id::integer AND f.following_type = 'community'
        )
      ORDER BY discovery_score DESC, o.created_at DESC
      LIMIT ${limit}
    `);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
