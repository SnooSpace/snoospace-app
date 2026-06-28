require('dotenv').config();
const { createPool } = require('./config/db');
const pool = createPool();

async function inspect() {
  try {
    const userId = 51;
    const aqi = await pool.query(
      `SELECT * FROM user_aqi_signals WHERE user_id = $1`,
      [userId]
    );
    console.log("=== User 51 AQI Signals ===");
    console.log(aqi.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
