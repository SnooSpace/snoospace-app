const fs = require("fs");
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

async function savePollData() {
  try {
    const result = await pool.query(
      "SELECT type_data FROM posts WHERE id = 90"
    );
    if (result.rows.length > 0) {
      const data = JSON.stringify(result.rows[0].type_data, null, 2);
      fs.writeFileSync("poll_90_data.json", data);
      console.log("Saved poll 90 type_data to poll_90_data.json");
    } else {
      console.log("No poll found with ID 90");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await pool.end();
  }
}

savePollData();
