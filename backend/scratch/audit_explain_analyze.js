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

  try {
    console.log('================ 1. POSTS DISCOVERY: EXPLAIN (ANALYZE, BUFFERS) ================\n');
    
    const postQuery = (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH engagement_raw AS (
        SELECT p.post_type, SUM(1.0) AS weight
          FROM post_likes l
          JOIN posts p ON l.post_id = p.id
         WHERE l.liker_id = ${userId} AND l.liker_type = '${userType}'
         GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(2.0) AS weight
          FROM post_comments c
          JOIN posts p ON c.post_id = p.id
         WHERE c.commenter_id = ${userId} AND c.commenter_type = '${userType}'
         GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_saves s
          JOIN posts p ON s.post_id = p.id
         WHERE s.saver_id = ${userId} AND s.saver_type = '${userType}'
         GROUP BY p.post_type
        UNION ALL
        SELECT p.post_type, SUM(3.0) AS weight
          FROM post_shares sh
          JOIN posts p ON sh.post_id = p.id
         WHERE sh.sharer_id = ${userId} AND sh.sharer_type = '${userType}'
         GROUP BY p.post_type
      ),
      engagement_agg AS (
        SELECT post_type, SUM(weight) AS total_weight
          FROM engagement_raw
         GROUP BY post_type
      ),
      engagement_max AS (
        SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
      ),
      engagement_norm AS (
        SELECT ea.post_type, ea.total_weight / em.max_weight AS engagement_score
          FROM engagement_agg ea
          CROSS JOIN engagement_max em
      ),
      dwell_aff AS (
        SELECT post_type, AVG(COALESCE(dwell_time_ms, 2500)) / 2500.0 AS dwell_score
          FROM unique_view_events
         WHERE user_id = ${userId} AND user_type = '${userType}'
         GROUP BY post_type
      ),
      viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id   = ${userId} AND f_aff.follower_type = '${userType}' AND f_aff.is_superseded_by_circle = false AND com_f.category IS NOT NULL
        UNION
        SELECT LOWER(com_c.category) AS category
          FROM community_member_circles cmc_aff
          JOIN communities com_c ON cmc_aff.community_id = com_c.id
         WHERE cmc_aff.member_id = ${userId} AND com_c.category IS NOT NULL
      ),
      category_match AS (
        SELECT p_cm.id AS post_id,
          CASE WHEN EXISTS (SELECT 1 FROM viewer_categories vc WHERE vc.category = LOWER(com_cm.category)) THEN 1.0 ELSE 0.0 END AS category_score
          FROM posts p_cm
          JOIN communities com_cm ON p_cm.author_id = com_cm.id AND p_cm.author_type = 'community'
      ),
      daily_discovery_count AS (
        SELECT COUNT(DISTINCT post_id) AS cnt
          FROM post_impression_state
         WHERE user_id = ${userId} AND user_type = '${userType}' AND first_discovered_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT p.id,
        COALESCE(en.engagement_score, 0) + COALESCE(da.dwell_score, 0) + 
        ((COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) + COALESCE(p.save_count, 0) + COALESCE(p.share_count, 0))::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 1.0)) +
        COALESCE(cm.category_score, 0) AS discovery_score
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      LEFT JOIN engagement_norm en ON en.post_type = p.post_type
      LEFT JOIN dwell_aff da ON da.post_type = p.post_type
      LEFT JOIN category_match cm ON cm.post_id = p.id
      LEFT JOIN post_impression_state pis_disc ON pis_disc.user_id = ${userId} AND pis_disc.user_type = '${userType}' AND pis_disc.post_id = p.id
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
    `;

    const pExp10 = await c.query(postQuery(10));
    console.log('--- Post Discovery (LIMIT 10) ---');
    console.log(pExp10.rows.map(r => r['QUERY PLAN']).join('\n'));

    const pExp30 = await c.query(postQuery(30));
    console.log('\n--- Post Discovery (LIMIT 30) ---');
    console.log(pExp30.rows.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n================ 2. EVENTS DISCOVERY: EXPLAIN (ANALYZE, BUFFERS) ================\n');

    const eventQuery = (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id = ${userId} AND f_aff.follower_type = '${userType}' AND f_aff.is_superseded_by_circle = false AND com_f.category IS NOT NULL
        UNION
        SELECT LOWER(com_c.category) AS category
          FROM community_member_circles cmc_aff
          JOIN communities com_c ON cmc_aff.community_id = com_c.id
         WHERE cmc_aff.member_id = ${userId} AND com_c.category IS NOT NULL
      ),
      followed_communities AS (
        SELECT following_id FROM follows WHERE follower_id = ${userId} AND follower_type = '${userType}' AND following_type = 'community'
      ),
      event_scores AS (
        SELECT e.id,
          (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
          (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int +
          (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 2) AS score
        FROM events e
        INNER JOIN communities c ON e.community_id = c.id
        LEFT JOIN followed_communities fc ON e.community_id = fc.following_id
        WHERE e.is_published = true AND e.start_datetime > NOW() AND (e.is_cancelled = false OR e.is_cancelled IS NULL)
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT ${limit} OFFSET 0
      )
      SELECT * FROM event_scores
    `;

    const eExp10 = await c.query(eventQuery(10));
    console.log('--- Events Discovery (LIMIT 10) ---');
    console.log(eExp10.rows.map(r => r['QUERY PLAN']).join('\n'));

    const eExp30 = await c.query(eventQuery(30));
    console.log('\n--- Events Discovery (LIMIT 30) ---');
    console.log(eExp30.rows.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n================ 3. OPPORTUNITIES DISCOVERY: EXPLAIN (ANALYZE, BUFFERS) ================\n');

    const oppQuery = (limit) => `
      EXPLAIN (ANALYZE, BUFFERS)
      WITH viewer_categories AS (
        SELECT LOWER(com_f.category) AS category
          FROM follows f_aff
          JOIN communities com_f ON f_aff.following_id = com_f.id AND f_aff.following_type = 'community'
         WHERE f_aff.follower_id = ${userId} AND f_aff.follower_type = '${userType}' AND f_aff.is_superseded_by_circle = false AND com_f.category IS NOT NULL
        UNION
        SELECT LOWER(com_c.category) AS category
          FROM community_member_circles cmc_aff
          JOIN communities com_c ON cmc_aff.community_id = com_c.id
         WHERE cmc_aff.member_id = ${userId} AND com_c.category IS NOT NULL
      ),
      engagement_raw AS (
        SELECT opportunity_id, 1.0 AS weight FROM opportunity_likes WHERE liker_id = ${userId} AND liker_type = '${userType}'
        UNION ALL
        SELECT opportunity_id, 2.0 AS weight FROM opportunity_comments WHERE commenter_id = ${userId} AND commenter_type = '${userType}'
        UNION ALL
        SELECT opportunity_id, 3.0 AS weight FROM opportunity_saves WHERE saver_id = ${userId} AND saver_type = '${userType}'
      ),
      engagement_agg AS (
        SELECT opportunity_id, SUM(weight) AS total_weight FROM engagement_raw GROUP BY opportunity_id
      ),
      engagement_max AS (
        SELECT GREATEST(MAX(total_weight), 1) AS max_weight FROM engagement_agg
      ),
      engagement_norm AS (
        SELECT ea.opportunity_id, ea.total_weight / em.max_weight AS engagement_score FROM engagement_agg ea CROSS JOIN engagement_max em
      ),
      daily_discovery_count AS (
        SELECT COUNT(DISTINCT opportunity_id) AS cnt FROM opportunity_impression_state WHERE user_id = ${userId} AND user_type = '${userType}' AND first_discovered_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT o.id,
        COALESCE(en.engagement_score, 0) + ((COALESCE(o.like_count, 0) + COALESCE(o.comment_count, 0) + COALESCE(o.save_count, 0) + COALESCE(o.share_count, 0))::float / GREATEST(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600.0, 1.0)) AS discovery_score
      FROM opportunities o
      JOIN communities c ON o.creator_id::integer = c.id
      LEFT JOIN engagement_norm en ON en.opportunity_id = o.id
      WHERE o.status = 'active' AND o.creator_type = 'community' AND (o.expires_at IS NULL OR o.expires_at > NOW()) AND o.closed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM follows f WHERE f.follower_id = ${userId} AND f.follower_type = '${userType}' AND f.following_id = o.creator_id::integer AND f.following_type = 'community'
        )
      ORDER BY discovery_score DESC, o.created_at DESC
      LIMIT ${limit}
    `;

    const oExp10 = await c.query(oppQuery(10));
    console.log('--- Opportunities Discovery (LIMIT 10) ---');
    console.log(oExp10.rows.map(r => r['QUERY PLAN']).join('\n'));

    const oExp30 = await c.query(oppQuery(30));
    console.log('\n--- Opportunities Discovery (LIMIT 30) ---');
    console.log(oExp30.rows.map(r => r['QUERY PLAN']).join('\n'));

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
