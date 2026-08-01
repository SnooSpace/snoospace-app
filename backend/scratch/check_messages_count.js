require("dotenv").config();
const { createPool } = require("../config/db");
const pool = createPool();

async function checkMessageCounts() {
  try {
    const res = await pool.query(`
      SELECT conversation_id, COUNT(*) as total_messages, MIN(created_at) as oldest_msg, MAX(created_at) as newest_msg
      FROM messages
      GROUP BY conversation_id
      ORDER BY total_messages DESC
    `);
    console.log("=== CONVERSATION MESSAGE COUNTS IN DB ===");
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error("Error checking message counts:", err);
    process.exit(1);
  }
}

checkMessageCounts();
