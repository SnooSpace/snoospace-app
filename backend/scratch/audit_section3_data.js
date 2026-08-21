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
  const client = await pool.connect();
  try {
    console.log('=== SECTION 3: REAL DATA CHECK ===\n');

    // 1. Total distinct creators with visibility='community_members'
    const q1 = await client.query(`
      SELECT 
        COUNT(DISTINCT created_by) AS distinct_creators,
        COUNT(*) AS total_community_member_plans,
        COUNT(CASE WHEN scoped_community_id IS NOT NULL THEN 1 END) AS scoped_plans,
        COUNT(CASE WHEN scoped_community_id IS NULL THEN 1 END) AS unscoped_plans
      FROM open_plans
      WHERE visibility = 'community_members'
    `);
    console.log('1. Summary of community_members plans:');
    console.table(q1.rows);

    // 2. Of those creators, how many belong to / follow > 1 community?
    const q2 = await client.query(`
      WITH plan_creators AS (
        SELECT DISTINCT created_by
        FROM open_plans
        WHERE visibility = 'community_members'
      ),
      creator_community_counts AS (
        SELECT 
          pc.created_by,
          (
            SELECT COUNT(DISTINCT f.following_id)
            FROM follows f
            WHERE f.follower_id = pc.created_by 
              AND f.follower_type = 'member' 
              AND f.following_type = 'community'
          ) AS followed_communities_count,
          (
            SELECT COUNT(DISTINCT cmc.community_id)
            FROM community_member_circles cmc
            WHERE cmc.member_id = pc.created_by
          ) AS circled_communities_count
        FROM plan_creators pc
      )
      SELECT 
        created_by,
        followed_communities_count,
        circled_communities_count,
        (followed_communities_count + circled_communities_count) AS total_community_connections
      FROM creator_community_counts
      ORDER BY followed_communities_count DESC
    `);
    console.log('2. Creators and their community counts:');
    console.table(q2.rows);

    const creatorsMultiCom = q2.rows.filter(r => parseInt(r.followed_communities_count, 10) > 1);
    console.log(`Creators in > 1 community (via follows): ${creatorsMultiCom.length} / ${q2.rows.length}`);

    // 3. Let's find one real example:
    // Creator in 2+ communities who created an open_plan with visibility='community_members'.
    // Test if a member of Community B (who does NOT follow Community A) can see the plan in getPlans!
    console.log('\n3. Real test case of visibility leak / behavior:');
    const sampleCreator = creatorsMultiCom[0];
    if (sampleCreator) {
      const creatorId = sampleCreator.created_by;
      console.log(`Creator ID: ${creatorId}`);

      // Communities creator follows
      const comsRes = await client.query(`
        SELECT c.id, c.name, c.category
        FROM follows f
        JOIN communities c ON f.following_id = c.id
        WHERE f.follower_id = $1 AND f.follower_type = 'member' AND f.following_type = 'community'
      `, [creatorId]);
      console.log('Creator follows communities:', comsRes.rows);

      // Plans created by this creator
      const plansRes = await client.query(`
        SELECT id, title, visibility, scoped_community_id, status, scheduled_at, expires_at
        FROM open_plans
        WHERE created_by = $1 AND visibility = 'community_members'
        LIMIT 5
      `, [creatorId]);
      console.log('Plans created by this creator:', plansRes.rows);

      if (comsRes.rows.length >= 2 && plansRes.rows.length > 0) {
        const comA = comsRes.rows[0];
        const comB = comsRes.rows[1];
        const plan = plansRes.rows[0];

        // Find a member who follows Com B, but does NOT follow Com A
        const viewerRes = await client.query(`
          SELECT m.id, m.name, m.gender
          FROM members m
          WHERE m.id != $1
            AND EXISTS (
              SELECT 1 FROM follows f
              WHERE f.follower_id = m.id AND f.follower_type = 'member'
                AND f.following_id = $2 AND f.following_type = 'community'
            )
            AND NOT EXISTS (
              SELECT 1 FROM follows f
              WHERE f.follower_id = m.id AND f.follower_type = 'member'
                AND f.following_id = $3 AND f.following_type = 'community'
            )
          LIMIT 1
        `, [creatorId, comB.id, comA.id]);

        if (viewerRes.rows.length > 0) {
          const testViewer = viewerRes.rows[0];
          console.log(`\nTest Viewer: Member ${testViewer.id} ("${testViewer.name}", gender=${testViewer.gender})`);
          console.log(`  - Follows Community B (${comB.name}, id=${comB.id})`);
          console.log(`  - DOES NOT follow Community A (${comA.name}, id=${comA.id})`);

          // Run the exact getPlans query logic for this test viewer against plan.id
          const getPlansQuery = `
            SELECT op.id, op.title, op.visibility, op.scoped_community_id, op.created_by,
              (
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
                    WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
                      AND f2.follower_id = op.created_by AND f2.follower_type = 'member'
                  )
                )
                OR (
                  op.visibility = 'community_members'
                  AND op.scoped_community_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM follows
                    WHERE follower_id = $1
                      AND follower_type = 'member'
                      AND following_id = op.scoped_community_id
                      AND following_type = 'community'
                  )
                )
              ) AS visibility_passed
            FROM open_plans op
            WHERE op.id = $2
          `;

          const testResult = await client.query(getPlansQuery, [testViewer.id, plan.id]);
          console.log('\nQuery Result for Test Viewer against Plan:');
          console.table(testResult.rows);
          console.log(`Result: Plan ${plan.id} (scoped_community_id=${plan.scoped_community_id ?? 'NULL'}) visibility_passed = ${testResult.rows[0]?.visibility_passed}`);
        } else {
          console.log('No single viewer found following ONLY Com B and not Com A.');
        }
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
