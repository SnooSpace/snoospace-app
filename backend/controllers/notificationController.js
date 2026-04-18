// Use the app's shared pool to avoid multiple connections and ensure .query exists

// List notifications for current user
const listNotifications = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });

    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const offset = parseInt(req.query.offset || "0", 10);

    // Query with JOINs to enrich actor data for old notifications missing payload info
    const q = `
      SELECT 
        n.id, n.recipient_id, n.recipient_type, n.actor_id, n.actor_type, 
        n.type, n.payload, n.is_read,
        COALESCE(n.updated_at, n.created_at) AS timestamp, 
        n.created_at,
        -- Get actor name based on actor_type
        CASE 
          WHEN n.actor_type = 'member' THEN m.name
          WHEN n.actor_type = 'community' THEN c.name
          WHEN n.actor_type = 'sponsor' THEN s.brand_name
          WHEN n.actor_type = 'venue' THEN v.name
        END as actor_name,
        -- Get actor username based on actor_type
        CASE 
          WHEN n.actor_type = 'member' THEN m.username
          WHEN n.actor_type = 'community' THEN c.username
          WHEN n.actor_type = 'sponsor' THEN s.username
          WHEN n.actor_type = 'venue' THEN v.username
        END as actor_username,
        -- Get actor avatar based on actor_type
        CASE 
          WHEN n.actor_type = 'member' THEN m.profile_photo_url
          WHEN n.actor_type = 'community' THEN c.logo_url
          WHEN n.actor_type = 'sponsor' THEN s.logo_url
          WHEN n.actor_type = 'venue' THEN NULL
        END as actor_avatar
      FROM notifications n
      LEFT JOIN members m ON n.actor_type = 'member' AND n.actor_id = m.id
      LEFT JOIN communities c ON n.actor_type = 'community' AND n.actor_id = c.id
      LEFT JOIN sponsors s ON n.actor_type = 'sponsor' AND n.actor_id = s.id
      LEFT JOIN venues v ON n.actor_type = 'venue' AND n.actor_id = v.id
      WHERE n.recipient_id = $1 AND n.recipient_type = $2 AND n.is_active = TRUE
      ORDER BY COALESCE(n.updated_at, n.created_at) DESC
      LIMIT $3 OFFSET $4
    `;
    const r = await pool.query(q, [userId, userType, limit, offset]);

    // Enrich payload with actor data from the JOINed tables
    const enrichedNotifications = r.rows.map((row) => {
      const payload = row.payload || {};
      return {
        ...row,
        payload: {
          ...payload,
          // Use JOINed actor data if payload is missing these fields
          actorName: payload.actorName || row.actor_name || null,
          actorUsername: payload.actorUsername || row.actor_username || null,
          actorAvatar: payload.actorAvatar || row.actor_avatar || null,
        },
      };
    });

    res.json({
      notifications: enrichedNotifications,
      nextOffset: offset + r.rows.length,
      hasMore: r.rows.length === limit,
    });
  } catch (e) {
    console.error("listNotifications error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Unread count for current user
const unreadCount = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });
    const q = `SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE AND is_active = TRUE`;
    const r = await pool.query(q, [userId, userType]);
    res.json({ unread: r.rows[0]?.count || 0 });
  } catch (e) {
    console.error("unreadCount error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark one notification as read
const markRead = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const id = parseInt(req.params.id, 10);
    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const q = `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2 AND recipient_type = $3 AND is_active = TRUE`;
    await pool.query(q, [id, userId, userType]);
    res.json({ success: true });
  } catch (e) {
    console.error("markRead error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark all as read
const markAllRead = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });
    const q = `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE AND is_active = TRUE`;
    await pool.query(q, [userId, userType]);
    res.json({ success: true });
  } catch (e) {
    console.error("markAllRead error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { listNotifications, unreadCount, markRead, markAllRead };
