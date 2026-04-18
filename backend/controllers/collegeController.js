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

    // Check previous status before update (for notification logic)
    let previousStatus = null;
    if (status) {
      const prev = await pool.query(`SELECT status FROM colleges WHERE id = $1`, [id]);
      if (prev.rows.length > 0) {
        previousStatus = prev.rows[0].status;
      }
    }

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

    const updatedCollege = result.rows[0];

    // If status changed from pending to approved, notify affiliated communities
    if (previousStatus === 'pending' && status === 'approved') {
      try {
        const { createSimpleNotification } = require('../services/notificationService');

        // Find all communities linked to this college's campuses
        const communitiesResult = await pool.query(
          `SELECT DISTINCT c.id
           FROM communities c
           JOIN campuses ca ON c.campus_id = ca.id
           WHERE ca.college_id = $1`,
          [id],
        );

        // Send notification to each affiliated community
        for (const community of communitiesResult.rows) {
          try {
            await createSimpleNotification(pool, {
              recipientId: community.id,
              recipientType: 'community',
              actorId: null,
              actorType: null,
              type: 'college_approved',
              payload: {
                title: 'College Verified! 🎓',
                message: `${updatedCollege.name} has been verified. Your college affiliation is now live on your profile.`,
                collegeId: id,
                collegeName: updatedCollege.name,
                collegeAbbreviation: updatedCollege.abbreviation,
              },
            });
          } catch (notifErr) {
            console.error(`[CollegeApproval] Failed to notify community ${community.id}:`, notifErr);
          }
        }

        console.log(`[CollegeApproval] Notified ${communitiesResult.rows.length} communities for college ${updatedCollege.name}`);
      } catch (notifBatchErr) {
        console.error('[CollegeApproval] Failed to send approval notifications:', notifBatchErr);
      }
    }

    res.json({ success: true, college: updatedCollege });
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

    // Build dynamic SET clause to allow clearing optional fields
    // Optional fields (state, area, address, location_url) can be set to null
    // Required fields (campus_name, city) use COALESCE to keep old value if not provided
    const result = await pool.query(
      `UPDATE campuses SET
         campus_name = COALESCE($2, campus_name),
         city = COALESCE($3, city),
         state = $4,
         area = $5,
         address = $6,
         location_url = $7,
         geo_location = $7,
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

/**
 * GET /colleges/:collegeId/members
 * Paginated list of members linked to any campus of this college.
 * Returns follow status for the authenticated viewer.
 */
async function getCollegeMembers(req, res) {
  try {
    const { collegeId } = req.params;
    const pool = req.app.locals.pool;
    const viewerId = req.user?.id;
    const viewerType = req.user?.type;
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT m.id, m.name, m.username, m.profile_photo_url,
              m.occupation, m.occupation_details,
              ca.campus_name,
              CASE
                WHEN $2::text IS NULL THEN false
                ELSE EXISTS (
                  SELECT 1 FROM follows
                  WHERE follower_id = $2::int
                    AND follower_type = $3
                    AND following_id = m.id
                    AND following_type = 'member'
                )
              END AS is_following
       FROM members m
       JOIN campuses ca ON m.campus_id = ca.id
       WHERE ca.college_id = $1
         AND m.username IS NOT NULL
       ORDER BY m.name
       LIMIT $4 OFFSET $5`,
      [collegeId, viewerId ? String(viewerId) : null, viewerType || null, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT m.id)::int AS total
       FROM members m
       JOIN campuses ca ON m.campus_id = ca.id
       WHERE ca.college_id = $1
         AND m.username IS NOT NULL`,
      [collegeId]
    );

    res.json({
      members: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        username: r.username,
        profile_photo_url: r.profile_photo_url,
        occupation: r.occupation,
        occupation_details: r.occupation_details,
        campus_name: r.campus_name,
        is_following: !!r.is_following,
      })),
      total: countResult.rows[0]?.total || 0,
      has_more: offset + limit < (countResult.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error('Error fetching college members:', error);
    res.status(500).json({ error: 'Failed to fetch college members' });
  }
}

/**
 * GET /colleges/:collegeId/communities
 * Paginated list of communities linked to any campus of this college.
 * Returns follow status for the authenticated viewer.
 */
async function getCollegeCommunities(req, res) {
  try {
    const { collegeId } = req.params;
    const pool = req.app.locals.pool;
    const viewerId = req.user?.id;
    const viewerType = req.user?.type;
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT c.id, c.name, c.username, c.logo_url,
              c.college_subtype, c.club_type, c.category,
              ca.campus_name, ca.city AS campus_city,
              (
                SELECT COUNT(*) FROM follows
                WHERE following_id = c.id AND following_type = 'community'
              )::int AS follower_count,
              CASE
                WHEN $2::text IS NULL THEN false
                ELSE EXISTS (
                  SELECT 1 FROM follows
                  WHERE follower_id = $2::int
                    AND follower_type = $3
                    AND following_id = c.id
                    AND following_type = 'community'
                )
              END AS is_following
       FROM communities c
       JOIN campuses ca ON c.campus_id = ca.id
       WHERE ca.college_id = $1
       ORDER BY c.name
       LIMIT $4 OFFSET $5`,
      [collegeId, viewerId ? String(viewerId) : null, viewerType || null, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT c.id)::int AS total
       FROM communities c
       JOIN campuses ca ON c.campus_id = ca.id
       WHERE ca.college_id = $1`,
      [collegeId]
    );

    res.json({
      communities: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        username: r.username,
        logo_url: r.logo_url,
        college_subtype: r.college_subtype,
        club_type: r.club_type,
        category: r.category,
        campus_name: r.campus_name,
        campus_city: r.campus_city,
        follower_count: r.follower_count || 0,
        is_following: !!r.is_following,
      })),
      total: countResult.rows[0]?.total || 0,
      has_more: offset + limit < (countResult.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error('Error fetching college communities:', error);
    res.status(500).json({ error: 'Failed to fetch college communities' });
  }
}

/**
 * Get college hub data (for the College Hub bottom sheet)
 * GET /colleges/:collegeId/hub
 * Returns college details, campus list, community count, member count, affiliated communities
 */
async function getCollegeHub(req, res) {
  try {
    const { collegeId } = req.params;
    const pool = req.app.locals.pool;

    // Get college details
    const collegeResult = await pool.query(
      `SELECT id, name, abbreviation, website, logo_url, status, created_at
       FROM colleges WHERE id = $1`,
      [collegeId],
    );

    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    const college = collegeResult.rows[0];

    // Get active campuses for this college
    const campusesResult = await pool.query(
      `SELECT id, campus_name, city, area, state
       FROM campuses
       WHERE college_id = $1 AND status = 'active'
       ORDER BY campus_name`,
      [collegeId],
    );

    // Count affiliated communities (communities linked to any campus of this college)
    const communityCountResult = await pool.query(
      `SELECT COUNT(DISTINCT c.id)::int as community_count
       FROM communities c
       JOIN campuses ca ON c.campus_id = ca.id
       WHERE ca.college_id = $1`,
      [collegeId],
    );

    // Count members linked to any campus of this college
    const memberCountResult = await pool.query(
      `SELECT COUNT(DISTINCT m.id)::int as member_count
       FROM members m
       JOIN campuses ca ON m.campus_id = ca.id
       WHERE ca.college_id = $1`,
      [collegeId],
    );

    // Get list of affiliated communities (limited to 50)
    const communitiesResult = await pool.query(
      `SELECT c.id, c.name, c.logo_url, c.username, c.college_subtype, c.club_type,
              c.category, c.categories,
              ca.campus_name, ca.city as campus_city,
              (SELECT COUNT(*) FROM follows WHERE following_id = c.id AND following_type = 'community') as follower_count
       FROM communities c
       JOIN campuses ca ON c.campus_id = ca.id
       WHERE ca.college_id = $1
       ORDER BY c.name
       LIMIT 50`,
      [collegeId],
    );

    res.json({
      success: true,
      college: {
        ...college,
        campuses: campusesResult.rows,
        community_count: communityCountResult.rows[0]?.community_count || 0,
        member_count: memberCountResult.rows[0]?.member_count || 0,
      },
      communities: communitiesResult.rows.map(c => ({
        id: c.id,
        name: c.name,
        logo_url: c.logo_url,
        username: c.username,
        college_subtype: c.college_subtype,
        club_type: c.club_type,
        category: c.category,
        campus_name: c.campus_name,
        campus_city: c.campus_city,
        follower_count: parseInt(c.follower_count || 0, 10),
      })),
    });
  } catch (error) {
    console.error("Error fetching college hub:", error);
    res.status(500).json({ error: "Failed to fetch college hub data" });
  }
}

module.exports = {
  // Public
  searchColleges,
  requestCollege,
  getCollege,
  getBranches,
  getIndianStates,
  getCollegeHub,
  getCollegeMembers,
  getCollegeCommunities,
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
