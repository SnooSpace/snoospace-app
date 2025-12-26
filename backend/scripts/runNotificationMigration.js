/**
 * Migration Runner: Enhance Notifications for Deduplication
 *
 * This script runs the notification enhancement migration which:
 * 1. Adds is_active and updated_at columns
 * 2. Deduplicates existing follow notifications
 * 3. Creates unique partial index to prevent future duplicates
 * 4. Adds notification_aggregates table for likes/comments
 *
 * Run with: node scripts/runNotificationMigration.js
 */

require("dotenv").config();
const { createPool } = require("../config/db");
const fs = require("fs");
const path = require("path");

const pool = createPool();

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🔔 Starting Notification Enhancement Migration");
    console.log("=".repeat(50));

    // Begin transaction for safety
    await client.query("BEGIN");

    // Step 1: Add is_active column
    console.log("\n📝 Step 1: Adding is_active column...");
    await client.query(`
      ALTER TABLE notifications 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    console.log("✓ is_active column added");

    // Step 2: Add updated_at column
    console.log("\n📝 Step 2: Adding updated_at column...");
    await client.query(`
      ALTER TABLE notifications 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    console.log("✓ updated_at column added");

    // Step 3: Backfill updated_at
    console.log("\n📝 Step 3: Backfilling updated_at from created_at...");
    const backfillResult = await client.query(`
      UPDATE notifications 
      SET updated_at = created_at 
      WHERE updated_at IS NULL
      RETURNING id;
    `);
    console.log(`✓ Backfilled ${backfillResult.rowCount} rows`);

    // Step 4: Count follow duplicates before deduplication
    console.log("\n📝 Step 4: Analyzing follow notification duplicates...");
    const duplicatesResult = await client.query(`
      SELECT COUNT(*) as duplicate_count FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY actor_id, actor_type, recipient_id, recipient_type, type 
          ORDER BY created_at DESC
        ) AS rn
        FROM notifications
        WHERE type = 'follow'
      ) ranked WHERE rn > 1;
    `);
    console.log(
      `Found ${duplicatesResult.rows[0].duplicate_count} duplicate follow notifications to deactivate`
    );

    // Step 5: Deduplicate
    console.log("\n📝 Step 5: Deduplicating follow notifications...");
    const dedupeResult = await client.query(`
      WITH ranked AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                 PARTITION BY actor_id, actor_type, recipient_id, recipient_type, type 
                 ORDER BY created_at DESC
               ) AS rn
        FROM notifications
        WHERE type = 'follow'
      )
      UPDATE notifications n
      SET is_active = FALSE
      FROM ranked r
      WHERE n.id = r.id AND r.rn > 1
      RETURNING n.id;
    `);
    console.log(
      `✓ Deactivated ${dedupeResult.rowCount} duplicate follow notifications`
    );

    // Step 6: Create unique partial index
    console.log(
      "\n📝 Step 6: Creating unique partial index for follow notifications..."
    );
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_active_follow
        ON notifications (actor_id, actor_type, recipient_id, recipient_type, type)
        WHERE type IN ('follow') AND is_active = TRUE;
    `);
    console.log("✓ Unique partial index created");

    // Step 7: Update performance indexes
    console.log("\n📝 Step 7: Updating query performance indexes...");

    await client.query(
      `DROP INDEX IF EXISTS idx_notifications_recipient_read;`
    );
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_active_read
        ON notifications (recipient_id, recipient_type, is_active, is_read)
        WHERE is_active = TRUE;
    `);

    await client.query(`DROP INDEX IF EXISTS idx_notifications_created_at;`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at_active
        ON notifications (created_at DESC)
        WHERE is_active = TRUE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_inactive_old
        ON notifications (is_active, updated_at)
        WHERE is_active = FALSE;
    `);
    console.log("✓ Performance indexes updated");

    // Step 8: Create notification_aggregates table
    console.log("\n📝 Step 8: Creating notification_aggregates table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_aggregates (
        id BIGSERIAL PRIMARY KEY,
        recipient_id BIGINT NOT NULL,
        recipient_type VARCHAR(16) NOT NULL,
        type VARCHAR(32) NOT NULL,
        reference_id BIGINT,
        reference_type VARCHAR(16),
        actor_ids BIGINT[] NOT NULL DEFAULT '{}',
        actor_types VARCHAR(16)[] NOT NULL DEFAULT '{}',
        actor_count INT NOT NULL DEFAULT 1,
        latest_actor_id BIGINT NOT NULL,
        latest_actor_type VARCHAR(16) NOT NULL,
        payload JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_agg_unique
        ON notification_aggregates (recipient_id, recipient_type, type, reference_id, reference_type)
        WHERE is_active = TRUE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notif_agg_recipient
        ON notification_aggregates (recipient_id, recipient_type, is_active, is_read)
        WHERE is_active = TRUE;
    `);
    console.log("✓ notification_aggregates table created with indexes");

    // Commit transaction
    await client.query("COMMIT");

    // Verification
    console.log("\n" + "=".repeat(50));
    console.log("📊 Verification:");

    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive,
        COUNT(*) FILTER (WHERE type = 'follow' AND is_active = TRUE) as active_follows
      FROM notifications;
    `);
    const stats = verifyResult.rows[0];
    console.log(`Total notifications: ${stats.total}`);
    console.log(`Active notifications: ${stats.active}`);
    console.log(`Inactive (deduplicated): ${stats.inactive}`);
    console.log(`Active follow notifications: ${stats.active_follows}`);

    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed:", error);
    console.error("Transaction rolled back. No changes were made.");
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigration();
