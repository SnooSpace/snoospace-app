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

    // Cancel any pending circle requests between the two users (either direction)
    await pool.query(
      `UPDATE circle_requests
       SET status = 'cancelled', updated_at = NOW()
       WHERE status = 'pending'
         AND ((sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1))`,
      [blockerId, blockedId]
    );

    // Remove any existing circle relationship
    // sortedPair: smaller BIGINT → user_a_id (use numeric comparison, not string)
    const [userA, userB] = BigInt(blockerId) < BigInt(blockedId)
      ? [blockerId, blockedId]
      : [blockedId, blockerId];

    await pool.query(
      `DELETE FROM circles WHERE user_a_id = $1 AND user_b_id = $2`,
      [userA, userB]
    );

    // Also clear the accepted circle_requests row so getCircleStatus
    // returns 'none' after unblocking if they want to reconnect
    await pool.query(
      `DELETE FROM circle_requests
       WHERE status = 'accepted'
         AND ((sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1))`,
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

    // Reveal messages that blockedId sent while blocked:
    // Find all 1:1 conversations between blockerId and blockedId, then
    // set is_hidden = false on messages from blockedId that were hidden
    // solely because of this block (i.e. stored-but-invisible-to-blocker).
    await pool.query(
      `UPDATE messages
       SET is_hidden = false
       WHERE is_hidden = true
         AND sender_id   = $2
         AND sender_type = 'member'
         AND conversation_id IN (
           SELECT id FROM conversations
           WHERE is_group = false
             AND (
               (participant1_id = $1 AND participant1_type = 'member'
                AND participant2_id = $2 AND participant2_type = 'member')
               OR
               (participant1_id = $2 AND participant1_type = 'member'
                AND participant2_id = $1 AND participant2_type = 'member')
             )
         )`,
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

// ---------------------------------------------------------------------------
// POST /communities/:id/block
// ---------------------------------------------------------------------------
async function blockCommunity(req, res) {
  try {
    const pool = req.app.locals.pool;
    const blockerId = req.user.id;
    const blockedCommunityId = parseInt(req.params.id, 10);

    // Verify target community exists
    const communityR = await pool.query(`SELECT id FROM communities WHERE id = $1`, [blockedCommunityId]);
    if (communityR.rows.length === 0) return res.status(404).json({ error: 'Community not found' });

    await pool.query(
      `INSERT INTO community_blocks (blocker_id, blocked_community_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_community_id) DO NOTHING`,
      [blockerId, blockedCommunityId]
    );

    // Auto-remove follows
    await pool.query(
      `DELETE FROM follows
       WHERE follower_id = $1 AND follower_type = 'member' AND following_id = $2 AND following_type = 'community'`,
      [blockerId, blockedCommunityId]
    );

    res.json({ blocked: true });
  } catch (err) {
    console.error('[blocksController.blockCommunity]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /communities/:id/block
// ---------------------------------------------------------------------------
async function unblockCommunity(req, res) {
  try {
    const pool = req.app.locals.pool;
    const blockerId = req.user.id;
    const blockedCommunityId = parseInt(req.params.id, 10);

    await pool.query(
      `DELETE FROM community_blocks WHERE blocker_id = $1 AND blocked_community_id = $2`,
      [blockerId, blockedCommunityId]
    );

    res.json({ blocked: false });
  } catch (err) {
    console.error('[blocksController.unblockCommunity]', err);
    res.status(500).json({ error: 'server_error' });
  }
}

module.exports = { blockUser, unblockUser, getBlocks, blockCommunity, unblockCommunity };
