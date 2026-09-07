require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    const colRes = await p.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);
    console.log('=== NOTIFICATIONS COLUMNS ===');
    console.table(colRes.rows);

    const conRes = await p.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'notifications'::regclass;
    `);
    console.log('=== NOTIFICATIONS CONSTRAINTS ===');
    console.table(conRes.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await p.end();
  }
}

run();
