'use strict';
/**
 * Migration Runner for 075_add_load_test_marker_columns.sql
 * Run with: node scripts/run_075_load_test_marker_migration.js
 *
 * Runs each ALTER TABLE and CREATE INDEX CONCURRENTLY statement
 * as an individual query outside of any transaction block.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port:     parseInt(process.env.DB_PORT || '6543', 10),
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  console.log('🚀 Starting migration 075: Load Test Marker Columns & Indexes...\n');

  const steps = [
    // 1. Members
    { desc: 'ALTER TABLE members', sql: `ALTER TABLE members ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;` },
    { desc: 'INDEX idx_members_load_test', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_load_test ON members (is_load_test) WHERE is_load_test = true;` },

    // 2. Posts
    { desc: 'ALTER TABLE posts', sql: `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;` },
    { desc: 'INDEX idx_posts_load_test', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_load_test ON posts (is_load_test) WHERE is_load_test = true;` },

    // 3. Follows
    { desc: 'ALTER TABLE follows', sql: `ALTER TABLE follows ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;` },
    { desc: 'INDEX idx_follows_load_test', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_load_test ON follows (is_load_test) WHERE is_load_test = true;` },

    // 4. Post Likes
    { desc: 'ALTER TABLE post_likes', sql: `ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;` },
    { desc: 'INDEX idx_post_likes_load_test', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_likes_load_test ON post_likes (is_load_test) WHERE is_load_test = true;` },

    // 5. Post Comments
    { desc: 'ALTER TABLE post_comments', sql: `ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;` },
    { desc: 'INDEX idx_post_comments_load_test', sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_load_test ON post_comments (is_load_test) WHERE is_load_test = true;` },
  ];

  for (const item of steps) {
    try {
      console.log(`⏳ Executing ${item.desc}...`);
      await pool.query(item.sql);
      console.log(`✅ ${item.desc} done.`);
    } catch (err) {
      console.error(`❌ Error in ${item.desc}:`, err.message);
      throw err;
    }
  }

  console.log('\n🎉 Migration 075 completed successfully!');
}

runMigration()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
