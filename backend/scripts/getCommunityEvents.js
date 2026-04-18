// Get events created by a community
const getCommunityEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.start_datetime as event_date,
        e.end_datetime,
        e.location,
        e.max_attendees,
        e.banner_url,
        e.event_type,
        e.virtual_link,
        e.is_published,
        e.created_at,
        COUNT(DISTINCT er.member_id) FILTER (WHERE er.registration_status = 'registered') as current_attendees,
        (e.start_datetime < NOW()) as is_past
      FROM events e
      LEFT JOIN event_registrations er ON e.id = er.event_id
      WHERE e.creator_id = $1
      GROUP BY e.id
      ORDER BY e.start_datetime DESC
    `;

    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      events: result.rows
    });

  } catch (error) {
    console.error("Error getting community events:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
};

module.exports = {
  getCommunityEvents
};
