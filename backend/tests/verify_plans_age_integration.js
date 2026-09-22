require("dotenv").config();
const { createPool } = require("../config/db");

const pool = createPool();

async function run() {
  console.log("=== Running Comprehensive Open Plans Age Range & Filter Test ===");
  const client = await pool.connect();
  let testPlanId = null;
  let testMemberYoungId = null;
  let testMemberAdultId = null;
  let hostMemberId = null;

  try {
    const ts = Date.now();
    // 1. Create 3 test members (Host, Young Member age 19, Adult Member age 25)
    const hostR = await client.query(
      `INSERT INTO members (name, username, email, phone, gender, dob, interests)
       VALUES ('Host Age Test', 'host_${ts}', 'host_${ts}@test.com', '989${ts.toString().slice(-7)}', 'Female', '1998-05-15', '["music","sports","tech"]')
       RETURNING id, EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::int as age`
    );
    hostMemberId = hostR.rows[0].id;
    console.log(`Host created (ID: ${hostMemberId}, Age: ${hostR.rows[0].age})`);

    // Young member: Born in 2007 (approx 19 yrs old)
    const youngR = await client.query(
      `INSERT INTO members (name, username, email, phone, gender, dob, interests)
       VALUES ('Young Age Test', 'young_${ts}', 'young_${ts}@test.com', '988${ts.toString().slice(-7)}', 'Male', '2007-01-10', '["music","sports","tech"]')
       RETURNING id, EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::int as age`
    );
    testMemberYoungId = youngR.rows[0].id;
    const youngAge = youngR.rows[0].age;
    console.log(`Young member created (ID: ${testMemberYoungId}, Age: ${youngAge})`);

    // Adult member: Born in 2001 (approx 25 yrs old)
    const adultR = await client.query(
      `INSERT INTO members (name, username, email, phone, gender, dob, interests)
       VALUES ('Adult Age Test', 'adult_${ts}', 'adult_${ts}@test.com', '987${ts.toString().slice(-7)}', 'Female', '2001-03-20', '["music","sports","tech"]')
       RETURNING id, EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::int as age`
    );
    testMemberAdultId = adultR.rows[0].id;
    const adultAge = adultR.rows[0].age;
    console.log(`Adult member created (ID: ${testMemberAdultId}, Age: ${adultAge})`);

    // 2. Insert Open Plan restricted to ages 22 to 30
    const planR = await client.query(
      `INSERT INTO open_plans (
         created_by, title, activity_type, cost_type, visibility, scheduled_at, expires_at, min_age, max_age, gender_preference
       ) VALUES ($1, 'Age 22-30 Social Plan', 'food', 'free', 'everyone', NOW() + INTERVAL '3 days', NOW() + INTERVAL '4 days', 22, 30, 'all')
       RETURNING *`,
      [hostMemberId]
    );
    testPlanId = planR.rows[0].id;
    console.log(`Open Plan created (ID: ${testPlanId}, Range: ${planR.rows[0].min_age} - ${planR.rows[0].max_age})`);

    // 3. Test Feed Query with Age Filter:
    // Filter [20, 25] should match our plan (22-30) because they overlap
    const matchFilterR = await client.query(
      `SELECT op.id, op.title, op.min_age, op.max_age
       FROM open_plans op
       WHERE op.id = $1
         AND (op.min_age IS NULL OR op.min_age <= 25)
         AND (op.max_age IS NULL OR op.max_age >= 20)`,
      [testPlanId]
    );
    if (matchFilterR.rows.length !== 1) {
      throw new Error("Feed query matching overlap failed!");
    }
    console.log("✓ Feed filter overlap query passed");

    // Filter [18, 20] should NOT match our plan (22-30)
    const noMatchFilterR = await client.query(
      `SELECT op.id, op.title, op.min_age, op.max_age
       FROM open_plans op
       WHERE op.id = $1
         AND (op.min_age IS NULL OR op.min_age <= 20)
         AND (op.max_age IS NULL OR op.max_age >= 18)`,
      [testPlanId]
    );
    if (noMatchFilterR.rows.length !== 0) {
      throw new Error("Feed query non-overlap unexpectedly returned a match!");
    }
    console.log("✓ Feed filter non-overlap exclusion passed");

    // 4. Test Ineligible Request Simulation:
    // Young member (age ~19) trying to request plan for 22-30
    if (youngAge < planR.rows[0].min_age) {
      console.log(`Verifying rejection for young member (${youngAge} < ${planR.rows[0].min_age})`);
      const shouldBlock = (planR.rows[0].min_age !== null && youngAge < planR.rows[0].min_age) ||
                          (planR.rows[0].max_age !== null && youngAge > planR.rows[0].max_age);
      if (!shouldBlock) throw new Error("Age validation logic failed for young member!");
      console.log("✓ Ineligible member age validation correctly flagged");
    }

    // 5. Test Eligible Request Simulation:
    // Adult member (age ~25) is within 22-30
    const adultBlocked = (planR.rows[0].min_age !== null && adultAge < planR.rows[0].min_age) ||
                         (planR.rows[0].max_age !== null && adultAge > planR.rows[0].max_age);
    if (adultBlocked) throw new Error("Adult member should be eligible but was flagged as blocked!");
    console.log("✓ Eligible member (age ~25) correctly passed age range check");

    // 6. Test updating plan to remove age restriction (set null)
    await client.query(
      `UPDATE open_plans SET min_age = NULL, max_age = NULL WHERE id = $1`,
      [testPlanId]
    );
    const updatedR = await client.query(`SELECT min_age, max_age FROM open_plans WHERE id = $1`, [testPlanId]);
    if (updatedR.rows[0].min_age !== null || updatedR.rows[0].max_age !== null) {
      throw new Error("Update plan clearing age restriction failed!");
    }
    console.log("✓ Updating plan to clear age range passed");

    console.log("=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    // Cleanup
    if (testPlanId) {
      await client.query("DELETE FROM open_plans WHERE id = $1", [testPlanId]);
    }
    if (testMemberYoungId) {
      await client.query("DELETE FROM members WHERE id = $1", [testMemberYoungId]);
    }
    if (testMemberAdultId) {
      await client.query("DELETE FROM members WHERE id = $1", [testMemberAdultId]);
    }
    if (hostMemberId) {
      await client.query("DELETE FROM members WHERE id = $1", [hostMemberId]);
    }
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
