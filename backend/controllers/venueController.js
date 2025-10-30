async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
  const { name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, hourly_price, daily_price, conditions, logo_url } = req.body || {};
    
    // Validate required fields
    if (!name || !address || !city || !contact_name || !contact_email || !contact_phone || capacity_max === undefined || capacity_max === null) {
      return res.status(400).json({ error: "All fields are required: name, address, city, contact_name, contact_email, contact_phone, capacity_max" });
    }
    
    // Validate that at least one pricing type is provided
    if (!price_per_head && !hourly_price && !daily_price) {
      return res.status(400).json({ error: "At least one pricing type is required: price_per_head, hourly_price, or daily_price" });
    }
    
    if (!/^\d{10}$/.test(contact_phone)) {
      return res.status(400).json({ error: "contact_phone must be 10 digits" });
    }
    
    // Set capacity_min to 0 if not provided, and validate capacity relationship
    const finalCapacityMin = capacity_min || 0;
    if (finalCapacityMin >= capacity_max) {
      return res.status(400).json({ error: "capacity_min must be less than capacity_max" });
    }
    
    const result = await pool.query(
      `INSERT INTO venues (name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, hourly_price, daily_price, conditions, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (contact_email) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         capacity_min = EXCLUDED.capacity_min,
         capacity_max = EXCLUDED.capacity_max,
         price_per_head = EXCLUDED.price_per_head,
         hourly_price = EXCLUDED.hourly_price,
         daily_price = EXCLUDED.daily_price,
         conditions = EXCLUDED.conditions,
         logo_url = COALESCE(EXCLUDED.logo_url, venues.logo_url)
       RETURNING *`,
      [name, address, city, contact_name, contact_email, contact_phone, finalCapacityMin, capacity_max, price_per_head || 0, hourly_price || 0, daily_price || 0, conditions || null, logo_url || null]
    );
    res.json({ venue: result.rows[0] });
  } catch (err) {
    console.error("/venues/signup error:", err);
    res.status(500).json({ error: "Failed to signup venue" });
  }
}

module.exports = { signup };

async function updateLogo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { logo_url } = req.body || {};
    if (!userId || userType !== 'venue') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!logo_url) {
      return res.status(400).json({ error: 'logo_url is required' });
    }
    const r = await pool.query('UPDATE venues SET logo_url = $1 WHERE id = $2 RETURNING id, logo_url', [logo_url, userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Venue not found' });
    res.json({ success: true, logo_url: r.rows[0].logo_url });
  } catch (err) {
    console.error('/venues/profile/logo error:', err);
    res.status(500).json({ error: 'Failed to update logo' });
  }
}

module.exports.updateLogo = updateLogo;


