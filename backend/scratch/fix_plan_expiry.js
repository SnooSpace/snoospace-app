const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: parseInt(process.env.DB_PORT, 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function fixExpiry() {
  const result = await pool.query(`
    UPDATE open_plans
    SET expires_at = scheduled_at + INTERVAL '24 hours'
    WHERE status = 'active'
    RETURNING id, title, scheduled_at, expires_at
  `);
  console.log('Updated', result.rowCount, 'plans:');
  result.rows.forEach(p => console.log(` - [${p.id}] ${p.title} | scheduled: ${p.scheduled_at} | new expires_at: ${p.expires_at}`));
  await pool.end();
}

fixExpiry().catch(e => { console.error(e.message); pool.end(); });

