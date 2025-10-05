async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, bio, email, phone, requirements } = req.body || {};
    if (!name || !bio || !email || !phone || !requirements) {
      return res.status(400).json({ error: "All fields are required: name, bio, email, phone, requirements" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    const result = await pool.query(
      `INSERT INTO communities (name, bio, email, phone, requirements)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         requirements = EXCLUDED.requirements
       RETURNING *`,
      [name, bio, email, phone, requirements]
    );
    res.json({ community: result.rows[0] });
  } catch (err) {
    console.error("/communities/signup error:", err);
    res.status(500).json({
      error: "Failed to signup community",
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
    });
  }
}

module.exports = { signup };


