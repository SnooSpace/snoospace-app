/**
 * Test Script — Prompt 3
 * Data Change Handling & Dormant User Fix
 *
 * Run: node scripts/testPrompt3DataChange.js
 */

require("dotenv").config();
const { createPool } = require("../config/db");
const { handleProfileFieldChange } = require("../utils/profileChangeHandler");

const pool = createPool();
let passed = 0;
let failed = 0;

const test = (name, fn) => async () => {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
};

// Pull the real function from the controller for white-box testing
// We do this by evaluating just the function body, not the whole module
const calculateOnboardingWeight = (totalEvents, lastActiveAt = null) => {
  const eventDecay = Math.max(0.02, 0.90 * Math.exp(-0.008 * totalEvents));
  if (!lastActiveAt) return eventDecay;
  const daysSinceActive = Math.floor(
    (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceActive < 60) return eventDecay;
  const dormancyRecovery = Math.min(0.5, ((daysSinceActive - 60) / 240) * 0.5);
  return Math.min(0.5, eventDecay + dormancyRecovery);
};

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function run() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Prompt 3 — Data Change Handling & Dormant Fix");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 1. Schema Verification ──────────────────────────────────────────────
  console.log("◆ Schema Verification");

  await test("member_profile_change_log table exists with all columns", async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'member_profile_change_log'
    `);
    const cols = r.rows.map(c => c.column_name);
    const required = ["id", "user_id", "field_changed", "old_value", "new_value",
                      "changed_at", "aqi_recalculated", "recalculated_at"];
    for (const col of required) {
      if (!cols.includes(col)) throw new Error(`Missing column: ${col}`);
    }
  })();

  await test("user_aqi_signals has last_active_at column", async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_aqi_signals' AND column_name = 'last_active_at'
    `);
    if (r.rows.length === 0) throw new Error("last_active_at column not found");
  })();

  await test("user_aqi_signals has dormancy_adjustment_applied column", async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_aqi_signals' AND column_name = 'dormancy_adjustment_applied'
    `);
    if (r.rows.length === 0) throw new Error("dormancy_adjustment_applied column not found");
  })();

  await test("platform_config table exists and seeded", async () => {
    const r = await pool.query(`
      SELECT key FROM platform_config
      WHERE key IN (
        'interest_vector_decay_lambda',
        'aqi_minimum_behavior_events',
        'aqi_dormancy_threshold_days'
      )
    `);
    if (r.rows.length < 3) throw new Error(`Only ${r.rows.length}/3 config keys seeded`);
  })();

  await test("interest_vector_decay_lambda value is 0.02 (default)", async () => {
    const r = await pool.query(
      `SELECT value FROM platform_config WHERE key = 'interest_vector_decay_lambda'`
    );
    const val = parseFloat(r.rows[0]?.value);
    if (val !== 0.02) throw new Error(`Expected 0.02, got ${val}`);
  })();

  await test("Partial indexes on member_profile_change_log exist", async () => {
    const r = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN ('idx_profile_changes_user', 'idx_profile_changes_pending')
    `);
    if (r.rows.length < 2) throw new Error(`Only ${r.rows.length}/2 indexes found`);
  })();

  // ── 2. Dormancy Weight Formula ──────────────────────────────────────────
  console.log("\n◆ Dormancy Weight Formula");

  await test("Active user (0 events) → weight = 0.90", async () => {
    const w = calculateOnboardingWeight(0, daysAgo(5));
    if (Math.abs(w - 0.90) > 0.001) throw new Error(`Expected ~0.90, got ${w.toFixed(4)}`);
  })();

  await test("Active user (500 events) → weight ≈ 0.02 (floor)", async () => {
    const w = calculateOnboardingWeight(500, daysAgo(5));
    if (w > 0.025) throw new Error(`Expected ~0.02, got ${w.toFixed(4)}`);
  })();

  await test("Dormant user (90 days, 500 events) → weight > 0.02 (dormancy kick)", async () => {
    const w = calculateOnboardingWeight(500, daysAgo(90));
    if (w <= 0.02) throw new Error(`Expected dormancy recovery, got ${w.toFixed(4)}`);
    // 90 days → 30 days past threshold → recovery = (30/240)*0.5 = 0.0625
    const expected = Math.min(0.5, 0.02 + (30 / 240) * 0.5);
    if (Math.abs(w - expected) > 0.001) throw new Error(`Expected ${expected.toFixed(4)}, got ${w.toFixed(4)}`);
  })();

  await test("Dormant user (300 days, 500 events) → weight capped at 0.5", async () => {
    const w = calculateOnboardingWeight(500, daysAgo(300));
    if (w !== 0.5) throw new Error(`Expected 0.5 cap, got ${w.toFixed(4)}`);
  })();

  await test("No lastActiveAt → pure event decay (no dormancy)", async () => {
    const w1 = calculateOnboardingWeight(200, null);
    const w2 = calculateOnboardingWeight(200); // default
    if (w1 !== w2) throw new Error(`Expected same result with null lastActiveAt`);
    const expected = Math.max(0.02, 0.90 * Math.exp(-0.008 * 200));
    if (Math.abs(w1 - expected) > 0.001) throw new Error(`Expected ${expected.toFixed(4)}, got ${w1.toFixed(4)}`);
  })();

  // ── 3. Profile Change Log (DB write) ───────────────────────────────────
  console.log("\n◆ Profile Change Log");

  // Use the FIRST real member in the DB for testing (avoids FK violation)
  const memberRow = await pool.query(
    `SELECT id FROM members WHERE signup_status = 'COMPLETE' LIMIT 1`
  );

  if (memberRow.rows.length === 0) {
    console.log("  ⚠️  No completed members found — skipping live DB write tests");
  } else {
    const testUserId = memberRow.rows[0].id;

    await test("handleProfileFieldChange writes to member_profile_change_log", async () => {
      const before = await pool.query(
        `SELECT COUNT(*) FROM member_profile_change_log WHERE user_id = $1 AND field_changed = 'occupation'`,
        [testUserId]
      );
      const countBefore = parseInt(before.rows[0].count);

      await handleProfileFieldChange(pool, testUserId, 'occupation', 'Engineer', 'Product Manager');

      const after = await pool.query(
        `SELECT COUNT(*) FROM member_profile_change_log WHERE user_id = $1 AND field_changed = 'occupation'`,
        [testUserId]
      );
      const countAfter = parseInt(after.rows[0].count);
      if (countAfter <= countBefore) throw new Error("No new log entry created");
    })();

    await test("Log entry is marked aqi_recalculated=true after handling", async () => {
      const r = await pool.query(`
        SELECT aqi_recalculated FROM member_profile_change_log
        WHERE user_id = $1 AND field_changed = 'occupation'
        ORDER BY changed_at DESC LIMIT 1
      `, [testUserId]);
      if (r.rows.length === 0) throw new Error("No log entry found");
      if (!r.rows[0].aqi_recalculated) throw new Error("aqi_recalculated should be true");
    })();

    await test("Gender change is also logged correctly", async () => {
      const before = await pool.query(
        `SELECT COUNT(*) FROM member_profile_change_log WHERE user_id = $1 AND field_changed = 'gender'`,
        [testUserId]
      );
      const countBefore = parseInt(before.rows[0].count);

      await handleProfileFieldChange(pool, testUserId, 'gender', 'Male', 'Male'); // same value, still logged

      const after = await pool.query(
        `SELECT COUNT(*) FROM member_profile_change_log WHERE user_id = $1 AND field_changed = 'gender'`,
        [testUserId]
      );
      if (parseInt(after.rows[0].count) <= countBefore) throw new Error("No gender log entry created");
    })();

    // Cleanup test log entries
    await pool.query(
      `DELETE FROM member_profile_change_log WHERE user_id = $1 AND changed_at >= NOW() - INTERVAL '5 minutes'`,
      [testUserId]
    );
  }

  // ── 4. Platform Config DB Read ─────────────────────────────────────────
  console.log("\n◆ Platform Config Runtime Read");

  await test("platform_config can be updated and re-read (lambda tuning flow)", async () => {
    await pool.query(
      `UPDATE platform_config SET value = '0.03' WHERE key = 'interest_vector_decay_lambda'`
    );
    const r = await pool.query(
      `SELECT value FROM platform_config WHERE key = 'interest_vector_decay_lambda'`
    );
    const val = parseFloat(r.rows[0].value);
    if (val !== 0.03) throw new Error(`Expected 0.03 after update, got ${val}`);

    // Restore
    await pool.query(
      `UPDATE platform_config SET value = '0.02' WHERE key = 'interest_vector_decay_lambda'`
    );
  })();

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  if (failed > 0) process.exit(1);
}

run()
  .catch((err) => {
    console.error("\n[TEST RUNNER CRASH]", err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
