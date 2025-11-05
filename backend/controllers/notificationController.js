// Use the app's shared pool to avoid multiple connections and ensure .query exists

// List notifications for current user
const listNotifications = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    const q = `
      SELECT id, recipient_id, recipient_type, actor_id, actor_type, type, payload, is_read, created_at
      FROM notifications
      WHERE recipient_id = $1 AND recipient_type = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const r = await pool.query(q, [userId, userType, limit, offset]);
    res.json({ notifications: r.rows, nextOffset: offset + r.rows.length, hasMore: r.rows.length === limit });
  } catch (e) {
    console.error('listNotifications error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unread count for current user
const unreadCount = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Unauthorized' });
    const q = `SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE`;
    const r = await pool.query(q, [userId, userType]);
    res.json({ unread: r.rows[0]?.count || 0 });
  } catch (e) {
    console.error('unreadCount error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark one notification as read
const markRead = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const id = parseInt(req.params.id, 10);
    if (!userId || !userType) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const q = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2 AND recipient_type = $3`;
    await pool.query(q, [id, userId, userType]);
    res.json({ success: true });
  } catch (e) {
    console.error('markRead error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark all as read
const markAllRead = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType) return res.status(401).json({ error: 'Unauthorized' });
    const q = `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE`;
    await pool.query(q, [userId, userType]);
    res.json({ success: true });
  } catch (e) {
    console.error('markAllRead error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { listNotifications, unreadCount, markRead, markAllRead };


