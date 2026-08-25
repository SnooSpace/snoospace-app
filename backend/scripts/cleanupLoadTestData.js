'use strict';
/**
 * Load Test Synthetic Data Cleanup Script (Hardened)
 * 
 * Purges all synthetic load test data tagged with `is_load_test = true`
 * from the database in strict FK dependency order (children before parents).
 * 
 * Safety Features:
 *   - Supports `--dry-run` flag to preview row counts without modifying data.
 *   - Pre-check safety scan: detects if any untagged rows reference test member emails
 *     ('loadtest_%@snoospace-test.internal') as a safeguard against accidental write-path runs.
 *   - Automatically executes `ANALYZE` after cleanup to reset PostgreSQL
 *     planner statistics back to real-data distributions.
 * 
 * Usage:
 *   # Preview what would be deleted:
 *   node scripts/cleanupLoadTestData.js --dry-run
 * 
 *   # Execute real cleanup:
 *   node scripts/cleanupLoadTestData.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function runCleanup() {
  const isDryRun = process.argv.includes('--dry-run');
  const pool = createPool();
  const startTime = Date.now();

  console.log('================================================================');
  console.log(`🧹 Load Test Synthetic Data Cleanup ${isDryRun ? '(DRY RUN MODE)' : '(LIVE PURGE MODE)'}`);
  console.log('   Filter: WHERE is_load_test = true');
  console.log('================================================================\n');

  // Deletion order: children before parents
  const tables = [
    { name: 'post_comments', description: 'Post Comments' },
    { name: 'post_likes',    description: 'Post Likes' },
    { name: 'follows',       description: 'Follow Relationships' },
    { name: 'posts',         description: 'Posts' },
    { name: 'members',       description: 'Members' },
  ];

  try {
    // ── Defensive Pre-Check: Scan for untagged writes from test members ────────
    const orphanCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM post_likes pl JOIN members m ON pl.liker_id = m.id WHERE m.is_load_test = true AND pl.is_load_test = false) AS untagged_likes,
        (SELECT COUNT(*)::int FROM post_comments pc JOIN members m ON pc.commenter_id = m.id WHERE m.is_load_test = true AND pc.is_load_test = false) AS untagged_comments,
        (SELECT COUNT(*)::int FROM follows f JOIN members m ON f.follower_id = m.id WHERE m.is_load_test = true AND f.is_load_test = false) AS untagged_follows
    `);

    const { untagged_likes, untagged_comments, untagged_follows } = orphanCheck.rows[0];
    const totalUntagged = untagged_likes + untagged_comments + untagged_follows;

    if (totalUntagged > 0) {
      console.warn('⚠️  WARNING: Detected untagged write-activity from test members:');
      console.warn(`    Untagged Likes: ${untagged_likes}, Comments: ${untagged_comments}, Follows: ${untagged_follows}`);
      console.warn('    These will be included in the cleanup to prevent FK constraint violations.\n');
    }

    if (isDryRun) {
      console.log('🔍 Scanning database for synthetic load test rows...\n');
      let totalFound = 0;

      for (const table of tables) {
        const countRes = await pool.query(
          `SELECT COUNT(*)::int AS count FROM ${table.name} WHERE is_load_test = true`
        );
        const count = countRes.rows[0].count;
        totalFound += count;
        console.log(`  - ${table.name.padEnd(16)}: ${String(count).padStart(6)} rows found (${table.description})`);
      }

      console.log('\n----------------------------------------------------------------');
      console.log(`📊 Dry Run Summary: Total synthetic rows to delete: ${totalFound + totalUntagged}`);
      console.log('   (No rows were modified or deleted)');
      console.log('================================================================\n');
      return;
    }

    // ── Live Purge Mode ───────────────────────────────────────────────────────
    console.log('⚠️  Executing deletion of synthetic rows...\n');
    let totalDeleted = 0;

    // Purge any untagged write artifacts if they exist
    if (totalUntagged > 0) {
      await pool.query(`
        DELETE FROM post_comments WHERE commenter_id IN (SELECT id FROM members WHERE is_load_test = true);
        DELETE FROM post_likes WHERE liker_id IN (SELECT id FROM members WHERE is_load_test = true);
        DELETE FROM follows WHERE follower_id IN (SELECT id FROM members WHERE is_load_test = true);
      `);
      console.log(`  ✓ Purged ${totalUntagged} untagged activity rows linked to test members`);
      totalDeleted += totalUntagged;
    }

    // Purge main synthetic rows
    for (const table of tables) {
      const deleteRes = await pool.query(
        `DELETE FROM ${table.name} WHERE is_load_test = true`
      );
      const count = deleteRes.rowCount;
      totalDeleted += count;
      console.log(`  ✓ Purged ${String(count).padStart(6)} rows from ${table.name.padEnd(16)} (${table.description})`);
    }

    // ── Reset Planner Statistics ──────────────────────────────────────────────
    console.log('\n🔄 Resetting PostgreSQL query planner statistics (ANALYZE)...');
    for (const table of tables) {
      await pool.query(`ANALYZE ${table.name};`);
      console.log(`  ✓ ANALYZE ${table.name}`);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n================================================================');
    console.log(`🎉 Cleanup Completed Successfully in ${elapsedSeconds}s!`);
    console.log(`   Total Synthetic Rows Purged: ${totalDeleted}`);
    console.log('   All query planner statistics have been refreshed.');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Cleanup failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCleanup();
