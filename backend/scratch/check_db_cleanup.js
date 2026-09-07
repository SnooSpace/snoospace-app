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
  const m = await p.query("SELECT count(id) FROM members WHERE email LIKE '%snoospace.test'");
  const pl = await p.query("SELECT count(id) FROM open_plans WHERE title LIKE '%test_%'");
  const n = await p.query("SELECT count(id) FROM notifications WHERE type IN ('plan_host_ver_takedown', 'plan_host_ver_failed', 'plan_attendee_ver_failed')");
  console.log('Stray snoospace.test members:', m.rows[0].count);
  console.log('Stray test plans:', pl.rows[0].count);
  console.log('Verification notifications in DB:', n.rows[0].count);
  await p.end();
}
run();
