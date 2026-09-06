require("dotenv").config();
const {createPool}=require("./config/db");
const fs=require("fs");
const p=createPool();
async function run(){
  const sql=fs.readFileSync("./migrations/083_refund_requests.sql","utf8");
  await p.query(sql);
  console.log("Migration 083 applied OK");
  const r=await p.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_name='refund_requests'");
  console.log("refund_requests table exists:", r.rows[0].count === "1");
  await p.end();
}
run().catch(e=>{console.error("[FAIL]",e.message);process.exit(1);});
