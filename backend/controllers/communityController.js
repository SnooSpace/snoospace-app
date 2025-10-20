async function signup(req, res) {
  try {
    console.log('Community signup request received:', req.body);
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
    
    // Get user_id from authenticated user (optional for now)
    const user_id = req.user?.id || null;

    console.log('Validation check:', {
      name: !!name,
      category: !!category,
      location: !!location,
      email: !!email,
      phone: !!phone,
      sponsor_types: Array.isArray(sponsor_types),
      sponsor_types_value: sponsor_types
    });
    
    if (!name || !category || !location || !email || !phone || !Array.isArray(sponsor_types)) {
      console.log('Validation failed - missing required fields');
      return res.status(400).json({ error: "Required: name, category, location, email, phone, sponsor_types[]" });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    // Allow "Open to All" as a single item, otherwise require minimum 3 items (no maximum)
    if (sponsor_types.length === 1 && sponsor_types[0] === 'Open to All') {
      // This is valid - "Open to All" is allowed as a single item
    } else if (sponsor_types.length < 3) {
      return res.status(400).json({ error: "sponsor_types must include at least 3 items, or select 'Open to All'" });
    }
    // Heads: expect array of up to 3 with one primary
    console.log('Heads validation:', {
      heads: heads,
      isArray: Array.isArray(heads),
      length: heads?.length
    });
    
    if (!Array.isArray(heads) || heads.length === 0) {
      console.log('Heads validation failed - not array or empty');
      return res.status(400).json({ error: "heads[] required: at least one head with name and is_primary" });
    }
    const primaryHeads = heads.filter(h => h && h.is_primary);
    console.log('Primary heads found:', primaryHeads.length);
    if (primaryHeads.length !== 1) {
      console.log('Heads validation failed - not exactly one primary head');
      return res.status(400).json({ error: "Exactly one primary head is required" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const communityResult = await client.query(
        `INSERT INTO communities (user_id, name, logo_url, bio, category, location, email, phone, sponsor_types)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         ON CONFLICT (email) DO UPDATE SET
           user_id=EXCLUDED.user_id,
           name=EXCLUDED.name,
           logo_url=EXCLUDED.logo_url,
           bio=EXCLUDED.bio,
           category=EXCLUDED.category,
           location=EXCLUDED.location,
           phone=EXCLUDED.phone,
           sponsor_types=EXCLUDED.sponsor_types
         RETURNING *`,
        [user_id, name, logo_url || null, bio || null, category, location, email, phone, JSON.stringify(sponsor_types)]
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


