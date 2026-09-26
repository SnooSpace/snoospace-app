const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createPool } = require("../config/db");
const fs = require("fs");

const p = createPool();

async function run() {
  const sqlPath = path.join(__dirname, "../migrations/098_post_community_votes.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await p.query(sql);
  console.log("Migration 098 applied OK");

  const r = await p.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts' AND column_name LIKE 'community_%'"
  );
  console.log("Posts columns verified:", r.rows);

  const t = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'post_community_votes'"
  );
  console.log("Table verified:", t.rows);

  await p.end();
}

run().catch((e) => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});
