'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT||'5432'), user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, ssl: process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false });
(async () => {
  const tables = [
    'opportunity_likes',
    'opportunity_comments',
    'opportunity_saves',
    'opportunities',
  ];
  for (const t of tables) {
    const r = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns WHERE table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    console.log(`\n=== ${t} ===`);
    r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
  }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
