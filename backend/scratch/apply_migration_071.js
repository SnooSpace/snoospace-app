'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const client = await pool.connect();
  try {
    // Before: confirm scoped_community_id non-NULL rows
    const before = await client.query(
      "SELECT COUNT(*) AS cnt FROM open_plans WHERE scoped_community_id IS NOT NULL"
    );
    console.log('scoped_community_id non-NULL rows BEFORE migration:', before.rows[0].cnt);

    const sql = fs.readFileSync(__dirname + '/../migrations/071_open_plan_visible_communities.sql', 'utf8');
    await client.query(sql);
    console.log('Migration 071 applied successfully.\n');

    // Verify join table row count
    const tbl = await client.query('SELECT COUNT(*) AS cnt FROM open_plan_visible_communities');
    console.log('open_plan_visible_communities rows after backfill:', tbl.rows[0].cnt, '(expected 0)');

    // Confirm column is gone
    const col = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='open_plans' AND column_name='scoped_community_id'"
    );
    console.log('scoped_community_id column still exists?', col.rows.length > 0 ? 'YES (bad)' : 'NO (correct — column dropped)');

    // Confirm indexes
    const idx = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='open_plan_visible_communities' ORDER BY indexname"
    );
    console.log('Indexes on open_plan_visible_communities:', idx.rows.map(r => r.indexname));
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
