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

async function fixPoll() {
  try {
    // Update poll ID 90 to set show_results_before_vote to false
    const result = await pool.query(`
      UPDATE posts 
      SET type_data = jsonb_set(type_data, '{show_results_before_vote}', 'false')
      WHERE id = 90 AND post_type = 'poll'
      RETURNING id, type_data
    `);

    if (result.rows.length > 0) {
      console.log("✓ Successfully updated poll");
      console.log(
        "New type_data:",
        JSON.stringify(result.rows[0].type_data, null, 2)
      );
    } else {
      console.log("No poll found with ID 90");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

fixPoll();
