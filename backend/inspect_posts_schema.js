require('dotenv').config();
const { createPool } = require('./config/db');
const pool = createPool();

async function inspect() {
  try {
    const res = await pool.query(`SELECT DISTINCT post_type FROM posts`);
    console.log("=== distinct post types ===");
    res.rows.forEach(r => {
      console.log(` - ${r.post_type}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
