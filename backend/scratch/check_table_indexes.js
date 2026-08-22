'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const r = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('follows', 'community_member_circles', 'open_plans', 'posts')
    ORDER BY tablename, indexname
  `);
  console.log('Indexes:');
  r.rows.forEach(x => console.log(`[${x.tablename}] ${x.indexname} -> ${x.indexdef}`));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
