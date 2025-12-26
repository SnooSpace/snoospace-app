const { createPool } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = createPool();

// JWT secret (should be in environment variable in production)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-admin-jwt-secret-change-in-production";

// ============================================
// ADMIN AUTHENTICATION
// ============================================

/**
 * Admin login
 */
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find admin by email
    const result = await pool.query(
      "SELECT * FROM admins WHERE email = $1 AND is_active = true",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const admin = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await pool.query("UPDATE admins SET last_login_at = NOW() WHERE id = $1", [
      admin.id,
    ]);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: "admin",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

/**
 * Create admin (for initial setup - should be protected/removed in production)
 */
const createAdmin = async (req, res) => {
  try {
    const { email, password, name, role = "moderator" } = req.body;

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO admins (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, is_active, created_at`,
      [email.toLowerCase(), password_hash, name, role]
    );

    res.status(201).json({
      success: true,
      admin: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Admin with this email already exists" });
    }
    res.status(500).json({ error: "Failed to create admin" });
  }
};

// ============================================
// DISCOVER CATEGORIES CRUD
// ============================================

/**
 * Get all active discover categories
 * Returns categories ordered by display_order, filtered by visibility dates
 */
const getDiscoverCategories = async (req, res) => {
  try {
    const now = new Date().toISOString();

    const query = `
      SELECT 
        id,
        name,
        slug,
        icon_name,
        description,
        display_order,
        is_active,
        visible_from,
        visible_until
      FROM discover_categories
      WHERE is_active = true
        AND (visible_from IS NULL OR visible_from <= $1)
        AND (visible_until IS NULL OR visible_until >= $1)
      ORDER BY display_order ASC
    `;

    const result = await pool.query(query, [now]);

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Error getting discover categories:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
};

/**
 * Get all categories (admin view - includes inactive)
 */
const getAllCategoriesAdmin = async (req, res) => {
  try {
    const query = `
      SELECT 
        dc.*,
        COUNT(edc.id) as event_count
      FROM discover_categories dc
      LEFT JOIN event_discover_categories edc ON dc.id = edc.category_id
      GROUP BY dc.id
      ORDER BY dc.display_order ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Error getting all categories:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
};

/**
 * Get category by ID with events
 */
const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Get category details
    const categoryQuery = `
      SELECT * FROM discover_categories WHERE id = $1
    `;
    const categoryResult = await pool.query(categoryQuery, [categoryId]);

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Get events in this category
    const eventsQuery = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.start_datetime as event_date,
        e.end_datetime,
        e.location_url,
        e.banner_url,
        e.ticket_price,
        e.event_type,
        e.max_attendees,
        c.id as community_id,
        c.name as community_name,
        c.logo_url as community_logo,
        c.username as community_username,
        edc.is_featured,
        edc.display_order,
        COALESCE(COUNT(DISTINCT er.member_id) FILTER (WHERE er.registration_status = 'registered'), 0) as attendee_count,
        TO_CHAR(e.start_datetime, 'Dy, DD Mon') as formatted_date,
        TO_CHAR(e.start_datetime, 'HH:MI AM') as formatted_time
      FROM events e
      INNER JOIN event_discover_categories edc ON e.id = edc.event_id
      INNER JOIN communities c ON e.community_id = c.id
      LEFT JOIN event_registrations er ON e.id = er.event_id
      WHERE edc.category_id = $1
        AND e.start_datetime >= NOW()
        AND e.is_published = true
      GROUP BY e.id, c.id, edc.is_featured, edc.display_order
      ORDER BY edc.is_featured DESC, edc.display_order ASC, e.start_datetime ASC
      LIMIT $2 OFFSET $3
    `;

    const eventsResult = await pool.query(eventsQuery, [
      categoryId,
      limit,
      offset,
    ]);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM events e
      INNER JOIN event_discover_categories edc ON e.id = edc.event_id
      WHERE edc.category_id = $1
        AND e.start_datetime >= NOW()
        AND e.is_published = true
    `;
    const countResult = await pool.query(countQuery, [categoryId]);

    res.json({
      success: true,
      category: categoryResult.rows[0],
      events: eventsResult.rows,
      total: parseInt(countResult.rows[0].total),
      hasMore:
        parseInt(countResult.rows[0].total) > offset + eventsResult.rows.length,
    });
  } catch (error) {
    console.error("Error getting category by ID:", error);
    res.status(500).json({ error: "Failed to get category" });
  }
};

/**
 * Get discover feed with categories and events
 * This is the main endpoint for the new Discover Feed V2
 */
const getDiscoverFeedV2 = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const now = new Date().toISOString();

    // Get active categories
    const categoriesQuery = `
      SELECT 
        id,
        name,
        slug,
        icon_name,
        description,
        display_order
      FROM discover_categories
      WHERE is_active = true
        AND (visible_from IS NULL OR visible_from <= $1)
        AND (visible_until IS NULL OR visible_until >= $1)
      ORDER BY display_order ASC
    `;

    const categoriesResult = await pool.query(categoriesQuery, [now]);
    const categories = categoriesResult.rows;

    // For each category, get top events
    const categoriesWithEvents = await Promise.all(
      categories.map(async (category) => {
        const eventsQuery = `
          SELECT 
            e.id,
            e.title,
            e.description,
            e.start_datetime as event_date,
            e.location_url,
            e.banner_url,
            e.ticket_price,
            e.event_type,
            c.id as community_id,
            c.name as community_name,
            c.logo_url as community_logo,
            edc.is_featured,
            COALESCE(COUNT(DISTINCT er.member_id) FILTER (WHERE er.registration_status = 'registered'), 0) as attendee_count,
            TO_CHAR(e.start_datetime, 'Dy, DD Mon, HH:MI AM') as formatted_date,
            TO_CHAR(e.start_datetime, 'HH:MI AM') as formatted_time
          FROM events e
          INNER JOIN event_discover_categories edc ON e.id = edc.event_id
          INNER JOIN communities c ON e.community_id = c.id
          LEFT JOIN event_registrations er ON e.id = er.event_id
          WHERE edc.category_id = $1
            AND e.start_datetime >= NOW()
            AND e.is_published = true
          GROUP BY e.id, c.id, edc.is_featured, edc.display_order
          ORDER BY edc.is_featured DESC, edc.display_order ASC, e.start_datetime ASC
          LIMIT 10
        `;

        const eventsResult = await pool.query(eventsQuery, [category.id]);

        return {
          ...category,
          events: eventsResult.rows,
        };
      })
    );

    // Filter out categories with no events
    const categoriesWithContent = categoriesWithEvents.filter(
      (c) => c.events.length > 0
    );

    res.json({
      success: true,
      categories: categoriesWithContent,
    });
  } catch (error) {
    console.error("Error getting discover feed V2:", error);
    res.status(500).json({ error: "Failed to get discover feed" });
  }
};

