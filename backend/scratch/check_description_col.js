require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
p.query(
  "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'open_plans' AND column_name = 'description'"
).then(r => {
  console.log('Column check result:', JSON.stringify(r.rows, null, 2));
  if (r.rows.length === 0) {
    console.log('WARNING: column not found!');
    process.exit(1);
  } else {
    console.log('SUCCESS: description column exists');
  }
  p.end();
}).catch(e => {
  console.error('ERROR:', e.message);
  p.end();
  process.exit(1);
});
