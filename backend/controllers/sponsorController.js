async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, logo_url, bio, category, email, phone, interests } = req.body || {};
    
    console.log('Sponsor signup request body:', req.body);
    
    // Validation
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Required fields: name, email, phone" });
    }
    
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Phone must be exactly 10 digits" });
    }
    
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: "At least one interest is required" });
    }
    
    // Validate interests array
    if (interests.length === 1 && interests[0] === 'Open to All') {
      // This is valid - "Open to All" is allowed as a single item
    } else if (interests.length < 3) {
      return res.status(400).json({ error: "interests must include at least 3 items, or select 'Open to All'" });
    }
    
    // Get user_id from authenticated user (optional for now)
    const user_id = req.user?.id || null;
    
    console.log('Creating sponsor with user_id:', user_id);
    
    const result = await pool.query(
      `INSERT INTO sponsors (user_id, brand_name, logo_url, bio, category, email, phone, interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (email) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         brand_name = EXCLUDED.brand_name,
         logo_url = EXCLUDED.logo_url,
         bio = EXCLUDED.bio,
         category = EXCLUDED.category,
         phone = EXCLUDED.phone,
         interests = EXCLUDED.interests
       RETURNING *`,
      [user_id, name, logo_url || null, bio || null, category || null, email, phone, JSON.stringify(interests)]
    );
    
    console.log('Sponsor created successfully:', result.rows[0]);
    res.json({ sponsor: result.rows[0] });
  } catch (err) {
    console.error("/sponsors/signup error:", err);
    res.status(500).json({
      error: "Failed to signup sponsor",
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
    });
  }
}

module.exports = { signup };


