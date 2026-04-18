const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

async function clearVotes() {
  try {
    // Delete all votes for poll 90 to allow re-testing
    const result = await pool.query(
      `DELETE FROM poll_votes WHERE post_id = 90`
    );
    console.log("✓ Deleted", result.rowCount, "votes from poll 90");

    // Also reset the vote counts in type_data
    const updateResult = await pool.query(`
      UPDATE posts 
      SET type_data = jsonb_set(
        jsonb_set(type_data, '{total_votes}', '0'),
        '{options}',
        (
          SELECT jsonb_agg(
            jsonb_set(opt.value, '{vote_count}', '0')
          )
          FROM jsonb_array_elements(type_data->'options') AS opt(value)
        )
      )
      WHERE id = 90
    `);
    console.log("✓ Reset vote counts in type_data");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

clearVotes();
