const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting Featured Events & Velocity Indexes migration...');
    await client.query('BEGIN');

    // 1. Add is_featured and featured_until to events
    console.log('[Migration] Adding is_featured and featured_until columns to events...');
    await client.query(`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
    `);

    // 2. Add compound index on event_registrations (event_id, created_at)
    console.log('[Migration] Adding compound index on event_registrations (event_id, created_at)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_registrations_event_created
        ON event_registrations (event_id, created_at);
    `);

    // 3. Add compound index on event_interests (event_id, created_at)
    console.log('[Migration] Adding compound index on event_interests (event_id, created_at)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_interests_event_created
        ON event_interests (event_id, created_at);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
