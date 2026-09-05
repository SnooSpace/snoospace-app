require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

async function main() {
  const pool = createPool();
  try {
    const sqlPath = path.join(__dirname, '../migrations/080_two_tier_verification.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Successfully executed 080_two_tier_verification.sql');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await pool.end();
  }
}

main();
