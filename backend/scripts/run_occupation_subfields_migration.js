/**
 * Run occupation sub-fields migration
 * Run with: node scripts/run_occupation_subfields_migration.js
 */
require('dotenv').config();
const { createPool } = require('../config/db');
const pool = createPool();

async function runMigration() {
  try {
    console.log('Starting migration: add occupation sub-fields columns to members...');
    
    await pool.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation_details JSONB DEFAULT NULL;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation_category VARCHAR(50) DEFAULT NULL;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS portfolio_link VARCHAR(255) DEFAULT NULL;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS education VARCHAR(200) DEFAULT NULL;
    `);
    
    console.log('✅ Columns added to members table');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name IN ('occupation_details', 'occupation_category', 'portfolio_link', 'education')
      ORDER BY column_name
    `);

    if (result.rows.length === 4) {
      console.log('✅ Verified: all 4 columns exist');
      result.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`));
    } else {
      console.log('⚠️ Expected 4 columns, found', result.rows.length);
      result.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
