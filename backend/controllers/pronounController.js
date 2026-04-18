const pool = require("../config/db").createPool();

/**
 * Get all pronouns (Admin)
 */
exports.getAllPronounsAdmin = async (req, res) => {
  try {
    const result = await req.app.locals.pool.query(
      `SELECT * FROM pronouns ORDER BY display_order ASC, created_at DESC`
    );
    res.json({ success: true, pronouns: result.rows });
  } catch (err) {
    console.error("getAllPronounsAdmin error:", err);
    res.status(500).json({ error: "Failed to fetch pronouns" });
  }
};

/**
 * Get active pronouns (Public/App)
 */
exports.getParamPronouns = async (req, res) => {
  try {
    const result = await req.app.locals.pool.query(
      `SELECT * FROM pronouns WHERE is_active = true ORDER BY display_order ASC`
    );
    res.json({ success: true, pronouns: result.rows });
  } catch (err) {
    console.error("getParamPronouns error:", err);
    res.status(500).json({ error: "Failed to fetch pronouns" });
  }
};

/**
 * Create a new pronoun
 */
exports.createPronoun = async (req, res) => {
  const { label, display_order } = req.body;

  if (!label) {
    return res.status(400).json({ error: "Label is required" });
  }

  try {
    const result = await req.app.locals.pool.query(
      `INSERT INTO pronouns (label, display_order) 
       VALUES ($1, $2) 
       RETURNING *`,
      [label, display_order || 0]
    );
    res.json({ success: true, pronoun: result.rows[0] });
  } catch (err) {
    console.error("createPronoun error:", err);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Pronoun already exists" });
    }
    res.status(500).json({ error: "Failed to create pronoun" });
  }
};

/**
 * Update a pronoun
 */
exports.updatePronoun = async (req, res) => {
  const { id } = req.params;
  const { label, display_order, is_active } = req.body;

  try {
    // Dynamic update query
    let query = "UPDATE pronouns SET ";
    const values = [];
    let paramCount = 1;

    if (label !== undefined) {
      query += `label = $${paramCount++}, `;
      values.push(label);
    }
    if (display_order !== undefined) {
      query += `display_order = $${paramCount++}, `;
      values.push(display_order);
    }
    if (is_active !== undefined) {
      query += `is_active = $${paramCount++}, `;
      values.push(is_active);
    }

    // Remove trailing comma and space
    query = query.slice(0, -2);
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const result = await req.app.locals.pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pronoun not found" });
    }

    res.json({ success: true, pronoun: result.rows[0] });
  } catch (err) {
    console.error("updatePronoun error:", err);
    if (err.code === "23505") {
      return res.status(400).json({ error: "Pronoun label already exists" });
    }
    res.status(500).json({ error: "Failed to update pronoun" });
  }
};

/**
 * Delete a pronoun
 */
exports.deletePronoun = async (req, res) => {
  const { id } = req.params;

  try {
    // Optional: Check usage before delete
    // const usage = await req.app.locals.pool.query(
    //   `SELECT COUNT(*) FROM members WHERE $1 = ANY(pronouns)`,
    //   [id] // This assumes we store IDs, but currently we seem to store text arrays.
    //        // If storing text, we'd need to fetch the label first.
    // );

    const result = await req.app.locals.pool.query(
      `DELETE FROM pronouns WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pronoun not found" });
    }

    res.json({ success: true, message: "Pronoun deleted successfully" });
  } catch (err) {
    console.error("deletePronoun error:", err);
    res.status(500).json({ error: "Failed to delete pronoun" });
  }
};

/**
 * Reorder pronouns
 */
exports.reorderPronouns = async (req, res) => {
  const { order } = req.body; // Array of { id, display_order }

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  const client = await req.app.locals.pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of order) {
      await client.query(
        "UPDATE pronouns SET display_order = $1 WHERE id = $2",
        [item.display_order, item.id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Pronouns reordered successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("reorderPronouns error:", err);
    res.status(500).json({ error: "Failed to reorder pronouns" });
  } finally {
    client.release();
  }
};