/**
 * Create a new category (Admin only)
 */
const createCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      icon_name,
      description,
      display_order,
      is_active,
      visible_from,
      visible_until,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const query = `
      INSERT INTO discover_categories (name, slug, icon_name, description, display_order, is_active, visible_from, visible_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      name,
      slug.toLowerCase().replace(/\s+/g, "-"),
      icon_name || null,
      description || null,
      display_order || 0,
      is_active !== false,
      visible_from || null,
      visible_until || null,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      category: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Category with this name or slug already exists" });
    }
    res.status(500).json({ error: "Failed to create category" });
  }
};

/**
 * Update a category (Admin only)
 */
const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      name,
      slug,
      icon_name,
      description,
      display_order,
      is_active,
      visible_from,
      visible_until,
    } = req.body;

    const query = `
      UPDATE discover_categories
      SET 
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        icon_name = COALESCE($3, icon_name),
        description = COALESCE($4, description),
        display_order = COALESCE($5, display_order),
        is_active = COALESCE($6, is_active),
        visible_from = $7,
        visible_until = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;

    const values = [
      name,
      slug ? slug.toLowerCase().replace(/\s+/g, "-") : null,
      icon_name,
      description,
      display_order,
      is_active,
      visible_from || null,
      visible_until || null,
      categoryId,
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({
      success: true,
      category: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
};

/**
 * Delete a category (Admin only)
 */
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const query = `DELETE FROM discover_categories WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [categoryId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
};

/**
 * Reorder categories (Admin only)
 */
const reorderCategories = async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, display_order }

    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: "Order array is required" });
    }

    // Update each category's display_order
    await Promise.all(
      order.map((item) =>
        pool.query(
          `UPDATE discover_categories SET display_order = $1, updated_at = NOW() WHERE id = $2`,
          [item.display_order, item.id]
        )
      )
    );

    res.json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(500).json({ error: "Failed to reorder categories" });
  }
};

// ============================================
// EVENT-CATEGORY ASSIGNMENT
// ============================================

/**
 * Assign categories to an event
 */
const assignEventCategories = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { categoryIds } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!categoryIds || !Array.isArray(categoryIds)) {
      return res.status(400).json({ error: "Category IDs array is required" });
    }

    // Verify the event belongs to this community
    const eventCheck = await pool.query(
      `SELECT id, community_id FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (
      userType === "community" &&
      eventCheck.rows[0].community_id !== userId
    ) {
      return res
        .status(403)
        .json({ error: "You can only modify categories for your own events" });
    }

    // Remove existing category assignments
    await pool.query(
      `DELETE FROM event_discover_categories WHERE event_id = $1`,
      [eventId]
    );

    // Add new category assignments
    if (categoryIds.length > 0) {
      const inserts = categoryIds.map((categoryId, index) =>
        pool.query(
          `INSERT INTO event_discover_categories (event_id, category_id, display_order) VALUES ($1, $2, $3)`,
          [eventId, categoryId, index]
        )
      );
      await Promise.all(inserts);
    }

    res.json({
      success: true,
      message: "Event categories updated successfully",
    });
  } catch (error) {
    console.error("Error assigning event categories:", error);
    res.status(500).json({ error: "Failed to assign categories" });
  }
};

