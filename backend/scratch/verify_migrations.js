require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function verify() {
  // 1. Check column exists on members
  const colR = await pool.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'plans_access_blocked'
  `);
  console.log('Column plans_access_blocked:', colR.rows.length > 0 ? 'EXISTS' : 'MISSING');
  if (colR.rows[0]) console.log('  Details:', colR.rows[0]);

  // 2. Check trigger function body contains plans_access_blocked
  const fnR = await pool.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'sync_verification_badge'
  `);
  const src = fnR.rows[0]?.prosrc || '';
  console.log('Trigger contains plans_access_blocked:', src.includes('plans_access_blocked'));

  await pool.end();
}
verify().catch(e => { console.error(e.message); process.exit(1); });
