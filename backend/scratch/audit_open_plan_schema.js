'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%open_plan%'
      ORDER BY table_name
    `);

    console.log('=== OPEN PLAN TABLE FAMILY ===\n');
    for (const row of res.rows) {
      const t = row.table_name;
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t]);
      console.log(`Table: ${t}`);
      cols.rows.forEach(c => {
        console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
      });
      console.log('');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
