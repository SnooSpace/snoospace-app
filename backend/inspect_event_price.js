require('dotenv').config();
const { createPool } = require('./config/db');
const pool = createPool();

async function inspect() {
  try {
    const res = await pool.query(
      `SELECT id, title, ticket_price, is_paid, event_type 
       FROM events 
       WHERE id = 32`
    );
    console.log("=== Event 32 details ===");
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
