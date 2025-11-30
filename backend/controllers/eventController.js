const { createPool } = require("../config/db");

const pool = createPool();

// Create a new event
const createEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Only communities can create events
    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: "Only communities can create events" });
    }

    const {
      title,
      description,
      event_date,
      location,
      max_attendees,
      banner_url,
      event_type,
      virtual_link,
      venue_id
    } = req.body;

    // Validation
    if (!title || !event_date) {
      return res.status(400).json({ error: "Title and event date are required" });
    }

    if (event_type === 'virtual' && !virtual_link) {
      return res.status(400).json({ error: "Virtual link required for virtual events" });
    }

    if ((event_type === 'in-person' || event_type === 'hybrid') && !location) {
      return res.status(400).json({ error: "Location required for in-person/hybrid events" });
    }

    // Insert event
    const query = `
      INSERT INTO events (
        community_id, title, description, event_date, location,
        max_attendees, banner_url, event_type, virtual_link, venue_id,
        created_by, is_published, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
    `;

    const values = [
      userId, // community_id
      title,
      description || null,
      event_date,
      location || null,
      max_attendees || null,
      banner_url || null,
      event_type || 'in-person',
      virtual_link || null,
      venue_id || null,
      userId, // created_by
      true // is_published
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      event: result.rows[0],
      message: "Event created successfully"
    });

  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
};


