/**
 * Run Post Types Migration
 * Executes the SQL migration to add post type support
 */

const path = require("path");
// Load env vars from backend/.env
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { createPool } = require("../config/db");
const fs = require("fs");

async function runMigration() {
  const pool = createPool();

  console.log("Starting Post Types Migration...\n");

  try {
    // Read the migration SQL file
    const sqlPath = path.join(__dirname, "post_types_migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Remove comments (both -- and /* */)
    const cleanSql = sql
      .replace(/--.*$/gm, "") // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove block comments

    // Split by semicolons and filter empty statements
    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip pure comments
      if (stmt.startsWith("--") || stmt.startsWith("/*")) continue;

      // Show progress
      const preview = stmt.substring(0, 60).replace(/\n/g, " ");
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);

      try {
        await pool.query(stmt);
        console.log("   ✓ Success\n");
      } catch (err) {
        // Ignore "already exists" errors for idempotent migrations
        if (
          err.code === "42701" || // column already exists
          err.code === "42P07" || // relation already exists
          err.code === "42710"
        ) {
          // constraint already exists
          console.log(`   ⚠ Already exists (skipped)\n`);
        } else {
          console.error(`   ✗ Error: ${err.message}\n`);
          throw err;
        }
      }
    }

    console.log("\n========================================");
    console.log("Post Types Migration completed successfully!");
    console.log("========================================\n");

    // Verify the migration
    console.log("Verifying migration...\n");

    // Check posts table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
        AND column_name IN ('post_type', 'status', 'expires_at', 'type_data')
    `);
    console.log("Posts table new columns:", columnsResult.rows);

    // Check new tables
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('poll_votes', 'prompt_submissions', 'qna_questions', 'challenge_participations')
    `);
    console.log(
      "New tables created:",
      tablesResult.rows.map((r) => r.table_name)
    );

    // Check existing posts count
    const postsCount = await pool.query(`
      SELECT post_type, COUNT(*) as count 
      FROM posts 
      GROUP BY post_type
    `);
    console.log("Posts by type:", postsCount.rows);
  } catch (error) {
    console.error("\nMigration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
