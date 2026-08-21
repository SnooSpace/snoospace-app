'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  // Find all tables related to opportunities
  const r = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%opportunit%'
    ORDER BY table_name
  `);
  console.log('Opportunity-related tables:', r.rows.map(x => x.table_name));

  // Also find anything that might be engagement for opportunities
  const r2 = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND (
      table_name ILIKE '%opp%' OR
      table_name ILIKE '%opportunit%'
    )
    ORDER BY table_name
  `);
  console.log('All opp* tables:', r2.rows.map(x => x.table_name));

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
