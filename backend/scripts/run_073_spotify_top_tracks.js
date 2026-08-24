/**
 * Migration Runner for 073_add_spotify_top_tracks.sql
 * Run with: node scripts/run_073_spotify_top_tracks.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createPool } = require('../config/db');

async function runMigration() {
  const pool = createPool();
  try {
    console.log('Starting migration 073: add spotify_top_tracks to members...');
    
    const sqlPath = path.resolve(__dirname, '../migrations/073_add_spotify_top_tracks.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sqlContent);
    console.log('✅ Migration SQL executed successfully!');

    // Verify members table column
    const memberCols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members' AND column_name IN ('spotify_connected', 'spotify_top_artists', 'spotify_top_tracks')
      ORDER BY ordinal_position;
    `);

    console.log('\nVerified members Spotify columns:');
    memberCols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

    console.log('\n✅ 073 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
