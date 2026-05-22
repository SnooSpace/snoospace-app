require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createPool } = require("../config/db");

async function runMigration() {
  const pool = createPool();

  try {
    console.log("Starting Opportunity Details Migration...\n");

    // Read migration SQL
    const sqlPath = path.join(__dirname, "add_opportunity_details_fields.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute migration
    await pool.query(sql);

    console.log("✅ Migration completed successfully!\n");

    // Verify columns exist
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'opportunities'
      AND column_name IN ('about_role', 'responsibilities', 'who_can_apply', 'gains', 'trial_type')
      ORDER BY column_name
    `);

    console.log("Verified Opportunity columns in database:");
    columnsResult.rows.forEach((row) => {
      console.log(`  ✓ ${row.column_name}: ${row.data_type}`);
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
