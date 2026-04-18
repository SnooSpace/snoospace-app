const pool = require("../config/database");

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Starting poll_votes constraint migration...");

    await client.query("BEGIN");

    // Drop the old constraint
    console.log("Dropping old unique constraint...");
    await client.query(`
      ALTER TABLE poll_votes 
      DROP CONSTRAINT IF EXISTS unique_poll_vote
    `);

    // Add new constraint that includes option_index
    console.log("Adding new unique constraint with option_index...");
    await client.query(`
      ALTER TABLE poll_votes 
      ADD CONSTRAINT unique_poll_vote UNIQUE(post_id, voter_id, voter_type, option_index)
    `);

    await client.query("COMMIT");

    console.log("✅ Migration completed successfully!");
    console.log(
      "Users can now vote for multiple options in polls with allow_multiple=true",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
