require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: "aws-1-ap-south-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.ujtoywnkodshtprqojap",
  database: "postgres",
  password: process.env.DB_PASS,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const followerId = 155;
    const followerType = 'member';
    const followingId = 51;
    const followingType = 'member';

    const result = await pool.query(
      `SELECT 1 FROM follows 
       WHERE follower_id = $1 AND follower_type = $2 AND following_id = $3 AND following_type = 'member' AND is_superseded_by_circle = false
       UNION ALL
       SELECT 1 FROM creator_follows 
       WHERE follower_id = $1 AND follower_type = $2 AND creator_id = $3 AND is_superseded_by_circle = false AND is_dormant = false
       LIMIT 1`,
      [followerId, followerType, followingId]
    );

    console.log("Is Following (computed):", result.rows.length > 0);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
