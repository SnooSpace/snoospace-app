// Run migration to add message_type and metadata to messages table
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Running migration: add_message_types...");

    // Add message_type column
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text'
    `);
    console.log("✓ Added message_type column");

    // Add metadata column
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL
    `);
    console.log("✓ Added metadata column");

    // Add index for message type
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_message_type 
      ON messages(message_type) WHERE message_type != 'text'
    `);
    console.log("✓ Added index");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
