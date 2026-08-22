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
  const comRes = await pool.query('SELECT id, name FROM communities LIMIT 3');
  console.log('Sample communities:', comRes.rows);
  const sampleComId = comRes.rows[0]?.id || 1;

  console.log(`\n--- EXPLAIN ANALYZE for single community audience (id=${sampleComId}) ---`);
  const explainSingle = await pool.query(`
    EXPLAIN ANALYZE
    SELECT follower_id AS member_id
      FROM follows
     WHERE following_id = $1
       AND following_type = 'community'
       AND follower_type = 'member'
       AND is_superseded_by_circle = false
    UNION
    SELECT member_id
      FROM community_member_circles
     WHERE community_id = $1
  `, [sampleComId]);
  explainSingle.rows.forEach(r => console.log(r['QUERY PLAN']));

  console.log(`\n--- EXPLAIN ANALYZE for multi-community audience (e.g. array of 3 communities) ---`);
  const comIds = comRes.rows.map(r => r.id);
  const explainMulti = await pool.query(`
    EXPLAIN ANALYZE
    SELECT follower_id AS member_id
      FROM follows
     WHERE following_id = ANY($1::int[])
       AND following_type = 'community'
       AND follower_type = 'member'
       AND is_superseded_by_circle = false
    UNION
    SELECT member_id
      FROM community_member_circles
     WHERE community_id = ANY($1::int[])
  `, [comIds]);
  explainMulti.rows.forEach(r => console.log(r['QUERY PLAN']));

  // Also check check if a specific viewer is in the audience of a set of communities:
  const VIEWER_ID = 51;
  console.log(`\n--- EXPLAIN ANALYZE for membership check (viewer=${VIEWER_ID} in communities ${JSON.stringify(comIds)}) ---`);
  const explainCheck = await pool.query(`
    EXPLAIN ANALYZE
    SELECT EXISTS (
      SELECT 1 FROM follows
       WHERE follower_id = $1
         AND follower_type = 'member'
         AND following_type = 'community'
         AND following_id = ANY($2::int[])
         AND is_superseded_by_circle = false
      UNION ALL
      SELECT 1 FROM community_member_circles
       WHERE member_id = $1
         AND community_id = ANY($2::int[])
    ) AS is_audience_member
  `, [VIEWER_ID, comIds]);
  explainCheck.rows.forEach(r => console.log(r['QUERY PLAN']));

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
