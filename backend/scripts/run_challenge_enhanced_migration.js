/**
 * Challenge Enhanced Migration Script
 * Adds progress and is_highlighted columns to challenge_participations table
 * Run this with: node scripts/run_challenge_enhanced_migration.js
 */

const path = require("path");
// Load env vars from backend/.env
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { createPool } = require("../config/db");
const pool = createPool();

async function runMigration() {
  try {
    console.log("Starting Challenge Enhanced Migration...\n");

    // Step 1: Add progress column
    console.log(
      "Step 1: Adding progress column to challenge_participations...",
    );
    await pool.query(`
      ALTER TABLE challenge_participations 
      ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
    `);
    console.log("✓ progress column added");

    // Step 2: Add is_highlighted column
    console.log(
      "Step 2: Adding is_highlighted column to challenge_participations...",
    );
    await pool.query(`
      ALTER TABLE challenge_participations 
      ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;
    `);
    console.log("✓ is_highlighted column added");

    // Step 3: Create challenge_submissions table if not exists
    console.log("Step 3: Creating challenge_submissions table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenge_submissions (
        id BIGSERIAL PRIMARY KEY,
        post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        participant_id BIGINT NOT NULL REFERENCES challenge_participations(id) ON DELETE CASCADE,
        content TEXT,
        media_urls JSONB,
        video_url TEXT,
        video_thumbnail TEXT,
        submission_type VARCHAR(20) DEFAULT 'image',
        status VARCHAR(20) DEFAULT 'pending',
        like_count INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        moderated_by BIGINT,
        moderated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✓ challenge_submissions table created");

    // Step 4: Create challenge_submission_likes table if not exists
    console.log("Step 4: Creating challenge_submission_likes table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenge_submission_likes (
        id BIGSERIAL PRIMARY KEY,
        submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_challenge_submission_like UNIQUE(submission_id, user_id, user_type)
      );
    `);
    console.log("✓ challenge_submission_likes table created");

    // Step 5: Create indexes
    console.log("Step 5: Creating indexes...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_challenge_submissions_post ON challenge_submissions(post_id);
      CREATE INDEX IF NOT EXISTS idx_challenge_submissions_participant ON challenge_submissions(participant_id);
      CREATE INDEX IF NOT EXISTS idx_challenge_submissions_status ON challenge_submissions(post_id, status);
      CREATE INDEX IF NOT EXISTS idx_challenge_submissions_featured ON challenge_submissions(post_id, is_featured) 
        WHERE is_featured = TRUE;
      CREATE INDEX IF NOT EXISTS idx_challenge_submission_likes ON challenge_submission_likes(submission_id);
    `);
    console.log("✓ Indexes created");

    // Verification
    console.log("\nVerification:");
    const verifyResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'challenge_participations'
        AND column_name IN ('progress', 'is_highlighted');
    `);
    console.log("challenge_participations columns:", verifyResult.rows);

    console.log("\n✅ Challenge Enhanced Migration completed successfully!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
