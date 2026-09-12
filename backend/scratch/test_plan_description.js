// Quick functional test: insert a plan with description, read it back, verify, clean up.
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  // Grab any existing member to use as created_by
  const memberR = await p.query('SELECT id FROM members LIMIT 1');
  if (memberR.rows.length === 0) throw new Error('No members in DB — cannot test');
  const memberId = memberR.rows[0].id;

  const testDesc = 'Test description — max 300 chars check ✅';
  const futureDate = new Date(Date.now() + 86400000 * 2).toISOString(); // 2 days from now

  // 1. INSERT with description
  const insertR = await p.query(
    `INSERT INTO open_plans
       (created_by, title, description, activity_type, cost_type, visibility, gender_preference, scheduled_at, expires_at, max_accepted, is_recurring)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8::timestamptz + INTERVAL '24 hours',$9,$10)
     RETURNING id, title, description`,
    [memberId, 'TEST PLAN (DELETE ME)', testDesc, 'other', 'free', 'everyone', 'all', futureDate, 5, false]
  );
  const plan = insertR.rows[0];
  console.log('INSERT OK:', plan);
  if (plan.description !== testDesc) throw new Error('Description mismatch after INSERT');

  // 2. SELECT * — confirm description comes back
  const selectR = await p.query('SELECT * FROM open_plans WHERE id = $1', [plan.id]);
  console.log('SELECT * description:', selectR.rows[0].description);
  if (selectR.rows[0].description !== testDesc) throw new Error('Description missing from SELECT *');

  // 3. UPDATE description
  const newDesc = 'Updated description';
  await p.query('UPDATE open_plans SET description = $1 WHERE id = $2', [newDesc, plan.id]);
  const updatedR = await p.query('SELECT description FROM open_plans WHERE id = $1', [plan.id]);
  console.log('UPDATE OK:', updatedR.rows[0].description);
  if (updatedR.rows[0].description !== newDesc) throw new Error('Description mismatch after UPDATE');

  // 4. NULL description (omitting it) — confirm nullable
  await p.query('UPDATE open_plans SET description = NULL WHERE id = $1', [plan.id]);
  const nullR = await p.query('SELECT description FROM open_plans WHERE id = $1', [plan.id]);
  console.log('NULL set OK:', nullR.rows[0].description);
  if (nullR.rows[0].description !== null) throw new Error('Expected null description');

  // 5. Clean up test row
  await p.query('DELETE FROM open_plans WHERE id = $1', [plan.id]);
  console.log('\nAll checks passed ✅');
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); }).finally(() => p.end());
