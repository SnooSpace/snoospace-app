require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_NAME, password: process.env.DB_PASS,
  port: parseInt(process.env.DB_PORT, 10), ssl: { rejectUnauthorized: false },
});
async function probe() {
  try {
    const r = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'members'::regclass AND contype = 'c'`
    );
    console.log('members CHECK constraints:');
    r.rows.forEach(c => console.log(' ', c.conname, ':', c.def));
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
probe();
