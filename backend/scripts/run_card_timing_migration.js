/**
 * Migration runner for Card Timing System
 * Run: node backend/scripts/run_card_timing_migration.js
 */

const fs = require("fs");
const path = require("path");
const { createPool } = require("../config/db");

const pool = createPool();

async function runCardTimingMigration() {
  try {
    console.log("[Migration] Starting Card Timing System migration...");

    // Read migration file
    const migrationPath = path.join(
      __dirname,
      "card_timing_system_migration.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Run the migration
    await pool.query(sql);

    console.log(
      "[Migration] ✅ Card Timing System migration completed successfully",
    );
    console.log("\nMigration details:");
    console.log(
      "- Added timing fields to posts table (original_end_time, extended_at, extension_count, closed_at, closure_type)",
    );
    console.log("- Added resolution fields to qna_questions table");
    console.log("- Created card_extensions audit log table");
    console.log("- Created indexes for timing queries");

    process.exit(0);
  } catch (error) {
    console.error("[Migration] ❌ Migration failed:", error);
    process.exit(1);
  }
}

runCardTimingMigration();
