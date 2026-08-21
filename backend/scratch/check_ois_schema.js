'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  const r = await pool.query(`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='opportunity_impression_state' ORDER BY ordinal_position`);
  console.log('opportunity_impression_state columns:', r.rows);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
