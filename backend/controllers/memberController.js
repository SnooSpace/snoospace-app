async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { name, email, phone, dob, gender, city, interests } = req.body || {};
    if (!name || !email || !phone || !dob || !gender || !city || !Array.isArray(interests)) {
      return res.status(400).json({ error: "All fields are required: name, email, phone, dob, gender, city, interests[]" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    const allowedGenders = ["Male", "Female", "Non-binary"];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({ error: "gender must be one of: Male, Female, Non-binary" });
    }
    if (interests.length < 3 || interests.length > 7) {
      return res.status(400).json({ error: "interests must include between 3 and 7 items" });
    }
    const result = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, city, interests)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (email) DO UPDATE SET
         name=EXCLUDED.name,
         phone=EXCLUDED.phone,
         dob=EXCLUDED.dob,
         gender=EXCLUDED.gender,
         city=EXCLUDED.city,
         interests=EXCLUDED.interests
       RETURNING *`,
      [name, email, phone, dob, gender, city, JSON.stringify(interests)]
    );
    res.json({ member: result.rows[0] });
  } catch (err) {
    console.error("/members/signup error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      error: "Failed to signup member",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
      hint: err && err.hint ? err.hint : undefined,
      position: err && err.position ? err.position : undefined,
    });
  }
}

module.exports = { signup };


