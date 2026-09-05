const proofGate = async (req, res, next) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(403).json({
        error: 'proof_gate_required',
        message: 'Open Plans is only available to member accounts.',
        requirements: ['verified'],
      });
    }

    // Mandatory Gate: Member must be face-verified
    const verifiedResult = await pool.query(
      `SELECT is_verified FROM members WHERE id = $1`,
      [userId]
    );

    if (verifiedResult.rows[0]?.is_verified === true) {
      return next();
    }

    return res.status(403).json({
      error: 'proof_gate_required',
      message: 'Identity verification is required to host or join Open Plans. Please get verified.',
      requirements: ['verified'],
    });
  } catch (err) {
    console.error('[proofGate] Error:', err);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = { proofGate };
