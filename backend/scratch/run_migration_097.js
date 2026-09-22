require("dotenv").config();
const { createPool } = require("../config/db");
const fs = require("fs");
const path = require("path");

const p = createPool();

async function run() {
  const sqlPath = path.join(__dirname, "../migrations/097_open_plans_age_range.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await p.query(sql);
  console.log("Migration 097 applied OK");

  const r = await p.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'open_plans' AND column_name IN ('min_age', 'max_age')"
  );
  console.log("Columns verified:", r.rows);
  await p.end();
}

run().catch((e) => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});
