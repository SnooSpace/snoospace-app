// Run migration to add threaded replies and pinning to prompt submissions
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Running migration: prompt_replies_migration...\n");

    // Step 1: Add is_pinned column
    await client.query(`
      ALTER TABLE prompt_submissions 
      ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE
    `);
    console.log("✓ Added is_pinned column to prompt_submissions");

    // Step 2: Add reply_count column
    await client.query(`
      ALTER TABLE prompt_submissions 
      ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0
    `);
    console.log("✓ Added reply_count column to prompt_submissions");

    // Step 3: Create prompt_replies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_replies (
        id BIGSERIAL PRIMARY KEY,
        submission_id BIGINT NOT NULL REFERENCES prompt_submissions(id) ON DELETE CASCADE,
        author_id BIGINT NOT NULL,
        author_type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        is_hidden BOOLEAN DEFAULT FALSE,
        hidden_at TIMESTAMP WITH TIME ZONE,
        hidden_by BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log("✓ Created prompt_replies table");

    // Step 4: Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_replies_submission ON prompt_replies(submission_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_replies_author ON prompt_replies(author_id, author_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prompt_submissions_pinned ON prompt_submissions(post_id, is_pinned) WHERE is_pinned = TRUE
    `);
    console.log("✓ Created indexes");

    // Step 5: Migrate featured to pinned
    const featuredResult = await client.query(`
      UPDATE prompt_submissions SET is_pinned = TRUE WHERE status = 'featured' RETURNING id
    `);
    if (featuredResult.rowCount > 0) {
      console.log(
        `✓ Migrated ${featuredResult.rowCount} featured submissions to pinned`
      );
    }

    await client.query(`
      UPDATE prompt_submissions SET status = 'approved' WHERE status = 'featured'
    `);
    console.log("✓ Updated featured status to approved");

    console.log("\n✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
