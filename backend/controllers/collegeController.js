const { Pool } = require("pg");

/**
 * Search approved colleges
 * GET /colleges?search=query
 */
async function searchColleges(req, res) {
  try {
    const { search } = req.query;
    const pool = req.app.locals.pool;

    if (!search || search.trim().length < 2) {
      return res.json({ colleges: [] });
    }

    const result = await pool.query(
      `SELECT id, name, city, state, country 
       FROM colleges 
       WHERE status = 'approved' AND name ILIKE $1 
       ORDER BY name 
       LIMIT 20`,
      [`%${search.trim()}%`]
    );

    res.json({ colleges: result.rows });
  } catch (error) {
    console.error("Error searching colleges:", error);
    res.status(500).json({ error: "Failed to search colleges" });
  }
}

/**
 * Request a new college to be added
 * POST /colleges/request
 */
async function requestCollege(req, res) {
  try {
    const { name, city, state, country, website } = req.body;
    const pool = req.app.locals.pool;

    // Validate required fields
    if (!name || !city || !state) {
      return res
        .status(400)
        .json({ error: "name, city, and state are required" });
    }

    // Check if pending/approved college already exists
    const existing = await pool.query(
      `SELECT id, status, request_count FROM colleges 
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) 
       AND LOWER(TRIM(city)) = LOWER(TRIM($2))`,
      [name, city]
    );

    if (existing.rows.length > 0) {
      const college = existing.rows[0];

      // Increment request count
      const newCount = college.request_count + 1;
      await pool.query(`UPDATE colleges SET request_count = $1 WHERE id = $2`, [
        newCount,
        college.id,
      ]);

      // Auto-approve if count >= 3 and not already approved
      if (newCount >= 3 && college.status === "pending") {
        await pool.query(
          `UPDATE colleges SET status = 'approved', approved_at = NOW() WHERE id = $1`,
          [college.id]
        );
        console.log(`College ${college.id} auto-approved (request_count >= 3)`);
      }

      return res.json({
        message:
          college.status === "approved"
            ? "College already exists"
            : "Request added to existing pending college",
        college_id: college.id,
        status: newCount >= 3 ? "approved" : college.status,
      });
    }

    // Create new pending college
    const result = await pool.query(
      `INSERT INTO colleges (name, city, state, country, website) 
       VALUES (TRIM($1), TRIM($2), TRIM($3), $4, $5) 
       RETURNING id, name, city, state, status`,
      [name, city, state, country || "India", website || null]
    );

    console.log(`New college request created: ${result.rows[0].id}`);

    res.json({
      message:
        "College request submitted. We'll add it shortly. You can continue setting up your profile.",
      college_id: result.rows[0].id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error requesting college:", error);
    res.status(500).json({ error: "Failed to submit college request" });
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
      `SELECT id, name FROM branches ORDER BY display_order, name`
    );

    res.json({ branches: result.rows });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
}

/**
 * Get a single college by ID
 * GET /colleges/:id
 */
async function getCollege(req, res) {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT id, name, city, state, country, status FROM colleges WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "College not found" });
    }

    res.json({ college: result.rows[0] });
  } catch (error) {
    console.error("Error fetching college:", error);
    res.status(500).json({ error: "Failed to fetch college" });
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

module.exports = {
  searchColleges,
  requestCollege,
  getBranches,
  getCollege,
  getIndianStates,
};