// Get events user is registered for (both past and upcoming)
const getMyEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.location,
        e.max_attendees,
        e.is_past,
        c.name as community_name,
        v.name as venue_name,
        er.registration_status,
        COUNT(DISTINCT er2.member_id) as attendee_count
      FROM events e
      LEFT JOIN communities c ON e.community_id = c.id
      LEFT JOIN venues v ON e.venue_id = v.id
      INNER JOIN event_registrations er ON e.id = er.event_id AND er.member_id = $1
      LEFT JOIN event_registrations er2 ON e.id = er2.event_id AND er2.registration_status = 'attended'
      GROUP BY e.id, e.title, e.description, e.event_date, e.location, e.max_attendees, e.is_past, c.name, v.name, er.registration_status
      ORDER BY e.event_date DESC
    `;

    const result = await pool.query(query, [userId]);
    
    res.json({
      success: true,
      events: result.rows
    });

  } catch (error) {
    console.error("Error getting user events:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
};

// Get all attendees for an event with their photos
const getEventAttendees = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2',
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not registered for this event" });
    }

    // Get attendees with their photos and exclude the current user
    const query = `
      SELECT 
        m.id,
        m.name,
        m.dob,
        m.gender,
        m.city,
        m.bio,
        m.interests,
        m.profile_photo_url,
        m.username,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mp.id,
              'photo_url', mp.photo_url,
              'photo_order', mp.photo_order
            ) ORDER BY mp.photo_order
          ) FILTER (WHERE mp.id IS NOT NULL),
          '[]'::json
        ) as photos
      FROM event_registrations er
      INNER JOIN members m ON er.member_id = m.id
      LEFT JOIN member_photos mp ON m.id = mp.member_id
      WHERE er.event_id = $1 
        AND er.member_id != $2 
        AND er.registration_status = 'attended'
      GROUP BY m.id, m.name, m.dob, m.gender, m.city, m.bio, m.interests, m.profile_photo_url, m.username
      ORDER BY m.name
    `;

    const result = await pool.query(query, [eventId, userId]);
    
    // Calculate age for each member
    const attendees = result.rows.map(attendee => {
      const birthDate = new Date(attendee.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return {
        ...attendee,
        age,
        photos: attendee.photos.length > 0 ? attendee.photos : [
          { id: 1, photo_url: attendee.profile_photo_url || 'https://via.placeholder.com/300', photo_order: 0 }
        ]
      };
    });

    res.json({
      success: true,
      attendees
    });

  } catch (error) {
    console.error("Error getting event attendees:", error);
    res.status(500).json({ error: "Failed to get attendees" });
  }
};

// Record a swipe (left/right)
const recordSwipe = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { swiped_id, swipe_direction } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!swiped_id || !swipe_direction || !['left', 'right'].includes(swipe_direction)) {
      return res.status(400).json({ error: "Invalid swipe data" });
    }

    if (userId === swiped_id) {
      return res.status(400).json({ error: "Cannot swipe on yourself" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2',
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not registered for this event" });
    }

    // Check if already swiped on this person
    const existingSwipe = await pool.query(
      'SELECT id FROM event_swipes WHERE event_id = $1 AND swiper_id = $2 AND swiped_id = $3',
      [eventId, userId, swiped_id]
    );

    if (existingSwipe.rows.length > 0) {
      return res.status(400).json({ error: "Already swiped on this person" });
    }

    // Record the swipe
    await pool.query(
      'INSERT INTO event_swipes (event_id, swiper_id, swiped_id, swipe_direction) VALUES ($1, $2, $3, $4)',
      [eventId, userId, swiped_id, swipe_direction]
    );

    let isMatch = false;
    let matchData = null;

    // If it's a right swipe, check for mutual like
    if (swipe_direction === 'right') {
      const mutualSwipe = await pool.query(
        'SELECT id FROM event_swipes WHERE event_id = $1 AND swiper_id = $2 AND swiped_id = $3 AND swipe_direction = $4',
        [eventId, swiped_id, userId, 'right']
      );

      if (mutualSwipe.rows.length > 0) {
        // It's a match! Create match record
        const member1Id = Math.min(userId, swiped_id);
        const member2Id = Math.max(userId, swiped_id);
        
        await pool.query(
          'INSERT INTO event_matches (event_id, member1_id, member2_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [eventId, member1Id, member2Id]
        );

        // Get match data
        const matchQuery = `
          SELECT 
            m1.name as member1_name,
            m1.profile_photo_url as member1_photo,
            m2.name as member2_name,
            m2.profile_photo_url as member2_photo
          FROM members m1, members m2
          WHERE m1.id = $1 AND m2.id = $2
        `;
        
        const matchResult = await pool.query(matchQuery, [member1Id, member2Id]);
        matchData = matchResult.rows[0];
        isMatch = true;
      }
    }

    res.json({
      success: true,
      isMatch,
      matchData
    });

  } catch (error) {
    console.error("Error recording swipe:", error);
    res.status(500).json({ error: "Failed to record swipe" });
  }
};

// Get matches for an event
const getEventMatches = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    const query = `
      SELECT 
        em.id,
        em.match_date,
        CASE 
          WHEN em.member1_id = $1 THEN m2.id
          ELSE m1.id
        END as matched_member_id,
        CASE 
          WHEN em.member1_id = $1 THEN m2.name
          ELSE m1.name
        END as matched_member_name,
        CASE 
          WHEN em.member1_id = $1 THEN m2.profile_photo_url
          ELSE m1.profile_photo_url
        END as matched_member_photo,
        CASE 
          WHEN em.member1_id = $1 THEN m2.username
          ELSE m1.username
        END as matched_member_username
      FROM event_matches em
      INNER JOIN members m1 ON em.member1_id = m1.id
      INNER JOIN members m2 ON em.member2_id = m2.id
      WHERE em.event_id = $2 AND (em.member1_id = $1 OR em.member2_id = $1)
      ORDER BY em.match_date DESC
    `;

    const result = await pool.query(query, [userId, eventId]);
    
    res.json({
      success: true,
      matches: result.rows
    });

  } catch (error) {
    console.error("Error getting event matches:", error);
    res.status(500).json({ error: "Failed to get matches" });
  }
};

// Send next-event request to another member
const requestNextEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { requested_id, message } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== 'member') {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!requested_id) {
      return res.status(400).json({ error: "Requested member ID is required" });
    }

    if (userId === requested_id) {
      return res.status(400).json({ error: "Cannot request next event with yourself" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      'SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2',
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not registered for this event" });
    }

    // Check if already sent a request
    const existingRequest = await pool.query(
      'SELECT id FROM next_event_requests WHERE current_event_id = $1 AND requester_id = $2 AND requested_id = $3',
      [eventId, userId, requested_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: "Request already sent to this member" });
    }

    // Create the request
    const result = await pool.query(
      'INSERT INTO next_event_requests (requester_id, requested_id, current_event_id, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, requested_id, eventId, message || null]
    );

    res.json({
      success: true,
      requestId: result.rows[0].id,
      message: "Next event request sent successfully"
    });

  } catch (error) {
    console.error("Error sending next event request:", error);
    res.status(500).json({ error: "Failed to send request" });
  }
};

module.exports = {
  createEvent,
  getMyEvents,
  getEventAttendees,
  recordSwipe,
  getEventMatches,
  requestNextEvent
};
