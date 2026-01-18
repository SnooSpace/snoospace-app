const { Pool } = require("pg");

// ============================================
// PUBLIC ENDPOINTS (Mobile App)
// ============================================

/**
 * Search campuses (with college name)
 * GET /colleges?search=query
 * Returns: "VIT University - Vellore Campus, Tamil Nadu"
 */
async function searchColleges(req, res) {
  try {
    const { search } = req.query;
    const pool = req.app.locals.pool;

    if (!search || search.trim().length < 2) {
      return res.json({ colleges: [] });
    }

    // Search campuses with college info joined
    const result = await pool.query(
      `SELECT 
         ca.id,
         ca.campus_name,
         ca.city,
         ca.area,
         co.id as college_id,
         co.name as college_name,
         co.abbreviation
       FROM campuses ca
       JOIN colleges co ON ca.college_id = co.id
       WHERE ca.status = 'active' 
         AND co.status = 'approved'
         AND (
           co.name ILIKE $1 
           OR co.abbreviation ILIKE $1
           OR ca.campus_name ILIKE $1
           OR ca.city ILIKE $1
         )
       ORDER BY co.name, ca.campus_name
       LIMIT 20`,
      [`%${search.trim()}%`],
    );

    // Format response for mobile app compatibility
    const colleges = result.rows.map((row) => ({
      id: row.id, // campus_id
      college_id: row.college_id,
      name: row.college_name,
      abbreviation: row.abbreviation,
      campus_name: row.campus_name,
      city: row.city,
      area: row.area,
      // Display format: "VIT University - Vellore Campus"
      display_name: row.campus_name
        ? `${row.college_name} - ${row.campus_name}`
        : row.college_name,
    }));

    res.json({ colleges });
  } catch (error) {
    console.error("Error searching colleges:", error);
    res.status(500).json({ error: "Failed to search colleges" });
  }
}

/**
 * Request a new college and campus to be added
 * POST /colleges/request
 * Body: { college_name, campus_name, city, area?, website? }
 */
