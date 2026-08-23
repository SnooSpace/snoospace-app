/**
 * Migration Runner for 072_create_spotify_connections.sql
 * Run with: node scripts/run_072_spotify_migration.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

async function runMigration() {
  const pool = createPool();
  try {
    console.log('Starting migration 072: create spotify_connections & spotify_profile...');
    
    const sqlPath = path.resolve(__dirname, '../migrations/072_create_spotify_connections.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sqlContent);
    console.log('✅ Migration SQL executed successfully!');

    // Verify spotify_connections table
    const connCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'spotify_connections'
      ORDER BY ordinal_position;
    `);

    console.log('\nVerified spotify_connections columns:');
    connCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    // Verify spotify_profile table
    const profCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'spotify_profile'
      ORDER BY ordinal_position;
    `);

    console.log('\nVerified spotify_profile columns:');
    profCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    console.log('\n✅ 072 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
