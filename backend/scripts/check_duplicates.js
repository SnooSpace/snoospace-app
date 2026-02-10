require("dotenv").config();
const { createPool } = require("../config/db");
const fs = require("fs");
const path = require("path");

(async () => {
  const pool = createPool();

  try {
    // 1. Check for exact duplicates
    const r = await pool.query(`
      SELECT participant1_id, participant1_type, participant2_id, participant2_type,
        COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM conversations 
      GROUP BY participant1_id, participant1_type, participant2_id, participant2_type 
      HAVING COUNT(*) > 1
    `);

    // 2. Check for bidirectional duplicates
    const bidir = await pool.query(`
      SELECT a.id as id_a, b.id as id_b,
        a.participant1_id as a_p1, a.participant1_type as a_p1t,
        a.participant2_id as a_p2, a.participant2_type as a_p2t
      FROM conversations a
      JOIN conversations b ON 
        a.participant1_id = b.participant2_id AND 
        a.participant1_type = b.participant2_type AND
        a.participant2_id = b.participant1_id AND 
        a.participant2_type = b.participant1_type AND
        a.id < b.id
    `);

    // 3. All conversations
    const all = await pool.query(`
      SELECT c.id, c.participant1_id as p1, c.participant1_type as p1t, 
        c.participant2_id as p2, c.participant2_type as p2t, c.last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msgs
      FROM conversations c ORDER BY c.id
    `);

    const result = {
      exactDuplicateGroups: r.rows.length,
      exactDuplicates: r.rows,
      bidirectionalDuplicateGroups: bidir.rows.length,
      bidirectionalDuplicates: bidir.rows,
      totalConversations: all.rows.length,
      conversations: all.rows,
    };

    fs.writeFileSync(
      path.join(__dirname, "db_state.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
    console.log("DONE - wrote db_state.json");
    console.log("Exact dupes:", r.rows.length);
    console.log("Bidir dupes:", bidir.rows.length);
    console.log("Total convos:", all.rows.length);
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await pool.end();
    process.exit();
  }
})();
