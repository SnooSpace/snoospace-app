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

async function dumpPoll() {
  try {
    const result = await pool.query(
      "SELECT id, post_type, type_data FROM posts WHERE id = 90"
    );
    if (result.rows.length > 0) {
      console.log("POLL 90 DATA:");
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log("No poll found with ID 90");
    }

    const votes = await pool.query(
      "SELECT * FROM poll_votes WHERE post_id = 90"
    );
    console.log("\nPOLL 90 VOTES:");
    console.log(JSON.stringify(votes.rows, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

dumpPoll();