/**
 * Get categories for an event
 */
const getEventCategories = async (req, res) => {
  try {
    const { eventId } = req.params;

    const query = `
      SELECT 
        dc.id,
        dc.name,
        dc.slug,
        dc.icon_name,
        edc.is_featured,
        edc.display_order
      FROM discover_categories dc
      INNER JOIN event_discover_categories edc ON dc.id = edc.category_id
      WHERE edc.event_id = $1
      ORDER BY edc.display_order ASC
    `;

    const result = await pool.query(query, [eventId]);

    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Error getting event categories:", error);
    res.status(500).json({ error: "Failed to get event categories" });
  }
};

/**
 * Feature/unfeature an event in a category (Admin only)
 */
const toggleEventFeatured = async (req, res) => {
  try {
    const { eventId, categoryId } = req.params;
    const { is_featured } = req.body;

    const query = `
      UPDATE event_discover_categories
      SET is_featured = $1
      WHERE event_id = $2 AND category_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [is_featured, eventId, categoryId]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Event-category assignment not found" });
    }

    res.json({
      success: true,
      assignment: result.rows[0],
    });
  } catch (error) {
    console.error("Error toggling event featured:", error);
    res.status(500).json({ error: "Failed to toggle featured status" });
  }
};

// ============================================
// SIGNUP INTERESTS
// ============================================

/**
 * Get active signup interests
 */
const getSignupInterests = async (req, res) => {
  try {
    const { userType = "all" } = req.query;

    const query = `
      SELECT id, label, icon_name, display_order
      FROM signup_interests
      WHERE is_active = true
        AND (user_type = 'all' OR user_type = $1)
      ORDER BY display_order ASC
    `;

    const result = await pool.query(query, [userType]);

    res.json({
      success: true,
      interests: result.rows,
    });
  } catch (error) {
    console.error("Error getting signup interests:", error);
    res.status(500).json({ error: "Failed to get interests" });
  }
};

/**
 * Get all interests (Admin view)
 */
const getAllInterestsAdmin = async (req, res) => {
  try {
    const query = `
      SELECT * FROM signup_interests ORDER BY display_order ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      interests: result.rows,
    });
  } catch (error) {
    console.error("Error getting all interests:", error);
    res.status(500).json({ error: "Failed to get interests" });
  }
};

