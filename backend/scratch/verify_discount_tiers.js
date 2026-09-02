require('c:/Dev/SnooSpace/backend/node_modules/dotenv').config({ path: 'c:/Dev/SnooSpace/backend/.env' });
const { createPool } = require('c:/Dev/SnooSpace/backend/config/db');
const pool = createPool();

async function runTransactionTests() {
  const client = await pool.connect();
  try {
    console.log('--- STARTING ISOLATED TRANSACTION TEST (DISCOUNT TIERS & FEED QUALIFICATION) ---');
    await client.query('BEGIN');

    // 1. Create a test community C1, viewer M1, co-member M2 (follows only), co-member M3 (circle member), direct follow M4
    const commRes = await client.query(`
      INSERT INTO communities (name, username, category)
      VALUES ('Test Community', 'test_comm_boost', 'tech')
      RETURNING id;
    `);
    const commId = commRes.rows[0].id;

    const m1Res = await client.query(`
      INSERT INTO members (name, username, email, phone, dob, gender, interests)
      VALUES ('Viewer M1', 'viewer_m1_boost', 'viewer_m1@test.com', '9999999991', '2000-01-01', 'Female', '["Fitness", "Adventure", "Tech"]')
      RETURNING id;
    `);
    const m1Id = m1Res.rows[0].id;

    const m2Res = await client.query(`
      INSERT INTO members (name, username, email, phone, dob, gender, interests)
      VALUES ('Co-member Follow M2', 'comember_m2_boost', 'm2@test.com', '9999999992', '2000-01-01', 'Female', '["Fitness", "Adventure", "Tech"]')
      RETURNING id;
    `);
    const m2Id = m2Res.rows[0].id;

    const m3Res = await client.query(`
      INSERT INTO members (name, username, email, phone, dob, gender, interests)
      VALUES ('Co-member Circle M3', 'comember_m3_boost', 'm3@test.com', '9999999993', '2000-01-01', 'Female', '["Fitness", "Adventure", "Tech"]')
      RETURNING id;
    `);
    const m3Id = m3Res.rows[0].id;

    const m4Res = await client.query(`
      INSERT INTO members (name, username, email, phone, dob, gender, interests)
      VALUES ('Direct Follow M4', 'direct_m4_boost', 'm4@test.com', '9999999994', '2000-01-01', 'Female', '["Fitness", "Adventure", "Tech"]')
      RETURNING id;
    `);
    const m4Id = m4Res.rows[0].id;

    // Follows setup:
    // M1 follows C1
    await client.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, 'member', $2, 'community')`, [m1Id, commId]);
    // M2 follows C1 (follows only)
    await client.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, 'member', $2, 'community')`, [m2Id, commId]);
    // M3 follows C1 AND is in community_member_circles with C1
    await client.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, 'member', $2, 'community')`, [m3Id, commId]);
    await client.query(`INSERT INTO community_member_circles (community_id, member_id) VALUES ($1, $2)`, [commId, m3Id]);
    // M1 follows M4 directly
    await client.query(`INSERT INTO follows (follower_id, follower_type, following_id, following_type) VALUES ($1, 'member', $2, 'member')`, [m1Id, m4Id]);

    // Create 3 posts (one by M2, one by M3, one by M4)
    const baseTime = new Date('2026-09-01T12:00:00Z');
    const p2Res = await client.query(`
      INSERT INTO posts (author_id, author_type, post_type, image_urls, created_at)
      VALUES ($1, 'member', 'media', '["https://example.com/test.jpg"]', $2)
      RETURNING id;
    `, [m2Id, baseTime]);
    const p2Id = p2Res.rows[0].id;

    const p3Res = await client.query(`
      INSERT INTO posts (author_id, author_type, post_type, image_urls, created_at)
      VALUES ($1, 'member', 'media', '["https://example.com/test.jpg"]', $2)
      RETURNING id;
    `, [m3Id, baseTime]);
    const p3Id = p3Res.rows[0].id;

    const p4Res = await client.query(`
      INSERT INTO posts (author_id, author_type, post_type, image_urls, created_at)
      VALUES ($1, 'member', 'media', '["https://example.com/test.jpg"]', $2)
      RETURNING id;
    `, [m4Id, baseTime]);
    const p4Id = p4Res.rows[0].id;

    // Execute getFeed query logic for viewer M1
    const testQuery = `
      SELECT 
        p.id,
        p.author_id,
        p.created_at,
        effective_calc.effective_sort_time,
        EXTRACT(EPOCH FROM (p.created_at - effective_calc.effective_sort_time)) / 3600.0 AS discount_hours
      FROM posts p
      LEFT JOIN post_impression_state pis_rank
        ON pis_rank.user_id = $1 AND pis_rank.user_type = $2 AND pis_rank.post_id = p.id
      CROSS JOIN LATERAL (
        SELECT 
          CASE
            WHEN pis_rank.rank_penalty_tier = 'heavy'
             AND pis_rank.rank_penalty_until IS NOT NULL
             AND NOW() < pis_rank.rank_penalty_until
            THEN p.created_at - INTERVAL '10 days'
            WHEN pis_rank.rank_penalty_tier = 'light'
             AND pis_rank.rank_penalty_until IS NOT NULL
             AND NOW() < pis_rank.rank_penalty_until
            THEN p.created_at - INTERVAL '3 days'
            WHEN NOT (
              (p.author_id = $1 AND p.author_type = $2)
              OR EXISTS (
                SELECT 1 FROM follows f_d
                WHERE f_d.follower_id = $1 AND f_d.follower_type = $2
                  AND f_d.following_id = p.author_id AND f_d.following_type = p.author_type
                  AND f_d.is_superseded_by_circle = false
              )
              OR (p.author_type = 'member' AND EXISTS (
                SELECT 1 FROM creator_follows cf_d
                WHERE cf_d.follower_id = $1 AND cf_d.follower_type = $2
                  AND cf_d.creator_id = p.author_id
                  AND cf_d.is_dormant = false
                  AND cf_d.is_superseded_by_circle = false
              ))
              OR ($2 = 'member' AND p.author_type = 'member' AND EXISTS (
                SELECT 1 FROM circles ci_d
                WHERE (ci_d.user_a_id = $1 AND ci_d.user_b_id = p.author_id)
                   OR (ci_d.user_b_id = $1 AND ci_d.user_a_id = p.author_id)
              ))
              OR ($2 = 'community' AND p.author_type = 'member' AND EXISTS (
                SELECT 1 FROM community_member_circles cc_d
                WHERE cc_d.community_id = $1 AND cc_d.member_id = p.author_id
              ))
              OR ($2 = 'member' AND p.author_type = 'community' AND EXISTS (
                SELECT 1 FROM community_member_circles cc_d
                WHERE cc_d.community_id = p.author_id AND cc_d.member_id = $1
              ))
            ) THEN
              CASE
                WHEN EXISTS (
                  SELECT 1 FROM follows f1_cmc
                  JOIN follows f2_cmc
                    ON f1_cmc.following_id = f2_cmc.following_id
                   AND f1_cmc.following_type = 'community'
                   AND f2_cmc.following_type = 'community'
                  WHERE f1_cmc.follower_id = $1 AND f1_cmc.follower_type = $2
                    AND f2_cmc.follower_id = p.author_id AND f2_cmc.follower_type = 'member'
                    AND (
                      EXISTS (SELECT 1 FROM community_member_circles cmc_v WHERE cmc_v.community_id = f1_cmc.following_id AND cmc_v.member_id = $1)
                      OR EXISTS (SELECT 1 FROM community_member_circles cmc_a WHERE cmc_a.community_id = f1_cmc.following_id AND cmc_a.member_id = p.author_id)
                    )
                ) THEN p.created_at - INTERVAL '6 hours'
                ELSE p.created_at - INTERVAL '1 day'
              END
            ELSE p.created_at
          END AS effective_sort_time
      ) effective_calc
      WHERE p.id IN ($3, $4, $5)
      ORDER BY effective_calc.effective_sort_time DESC, p.id DESC;
    `;

    const resResults = await client.query(testQuery, [m1Id, 'member', p2Id, p3Id, p4Id]);
    console.log('Test Query Results:');
    for (const r of resResults.rows) {
      console.log(`Post ${r.id} (Author ${r.author_id}): discount = ${r.discount_hours} hours, effective_time = ${r.effective_sort_time}`);
    }

    // Assertions:
    // P4 (Direct Follow) -> discount_hours = 0
    // P3 (Circle co-member) -> discount_hours = 6
    // P2 (Follows-only co-member) -> discount_hours = 24
    const r4 = resResults.rows.find(r => r.id === p4Id);
    const r3 = resResults.rows.find(r => r.id === p3Id);
    const r2 = resResults.rows.find(r => r.id === p2Id);

    if (parseFloat(r4.discount_hours) !== 0.0) throw new Error(`P4 discount expected 0.0, got ${r4.discount_hours}`);
    if (parseFloat(r3.discount_hours) !== 6.0) throw new Error(`P3 discount expected 6.0, got ${r3.discount_hours}`);
    if (parseFloat(r2.discount_hours) !== 24.0) throw new Error(`P2 discount expected 24.0, got ${r2.discount_hours}`);

    console.log('✅ ALL DISCOUNT TIER ASSERTIONS PASSED (Direct Follow=0h, Circle Co-Member=-6h, Follow Co-Member=-24h).');

    // Also check getDiscoveryPosts negation for M1
    const discNegCheck = await client.query(`
      SELECT p.id
      FROM posts p
      WHERE p.id IN ($3, $4, $5)
        AND NOT (
          p.author_type = 'member'
          AND (p.author_id != $1 OR $2 != 'member')
          AND EXISTS (
            SELECT 1 FROM follows f1_cm_neg
            JOIN follows f2_cm_neg
              ON f1_cm_neg.following_id = f2_cm_neg.following_id
             AND f1_cm_neg.following_type = 'community'
             AND f2_cm_neg.following_type = 'community'
            WHERE f1_cm_neg.follower_id = $1 AND f1_cm_neg.follower_type = $2
              AND f2_cm_neg.follower_id = p.author_id AND f2_cm_neg.follower_type = 'member'
          )
        )
    `, [m1Id, 'member', p2Id, p3Id, p4Id]);

    // P2 and P3 are co-members, so they MUST be excluded by the negation.
    // Only P4 (direct follow, not excluded by this specific co-member clause, though excluded by direct follow clause) passes this specific filter.
    const discPostIds = discNegCheck.rows.map(r => r.id);
    console.log('Posts passing co-member negation in discovery:', discPostIds);
    if (discPostIds.includes(p2Id) || discPostIds.includes(p3Id)) {
      throw new Error('Discovery negation failed: P2 or P3 passed through co-member exclusion.');
    }
    console.log('✅ DISCOVERY MIRROR NEGATION ASSERTION PASSED (Co-members P2 and P3 successfully excluded from discovery).');

  } catch (err) {
    console.error('Fatal in test:', err);
    process.exit(1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

runTransactionTests();
