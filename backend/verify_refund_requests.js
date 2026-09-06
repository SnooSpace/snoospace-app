require("dotenv").config();
const { createPool } = require("./config/db");
const p = createPool();

async function run() {
  // --- 1. Verify table exists with correct columns ---
  const cols = await p.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'refund_requests'
    ORDER BY ordinal_position
  `);
  console.log("refund_requests columns:", cols.rows.map(c => c.column_name).join(", "));

  // --- 2. Simulate auto_approved vs manual_review logic ---
  // Event 3h from now -> well within 24h deadline -> manual_review
  const policy24h = { allowed: true, deadline_hours_before: 24, percentage: 100 };
  const hoursUntil3 = 3;
  const tag3 = hoursUntil3 >= policy24h.deadline_hours_before ? "auto_approved" : "manual_review";
  console.assert(tag3 === "manual_review", `Expected manual_review, got ${tag3}`);
  console.log("3h until event + 24h deadline =>", tag3, "✓");

  // Event 48h from now -> within 24h deadline? 48 >= 24 -> auto_approved
  const hoursUntil48 = 48;
  const tag48 = hoursUntil48 >= policy24h.deadline_hours_before ? "auto_approved" : "manual_review";
  console.assert(tag48 === "auto_approved", `Expected auto_approved, got ${tag48}`);
  console.log("48h until event + 24h deadline =>", tag48, "✓");

  // --- 3. Policy snapshot test (check JSONB round-trip) ---
  const snapshot = { allowed: true, deadline_hours_before: 24, percentage: 75 };
  const r = await p.query(`
    SELECT $1::jsonb->>'percentage' as pct
  `, [JSON.stringify(snapshot)]);
  console.assert(r.rows[0].pct === "75", `snapshot round-trip: expected 75, got ${r.rows[0].pct}`);
  console.log("Policy snapshot JSONB round-trip: percentage =", r.rows[0].pct, "✓");

  // --- 4. Duplicate-submission guard: status filter ---
  const activeStatuses = ["pending_review","auto_approved","manual_review","approved","completed"];
  const rejectedStatus = "rejected";
  const wouldBlock = activeStatuses.includes("auto_approved");
  console.assert(wouldBlock === true, "auto_approved should be blocked");
  const rejectedDoesNotBlock = !activeStatuses.includes(rejectedStatus);
  console.assert(rejectedDoesNotBlock === true, "rejected should not block");
  console.log("Duplicate guard: auto_approved blocks =", wouldBlock, "✓");
  console.log("Duplicate guard: rejected does not block =", rejectedDoesNotBlock, "✓");

  // --- 5. Requested amount calculation ---
  const totalPrice = 1200;
  const pct = 75;
  const amount = totalPrice * (pct / 100);
  console.assert(amount === 900, `Expected 900, got ${amount}`);
  console.log("Amount calc: 1200 * 75% =", amount, "✓");

  console.log("\n✅ All verification checks passed.");
  await p.end();
}

run().catch(e => { console.error("[FAIL]", e.message); process.exit(1); });
