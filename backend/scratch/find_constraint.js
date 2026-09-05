require('dotenv').config();
const { createPool } = require('../config/db');

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as condef
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'members' AND c.contype = 'c';
    `);
    console.log('Constraints on members table:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error fetching constraint:', err);
  } finally {
    await pool.end();
  }
}

main();
