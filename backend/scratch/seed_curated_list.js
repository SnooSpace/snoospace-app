require("dotenv").config();
const { createPool } = require("../config/db");
const pool = createPool();

(async () => {
  try {
    const evRes = await pool.query(
      "SELECT id, title, banner_url FROM events WHERE is_published = true AND start_datetime > NOW() LIMIT 3"
    );

    const listRes = await pool.query(`
      INSERT INTO curated_lists (title, subtitle, cover_url, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      "Bangalore Tech & Creative Hub 2026",
      "Curated hackathons, mixer nights, and builder summits",
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
      1,
      true
    ]);

    const listId = listRes.rows[0].id;
    for (let i = 0; i < evRes.rows.length; i++) {
      await pool.query(`
        INSERT INTO curated_list_events (curated_list_id, event_id, display_order)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [listId, evRes.rows[i].id, i + 1]);
    }

    console.log("✅ Seeded test curated list with id:", listId, "and", evRes.rows.length, "events");
    process.exit(0);
  } catch (e) {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  }
})();
