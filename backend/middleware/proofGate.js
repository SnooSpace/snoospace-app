const proofGate = async (req, res, next) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(403).json({
        error: 'proof_gate_required',
        message: 'Open Plans is only available to member accounts.',
        requirements: ['post', 'instagram', 'verified'],
      });
    }

    // Gate 1: has at least one post
    const postResult = await pool.query(
      `SELECT 1 FROM posts WHERE author_id = $1 AND author_type = 'member' LIMIT 1`,
      [userId]
    );
    if (postResult.rows.length > 0) return next();

    // Gate 2: has an active social connection
    const socialResult = await pool.query(
      `SELECT 1 FROM user_social_connections WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [userId]
    );
    if (socialResult.rows.length > 0) return next();

    // Gate 3: is verified
    const verifiedResult = await pool.query(
      `SELECT is_verified FROM members WHERE id = $1`,
      [userId]
    );
    if (verifiedResult.rows[0]?.is_verified === true) return next();

    return res.status(403).json({
      error: 'proof_gate_required',
      message: 'Complete your profile to use Open Plans. Add a post, connect Instagram, or get verified.',
      requirements: ['post', 'instagram', 'verified'],
    });
  } catch (err) {
    console.error('[proofGate] Error:', err);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = { proofGate };
