/**
 * Run Spotify column additions migration
 * Run with: node scripts/run_spotify_migration.js
 */
require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  try {
    console.log('Starting migration: add spotify_connected and spotify_top_artists columns to members...');
    
    await pool.query(`
      ALTER TABLE members 
      ADD COLUMN IF NOT EXISTS spotify_connected BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS spotify_top_artists JSONB DEFAULT NULL;

      CREATE INDEX IF NOT EXISTS idx_members_spotify_connected ON members(spotify_connected);
    `);
    
    console.log('✅ Spotify columns and index added to members table');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name IN ('spotify_connected', 'spotify_top_artists')
    `);

    console.log(`Found ${result.rows.length} new Spotify columns:`);
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });

    if (result.rows.length === 2) {
      console.log('✅ Verification success! Both columns created.');
    } else {
      console.log('⚠️ Verification failed: Some columns are missing.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
