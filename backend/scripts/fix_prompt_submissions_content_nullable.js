/**
 * Migration: Make prompt_submissions.content nullable
 * Reason: Image-type prompt responses have no text content — only media_urls.
 * The original schema required content NOT NULL, which blocks image submissions.
 */

require("dotenv").config();
const { createPool } = require("../config/db");

const pool = createPool();

async function run() {
  console.log("🔧 Making prompt_submissions.content nullable...");

  try {
    // Check current nullability
    const check = await pool.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'prompt_submissions' AND column_name = 'content'
    `);

    if (check.rows[0]?.is_nullable === "YES") {
      console.log("✓ content column is already nullable — nothing to do.");
      return;
    }

    // Drop the NOT NULL constraint
    await pool.query(`
      ALTER TABLE prompt_submissions ALTER COLUMN content DROP NOT NULL
    `);

    console.log("✓ content column is now nullable.");

    // Verify
    const verify = await pool.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'prompt_submissions' AND column_name = 'content'
    `);
    console.log("  Verified is_nullable =", verify.rows[0]?.is_nullable);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