async function requestCollege(req, res) {
  try {
    const { college_name, campus_name, city, area, website } = req.body;
    const pool = req.app.locals.pool;

    // Validate required fields
    if (!college_name || !campus_name || !city) {
      return res.status(400).json({
        error: "college_name, campus_name, and city are required",
      });
    }

    // Check if college exists
    let collegeResult = await pool.query(
      `SELECT id, status FROM colleges WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
      [college_name],
    );

    let collegeId;
    let collegeStatus;

    if (collegeResult.rows.length > 0) {
      // College exists
      collegeId = collegeResult.rows[0].id;
      collegeStatus = collegeResult.rows[0].status;
    } else {
      // Create new pending college
      const newCollege = await pool.query(
        `INSERT INTO colleges (name, website, status) 
         VALUES (TRIM($1), $2, 'pending') 
         RETURNING id, status`,
        [college_name, website || null],
      );
      collegeId = newCollege.rows[0].id;
      collegeStatus = "pending";
      console.log(
        `[Colleges] New college created: ${collegeId} - ${college_name}`,
      );
    }

    // Check if campus exists for this college
    const existingCampus = await pool.query(
      `SELECT id, status FROM campuses 
       WHERE college_id = $1 
         AND LOWER(TRIM(campus_name)) = LOWER(TRIM($2))`,
      [collegeId, campus_name],
    );

    if (existingCampus.rows.length > 0) {
      // Campus already exists
      const campus = existingCampus.rows[0];
      return res.json({
        message:
          campus.status === "active"
            ? "Campus already exists"
            : "Campus is pending approval",
        campus_id: campus.id,
        college_id: collegeId,
        status: campus.status,
      });
    }

    // Create new pending campus
    const newCampus = await pool.query(
      `INSERT INTO campuses (college_id, campus_name, city, area, status) 
       VALUES ($1, TRIM($2), TRIM($3), $4, 'pending') 
       RETURNING id, status`,
      [collegeId, campus_name, city, area || null],
    );

    console.log(
      `[Colleges] New campus created: ${newCampus.rows[0].id} - ${campus_name}`,
    );

    res.json({
      message:
        "Request submitted. We'll add it shortly. You can continue setting up your profile.",
      campus_id: newCampus.rows[0].id,
      college_id: collegeId,
      status: "pending",
    });
  } catch (error) {
    console.error("Error requesting college:", error);
    res.status(500).json({ error: "Failed to submit college request" });
  }
}

/**
 * Get a single campus by ID
 * GET /colleges/:id
 */
async function getCollege(req, res) {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT 
         ca.id,
         ca.campus_name,
         ca.city,
         ca.area,
         ca.status as campus_status,
         co.id as college_id,
         co.name as college_name,
         co.abbreviation,
         co.status as college_status
       FROM campuses ca
       JOIN colleges co ON ca.college_id = co.id
       WHERE ca.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Campus not found" });
    }

    res.json({ college: result.rows[0] });
  } catch (error) {
    console.error("Error fetching college:", error);
    res.status(500).json({ error: "Failed to fetch college" });
  }
}

/**
 * Get all branches for event targeting
 * GET /branches
 */
async function getBranches(req, res) {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `SELECT id, name FROM branches ORDER BY display_order, name`,
    );
    res.json({ branches: result.rows });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
}

/**
 * List of Indian states for dropdown
 * GET /states
 */
async function getIndianStates(req, res) {
  const states = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Chandigarh",
    "Puducherry",
  ];
  res.json({ states });
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all colleges with campus count
 * GET /admin/colleges?status=all&search=
 */
async function adminGetColleges(req, res) {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const pool = req.app.locals.pool;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "1=1";
    const params = [];

    if (status && status !== "all") {
      params.push(status);
      whereClause += ` AND co.status = $${params.length}`;
    }

    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (co.name ILIKE $${params.length} OR co.abbreviation ILIKE $${params.length})`;
    }

    // Get colleges with counts
    const result = await pool.query(
      `SELECT 
         co.id,
         co.name,
         co.abbreviation,
         co.website,
         co.logo_url,
         co.status,
         co.created_at,
         COUNT(DISTINCT ca.id) as campus_count,
         COUNT(DISTINCT c.id) as community_count
       FROM colleges co
       LEFT JOIN campuses ca ON ca.college_id = co.id AND ca.status = 'active'
       LEFT JOIN communities c ON c.campus_id = ca.id
       WHERE ${whereClause}
       GROUP BY co.id
       ORDER BY co.name
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset],
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM colleges co WHERE ${whereClause}`,
      params,
    );

    res.json({
      success: true,
      colleges: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching colleges (admin):", error);
    res.status(500).json({ error: "Failed to fetch colleges" });
  }
}

/**
 * Create a new college
 * POST /admin/colleges
 */
async function adminCreateCollege(req, res) {
  try {
    const { name, abbreviation, website, logo_url } = req.body;
    const pool = req.app.locals.pool;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await pool.query(
      `INSERT INTO colleges (name, abbreviation, website, logo_url, status)
       VALUES (TRIM($1), $2, $3, $4, 'approved')
       RETURNING *`,
      [name, abbreviation || null, website || null, logo_url || null],
    );

    res.json({ success: true, college: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "College name already exists" });
    }
    console.error("Error creating college:", error);
    res.status(500).json({ error: "Failed to create college" });
  }
}

/**
 * Update a college
 * PUT /admin/colleges/:id
 */
async function adminUpdateCollege(req, res) {
  try {
    const { id } = req.params;
    const { name, abbreviation, website, logo_url, status } = req.body;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE colleges SET
         name = COALESCE($2, name),
         abbreviation = COALESCE($3, abbreviation),
         website = COALESCE($4, website),
         logo_url = COALESCE($5, logo_url),
         status = COALESCE($6, status)
       WHERE id = $1
       RETURNING *`,
      [id, name, abbreviation, website, logo_url, status],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    res.json({ success: true, college: result.rows[0] });
  } catch (error) {
    console.error("Error updating college:", error);
    res.status(500).json({ error: "Failed to update college" });
  }
}

/**
 * Delete a college
 * DELETE /admin/colleges/:id
 */
async function adminDeleteCollege(req, res) {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `DELETE FROM colleges WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    res.json({ success: true, message: "College deleted" });
  } catch (error) {
    console.error("Error deleting college:", error);
    res.status(500).json({ error: "Failed to delete college" });
  }
}

/**
 * Get campuses for a college
 * GET /admin/colleges/:collegeId/campuses
 */
async function adminGetCampuses(req, res) {
  try {
    const { collegeId } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT 
         ca.*,
         COUNT(DISTINCT c.id) as community_count
       FROM campuses ca
       LEFT JOIN communities c ON c.campus_id = ca.id
       WHERE ca.college_id = $1
       GROUP BY ca.id
       ORDER BY ca.campus_name`,
      [collegeId],
    );

    res.json({ success: true, campuses: result.rows });
  } catch (error) {
    console.error("Error fetching campuses:", error);
    res.status(500).json({ error: "Failed to fetch campuses" });
  }
}

/**
 * Create a campus
 * POST /admin/campuses
 */
async function adminCreateCampus(req, res) {
  try {
    const {
      college_id,
      campus_name,
      city,
      state,
      area,
      address,
      location_url,
    } = req.body;
    const pool = req.app.locals.pool;

    if (!college_id || !campus_name || !city) {
      return res
        .status(400)
        .json({ error: "college_id, campus_name, and city are required" });
    }

    const result = await pool.query(
      `INSERT INTO campuses (college_id, campus_name, city, state, area, address, location_url, geo_location, status)
       VALUES ($1, TRIM($2), TRIM($3), $4, $5, $6, $7, $7, 'active')
       RETURNING *`,
      [
        college_id,
        campus_name,
        city,
        state || null,
        area || null,
        address || null,
        location_url || null,
      ],
    );

    res.json({ success: true, campus: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Campus already exists for this college" });
    }
    console.error("Error creating campus:", error);
    res.status(500).json({ error: "Failed to create campus" });
  }
}

/**
 * Update a campus
 * PUT /admin/campuses/:id
 */
async function adminUpdateCampus(req, res) {
  try {
    const { id } = req.params;
    const { campus_name, city, state, area, address, location_url, status } =
      req.body;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `UPDATE campuses SET
         campus_name = COALESCE($2, campus_name),
         city = COALESCE($3, city),
         state = COALESCE($4, state),
         area = COALESCE($5, area),
         address = COALESCE($6, address),
         location_url = COALESCE($7, location_url),
         geo_location = COALESCE($7, geo_location),
         status = COALESCE($8, status)
       WHERE id = $1
       RETURNING *`,
      [id, campus_name, city, state, area, address, location_url, status],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Campus not found" });
    }

    res.json({ success: true, campus: result.rows[0] });
  } catch (error) {
    console.error("Error updating campus:", error);
    res.status(500).json({ error: "Failed to update campus" });
  }
}

/**
 * Delete a campus
 * DELETE /admin/campuses/:id
 */
async function adminDeleteCampus(req, res) {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `DELETE FROM campuses WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Campus not found" });
    }

    res.json({ success: true, message: "Campus deleted" });
  } catch (error) {
    console.error("Error deleting campus:", error);
    res.status(500).json({ error: "Failed to delete campus" });
  }
}

/**
 * Get pending requests count (for notification badge)
 * GET /admin/colleges/pending-count
 */
async function adminGetPendingCount(req, res) {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM colleges WHERE status = 'pending') as pending_colleges,
         (SELECT COUNT(*) FROM campuses WHERE status = 'pending') as pending_campuses`,
    );

    res.json({
      success: true,
      pending: {
        colleges: parseInt(result.rows[0].pending_colleges),
        campuses: parseInt(result.rows[0].pending_campuses),
        total:
          parseInt(result.rows[0].pending_colleges) +
          parseInt(result.rows[0].pending_campuses),
      },
    });
  } catch (error) {
    console.error("Error fetching pending count:", error);
    res.status(500).json({ error: "Failed to fetch pending count" });
  }
}

module.exports = {
  // Public
  searchColleges,
  requestCollege,
  getCollege,
  getBranches,
  getIndianStates,
  // Admin
  adminGetColleges,
  adminCreateCollege,
  adminUpdateCollege,
  adminDeleteCollege,
  adminGetCampuses,
  adminCreateCampus,
  adminUpdateCampus,
  adminDeleteCampus,
  adminGetPendingCount,
};
