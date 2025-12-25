const { createPool } = require("../config/db");

const pool = createPool();

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

module.exports = {
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
};
