const poolFactory = require('../config/db');
const pool = poolFactory.createPool();

const deleteAccount = async (req, res) => {
  const userId = req.user?.id;
  const userType = req.user?.type; // 'member' | 'community' | 'sponsor' | 'venue'
  if (!userId || !userType) return res.status(401).json({ error: 'Unauthorized' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove dependent rows (order matters for FK constraints)
    // Likes on posts/comments by this user
    await client.query(`DELETE FROM post_likes WHERE user_id = $1 AND user_type = $2`, [userId, userType]);
    await client.query(`DELETE FROM comment_likes WHERE user_id = $1 AND user_type = $2`, [userId, userType]);

    // Comments authored by this user
    await client.query(`DELETE FROM comments WHERE author_id = $1 AND author_type = $2`, [userId, userType]);

    // Follows where user is follower or following
    await client.query(`DELETE FROM follows WHERE follower_id = $1 AND follower_type = $2`, [userId, userType]);
    await client.query(`DELETE FROM follows WHERE following_id = $1 AND following_type = $2`, [userId, userType]);

    // Notifications: those sent to or created by this user
    await client.query(`DELETE FROM notifications WHERE recipient_id = $1 AND recipient_type = $2`, [userId, userType]);
    await client.query(`DELETE FROM notifications WHERE actor_id = $1 AND actor_type = $2`, [userId, userType]);

    // Posts authored by this user (and possibly related rows via ON DELETE CASCADE if set)
    await client.query(`DELETE FROM posts WHERE author_id = $1 AND author_type = $2`, [userId, userType]);

    // Finally remove from specific role table
    const table = userType === 'member' ? 'members'
      : userType === 'community' ? 'communities'
      : userType === 'sponsor' ? 'sponsors'
      : userType === 'venue' ? 'venues'
      : null;
    if (!table) throw new Error('Unknown user type');
    await client.query(`DELETE FROM ${table} WHERE id = $1`, [userId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('deleteAccount error', e);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }
};

module.exports = { deleteAccount };


