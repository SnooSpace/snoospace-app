const { createPool } = require("../config/db");
const pool = createPool();

/**
 * Get all curated lists (Admin)
 * GET /admin/curated-lists
 */
const getCuratedLists = async (req, res) => {
  try {
    const query = `
      SELECT 
        cl.*,
        COUNT(cle.id)::int as event_count
      FROM curated_lists cl
      LEFT JOIN curated_list_events cle ON cl.id = cle.curated_list_id
      GROUP BY cl.id
      ORDER BY cl.display_order ASC, cl.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({
      success: true,
      curatedLists: result.rows
    });
  } catch (error) {
    console.error("[curatedListController.getCuratedLists] error:", error);
    res.status(500).json({ error: "Failed to fetch curated lists" });
  }
};

/**
 * Create a new curated list (Admin)
 * POST /admin/curated-lists
 */
const createCuratedList = async (req, res) => {
  try {
    const { title, subtitle, cover_url, display_order = 0, is_active = true } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const query = `
      INSERT INTO curated_lists (title, subtitle, cover_url, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      title.trim(),
      subtitle ? subtitle.trim() : null,
      cover_url || null,
      parseInt(display_order, 10) || 0,
      is_active !== false
    ]);

    res.status(201).json({
      success: true,
      curatedList: result.rows[0]
    });
  } catch (error) {
    console.error("[curatedListController.createCuratedList] error:", error);
    res.status(500).json({ error: "Failed to create curated list" });
  }
};

/**
 * Get a single curated list with its events (Admin)
 * GET /admin/curated-lists/:id
 */
const getCuratedListById = async (req, res) => {
  try {
    const { id } = req.params;

    const listQuery = `
      SELECT * FROM curated_lists WHERE id = $1
    `;
    const listResult = await pool.query(listQuery, [id]);

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: "Curated list not found" });
    }

    const eventsQuery = `
      SELECT 
        cle.id as link_id,
        cle.display_order,
        e.id as event_id,
        e.title,
        e.banner_url,
        e.start_datetime,
        e.location_name,
        e.ticket_price,
        e.is_paid,
        c.name as community_name
      FROM curated_list_events cle
      JOIN events e ON cle.event_id = e.id
      LEFT JOIN communities c ON e.community_id = c.id
      WHERE cle.curated_list_id = $1
      ORDER BY cle.display_order ASC, cle.created_at ASC
    `;
    const eventsResult = await pool.query(eventsQuery, [id]);

    res.json({
      success: true,
      curatedList: {
        ...listResult.rows[0],
        events: eventsResult.rows
      }
    });
  } catch (error) {
    console.error("[curatedListController.getCuratedListById] error:", error);
    res.status(500).json({ error: "Failed to fetch curated list details" });
  }
};

/**
 * Update a curated list (Admin)
 * PATCH /admin/curated-lists/:id
 */
const updateCuratedList = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, cover_url, display_order, is_active } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(title.trim());
    }
    if (subtitle !== undefined) {
      updates.push(`subtitle = $${idx++}`);
      values.push(subtitle ? subtitle.trim() : null);
    }
    if (cover_url !== undefined) {
      updates.push(`cover_url = $${idx++}`);
      values.push(cover_url || null);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${idx++}`);
      values.push(parseInt(display_order, 10) || 0);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(Boolean(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
    const query = `
      UPDATE curated_lists
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Curated list not found" });
    }

    res.json({
      success: true,
      curatedList: result.rows[0]
    });
  } catch (error) {
    console.error("[curatedListController.updateCuratedList] error:", error);
    res.status(500).json({ error: "Failed to update curated list" });
  }
};

/**
 * Delete a curated list (Admin)
 * DELETE /admin/curated-lists/:id
 */
const deleteCuratedList = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM curated_lists WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Curated list not found" });
    }

    res.json({
      success: true,
      message: "Curated list deleted successfully"
    });
  } catch (error) {
    console.error("[curatedListController.deleteCuratedList] error:", error);
    res.status(500).json({ error: "Failed to delete curated list" });
  }
};

/**
 * Add event to a curated list (Admin)
 * POST /admin/curated-lists/:id/events
 */
const addEventToCuratedList = async (req, res) => {
  try {
    const { id } = req.params;
    const { event_id, display_order = 0 } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: "event_id is required" });
    }

    // Verify event exists
    const eventCheck = await pool.query("SELECT id, title FROM events WHERE id = $1", [event_id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const query = `
      INSERT INTO curated_list_events (curated_list_id, event_id, display_order)
      VALUES ($1, $2, $3)
      ON CONFLICT (curated_list_id, event_id) 
      DO UPDATE SET display_order = EXCLUDED.display_order
      RETURNING *
    `;
    const result = await pool.query(query, [id, event_id, parseInt(display_order, 10) || 0]);

    res.json({
      success: true,
      link: result.rows[0],
      event: eventCheck.rows[0]
    });
  } catch (error) {
    console.error("[curatedListController.addEventToCuratedList] error:", error);
    res.status(500).json({ error: "Failed to add event to curated list" });
  }
};

/**
 * Remove event from a curated list (Admin)
 * DELETE /admin/curated-lists/:id/events/:eventId
 */
const removeEventFromCuratedList = async (req, res) => {
  try {
    const { id, eventId } = req.params;

    const result = await pool.query(
      "DELETE FROM curated_list_events WHERE curated_list_id = $1 AND event_id = $2 RETURNING id",
      [id, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found in this curated list" });
    }

    res.json({
      success: true,
      message: "Event removed from curated list"
    });
  } catch (error) {
    console.error("[curatedListController.removeEventFromCuratedList] error:", error);
    res.status(500).json({ error: "Failed to remove event from curated list" });
  }
};

/**
 * Public endpoint to fetch a single curated list and its events
 * GET /curated-lists/:id
 */
const getPublicCuratedList = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const listQuery = `
      SELECT id, title, subtitle, cover_url as "coverUrl", display_order as "displayOrder"
      FROM curated_lists
      WHERE id = $1 AND is_active = true
    `;
    const listResult = await pool.query(listQuery, [id]);

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: "Curated list not found" });
    }

    const eventsQuery = `
      SELECT 
        e.id as "eventId",
        e.title,
        e.banner_url as "coverUrl",
        e.start_datetime as "startDatetime",
        e.end_datetime as "endDatetime",
        e.location_name as "locationName",
        e.event_type as "eventType",
        e.is_paid as "isPaid",
        e.ticket_price as "ticketPrice",
        c.name as "communityName",
        COALESCE((
          SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
        ), 0)::int as "attendeeCount",
        ${userId ? `EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = ${parseInt(userId, 10)})` : "false"} as "isInterested",
        CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree"
      FROM curated_list_events cle
      JOIN events e ON cle.event_id = e.id
      LEFT JOIN communities c ON e.community_id = c.id
      WHERE cle.curated_list_id = $1
        AND e.is_published = true
        AND (e.is_cancelled IS NOT TRUE)
      ORDER BY cle.display_order ASC, cle.created_at ASC
    `;
    const eventsResult = await pool.query(eventsQuery, [id]);

    res.json({
      success: true,
      curatedList: {
        ...listResult.rows[0],
        events: eventsResult.rows
      }
    });
  } catch (error) {
    console.error("[curatedListController.getPublicCuratedList] error:", error);
    res.status(500).json({ error: "Failed to fetch curated list" });
  }
};

module.exports = {
  getCuratedLists,
  createCuratedList,
  getCuratedListById,
  updateCuratedList,
  deleteCuratedList,
  addEventToCuratedList,
  removeEventFromCuratedList,
  getPublicCuratedList
};
