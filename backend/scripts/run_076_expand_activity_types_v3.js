require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting 076_expand_activity_types_v3 migration...');
    await client.query('BEGIN');

    console.log('[Migration] Updating open_plans_activity_type_check constraint...');
    await client.query(`
      ALTER TABLE open_plans
        DROP CONSTRAINT IF EXISTS open_plans_activity_type_check;

      ALTER TABLE open_plans
        ADD CONSTRAINT open_plans_activity_type_check
          CHECK (activity_type IN (
            'sports',
            'study',
            'cowork',
            'food',
            'gaming',
            'games',
            'other',
            'cafe',
            'walk',
            'pet_friendly',
            'pet_gathering',
            'hangout',
            'rides',
            'creative',
            'gym',
            'yoga',
            'live_music',
            'movies',
            'bar',
            'house_party',
            'club',
            'hiking',
            'shopping',
            'bowling',
            'gokarting',
            'go_karting',
            'indoorgames',
            'indoor_games',
            'pilates',
            'swimming'
          ));
    `);

    await client.query('COMMIT');
    console.log('[Migration] 076_expand_activity_types_v3 completed successfully!');
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
