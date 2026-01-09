/**
 * Activity & Insights Controller
 * Handles profile views, connection requests, and activity insights
 */

// Log a profile view
async function logProfileView(req, res) {
  try {
    const pool = req.app.locals.pool;
    const viewerId = req.user?.id;
    const viewerType = req.user?.type;
    const { viewedMemberId, eventId } = req.body;

    if (!viewerId || viewerType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!viewedMemberId) {
      return res.status(400).json({ error: "viewedMemberId is required" });
    }

    // Don't log self-views
    if (parseInt(viewedMemberId) === parseInt(viewerId)) {
      return res.json({ success: true, message: "Self-view not logged" });
    }

    // Insert view (duplicate prevention handled by unique index)
    try {
      await pool.query(
        `INSERT INTO profile_views (viewed_member_id, viewer_member_id, event_id)
         VALUES ($1, $2, $3)`,
        [viewedMemberId, viewerId, eventId || null]
      );
    } catch (err) {
      // Ignore duplicate key errors (user viewed same profile within 1 hour)
      if (err.code !== "23505") throw err;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error logging profile view:", error);
    res.status(500).json({ error: "Failed to log profile view" });
  }
}

// Get activity insights for the current user
async function getActivityInsights(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get view counts (this week vs last week for comparison)
    const viewsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_this_week,
        COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '14 days' AND viewed_at < NOW() - INTERVAL '7 days') as views_last_week
       FROM profile_views
       WHERE viewed_member_id = $1`,
      [userId]
    );

    const viewsThisWeek = parseInt(viewsResult.rows[0]?.views_this_week || 0);
    const viewsLastWeek = parseInt(viewsResult.rows[0]?.views_last_week || 0);
    const viewsChange =
      viewsLastWeek > 0
        ? Math.round(((viewsThisWeek - viewsLastWeek) / viewsLastWeek) * 100)
        : viewsThisWeek > 0
        ? 100
        : 0;

    // Get connection stats
    const connectionsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'accepted' AND updated_at >= NOW() - INTERVAL '7 days') as connections_this_week,
        COUNT(*) FILTER (WHERE status = 'pending' AND to_member_id = $1) as pending_received
       FROM connection_requests
       WHERE from_member_id = $1 OR to_member_id = $1`,
      [userId]
    );

    const connectionsThisWeek = parseInt(
      connectionsResult.rows[0]?.connections_this_week || 0
    );
    const pendingReceived = parseInt(
      connectionsResult.rows[0]?.pending_received || 0
    );

    // Get recent activity (last 10 items)
    const recentActivityResult = await pool.query(
      `(
        SELECT 'view' as type, 
               pv.viewed_at as timestamp,
               e.title as event_title,
               COUNT(*) OVER (PARTITION BY DATE(pv.viewed_at)) as count,
               NULL as member_name,
               NULL as member_id
        FROM profile_views pv
        LEFT JOIN events e ON e.id = pv.event_id
        WHERE pv.viewed_member_id = $1 AND pv.viewed_at >= NOW() - INTERVAL '7 days'
        ORDER BY pv.viewed_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 'connection' as type,
               cr.updated_at as timestamp,
               NULL as event_title,
               1 as count,
               m.name as member_name,
               m.id as member_id
        FROM connection_requests cr
        JOIN members m ON m.id = CASE 
          WHEN cr.from_member_id = $1 THEN cr.to_member_id 
          ELSE cr.from_member_id 
        END
        WHERE (cr.from_member_id = $1 OR cr.to_member_id = $1)
          AND cr.status = 'accepted'
          AND cr.updated_at >= NOW() - INTERVAL '7 days'
        ORDER BY cr.updated_at DESC
        LIMIT 5
      )
      ORDER BY timestamp DESC
      LIMIT 10`,
      [userId]
    );

    res.json({
      insights: {
        viewsThisWeek,
        viewsChange,
        connectionsThisWeek,
        pendingReceived,
      },
      recentActivity: recentActivityResult.rows,
    });
  } catch (error) {
    console.error("Error getting activity insights:", error);
    res.status(500).json({ error: "Failed to get activity insights" });
  }
}

// Get pending connection requests (received)
async function getPendingRequests(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT 
        cr.id,
        cr.message,
        cr.created_at,
        cr.event_id,
        m.id as from_member_id,
        m.name as from_member_name,
        m.profile_photo_url as from_member_photo,
        m.bio as from_member_bio,
        m.intent_badges,
        e.title as event_title
       FROM connection_requests cr
       JOIN members m ON m.id = cr.from_member_id
       LEFT JOIN events e ON e.id = cr.event_id
       WHERE cr.to_member_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error("Error getting pending requests:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
}

// Send a connection request
async function sendConnectionRequest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { toMemberId, message, eventId } = req.body;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!toMemberId) {
      return res.status(400).json({ error: "toMemberId is required" });
    }

    if (parseInt(toMemberId) === parseInt(userId)) {
      return res.status(400).json({ error: "Cannot send request to yourself" });
    }

    // Check if request already exists
    const existing = await pool.query(
      `SELECT id, status FROM connection_requests 
       WHERE from_member_id = $1 AND to_member_id = $2`,
      [userId, toMemberId]
    );

    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      if (status === "pending") {
        return res.status(400).json({ error: "Request already pending" });
      }
      if (status === "accepted") {
        return res.status(400).json({ error: "Already connected" });
      }
      // If declined, allow re-request by updating existing
      await pool.query(
        `UPDATE connection_requests 
         SET status = 'pending', message = $1, updated_at = NOW()
         WHERE id = $2`,
        [message?.substring(0, 200) || null, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO connection_requests (from_member_id, to_member_id, message, event_id)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          toMemberId,
          message?.substring(0, 200) || null,
          eventId || null,
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error sending connection request:", error);
    res.status(500).json({ error: "Failed to send connection request" });
  }
}

// Respond to a connection request
async function respondToRequest(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    // Update request if it belongs to this user
    const result = await pool.query(
      `UPDATE connection_requests 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND to_member_id = $3 AND status = 'pending'
       RETURNING *`,
      [action === "accept" ? "accepted" : "declined", requestId, userId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Request not found or already responded" });
    }

    res.json({ success: true, request: result.rows[0] });
  } catch (error) {
    console.error("Error responding to request:", error);
    res.status(500).json({ error: "Failed to respond to request" });
  }
}

// Get connections (accepted requests)
async function getConnections(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT 
        cr.id as connection_id,
        cr.updated_at as connected_at,
        cr.event_id,
        m.id as member_id,
        m.name as member_name,
        m.profile_photo_url as member_photo,
        m.bio as member_bio,
        m.intent_badges,
        e.title as event_title
       FROM connection_requests cr
       JOIN members m ON m.id = CASE 
         WHEN cr.from_member_id = $1 THEN cr.to_member_id 
         ELSE cr.from_member_id 
       END
       LEFT JOIN events e ON e.id = cr.event_id
       WHERE (cr.from_member_id = $1 OR cr.to_member_id = $1) 
         AND cr.status = 'accepted'
       ORDER BY cr.updated_at DESC`,
      [userId]
    );

    res.json({ connections: result.rows });
  } catch (error) {
    console.error("Error getting connections:", error);
    res.status(500).json({ error: "Failed to get connections" });
  }
}

module.exports = {
  logProfileView,
  getActivityInsights,
  getPendingRequests,
  sendConnectionRequest,
  respondToRequest,
  getConnections,
};
