const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createPool } = require("../config/db");
const pool = createPool();

async function run() {
  const comms = await pool.query("SELECT id, name, username, follower_count FROM communities WHERE name ILIKE '%snoo%' OR username ILIKE '%snoo%'");
  console.log("Snoo communities:", comms.rows);

  for (const c of comms.rows) {
    const membersCount = await pool.query(
      `SELECT COUNT(DISTINCT m_id)::int as count FROM (
         SELECT follower_id as m_id FROM follows WHERE following_id = $1 AND following_type = 'community' AND follower_type = 'member'
         UNION
         SELECT member_id as m_id FROM community_member_circles WHERE community_id = $1
       ) t`,
      [c.id]
    );

    const activeMembers = await pool.query(
      `SELECT COUNT(DISTINCT m_id)::int as count FROM (
         SELECT follower_id as m_id FROM follows WHERE following_id = $1 AND following_type = 'community' AND follower_type = 'member'
         UNION
         SELECT member_id as m_id FROM community_member_circles WHERE community_id = $1
       ) t
       JOIN user_aqi_signals uas ON uas.user_id = t.m_id
       WHERE uas.last_active_at >= NOW() - INTERVAL '30 minutes'`,
      [c.id]
    );

    console.log(`Community "${c.name}" (ID ${c.id}): Total Members = ${membersCount.rows[0].count}, Active (last 30m) = ${activeMembers.rows[0].count}`);
  }

  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
