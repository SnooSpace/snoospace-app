/**
 * Challenge Tagging Migration Script
 * Creates tables for challenge-tagged post feature:
 * - challenge_submission_sources: Links submissions to source posts
 * - submission_removal_requests: Tracks user requests to remove submissions
 * Run with: node scripts/create_challenge_tagging_tables.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { createPool } = require("../config/db");
const pool = createPool();

async function runMigration() {
  try {
    console.log("Starting Challenge Tagging Migration...\n");

    // Step 1: Create challenge_submission_sources table
    console.log("Step 1: Creating challenge_submission_sources table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenge_submission_sources (
        id BIGSERIAL PRIMARY KEY,
        submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
        source_post_id BIGINT REFERENCES posts(id) ON DELETE SET NULL,
        is_from_tagged_post BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✓ challenge_submission_sources table created");

    // Step 2: Create submission_removal_requests table
    console.log("Step 2: Creating submission_removal_requests table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submission_removal_requests (
        id BIGSERIAL PRIMARY KEY,
        submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
        requester_id BIGINT NOT NULL,
        requester_type VARCHAR(50) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        reviewed_by BIGINT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("✓ submission_removal_requests table created");

    // Step 3: Create indexes
    console.log("Step 3: Creating indexes...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_challenge_submission_sources_submission 
        ON challenge_submission_sources(submission_id);
      CREATE INDEX IF NOT EXISTS idx_challenge_submission_sources_post 
        ON challenge_submission_sources(source_post_id);
      CREATE INDEX IF NOT EXISTS idx_removal_requests_submission 
        ON submission_removal_requests(submission_id);
      CREATE INDEX IF NOT EXISTS idx_removal_requests_status 
        ON submission_removal_requests(status);
      CREATE INDEX IF NOT EXISTS idx_removal_requests_requester 
        ON submission_removal_requests(requester_id, requester_type);
    `);
    console.log("✓ Indexes created");

    // Step 4: Add challenge_id column to posts for quick lookups
    console.log("Step 4: Adding linked_challenge_id column to posts...");
    await pool.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS linked_challenge_id BIGINT REFERENCES posts(id) ON DELETE SET NULL;
    `);
    console.log("✓ linked_challenge_id column added to posts");

    // Step 5: Create index for linked_challenge_id
    console.log("Step 5: Creating index for linked_challenge_id...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_linked_challenge 
        ON posts(linked_challenge_id) WHERE linked_challenge_id IS NOT NULL;
    `);
    console.log("✓ Index created");

    // Verification
    console.log("\nVerification:");
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('challenge_submission_sources', 'submission_removal_requests');
    `);
    console.log(
      "Tables created:",
      tables.rows.map((r) => r.table_name),
    );

    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'posts' AND column_name = 'linked_challenge_id';
    `);
    console.log("Posts column added:", columns.rows.length > 0 ? "yes" : "no");

    console.log("\n✅ Challenge Tagging Migration completed successfully!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
