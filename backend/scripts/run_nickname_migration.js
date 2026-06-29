/**
 * Run nickname migration
 * Run with: node scripts/run_nickname_migration.js
 */
require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  try {
    console.log('Starting migration: add nickname column to members...');
    
    await pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_members_nickname ON members (nickname) WHERE nickname IS NOT NULL;
    `);
    
    console.log('✅ nickname column and index added to members table');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name = 'nickname'
    `);

    if (result.rows.length === 1) {
      console.log(`✅ Verified: nickname column exists with type ${result.rows[0].data_type}`);
    } else {
      console.log('⚠️ Verification failed: nickname column not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
