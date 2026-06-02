/**
 * Migration 016: Apply Enhancements
 * Adds richer fields to opportunity_applications and requires_resume to opportunities
 * Run with: node scripts/run_016_apply_enhancements.js
 */

require("dotenv").config();
const { createPool } = require("../config/db");
const pool = createPool();

async function run() {
  try {
    console.log("🚀 Migration 016: Apply Enhancements");

    await pool.query(`
      ALTER TABLE opportunity_applications
        ADD COLUMN IF NOT EXISTS intro_pitch TEXT,
        ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS resume_url TEXT,
        ADD COLUMN IF NOT EXISTS applicant_questions TEXT[] DEFAULT '{}';
    `);
    console.log("✓ Added new columns to opportunity_applications");

    await pool.query(`
      ALTER TABLE opportunities
        ADD COLUMN IF NOT EXISTS requires_resume BOOLEAN DEFAULT false;
    `);
    console.log("✓ Added requires_resume to opportunities");

    // Verify
    const { rows } = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'opportunity_applications'
        AND column_name IN ('intro_pitch', 'portfolio_links', 'resume_url', 'applicant_questions')
      ORDER BY column_name;
    `);
    console.log("\n📋 Verification — new columns:");
    rows.forEach((r) => console.log(`  ${r.column_name}: ${r.data_type}`));

    console.log("\n✅ Migration 016 completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration 016 failed:", err.message);
    process.exit(1);
  }
}

run();
