'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/070_opportunity_first_seen.sql'), 'utf8');
  console.log('Applying 070_opportunity_first_seen.sql …');
  await pool.query(sql);
  console.log('Done.');
  const r = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'opportunity_impression_state' ORDER BY ordinal_position`);
  console.log('\nopportunity_impression_state columns after migration:');
  r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
