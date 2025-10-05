async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions } = req.body || {};
    if (!name || !address || !city || !contact_name || !contact_email || !contact_phone || !capacity_min || !capacity_max || !price_per_head) {
      return res.status(400).json({ error: "All fields are required: name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head" });
    }
    if (!/^\d{10}$/.test(contact_phone)) {
      return res.status(400).json({ error: "contact_phone must be 10 digits" });
    }
    if (capacity_min >= capacity_max) {
      return res.status(400).json({ error: "capacity_min must be less than capacity_max" });
    }
    const result = await pool.query(
      `INSERT INTO venues (name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (contact_email) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         capacity_min = EXCLUDED.capacity_min,
         capacity_max = EXCLUDED.capacity_max,
         price_per_head = EXCLUDED.price_per_head,
         conditions = EXCLUDED.conditions
       RETURNING *`,
      [name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions || null]
    );
    res.json({ venue: result.rows[0] });
  } catch (err) {
    console.error("/venues/signup error:", err);
    res.status(500).json({ error: "Failed to signup venue" });
  }
}

module.exports = { signup };


