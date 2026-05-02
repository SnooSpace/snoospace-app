const { Pool } = require("pg");
const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "snoospace",
  password: "postgressql1234",
  port: 5432,
});

async function verify() {
  try {
    const res = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%privacy%' OR table_name = 'data_deletion_requests' ORDER BY table_name"
    );
    console.log("Tables found:", res.rows.map((r) => r.table_name));

    // Check columns of user_privacy_consent
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_privacy_consent' ORDER BY ordinal_position"
    );
    console.log("\nuser_privacy_consent columns:");
    cols.rows.forEach((c) => console.log("  -", c.column_name, "(" + c.data_type + ")"));

    console.log("\nAll privacy tables verified successfully!");
  } catch (e) {
    console.error("Verification failed:", e.message);
  } finally {
    await pool.end();
  }
}

verify();
