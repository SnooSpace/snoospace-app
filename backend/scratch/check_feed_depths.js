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
  const totalPosts = await c.query("SELECT count(*) FROM posts WHERE status = 'active'");
  console.log('Total active posts in entire database:', totalPosts.rows[0].count);

  // Check top 10 most active members by follows count
  const topFollowers = await c.query(`
    SELECT m.id, m.username, count(f.id) as follow_count
    FROM members m
    JOIN follows f ON f.follower_id = m.id AND f.follower_type = 'member'
    GROUP BY m.id, m.username
    ORDER BY follow_count DESC
    LIMIT 10
  `);

  console.log('\nTop 10 members by follow count and their actual getFeed candidate counts:');
  for (const m of topFollowers.rows) {
    // Run the exact WHERE clause from getFeed
    const feedRes = await c.query(`
      SELECT count(*) FROM posts p
      WHERE (
        -- Own posts
        (p.author_id = $1 AND p.author_type = 'member')
        
        -- Standard active follows
        OR EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $1 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
            AND f.is_superseded_by_circle = false
            AND p.created_at >= f.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice')
                   THEN INTERVAL '15 days'
                   ELSE INTERVAL '7 days'
              END
            )
        )
        
        -- Creator follows
        OR (p.author_type = 'member' AND EXISTS (
          SELECT 1 FROM creator_follows cf
          WHERE cf.follower_id = $1 AND cf.follower_type = 'member'
            AND cf.creator_id = p.author_id
            AND cf.is_dormant = false
            AND cf.is_superseded_by_circle = false
            AND p.created_at >= cf.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice')
                   THEN INTERVAL '15 days'
                   ELSE INTERVAL '7 days'
              END
            )
        ))
        
        -- Mutual member-member circles
        OR ('member' = 'member' AND p.author_type = 'member' AND EXISTS (
          SELECT 1 FROM circles ci
          WHERE ((ci.user_a_id = $1 AND ci.user_b_id = p.author_id)
             OR (ci.user_b_id = $1 AND ci.user_a_id = p.author_id))
            AND p.created_at >= ci.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice')
                   THEN INTERVAL '15 days'
                   ELSE INTERVAL '7 days'
              END
            )
        ))
        
        -- Community-Member circles (viewer is member, author is community)
        OR ('member' = 'member' AND p.author_type = 'community' AND EXISTS (
          SELECT 1 FROM community_member_circles cc
          WHERE cc.community_id = p.author_id AND cc.member_id = $1
            AND p.created_at >= cc.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice')
                   THEN INTERVAL '15 days'
                   ELSE INTERVAL '7 days'
              END
            )
        ))
      )
      AND p.post_type NOT IN ('plan_promo', 'event_promo')
    `, [m.id]);

    // Backlog posts count
    const backlogRes = await c.query(`
      SELECT count(*) FROM posts p
      WHERE (
        -- Standard active follows
        EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = $1 AND f.follower_type = 'member'
            AND f.following_id = p.author_id AND f.following_type = p.author_type
            AND f.is_superseded_by_circle = false
            AND p.created_at >= f.created_at - (
              CASE WHEN p.post_type IN ('media', 'community_voice')
                   THEN INTERVAL '15 days'
                   ELSE INTERVAL '7 days'
              END
            )
            AND p.created_at < f.created_at
        )
      )
    `, [m.id]);

    console.log(`Member id=${m.id} (@${m.username}) -> follows: ${m.follow_count} | total feed posts: ${feedRes.rows[0].count} | of which backlog (pre-follow): ${backlogRes.rows[0].count}`);
  }

  c.release();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
