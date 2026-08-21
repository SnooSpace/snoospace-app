'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  // Check what NOT NULL columns events has for dates + required fields
  const r = await pool.query(`
    SELECT column_name, is_nullable, column_default, data_type
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position
  `);
  r.rows.forEach(c => console.log(`${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default}`));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
