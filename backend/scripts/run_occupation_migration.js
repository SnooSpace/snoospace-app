/**
 * Run occupation migration
 * Run with: node scripts/run_occupation_migration.js
 */
require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  try {
    console.log('Starting migration: add occupation column to members...');
    
    await pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation VARCHAR(50) DEFAULT NULL;
    `);
    
    console.log('✅ occupation column added to members table');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'members' AND column_name = 'occupation'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: column exists -', result.rows[0]);
    } else {
      console.log('❌ Column not found after migration');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
