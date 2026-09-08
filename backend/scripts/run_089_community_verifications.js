const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createPool } = require('../config/db');

const pool = createPool();

(async () => {
  try {
    const sqlPath = path.join(__dirname, '..', 'migrations', '089_community_verifications.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 089...');
    await pool.query(sql);
    console.log('✅ Migration 089 executed successfully!');

    // Verify table structure
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'community_verifications'
      ORDER BY ordinal_position;
    `);
    console.log('community_verifications columns:', cols.rows);

    // Verify communities column
    const commCol = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'communities' AND column_name = 'community_verification_tier';
    `);
    console.log('communities.community_verification_tier:', commCol.rows);

    // Verify storage bucket
    const bucket = await pool.query(`
      SELECT id, name, public
      FROM storage.buckets
      WHERE id = 'community-verification-docs';
    `);
    console.log('storage.buckets community-verification-docs:', bucket.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
})();
