// ---------------------------------------------------------------------------
// POST /users/:userId/block
// ---------------------------------------------------------------------------
async function blockUser(req, res) {
  try {
    const pool = req.app.locals.pool;
    const blockerId = req.user.id;
    const blockedId = parseInt(req.params.userId, 10);

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Verify target member exists
    const memberR = await pool.query(`SELECT id FROM members WHERE id = $1`, [blockedId]);
    if (memberR.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );

    // Auto-remove follows in both directions so counts stay consistent
    // and the blocked user doesn't silently keep following the blocker
    await pool.query(
      `DELETE FROM follows
       WHERE (follower_id = $1 AND follower_type = 'member' AND following_id = $2 AND following_type = 'member')
          OR (follower_id = $2 AND follower_type = 'member' AND following_id = $1 AND following_type = 'member')`,
      [blockerId, blockedId]
    );

    res.json({ blocked: true });
  } catch (err) {
    console.error('[blocksController.blockUser]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /users/:userId/block
// ---------------------------------------------------------------------------
async function unblockUser(req, res) {
  try {
    const pool = req.app.locals.pool;
    const blockerId = req.user.id;
    const blockedId = parseInt(req.params.userId, 10);

    await pool.query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    res.json({ blocked: false });
  } catch (err) {
    console.error('[blocksController.unblockUser]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// GET /users/me/blocks
// ---------------------------------------------------------------------------
async function getBlocks(req, res) {
  try {
    const pool = req.app.locals.pool;
    const blockerId = req.user.id;

    const result = await pool.query(
      `SELECT ub.blocked_id as id, m.name, m.profile_photo_url, ub.created_at as blocked_at
       FROM user_blocks ub
       JOIN members m ON m.id = ub.blocked_id
       WHERE ub.blocker_id = $1
       ORDER BY ub.created_at DESC`,
      [blockerId]
    );

    res.json({ blocked_users: result.rows });
  } catch (err) {
    console.error('[blocksController.getBlocks]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { blockUser, unblockUser, getBlocks };
