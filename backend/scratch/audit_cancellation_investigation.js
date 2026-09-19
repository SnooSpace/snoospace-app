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
  console.log('=== 1. EVENT_REGISTRATIONS COLUMNS & STATUSES ===');
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'event_registrations'
    ORDER BY ordinal_position
  `);
  console.log('Columns:', cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const statuses = await pool.query(`
    SELECT DISTINCT registration_status FROM event_registrations
  `);
  console.log('Existing statuses in DB:', statuses.rows.map(r => r.registration_status));

  console.log('\n=== 2. COMMUNITIES COLUMNS (VERIFICATION / STATS) ===');
  const commCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'communities'
    ORDER BY ordinal_position
  `);
  console.log('Community Columns:', commCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  console.log('\n=== 3. EVENT_POSTPONEMENT_DECISIONS COLUMNS & STATUSES ===');
  const postCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'event_postponement_decisions'
    ORDER BY ordinal_position
  `);
  console.log('Postponement decision columns:', postCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const postDecisions = await pool.query(`
    SELECT DISTINCT decision FROM event_postponement_decisions
  `);
  console.log('Existing decisions in DB:', postDecisions.rows.map(r => r.decision));

  await pool.end();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
