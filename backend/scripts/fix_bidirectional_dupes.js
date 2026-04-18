require("dotenv").config();
const { createPool } = require("../config/db");

/**
 * Fix bidirectional duplicate conversations.
 *
 * The issue: Conv 11 (community(9) <-> member(28)) and Conv 18 (member(28) <-> community(9))
 * are the SAME pair but with participant1/participant2 swapped.
 * The UNIQUE constraint doesn't catch this because column order differs.
 *
 * Fix: Move all messages from conv 18 -> conv 11, then delete conv 18.
 */
(async () => {
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Find all bidirectional duplicates
    const bidir = await client.query(`
      SELECT a.id as keep_id, b.id as delete_id,
        a.participant1_id as a_p1, a.participant1_type as a_p1t,
        a.participant2_id as a_p2, a.participant2_type as a_p2t,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = a.id) as keep_msgs,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = b.id) as delete_msgs
      FROM conversations a
      JOIN conversations b ON 
        a.participant1_id = b.participant2_id AND 
        a.participant1_type = b.participant2_type AND
        a.participant2_id = b.participant1_id AND 
        a.participant2_type = b.participant1_type AND
        a.id < b.id
    `);

    if (bidir.rows.length === 0) {
      console.log("No bidirectional duplicates found. Nothing to fix.");
      await client.query("ROLLBACK");
      return;
    }

    console.log(`Found ${bidir.rows.length} bidirectional duplicate(s):`);

    for (const dup of bidir.rows) {
      console.log(
        `  Keeping conv ${dup.keep_id} (${dup.keep_msgs} msgs), deleting conv ${dup.delete_id} (${dup.delete_msgs} msgs)`,
      );
      console.log(
        `    ${dup.a_p1t}(${dup.a_p1}) <-> ${dup.a_p2t}(${dup.a_p2})`,
      );

      // 2. Move messages from duplicate to kept conversation
      const moveResult = await client.query(
        "UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2",
        [dup.keep_id, dup.delete_id],
      );
      console.log(`    Moved ${moveResult.rowCount} messages`);

      // 3. Update last_message_at on kept conversation
      await client.query(
        `
        UPDATE conversations SET last_message_at = (
          SELECT MAX(created_at) FROM messages WHERE conversation_id = $1
        ) WHERE id = $1
      `,
        [dup.keep_id],
      );

      // 4. Delete the duplicate conversation
      const deleteResult = await client.query(
        "DELETE FROM conversations WHERE id = $1",
        [dup.delete_id],
      );
      console.log(`    Deleted conversation ${dup.delete_id}`);
    }

    await client.query("COMMIT");
    console.log("\nDone! Bidirectional duplicates merged successfully.");

    // 5. Verify
    const verify = await client.query(`
      SELECT a.id as id_a, b.id as id_b
      FROM conversations a
      JOIN conversations b ON 
        a.participant1_id = b.participant2_id AND 
        a.participant1_type = b.participant2_type AND
        a.participant2_id = b.participant1_id AND 
        a.participant2_type = b.participant1_type AND
        a.id < b.id
    `);
    console.log("Remaining bidirectional duplicates:", verify.rows.length);

    const total = await client.query(
      "SELECT COUNT(*) as count FROM conversations",
    );
    console.log("Total conversations now:", total.rows[0].count);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error (rolled back):", e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
    process.exit();
  }
})();
