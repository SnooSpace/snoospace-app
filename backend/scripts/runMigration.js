/**
 * Database migration script to replace location JSONB with location_url TEXT
 * Run this with: node scripts/runMigration.js
 */

const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  try {
    console.log('Starting migration: location -> location_url');

    // Step 1: Add new column
    console.log('Step 1: Adding location_url column...');
    await pool.query(`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS location_url TEXT;
    `);
    console.log('✓ location_url column added');

    // Step 2: Migrate existing data with location JSON
    console.log('Step 2: Migrating existing location data...');
    
    // Count events to migrate
    const countResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM events 
      WHERE location IS NOT NULL
    `);
    console.log(`Found ${countResult.rows[0].count} events with location data`);

    // Migrate URLs from JSON
    const urlResult = await pool.query(`
      UPDATE events 
      SET location_url = location->>'url'
      WHERE location IS NOT NULL AND location->>'url' IS NOT NULL
      RETURNING id
    `);
    console.log(`✓ Migrated ${urlResult.rowCount} events with URLs`);

    // Migrate coordinates to Google Maps URLs
    const coordsResult = await pool.query(`
      UPDATE events 
      SET location_url = CONCAT(
        'https://www.google.com/maps/search/?api=1&query=',
        location->>'lat', ',', location->>'lng'
      )
      WHERE location IS NOT NULL 
        AND location->>'lat' IS NOT NULL 
        AND location_url IS NULL
      RETURNING id
    `);
    console.log(`✓ Migrated ${coordsResult.rowCount} events with coordinates`);

    // Step 3: Drop old column
    console.log('Step 3: Dropping old location column...');
    await pool.query(`
      ALTER TABLE events 
      DROP COLUMN IF EXISTS location;
    `);
    console.log('✓ Old location column dropped');

    // Verification
    console.log('\\nVerification:');
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(location_url) as with_url,
        COUNT(*) FILTER (WHERE location_url IS NULL AND event_type IN ('in-person', 'hybrid')) as missing_url
      FROM events
    `);
    const stats = verifyResult.rows[0];
    console.log(`Total events: ${stats.total}`);
    console.log(`Events with location_url: ${stats.with_url}`);
    console.log(`In-person/hybrid events missing URL: ${stats.missing_url}`);

    console.log('\\n✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
