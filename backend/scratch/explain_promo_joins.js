'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const promoPosts = await pool.query(`
    SELECT id, post_type, type_data
    FROM posts
    WHERE (type_data->>'promo_source_type') = 'plan'
       OR (type_data->>'promo_source_id') IS NOT NULL
    LIMIT 5
  `);
  console.log('Sample promo posts in DB:', promoPosts.rows);

  // Check if open_plans has any rows
  const plans = await pool.query('SELECT id, title, visibility, scoped_community_id FROM open_plans LIMIT 5');
  console.log('Sample open plans:', plans.rows);

  // Let's test EXPLAIN ANALYZE joining posts with open_plans via type_data
  console.log('\n--- EXPLAIN ANALYZE: JOIN posts -> open_plans via (posts.type_data->>\'promo_source_id\')::int = open_plans.id ---');
  const explainJoin = await pool.query(`
    EXPLAIN ANALYZE
    SELECT p.id AS post_id, p.author_id, p.post_type, op.id AS plan_id, op.visibility, op.scoped_community_id
    FROM posts p
    JOIN open_plans op
      ON (p.type_data->>'promo_source_id')::int = op.id
    WHERE (p.type_data->>'promo_source_type') = 'plan'
      AND p.created_at >= NOW() - INTERVAL '7 days'
  `);
  explainJoin.rows.forEach(r => console.log(r['QUERY PLAN']));

  // Let's test EXPLAIN ANALYZE checking if a viewer qualifies for promo post delivery
  const VIEWER_ID = 51;
  console.log(`\n--- EXPLAIN ANALYZE: Viewer (${VIEWER_ID}) targeting check for promo posts ---`);
  const explainViewerTarget = await pool.query(`
    EXPLAIN ANALYZE
    WITH viewer_communities AS (
      SELECT following_id AS community_id
        FROM follows
       WHERE follower_id = $1
         AND follower_type = 'member'
         AND following_type = 'community'
         AND is_superseded_by_circle = false
      UNION
      SELECT community_id
        FROM community_member_circles
       WHERE member_id = $1
    )
    SELECT p.id, p.caption, p.type_data, op.id AS plan_id, op.visibility, op.scoped_community_id
      FROM posts p
      JOIN open_plans op
        ON (p.type_data->>'promo_source_id')::int = op.id
     WHERE (p.type_data->>'promo_source_type') = 'plan'
       AND p.created_at >= NOW() - INTERVAL '7 days'
       AND op.scheduled_at >= NOW() - INTERVAL '3 hours'
       AND (
         op.visibility = 'everyone'
         OR (
           op.visibility = 'community_members'
           AND (
             (op.scoped_community_id IS NOT NULL AND op.scoped_community_id IN (SELECT community_id FROM viewer_communities))
             OR
             (op.scoped_community_id IS NULL AND EXISTS (
               SELECT 1 FROM follows f_host
                WHERE f_host.follower_id = op.created_by
                  AND f_host.follower_type = 'member'
                  AND f_host.following_type = 'community'
                  AND f_host.following_id IN (SELECT community_id FROM viewer_communities)
             ))
           )
         )
       )
  `, [VIEWER_ID]);
  explainViewerTarget.rows.forEach(r => console.log(r['QUERY PLAN']));

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
