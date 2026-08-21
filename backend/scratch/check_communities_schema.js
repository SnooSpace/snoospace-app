'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  const r = await pool.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'communities' AND is_nullable = 'NO' ORDER BY ordinal_position`);
  console.log('NOT NULL communities columns:');
  r.rows.forEach(c => console.log(`  ${c.column_name}: default=${c.column_default}`));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
