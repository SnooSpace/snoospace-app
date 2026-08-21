require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const c = await pool.connect();
  try {
    console.log('--- COMMUNITIES SCHEMA ---');
    const comSchema = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'communities' AND column_name IN ('category', 'categories', 'community_type', 'club_type')
    `);
    console.table(comSchema.rows);

    const allComs = await c.query(`
      SELECT id, name, category, categories, community_type, club_type
      FROM communities
      ORDER BY id
    `);
    console.table(allComs.rows);

    console.log('\n--- CHECKING CONSTRAINTS ON COMMUNITIES ---');
    const constraints = await c.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'communities'
    `);
    console.table(constraints.rows);

  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
