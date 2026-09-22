require("dotenv").config();
const { createPool } = require("../config/db");

const pool = createPool();

async function runTest() {
  console.log("=== Testing Open Plans Age Range ===");
  const client = await pool.connect();
  try {
    // 1. Fetch a member to act as creator
    const memberR = await client.query("SELECT id, dob, gender FROM members LIMIT 1");
    if (memberR.rows.length === 0) {
      console.log("No members found, skipping live insert test");
      return;
    }
    const creator = memberR.rows[0];
    console.log("Using creator member id:", creator.id);

    // 2. Test valid insertion with min_age and max_age
    const validInsert = await client.query(
      `INSERT INTO open_plans (
         created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, min_age, max_age
       ) VALUES ($1, 'Age Range Test Plan', 'sports', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 21, 29)
       RETURNING id, min_age, max_age, scheduled_at`,
      [creator.id]
    );
    const planId = validInsert.rows[0].id;
    console.log("Inserted valid plan with age range:", validInsert.rows[0]);

    if (validInsert.rows[0].min_age !== 21 || validInsert.rows[0].max_age !== 29) {
      throw new Error("Age range values did not match!");
    }

    // 3. Test check constraint rejection when min_age > max_age
    let constraintFailed = false;
    try {
      await client.query(
        `INSERT INTO open_plans (
           created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, min_age, max_age
         ) VALUES ($1, 'Invalid Age Range Plan', 'sports', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 35, 20)`,
        [creator.id]
      );
    } catch (err) {
      constraintFailed = true;
      console.log("Check constraint successfully caught invalid min_age > max_age:", err.message);
    }
    if (!constraintFailed) {
      throw new Error("Check constraint FAILED to catch min_age > max_age!");
    }

    // 4. Test check constraint rejection when min_age < 18
    let under18Failed = false;
    try {
      await client.query(
        `INSERT INTO open_plans (
           created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, min_age, max_age
         ) VALUES ($1, 'Under 18 Plan', 'sports', 'free', 'everyone', NOW() + INTERVAL '2 days', NOW() + INTERVAL '3 days', 16, 25)`,
        [creator.id]
      );
    } catch (err) {
      under18Failed = true;
      console.log("Check constraint successfully caught min_age < 18:", err.message);
    }
    if (!under18Failed) {
      throw new Error("Check constraint FAILED to catch min_age < 18!");
    }

    // 5. Test query filtering logic (matching overlap: 20 to 25 overlaps with 21 to 29)
    const filterR = await client.query(
      `SELECT id, title, min_age, max_age FROM open_plans
       WHERE id = $1
         AND (min_age IS NULL OR min_age <= 25)
         AND (max_age IS NULL OR max_age >= 20)`,
      [planId]
    );
    console.log("Filter overlap matched:", filterR.rows.length === 1);
    if (filterR.rows.length !== 1) throw new Error("Overlap filter did not match!");

    // Non-overlap filter (30 to 40 does NOT overlap with 21 to 29)
    const nonOverlapR = await client.query(
      `SELECT id, title, min_age, max_age FROM open_plans
       WHERE id = $1
         AND (min_age IS NULL OR min_age <= 40)
         AND (max_age IS NULL OR max_age >= 30)`,
      [planId]
    );
    console.log("Non-overlap correctly excluded:", nonOverlapR.rows.length === 0);
    if (nonOverlapR.rows.length !== 0) throw new Error("Non-overlap filter matched unexpectedly!");

    // 6. Clean up
    await client.query("DELETE FROM open_plans WHERE id = $1", [planId]);
    console.log("Cleanup complete");
    console.log("ALL BACKEND DATABASE TESTS PASSED!");
  } finally {
    client.release();
    await pool.end();
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
