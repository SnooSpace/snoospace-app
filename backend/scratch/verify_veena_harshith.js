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
    const follows = await pool.query(
      "SELECT * FROM follows WHERE (follower_id = 155 AND following_id = 51) OR (follower_id = 51 AND following_id = 155)"
    );
    console.log("Follows rows:", follows.rows);

    const creatorFollows = await pool.query(
      "SELECT * FROM creator_follows WHERE (follower_id = 155 AND creator_id = 51)"
    );
    console.log("Creator Follows rows:", creatorFollows.rows);

    const circles = await pool.query(
      "SELECT * FROM circles WHERE (user_a_id = 155 AND user_b_id = 51) OR (user_a_id = 51 AND user_b_id = 155)"
    );
    console.log("Circles rows:", circles.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
