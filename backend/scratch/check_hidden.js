require("dotenv").config();
const { createPool } = require("../config/db");
const pool = createPool();

async function checkHidden() {
  try {
    const res = await pool.query(`
      SELECT COUNT(*) as visible_count FROM messages WHERE conversation_id = 25 AND created_at > '2026-04-21T19:27:58.082Z'
    `);
    console.log("=== VISIBLE MESSAGES FOR CHAT 25 AFTER HIDDEN_AT ===");
    console.log(res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("Error checking hidden:", err);
    process.exit(1);
  }
}

checkHidden();
