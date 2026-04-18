/**
 * Run Qualified Views Migration
 *
 * Creates tables for the qualified view tracking system:
 * - unique_view_events (public view count source of truth)
 * - repeat_view_events (private analytics)
 * - Adds public_view_count column to posts table
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createPool } = require("../config/db");

async function runMigration() {
  const pool = createPool();

  try {
    console.log("🚀 Starting Qualified Views migration...\n");

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, "qualified_views_migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the migration
    await pool.query(sql);

    console.log("✅ Migration completed successfully!\n");

    // Verify tables were created
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('unique_view_events', 'repeat_view_events')
    `);

    console.log("📊 Tables created:");
    tablesCheck.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Check if public_view_count column exists in posts
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
      AND column_name = 'public_view_count'
    `);

    if (columnCheck.rows.length > 0) {
      console.log("   - posts.public_view_count column ✓");
    }

    console.log("\n🎉 Qualified Views system is ready!");
  } catch (error) {
    console.error("❌ Migration failed!");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
