require('dotenv').config();
const { createPool } = require('../config/db');

const pool = createPool();

async function run() {
  try {
    console.log("Removing 'Here to learn' spark...");
    
    // 1. Remove user_sparks entries for 'here to learn'
    await pool.query(`
      DELETE FROM user_sparks 
      WHERE spark_id IN (
        SELECT id FROM sparks WHERE normalized_label = 'here to learn'
      );
    `);
    
    // 2. Remove the spark itself
    const res = await pool.query(`
      DELETE FROM sparks 
      WHERE normalized_label = 'here to learn';
    `);

    console.log(`✓ Deleted ${res.rowCount} row(s) for 'Here to learn'.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error deleting spark:", err.message);
    process.exit(1);
  }
}

run();
