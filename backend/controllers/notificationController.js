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
    const category = req.query.category; // e.g. "activity", "events", etc.

    // Query with JOINs to enrich actor data for old notifications missing payload info
    let q = `
      SELECT 
        n.id, n.recipient_id, n.recipient_type, n.actor_id, n.actor_type, 
        n.type, n.payload, n.is_read, n.category,
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
        END as actor_avatar,
        -- Check if actor is a creator
        CASE
          WHEN n.actor_type = 'member' THEN m.is_creator_mode_enabled
          ELSE false
        END as actor_is_creator
      FROM notifications n
      LEFT JOIN members m ON n.actor_type = 'member' AND n.actor_id = m.id
      LEFT JOIN communities c ON n.actor_type = 'community' AND n.actor_id = c.id
      LEFT JOIN sponsors s ON n.actor_type = 'sponsor' AND n.actor_id = s.id
      LEFT JOIN venues v ON n.actor_type = 'venue' AND n.actor_id = v.id
    `;

    const params = [userId, userType];
    let whereClause = "WHERE n.recipient_id = $1 AND n.recipient_type = $2 AND n.is_active = TRUE";

    if (category && category !== "all") {
      params.push(category);
      whereClause += ` AND n.category = $${params.length}`;
    }

    q += `\n${whereClause}\nORDER BY COALESCE(n.updated_at, n.created_at) DESC\nLIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const r = await pool.query(q, params);

    // Enrich payload with actor data from the JOINed tables
    const enrichedNotifications = r.rows.map((row) => {
      const payload = row.payload || {};
      return {
        ...row,
        actor_is_creator: row.actor_is_creator === true,
        payload: {
          ...payload,
          // Use JOINed actor data if payload is missing these fields
          actorName: payload.actorName || row.actor_name || null,
          actorUsername: payload.actorUsername || row.actor_username || null,
          actorAvatar: payload.actorAvatar || row.actor_avatar || null,
          actorIsCreator: payload.actorIsCreator !== undefined ? payload.actorIsCreator : (row.actor_is_creator === true),
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

    // 1. Get total unread count
    const totalQ = `SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE AND is_active = TRUE`;
    const totalR = await pool.query(totalQ, [userId, userType]);
    const totalCount = totalR.rows[0]?.count || 0;

    // 2. Get breakdown of unread count per category
    const breakdownQ = `
      SELECT category, COUNT(*)::int AS count 
      FROM notifications 
      WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = FALSE AND is_active = TRUE
      GROUP BY category
    `;
    const breakdownR = await pool.query(breakdownQ, [userId, userType]);
    
    const breakdown = {
      activity: 0,
      communities: 0,
      messages: 0,
      events: 0,
      system: 0
    };

    for (const row of breakdownR.rows) {
      if (row.category && breakdown[row.category] !== undefined) {
        breakdown[row.category] = row.count;
      }
    }

    res.json({ 
      unread: totalCount,
      breakdown
    });
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

// Register push token for user
const registerPushToken = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { token, deviceId } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    console.log(`[PushToken] Registering token for user ${userType}_${userId}: ${token.substring(0, 25)}... (Device: ${deviceId})`);


    // Upsert push token for user+device
    await pool.query(
      `INSERT INTO push_tokens (user_id, user_type, expo_push_token, device_id, is_active, updated_at)
       VALUES ($1, $2, $3, $4, true, now())
       ON CONFLICT (user_id, user_type, device_id)
       DO UPDATE SET expo_push_token = EXCLUDED.expo_push_token, is_active = true, updated_at = now()`,
      [userId, userType, token, deviceId || 'default']
    );

    res.json({ success: true });
  } catch (e) {
    console.error("registerPushToken error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Generic reference-driven notifications read handler
const markReadByReference = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { referenceType, referenceId } = req.body;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!referenceType || !referenceId) {
      return res.status(400).json({ error: "referenceType and referenceId are required" });
    }

    let q;
    let params;

    if (referenceType === "follow") {
      // Follows reference actor directly via actor_id column
      q = `
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE recipient_id = $1 
          AND recipient_type = $2 
          AND is_active = TRUE 
          AND is_read = FALSE
          AND type IN ('follow', 'creator_follow_received') 
          AND actor_id::text = $3
      `;
      params = [userId, userType, String(referenceId)];
    } else {
      // Restrict matching JSON payload fields based on referenceType to prevent ID collisions
      let filterSql;

      if (referenceType === "post") {
        filterSql = `(payload->>'postId' = $3 OR payload->>'post_id' = $3)`;
      } else if (referenceType === "event") {
        filterSql = `(payload->>'eventId' = $3 OR payload->>'event_id' = $3 OR payload->>'referenceId' = $3 OR payload->>'reference_id' = $3)`;
      } else {
        return res.status(400).json({ error: "Unsupported reference type" });
      }

      q = `
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE recipient_id = $1 
          AND recipient_type = $2 
          AND is_active = TRUE 
          AND is_read = FALSE
          AND ${filterSql}
      `;
      params = [userId, userType, String(referenceId)];
    }

    // Sync notification_aggregates table too (uses structured columns)
    const aggQuery = `
      UPDATE notification_aggregates 
      SET is_read = TRUE 
      WHERE recipient_id = $1 
        AND recipient_type = $2 
        AND is_active = TRUE 
        AND is_read = FALSE 
        AND reference_type = $3 
        AND reference_id::text = $4
    `;

    const [result] = await Promise.all([
      pool.query(q, params),
      pool.query(aggQuery, [userId, userType, referenceType, String(referenceId)])
    ]);

    res.json({ success: true, count: result.rowCount });
  } catch (e) {
    console.error("markReadByReference error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get user notification preferences
const getPreferences = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });

    const q = `
      SELECT category, enabled 
      FROM user_notification_preferences 
      WHERE user_id = $1 AND user_type = $2
    `;
    const result = await pool.query(q, [userId, userType]);

    // Construct preferences map, default all categories to true
    const preferences = {
      activity: true,
      communities: true,
      messages: true,
      events: true,
      system: true,
    };

    for (const row of result.rows) {
      if (preferences[row.category] !== undefined) {
        preferences[row.category] = row.enabled;
      }
    }

    res.json({ preferences });
  } catch (e) {
    console.error("getPreferences error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update user notification preferences
const updatePreferences = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { category, enabled } = req.body;

    if (!userId || !userType)
      return res.status(401).json({ error: "Unauthorized" });

    if (category === undefined || enabled === undefined) {
      return res.status(400).json({ error: "category and enabled are required" });
    }

    const validCategories = ["activity", "communities", "messages", "events", "system"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const q = `
      INSERT INTO user_notification_preferences (user_id, user_type, category, enabled, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, user_type, category)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
    `;
    await pool.query(q, [userId, userType, category, enabled]);

    res.json({ success: true, category, enabled });
  } catch (e) {
    console.error("updatePreferences error", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { 
  listNotifications, 
  unreadCount, 
  markRead, 
  markAllRead, 
  registerPushToken, 
  markReadByReference,
  getPreferences,
  updatePreferences
};
