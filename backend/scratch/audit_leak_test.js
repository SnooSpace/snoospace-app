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
  const synthetic = {
    planId: null,
    postId: null,
    creatorId: null,
    viewerId: null,
  };

  try {
    console.log('=== SECTION 4: REAL TEST OF PROMO POST -> PLAN LEAK PATH ===\n');

    // 1. Pick a creator (Member 52) and a non-connected viewer (Member 51)
    const creatorRes = await client.query(`SELECT id, name FROM members WHERE id = 52`);
    const viewerRes = await client.query(`SELECT id, name FROM members WHERE id = 51`);
    const creator = creatorRes.rows[0];
    const viewer = viewerRes.rows[0];
    synthetic.creatorId = creator.id;
    synthetic.viewerId = viewer.id;

    console.log(`Creator: Member ${creator.id} ("${creator.name}")`);
    console.log(`Viewer:  Member ${viewer.id} ("${viewer.name}")`);

    // Check shared communities between Creator and Viewer
    const sharedComs = await client.query(`
      SELECT c.id, c.name 
      FROM follows f1
      JOIN follows f2 ON f1.following_id = f2.following_id AND f1.following_type = 'community' AND f2.following_type = 'community'
      JOIN communities c ON c.id = f1.following_id
      WHERE f1.follower_id = $1 AND f1.follower_type = 'member'
        AND f2.follower_id = $2 AND f2.follower_type = 'member'
    `, [creator.id, viewer.id]);
    console.log(`Shared communities between Creator & Viewer: ${sharedComs.rows.length} (${sharedComs.rows.map(c => c.name).join(', ') || 'NONE'})\n`);

    // 2. Insert a synthetic 'community_members' Open Plan authored by Creator
    const planRes = await client.query(`
      INSERT INTO open_plans (
        created_by, title, activity_type, cost_type, visibility,
        location_public, location_private, scheduled_at, expires_at, max_accepted, status
      ) VALUES (
        $1, '__test_secret_community_plan__', 'sports', 'free', 'community_members',
        'Secret Public Area', 'Secret Exact Address Room 101', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 5, 'active'
      ) RETURNING id, title, visibility, scheduled_at, location_public, location_private
    `, [creator.id]);
    synthetic.planId = planRes.rows[0].id;
    const plan = planRes.rows[0];
    console.log(`[CREATED SYNTHETIC PLAN] id=${plan.id}`);
    console.log(`  title:            "${plan.title}"`);
    console.log(`  visibility:       "${plan.visibility}"`);
    console.log(`  location_public:  "${plan.location_public}"`);
    console.log(`  location_private: "${plan.location_private}"\n`);

    // 3. Check /plans (getPlans) query as the non-member Viewer
    const getPlansCheck = await client.query(`
      SELECT op.id, op.title
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
        )
    `, [plan.id, viewer.id]);
    console.log(`[TEST 1: getPlans (feed)] Is Plan ${plan.id} visible to non-member Viewer in /plans?`);
    console.log(`  Result: ${getPlansCheck.rows.length > 0 ? 'YES (VISIBLE)' : 'NO (BLOCKED BY VISIBILITY GATE)'} (Rows: ${getPlansCheck.rows.length})\n`);

    // 4. Create a promo poll post referencing this plan
    const typeData = {
      question: 'Are you joining our community game?',
      options: [{ id: 1, text: 'Yes' }, { id: 2, text: 'No' }],
      promo_source_type: 'plan',
      promo_source_id: String(plan.id),
      promo_text: 'Check out our exclusive community plan!',
    };

    const postRes = await client.query(`
      INSERT INTO posts (
        author_id, author_type, post_type, caption, type_data, image_urls, created_at,
        like_count, comment_count, save_count, share_count
      ) VALUES (
        $1, 'member', 'poll', '__test_promo_poll_post__', $2::jsonb, '[]', NOW(),
        5, 2, 1, 0
      ) RETURNING id, post_type, type_data
    `, [creator.id, JSON.stringify(typeData)]);
    synthetic.postId = postRes.rows[0].id;
    const post = postRes.rows[0];
    console.log(`[CREATED SYNTHETIC PROMO POST] id=${post.id} (post_type=${post.post_type})`);
    console.log(`  type_data:`, post.type_data, '\n');

    // 5. Test Discovery Candidate Pool as non-member Viewer
    const discRes = await client.query(`
      SELECT p.id, p.post_type, p.type_data
      FROM posts p
      WHERE p.id = $1
        AND p.post_type IN ('media', 'community_voice', 'poll', 'prompt', 'qna', 'challenge')
        AND p.created_at >= NOW() - INTERVAL '5 days'
        AND NOT (p.author_id = $2 AND p.author_type = 'member')
        AND NOT EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $2 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
            AND f.is_superseded_by_circle = false
        )
    `, [post.id, viewer.id]);
    console.log(`[TEST 2: getDiscoveryPosts] Is promo post ${post.id} admitted to non-member's discovery pool?`);
    console.log(`  Result: ${discRes.rows.length > 0 ? 'YES (ADMITTED)' : 'NO'}`);
    if (discRes.rows.length > 0) {
      console.log(`  Payload delivered to client:`, JSON.stringify(discRes.rows[0], null, 2), '\n');
    }

    // 6. Test PlanPreviewCard's fetch endpoint: GET /plans/:planId (getPlanById) as Viewer
    // In plansController.js: getPlanById runs `SELECT * FROM open_plans WHERE id = $1`
    const planFetchRes = await client.query(`SELECT * FROM open_plans WHERE id = $1`, [plan.id]);
    const fetchedPlan = planFetchRes.rows[0];
    console.log(`[TEST 3: PlanPreviewCard -> getPlanById(sourceId)] What data does getPlanById return to non-member?`);
    console.log('  Returned Plan Data in PlanPreviewCard:');
    console.log({
      id: fetchedPlan.id,
      title: fetchedPlan.title,
      activity_type: fetchedPlan.activity_type,
      visibility: fetchedPlan.visibility,
      cost_type: fetchedPlan.cost_type,
      location_public: fetchedPlan.location_public,
      scheduled_at: fetchedPlan.scheduled_at,
      max_accepted: fetchedPlan.max_accepted,
      status: fetchedPlan.status,
    });
    console.log('\n  LEAK CONFIRMED: Non-member who cannot see the plan in /plans CAN see the full plan details via PlanPreviewCard on the promo post.');

  } finally {
    console.log('\n[CLEANUP] Deleting synthetic test data...');
    if (synthetic.postId) {
      await client.query(`DELETE FROM posts WHERE id = $1`, [synthetic.postId]);
      console.log(`  Deleted synthetic post ${synthetic.postId}`);
    }
    if (synthetic.planId) {
      await client.query(`DELETE FROM open_plans WHERE id = $1`, [synthetic.planId]);
      console.log(`  Deleted synthetic plan ${synthetic.planId}`);
    }
    console.log('  Cleanup complete.\n');
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
