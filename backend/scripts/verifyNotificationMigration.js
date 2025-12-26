/**
 * Verification script for notification deduplication
 * Run with: node scripts/verifyNotificationMigration.js
 */

require("dotenv").config();
const { createPool } = require("../config/db");

const pool = createPool();

async function verify() {
  const client = await pool.connect();

  try {
    console.log("🔔 Notification System Verification");
    console.log("=".repeat(50));

    // 1. Check columns exist
    console.log("\n📋 Checking table structure...");
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);
    console.log("Notifications table columns:");
    columnsResult.rows.forEach((col) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 2. Check unique index exists
    console.log("\n📋 Checking indexes...");
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'notifications'
        AND indexname LIKE '%unique%';
    `);
    if (indexResult.rows.length > 0) {
      console.log("✓ Unique partial index found:");
      indexResult.rows.forEach((idx) => {
        console.log(`  - ${idx.indexname}`);
      });
    } else {
      console.log("⚠️ No unique index found!");
    }

    // 3. Check notification counts
    console.log("\n📋 Notification statistics:");
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive,
        COUNT(*) FILTER (WHERE type = 'follow') as follow_total,
        COUNT(*) FILTER (WHERE type = 'follow' AND is_active = TRUE) as follow_active
      FROM notifications;
    `);
    const stats = statsResult.rows[0];
    console.log(`  Total notifications: ${stats.total}`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  Inactive (deduplicated): ${stats.inactive}`);
    console.log(`  Follow notifications (active): ${stats.follow_active}`);

    // 4. Check for any remaining duplicates (should be 0)
    console.log("\n📋 Checking for duplicate active follow notifications...");
    const dupeResult = await client.query(`
      SELECT actor_id, actor_type, recipient_id, recipient_type, COUNT(*) as count
      FROM notifications
      WHERE type = 'follow' AND is_active = TRUE
      GROUP BY actor_id, actor_type, recipient_id, recipient_type
      HAVING COUNT(*) > 1;
    `);
    if (dupeResult.rows.length === 0) {
      console.log("✓ No duplicate active follow notifications found!");
    } else {
      console.log(
        `⚠️ Found ${dupeResult.rows.length} duplicate groups! This should not happen.`
      );
      dupeResult.rows.forEach((row) => {
        console.log(
          `  - Actor ${row.actor_type}:${row.actor_id} -> Recipient ${row.recipient_type}:${row.recipient_id}: ${row.count} duplicates`
        );
      });
    }

    // 5. Check notification_aggregates table exists
    console.log("\n📋 Checking notification_aggregates table...");
    const aggResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notification_aggregates'
      ) as exists;
    `);
    if (aggResult.rows[0].exists) {
      console.log("✓ notification_aggregates table exists");
    } else {
      console.log("⚠️ notification_aggregates table NOT found!");
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ Verification complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

verify();
