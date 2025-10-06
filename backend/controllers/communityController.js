async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { 
      name, 
      logo_url,
      bio,
      category,
      location,
      email,
      phone,
      sponsor_types,
      heads
    } = req.body || {};

    if (!name || !category || !location || !email || !phone || !Array.isArray(sponsor_types)) {
      return res.status(400).json({ error: "Required: name, category, location, email, phone, sponsor_types[]" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    if (sponsor_types.length < 3 || sponsor_types.length > 7) {
      return res.status(400).json({ error: "sponsor_types must include between 3 and 7 items" });
    }
    // Heads: expect array of up to 3 with one primary
    if (!Array.isArray(heads) || heads.length === 0) {
      return res.status(400).json({ error: "heads[] required: at least one head with name and is_primary" });
    }
    const primaryHeads = heads.filter(h => h && h.is_primary);
    if (primaryHeads.length !== 1) {
      return res.status(400).json({ error: "Exactly one primary head is required" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const communityResult = await client.query(
        `INSERT INTO communities (name, logo_url, bio, category, location, email, phone, sponsor_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (email) DO UPDATE SET
           name=EXCLUDED.name,
           logo_url=EXCLUDED.logo_url,
           bio=EXCLUDED.bio,
           category=EXCLUDED.category,
           location=EXCLUDED.location,
           phone=EXCLUDED.phone,
           sponsor_types=EXCLUDED.sponsor_types
         RETURNING *`,
        [name, logo_url || null, bio || null, category, location, email, phone, JSON.stringify(sponsor_types)]
      );
      const community = communityResult.rows[0];

      // Clear existing heads and insert provided ones
      await client.query('DELETE FROM community_heads WHERE community_id = $1', [community.id]);
      for (const h of heads) {
        if (!h || !h.name) continue;
        await client.query(
          `INSERT INTO community_heads (community_id, name, email, phone, profile_pic_url, is_primary)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [community.id, h.name, h.email || null, h.phone || null, h.profile_pic_url || null, !!h.is_primary]
        );
      }

      await client.query('COMMIT');
      res.json({ community });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
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


