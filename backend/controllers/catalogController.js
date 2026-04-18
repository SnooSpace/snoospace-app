const { createPool } = require("../config/db");

const pool = createPool();

/**
 * Get interests for Edit Profile / other screens
 * Now uses the unified signup_interests table managed via Admin Panel
 */
async function getInterests(req, res) {
  try {
    // Query the unified interests table (managed via Admin Panel)
    const result = await pool.query(
      `SELECT label FROM signup_interests 
       WHERE is_active = true 
       ORDER BY display_order ASC, label ASC`
    );

    // Return just the labels as strings for backward compatibility
    const interests = result.rows.map((row) => row.label);

    res.json({ interests });
  } catch (err) {
    console.error(
      "/catalog/interests error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to fetch interests" });
  }
}

module.exports = { getInterests };
