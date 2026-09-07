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

    // Fetch is_verified and plans_access_blocked in one query.
    const memberR = await pool.query(
      `SELECT is_verified, plans_access_blocked FROM members WHERE id = $1`,
      [userId]
    );
    const member = memberR.rows[0];

    // ── Priority 1: Explicitly blocked after a failed Plans-scope verification ──
    if (member?.plans_access_blocked === true) {
      return res.status(403).json({
        error: 'plans_access_blocked',
        message:
          'Your Open Plans access has been restricted following a failed verification. Submit a new verification to restore access.',
        requirements: ['verified'],
      });
    }

    // ── Priority 2: Fully verified ──
    if (member?.is_verified === true) {
      return next();
    }

    // ── Priority 3: First-time provisional access ──
    // Allow if the user has a pending plans-scope verification AND has never
    // previously had a rejection on plans scope.
    //
    // Resubmission-gaming is not possible: a prior rejection would have set
    // plans_access_blocked = TRUE, which is caught by Priority 1 above.
    // We therefore only need to confirm a pending row exists.
    const pendingR = await pool.query(
      `SELECT 1 FROM user_verifications
       WHERE user_id = $1
         AND scope   = 'plans'
         AND status  = 'pending'
       LIMIT 1`,
      [userId]
    );
    if (pendingR.rows.length > 0) {
      return next(); // provisional access granted
    }

    // ── Priority 4: No path through — require verification ──
    return res.status(403).json({
      error: 'proof_gate_required',
      message:
        'Identity verification is required to host or join Open Plans. Please get verified.',
      requirements: ['verified'],
    });
  } catch (err) {
    console.error('[proofGate] Error:', err);
    res.status(500).json({ error: 'server_error' });
  }
};

module.exports = { proofGate };
