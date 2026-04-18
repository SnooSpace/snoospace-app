/**
 * Run Q&A Enhanced Migration
 * Adds qna_answers and qna_experts tables
 */

const fs = require("fs");
const path = require("path");
const { createPool } = require("../config/db");

async function runMigration() {
  const pool = createPool();

  try {
    console.log("Starting Q&A Enhanced Migration...\n");

    // Read migration SQL
    const sqlPath = path.join(__dirname, "qna_enhanced_migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute migration
    await pool.query(sql);

    console.log("✅ Migration completed successfully!\n");

    // Verify tables exist
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('qna_questions', 'qna_answers', 'qna_experts', 'qna_question_upvotes')
      ORDER BY table_name
    `);

    console.log("Q&A Tables in database:");
    tablesResult.rows.forEach((row) => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Check qna_questions columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'qna_questions'
      ORDER BY ordinal_position
    `);

    console.log("\nqna_questions columns:");
    columnsResult.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
