'use strict';
/**
 * Migration Runner for 074_feed_query_indexes.sql
 * Run with: node scripts/run_074_feed_query_indexes.js
 *
 * Runs each CREATE INDEX CONCURRENTLY statement as an individual,
 * unbundled query outside of any transaction block.
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
  console.log('🚀 Starting migration 074: Home Feed Query Indexes...\n');

  const statements = [
    {
      name: 'idx_follows_follower_lookup',
      table: 'follows',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_lookup ON follows (follower_id, follower_type)`
    },
    {
      name: 'idx_post_likes_liker_lookup',
      table: 'post_likes',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_likes_liker_lookup ON post_likes (liker_id, liker_type)`
    },
    {
      name: 'idx_post_comments_commenter_lookup',
      table: 'post_comments',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_commenter_lookup ON post_comments (commenter_id, commenter_type)`
    },
    {
      name: 'idx_posts_created_at_id_sort',
      table: 'posts',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_created_at_id_sort ON posts (created_at DESC, id DESC)`
    }
  ];

  for (const item of statements) {
    try {
      console.log(`⏳ Creating index ${item.name} on ${item.table}...`);
      await pool.query(item.sql);
      console.log(`✅ ${item.name} created successfully.`);
    } catch (err) {
      console.error(`❌ Error creating ${item.name}:`, err.message);
      throw err;
    }
  }

  // Verification
  console.log('\n🔍 Verifying newly created indexes in database:');
  const indexCheck = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE indexname IN (
      'idx_follows_follower_lookup',
      'idx_post_likes_liker_lookup',
      'idx_post_comments_commenter_lookup',
      'idx_posts_created_at_id_sort'
    )
    ORDER BY tablename, indexname;
  `);

  indexCheck.rows.forEach(r => {
    console.log(`  - [${r.tablename}] ${r.indexname}`);
  });

  console.log('\n🎉 Migration 074 completed successfully!');
}

runMigration()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