/**
 * Create interest (Admin only)
 */
const createInterest = async (req, res) => {
  try {
    const { label, icon_name, display_order, user_type } = req.body;

    if (!label) {
      return res.status(400).json({ error: "Label is required" });
    }

    const query = `
      INSERT INTO signup_interests (label, icon_name, display_order, user_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [
      label,
      icon_name || null,
      display_order || 0,
      user_type || "all",
    ]);

    res.status(201).json({
      success: true,
      interest: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating interest:", error);
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Interest with this label already exists" });
    }
    res.status(500).json({ error: "Failed to create interest" });
  }
};

/**
 * Update interest (Admin only)
 */
const updateInterest = async (req, res) => {
  try {
    const { interestId } = req.params;
    const { label, icon_name, display_order, is_active, user_type } = req.body;

    const query = `
      UPDATE signup_interests
      SET 
        label = COALESCE($1, label),
        icon_name = COALESCE($2, icon_name),
        display_order = COALESCE($3, display_order),
        is_active = COALESCE($4, is_active),
        user_type = COALESCE($5, user_type)
      WHERE id = $6
      RETURNING *
    `;

    const result = await pool.query(query, [
      label,
      icon_name,
      display_order,
      is_active,
      user_type,
      interestId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Interest not found" });
    }

    res.json({
      success: true,
      interest: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating interest:", error);
    res.status(500).json({ error: "Failed to update interest" });
  }
};

/**
 * Delete interest (Admin only)
 */
const deleteInterest = async (req, res) => {
  try {
    const { interestId } = req.params;

    const query = `DELETE FROM signup_interests WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [interestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Interest not found" });
    }

    res.json({
      success: true,
      message: "Interest deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting interest:", error);
    res.status(500).json({ error: "Failed to delete interest" });
  }
};

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

/**
 * Get all users (Members + Communities) with pagination, search, and filtering
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      type = "all", // 'all', 'member', 'community'
      status = "all", // 'all', 'active', 'banned'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchPattern = `%${search}%`;

    console.log("[getAllUsers] Query params:", {
      page,
      limit,
      search,
      type,
      status,
      searchPattern,
    });

    let users = [];

    // Build the query based on type filter
    if (type === "all" || type === "member") {
      try {
        let memberQuery = `
          SELECT 
            m.id, 'member' as type, m.name, m.username, m.email, m.phone,
            m.profile_photo_url, m.location, m.pronouns, m.bio, m.interests,
            true as is_active, m.created_at,
            (SELECT COUNT(*) FROM follows WHERE following_id = m.id AND following_type = 'member') as follower_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = m.id AND follower_type = 'member') as following_count,
            (SELECT COUNT(*) FROM posts WHERE author_id = m.id AND author_type = 'member') as post_count
          FROM members m
        `;
        const params = [];
        const conditions = [];

        if (search && search.trim()) {
          params.push(searchPattern);
          conditions.push(
            `(m.name ILIKE $${params.length} OR m.username ILIKE $${params.length} OR m.email ILIKE $${params.length})`
          );
        }
        // Note: is_active column doesn't exist in members table, so status filtering is skipped

        if (conditions.length > 0) {
          memberQuery += " WHERE " + conditions.join(" AND ");
        }

        console.log(
          "[getAllUsers] Member query:",
          memberQuery,
          "params:",
          params
        );
        const memberResult = await pool.query(memberQuery, params);
        console.log("[getAllUsers] Members found:", memberResult.rows.length);

        users = users.concat(memberResult.rows);
      } catch (memberErr) {
        console.error("Error fetching members:", memberErr);
      }
    }

    if (type === "all" || type === "community") {
      try {
        let communityQuery = `
          SELECT 
            c.id, 'community' as type, c.name, c.username, c.email, c.phone,
            c.secondary_phone,
            c.logo_url as profile_photo_url, c.location, NULL as pronouns, c.bio,
            c.sponsor_types as interests, c.category,
            true as is_active, c.created_at,
            (SELECT COUNT(*) FROM follows WHERE following_id = c.id AND following_type = 'community') as follower_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = c.id AND follower_type = 'community') as following_count,
            (SELECT COUNT(*) FROM posts WHERE author_id = c.id AND author_type = 'community') as post_count
          FROM communities c
        `;
        const params = [];
        const conditions = [];

        if (search && search.trim()) {
          params.push(searchPattern);
          conditions.push(
            `(c.name ILIKE $${params.length} OR c.username ILIKE $${params.length} OR c.email ILIKE $${params.length})`
          );
        }
        // Note: is_active column doesn't exist in communities table, so status filtering is skipped

        if (conditions.length > 0) {
          communityQuery += " WHERE " + conditions.join(" AND ");
        }

        console.log(
          "[getAllUsers] Community query:",
          communityQuery,
          "params:",
          params
        );
        const communityResult = await pool.query(communityQuery, params);
        console.log(
          "[getAllUsers] Communities found:",
          communityResult.rows.length
        );

        // Fetch community heads for each community
        for (const community of communityResult.rows) {
          try {
            const headsResult = await pool.query(
              `SELECT name, phone, profile_pic_url, is_primary FROM community_heads 
               WHERE community_id = $1 ORDER BY is_primary DESC`,
              [community.id]
            );
            community.heads = headsResult.rows;
          } catch (headErr) {
            console.error("Error fetching community heads:", headErr);
            community.heads = [];
          }
        }

        users = users.concat(communityResult.rows);
      } catch (communityErr) {
        console.error("Error fetching communities:", communityErr);
      }
    }

    // Sort by created_at descending
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const totalCount = users.length;

    // Apply pagination
    const paginatedUsers = users.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query; // 'member' or 'community'

    if (!type || !["member", "community"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'member' or 'community'" });
    }

    let user;

    if (type === "member") {
      const result = await pool.query(
        `SELECT 
          id, 'member' as type, name, username, email, phone,
          profile_photo_url, location, pronouns, bio, interests, gender, dob,
          is_active, created_at,
          (SELECT COUNT(*) FROM follows WHERE followed_id = members.id AND followed_type = 'member') as follower_count,
          (SELECT COUNT(*) FROM follows WHERE follower_id = members.id AND follower_type = 'member') as following_count,
          (SELECT COUNT(*) FROM posts WHERE author_id = members.id AND author_type = 'member') as post_count
        FROM members WHERE id = $1`,
        [userId]
      );
      user = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT 
          id, 'community' as type, name, username, email, phone,
          logo_url as profile_photo_url, banner_url, location, bio,
          sponsor_interests as interests, category,
          head1_name, head1_phone, head2_name, head2_phone,
          is_active, created_at,
          (SELECT COUNT(*) FROM follows WHERE followed_id = communities.id AND followed_type = 'community') as follower_count,
          (SELECT COUNT(*) FROM posts WHERE author_id = communities.id AND author_type = 'community') as post_count
        FROM communities WHERE id = $1`,
        [userId]
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error getting user by ID:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
};

/**
 * Update user (ban/unban, etc.)
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query; // 'member' or 'community'
    const { is_active } = req.body;

    if (!type || !["member", "community"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'member' or 'community'" });
    }

    const table = type === "member" ? "members" : "communities";

    const result = await pool.query(
      `UPDATE ${table} SET is_active = $1 WHERE id = $2 RETURNING id, is_active`,
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: is_active
        ? "User unbanned successfully"
        : "User banned successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

/**
 * Delete user (soft delete by setting is_active to false, or hard delete)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, hard = false } = req.query; // 'member' or 'community'

    if (!type || !["member", "community"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'member' or 'community'" });
    }

    const table = type === "member" ? "members" : "communities";

    if (hard === "true") {
      // Hard delete - actually remove the record
      const result = await pool.query(
        `DELETE FROM ${table} WHERE id = $1 RETURNING id`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        success: true,
        message: "User permanently deleted",
      });
    } else {
      // Soft delete - just ban the user
      const result = await pool.query(
        `UPDATE ${table} SET is_active = false WHERE id = $1 RETURNING id`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        success: true,
        message: "User banned (soft deleted)",
      });
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// =============================================
// POST MANAGEMENT ENDPOINTS
// =============================================

/**
 * Get all posts for admin with pagination and filters
 */
const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", type = "all" } = req.query;
    const offset = (page - 1) * parseInt(limit);
    const searchPattern = `%${search}%`;

    let query = `
      SELECT 
        p.id, p.author_id, p.author_type, p.caption, p.image_urls,
        p.like_count, p.comment_count, p.created_at,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
    `;

    const params = [];
    const conditions = [];

    // Search filter
    if (search && search.trim()) {
      params.push(searchPattern);
      conditions.push(`p.caption ILIKE $${params.length}`);
    }

    // Type filter
    if (type && type !== "all") {
      params.push(type);
      conditions.push(`p.author_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM posts/,
      "SELECT COUNT(*) as total FROM posts"
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Add pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${
      params.length + 2
    }`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Parse JSON fields
    const posts = result.rows.map((post) => ({
      ...post,
      image_urls: (() => {
        try {
          if (!post.image_urls) return [];
          if (typeof post.image_urls === "string") {
            const parsed = JSON.parse(post.image_urls);
            return Array.isArray(parsed) ? parsed : [parsed];
          }
          return Array.isArray(post.image_urls)
            ? post.image_urls
            : [post.image_urls];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
    }));

    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting all posts:", error);
    res.status(500).json({ error: "Failed to get posts" });
  }
};

/**
 * Get posts for a specific user (admin version - no user auth required)
 */
const getUserPostsAdmin = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    const query = `
      SELECT 
        p.id, p.author_id, p.author_type, p.caption, p.image_urls,
        p.like_count, p.comment_count, p.created_at,
        CASE 
          WHEN p.author_type = 'member' THEN m.name
          WHEN p.author_type = 'community' THEN c.name
          WHEN p.author_type = 'sponsor' THEN s.brand_name
          WHEN p.author_type = 'venue' THEN v.name
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN m.username
          WHEN p.author_type = 'community' THEN c.username
          WHEN p.author_type = 'sponsor' THEN s.username
          WHEN p.author_type = 'venue' THEN v.username
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN m.profile_photo_url
          WHEN p.author_type = 'community' THEN c.logo_url
          WHEN p.author_type = 'sponsor' THEN s.logo_url
          WHEN p.author_type = 'venue' THEN NULL
        END as author_photo_url
      FROM posts p
      LEFT JOIN members m ON p.author_type = 'member' AND p.author_id = m.id
      LEFT JOIN communities c ON p.author_type = 'community' AND p.author_id = c.id
      LEFT JOIN sponsors s ON p.author_type = 'sponsor' AND p.author_id = s.id
      LEFT JOIN venues v ON p.author_type = 'venue' AND p.author_id = v.id
      WHERE p.author_id = $1 AND p.author_type = $2
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, [userId, userType]);

    // Parse JSON fields
    const posts = result.rows.map((post) => ({
      ...post,
      image_urls: (() => {
        try {
          if (!post.image_urls) return [];
          if (typeof post.image_urls === "string") {
            const parsed = JSON.parse(post.image_urls);
            return Array.isArray(parsed) ? parsed : [parsed];
          }
          return Array.isArray(post.image_urls)
            ? post.image_urls
            : [post.image_urls];
        } catch {
          return post.image_urls ? [post.image_urls] : [];
        }
      })(),
    }));

    res.json({ posts });
  } catch (error) {
    console.error("Error getting user posts:", error);
    res.status(500).json({ error: "Failed to get user posts" });
  }
};

module.exports = {
  // Admin authentication
  adminLogin,
  createAdmin,

  // Category endpoints
  getDiscoverCategories,
  getAllCategoriesAdmin,
  getCategoryById,
  getDiscoverFeedV2,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,

  // Event-category endpoints
  assignEventCategories,
  getEventCategories,
  toggleEventFeatured,

  // Interest endpoints
  getSignupInterests,
  getAllInterestsAdmin,
  createInterest,
  updateInterest,
  deleteInterest,

  // User management endpoints
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,

  // Post management endpoints
  getAllPosts,
  getUserPostsAdmin,
};
