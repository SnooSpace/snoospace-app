/**
 * Moderation Controller
 * Handles reports, user restrictions, and audit logging
 */

const pool = require("../config/db").createPool();

// ============================================================
// AUDIT LOG HELPER
// ============================================================

/**
 * Log an admin action to the audit log
 */
async function logAdminAction(
  adminId,
  action,
  targetType,
  targetId,
  details = {}
) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetType, targetId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error("Failed to log admin action:", error.message);
  }
}

// ============================================================
// REPORTS
// ============================================================

/**
 * Get all reports with filters
 * @query status - pending, reviewed, resolved, dismissed
 * @query type - post, comment, member, community, event
 * @query page, limit - pagination
 */
async function getReports(req, res) {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (type) {
      whereClause += ` AND r.reported_type = $${paramIndex++}`;
      params.push(type);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reports r ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get reports with reporter and reported info
    const result = await pool.query(
      `SELECT 
        r.*,
        CASE 
          WHEN r.reporter_type = 'member' THEN (SELECT name FROM members WHERE id = r.reporter_id)
          WHEN r.reporter_type = 'community' THEN (SELECT name FROM communities WHERE id = r.reporter_id)
        END as reporter_name,
        CASE 
          WHEN r.resolved_by IS NOT NULL THEN (SELECT email FROM admins WHERE id = r.resolved_by)
        END as resolved_by_email
       FROM reports r
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      reports: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch reports" });
  }
}

/**
 * Get single report details
 */
async function getReportById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        r.*,
        CASE 
          WHEN r.reporter_type = 'member' THEN (SELECT name FROM members WHERE id = r.reporter_id)
          WHEN r.reporter_type = 'community' THEN (SELECT name FROM communities WHERE id = r.reporter_id)
        END as reporter_name,
        CASE 
          WHEN r.resolved_by IS NOT NULL THEN (SELECT email FROM admins WHERE id = r.resolved_by)
        END as resolved_by_email
       FROM reports r
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Report not found" });
    }

    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error("Error fetching report:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch report" });
  }
}

/**
 * Resolve or dismiss a report
 * @body status - resolved, dismissed
 * @body resolution_notes - admin notes
 */
async function resolveReport(req, res) {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;
    const adminId = req.admin.id;

    if (!status || !["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'resolved' or 'dismissed'",
      });
    }

    const result = await pool.query(
      `UPDATE reports 
       SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, resolution_notes || null, adminId, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Report not found" });
    }

    // Log the action
    await logAdminAction(adminId, `report_${status}`, "report", id, {
      resolution_notes,
    });

    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error("Error resolving report:", error.message);
    res.status(500).json({ success: false, error: "Failed to resolve report" });
  }
}

/**
 * Get report stats for dashboard
 */
async function getReportStats(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
        COUNT(*) as total
      FROM reports
    `);

    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error("Error fetching report stats:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
}

// ============================================================
// USER RESTRICTIONS
// ============================================================

/**
 * Get all active restrictions
 */
async function getRestrictions(req, res) {
  try {
    const { user_type, active_only = "true", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (user_type) {
      whereClause += ` AND ur.user_type = $${paramIndex++}`;
      params.push(user_type);
    }

    if (active_only === "true") {
      whereClause += ` AND ur.revoked_at IS NULL AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM user_restrictions ur ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
        ur.*,
        CASE 
          WHEN ur.user_type = 'member' THEN (SELECT name FROM members WHERE id = ur.user_id)
          WHEN ur.user_type = 'community' THEN (SELECT name FROM communities WHERE id = ur.user_id)
          WHEN ur.user_type = 'sponsor' THEN (SELECT brand_name FROM sponsors WHERE id = ur.user_id)
          WHEN ur.user_type = 'venue' THEN (SELECT name FROM venues WHERE id = ur.user_id)
        END as user_name,
        (SELECT email FROM admins WHERE id = ur.created_by) as created_by_email
       FROM user_restrictions ur
       ${whereClause}
       ORDER BY ur.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      restrictions: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching restrictions:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch restrictions" });
  }
}

/**
 * Apply restriction to user (ban, suspend, warn)
 * @body user_id, user_type, restriction_type, reason, expires_at (optional)
 */
async function restrictUser(req, res) {
  try {
    const { user_id, user_type, restriction_type, reason, expires_at } =
      req.body;
    const adminId = req.admin.id;

    if (!user_id || !user_type || !restriction_type || !reason) {
      return res.status(400).json({
        success: false,
        error: "user_id, user_type, restriction_type, and reason are required",
      });
    }

    if (!["ban", "suspend", "warn"].includes(restriction_type)) {
      return res.status(400).json({
        success: false,
        error: "restriction_type must be 'ban', 'suspend', or 'warn'",
      });
    }

    const result = await pool.query(
      `INSERT INTO user_restrictions (user_id, user_type, restriction_type, reason, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user_id,
        user_type,
        restriction_type,
        reason,
        expires_at || null,
        adminId,
      ]
    );

    // Log the action
    await logAdminAction(
      adminId,
      `${restriction_type}_user`,
      user_type,
      user_id,
      {
        reason,
        expires_at,
      }
    );

    res.json({ success: true, restriction: result.rows[0] });
  } catch (error) {
    console.error("Error restricting user:", error.message);
    res.status(500).json({ success: false, error: "Failed to restrict user" });
  }
}

/**
 * Revoke a user restriction
 */
async function revokeRestriction(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const result = await pool.query(
      `UPDATE user_restrictions 
       SET revoked_at = NOW(), revoked_by = $1
       WHERE id = $2 AND revoked_at IS NULL
       RETURNING *`,
      [adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Restriction not found or already revoked",
      });
    }

    const restriction = result.rows[0];

    // Log the action
    await logAdminAction(
      adminId,
      "revoke_restriction",
      restriction.user_type,
      restriction.user_id,
      {
        restriction_id: id,
        original_type: restriction.restriction_type,
      }
    );

    res.json({ success: true, restriction });
  } catch (error) {
    console.error("Error revoking restriction:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to revoke restriction" });
  }
}

/**
 * Check if user has active restriction
 */
async function checkUserRestriction(req, res) {
  try {
    const { user_id, user_type } = req.query;

    if (!user_id || !user_type) {
      return res.status(400).json({
        success: false,
        error: "user_id and user_type are required",
      });
    }

    const result = await pool.query(
      `SELECT * FROM user_restrictions 
       WHERE user_id = $1 AND user_type = $2 
         AND revoked_at IS NULL 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id, user_type]
    );

    res.json({
      success: true,
      restricted: result.rows.length > 0,
      restriction: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Error checking restriction:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to check restriction" });
  }
}

// ============================================================
// AUDIT LOG
// ============================================================

/**
 * Get admin audit log
 */
async function getAuditLog(req, res) {
  try {
    const { admin_id, action, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (admin_id) {
      whereClause += ` AND al.admin_id = $${paramIndex++}`;
      params.push(admin_id);
    }

    if (action) {
      whereClause += ` AND al.action ILIKE $${paramIndex++}`;
      params.push(`%${action}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM admin_audit_log al ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
        al.*,
        a.email as admin_email
       FROM admin_audit_log al
       LEFT JOIN admins a ON a.id = al.admin_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      logs: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching audit log:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch audit log" });
  }
}

module.exports = {
  // Reports
  getReports,
  getReportById,
  resolveReport,
  getReportStats,
  // Restrictions
  getRestrictions,
  restrictUser,
  revokeRestriction,
  checkUserRestriction,
  // Audit Log
  getAuditLog,
  // Helper
  logAdminAction,
};
