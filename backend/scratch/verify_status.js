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
    const commRes = await pool.query("SELECT id, name, username FROM communities WHERE username = 'snoospace'");
    console.log("Communities:", commRes.rows);
    
    const membRes = await pool.query("SELECT id, name, username FROM members WHERE username IN ('harshithsgowda', 'nexarc01', 'veena')");
    console.log("Members:", membRes.rows);

    if (commRes.rows.length > 0) {
      const commId = commRes.rows[0].id;
      const circs = await pool.query("SELECT * FROM community_member_circles WHERE community_id = $1", [commId]);
      console.log(`Circles for community ${commId}:`, circs.rows);

      const invites = await pool.query("SELECT * FROM community_member_circle_invites WHERE community_id = $1", [commId]);
      console.log(`Invites for community ${commId}:`, invites.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
