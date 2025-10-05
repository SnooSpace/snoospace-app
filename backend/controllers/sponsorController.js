async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { brandName, bio, email, phone, requirements } = req.body || {};
    if (!brandName || !bio || !email || !phone || !requirements) {
      return res.status(400).json({ error: "All fields are required: brandName, bio, email, phone, requirements" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    const result = await pool.query(
      `INSERT INTO sponsors (brand_name, bio, email, phone, requirements)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         brand_name = EXCLUDED.brand_name,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         requirements = EXCLUDED.requirements
       RETURNING *`,
      [brandName, bio, email, phone, requirements]
    );
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


