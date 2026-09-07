require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_NAME, password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});
p.query(`SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid='members'::regclass AND contype='c'`)
  .then(r => { r.rows.forEach(c => console.log(c.conname, ':', c.def)); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
