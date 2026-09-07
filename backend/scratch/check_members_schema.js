require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_NAME, password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name='members' AND is_nullable='NO'
  ORDER BY ordinal_position
`).then(r => {
  r.rows.forEach(c => console.log(c.column_name, '|', c.data_type, '| default:', c.column_default));
  pool.end();
}).catch(e => { console.error(e.message); pool.end(); });
