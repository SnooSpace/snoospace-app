require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_NAME, password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});
// Check is_nullable for notifications columns
p.query(`
  SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_name='notifications'
  ORDER BY ordinal_position
`).then(r => { r.rows.forEach(c => console.log(c.column_name, 'nullable:', c.is_nullable)); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
