require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS open_plan_interests (
        plan_id    INTEGER NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
        user_id    INTEGER NOT NULL REFERENCES members(id)    ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (plan_id, user_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_open_plan_interests_user ON open_plan_interests(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_open_plan_interests_plan ON open_plan_interests(plan_id)`);
    console.log('✅ Migration 020: open_plan_interests created successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
