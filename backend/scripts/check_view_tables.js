require("dotenv").config();
const { createPool } = require("../config/db");

async function check() {
  const pool = createPool();
  try {
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('unique_view_events','repeat_view_events')"
    );
    console.log("Tables found:", tables.rows.map((r) => r.table_name));

    const col = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='posts' AND column_name='public_view_count'"
    );
    console.log("public_view_count column exists:", col.rows.length > 0);

    // Check current view counts
    const views = await pool.query(
      "SELECT id, public_view_count FROM posts ORDER BY id DESC LIMIT 5"
    );
    console.log("Recent posts view counts:", views.rows);

    // Check unique_view_events count
    if (tables.rows.some((r) => r.table_name === "unique_view_events")) {
      const uv = await pool.query("SELECT COUNT(*) as cnt FROM unique_view_events");
      console.log("Total unique_view_events rows:", uv.rows[0].cnt);
    }
    if (tables.rows.some((r) => r.table_name === "repeat_view_events")) {
      const rv = await pool.query("SELECT COUNT(*) as cnt FROM repeat_view_events");
      console.log("Total repeat_view_events rows:", rv.rows[0].cnt);
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}
check();
