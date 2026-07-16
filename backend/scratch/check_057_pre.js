require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function check() {
  const client = await pool.connect();
  try {
    // Check which review tables exist (did 056 run at all?)
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('review_dimensions','category_group_dimensions','event_reviews','event_review_tags','open_plan_reviews','open_plan_attendee_ratings','user_reputation_scores','reputation_pair_history','user_trust_flags','review_prompts_queue') ORDER BY table_name"
    );
    console.log('=== Review tables that exist ===');
    tables.rows.forEach(r => console.log(' ', r.table_name));
    if (tables.rows.length === 0) console.log('  (none — 056 was NOT applied)');

    // Check if category_group column exists on events
    const col = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'category_group'"
    );
    console.log('\nevents.category_group column:', col.rows.length > 0 ? 'EXISTS' : 'MISSING');

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(e => { console.error(e.message); process.exit(1); });
