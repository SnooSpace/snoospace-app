const { createPool } = require("../config/db");
const { isValidGoogleMapsUrl } = require("../utils/googleMapsValidation");

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
      location_url,  // Changed from 'location'
      max_attendees,
      banner_carousel,  // Array of {url, cloudinary_public_id, order}
      gallery,  // Array of {url, cloudinary_public_id, order}
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

    if ((event_type === 'in-person' || event_type === 'hybrid') && !location_url) {
      return res.status(400).json({ error: "Google Maps link required for in-person/hybrid events" });
    }

    // Validate Google Maps URL format
    if (location_url && !isValidGoogleMapsUrl(location_url)) {
      return res.status(400).json({ error: "Invalid Google Maps URL. Please paste a valid link from Google Maps." });
    }

    // Insert event (use first banner as banner_url for backward compatibility)
    const banner_url = banner_carousel && banner_carousel.length > 0 ? banner_carousel[0].url : null;

    const query = `
      INSERT INTO events (
        community_id, title, description, start_datetime, end_datetime, location_url,
        max_attendees, banner_url, event_type, virtual_link, venue_id,
        creator_id, is_published, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `;

    const values = [
      userId, // community_id
      title,
      description || null,
      event_date,
      event_date, // end_datetime (same as start for now)
      location_url || null,  // Changed from location
      max_attendees || null,
      banner_url,
      event_type || 'in-person',
      virtual_link || null,
      venue_id || null,
      userId, // creator_id
      true // is_published
    ];

    const result = await pool.query(query, values);
    const eventId = result.rows[0].id;

    // Save banner carousel images
    if (banner_carousel && Array.isArray(banner_carousel) && banner_carousel.length > 0) {
      const bannerInserts = banner_carousel.map((banner, index) => 
        pool.query(
          `INSERT INTO event_banners (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
          [eventId, banner.url, banner.cloudinary_public_id || null, index]
        )
      );
      await Promise.all(bannerInserts);
    }

    // Save gallery images
    if (gallery && Array.isArray(gallery) && gallery.length > 0) {
      const galleryInserts = gallery.map((image, index) => 
        pool.query(
          `INSERT INTO event_gallery (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
          [eventId, image.url, image.cloudinary_public_id || null, index]
        )
      );
      await Promise.all(galleryInserts);
    }

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

// Get events created by a community (with all related data)
const getCommunityEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || userType !== 'community') {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get main events
    const eventsQuery = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.start_datetime as event_date,
        e.end_datetime,
        e.gates_open_time,
        e.schedule_description,
        e.location_url,
        e.max_attendees,
        e.categories,
        e.banner_url,
        e.cloudinary_banner_id,
        e.event_type,
        e.virtual_link,
        e.has_featured_accounts,
        e.is_editable,
        COALESCE(COUNT(DISTINCT er.member_id) FILTER (WHERE er.registration_status = 'registered'), 0) as current_attendees,
        (e.start_datetime < NOW()) as is_past,
        e.created_at
      FROM events e
      LEFT JOIN event_registrations er ON e.id = er.event_id
      WHERE e.creator_id = $1
      GROUP BY e.id
      ORDER BY e.start_datetime DESC
    `;
    
    const eventsResult = await pool.query(eventsQuery, [userId]);
    const events = eventsResult.rows;

    // For each event, fetch related data
    const eventsWithDetails = await Promise.all(events.map(async (event) => {
      const eventId = event.id;

      // Fetch gallery images
      const galleryResult = await pool.query(
        `SELECT id, image_url, cloudinary_public_id, image_order 
         FROM event_gallery 
         WHERE event_id = $1 
         ORDER BY image_order ASC`,
        [eventId]
      );

      // Fetch highlights
      const highlightsResult = await pool.query(
        `SELECT id, icon_name, title, description, highlight_order 
         FROM event_highlights 
         WHERE event_id = $1 
         ORDER BY highlight_order ASC`,
        [eventId]
      );

      // Fetch things to know
      const thingsToKnowResult = await pool.query(
        `SELECT id, preset_id, icon_name, label, item_order 
         FROM event_things_to_know 
         WHERE event_id = $1 
         ORDER BY item_order ASC`,
        [eventId]
      );

      // Fetch featured accounts with enriched data
      const featuredAccountsQuery = `
        SELECT 
          fa.id,
          fa.linked_account_id,
          fa.linked_account_type,
          fa.display_name,
          fa.role,
          fa.description,
          fa.profile_photo_url,
          fa.cloudinary_public_id,
          fa.display_order,
          -- Fetch data from linked accounts if applicable
          CASE 
            WHEN fa.linked_account_type = 'member' THEN m.name
            WHEN fa.linked_account_type = 'community' THEN c.name
            WHEN fa.linked_account_type = 'sponsor' THEN s.brand_name
            WHEN fa.linked_account_type = 'venue' THEN v.name
            ELSE fa.display_name
          END as account_name,
          CASE 
            WHEN fa.linked_account_type = 'member' THEN m.profile_photo_url
            WHEN fa.linked_account_type = 'community' THEN c.logo_url
            WHEN fa.linked_account_type = 'sponsor' THEN s.logo_url
            WHEN fa.linked_account_type = 'venue' THEN v.logo_url
            ELSE fa.profile_photo_url
          END as account_photo,
          CASE 
            WHEN fa.linked_account_type = 'member' THEN m.username
            WHEN fa.linked_account_type = 'community' THEN c.username
            WHEN fa.linked_account_type = 'sponsor' THEN s.username
            WHEN fa.linked_account_type = 'venue' THEN v.username
            ELSE NULL
          END as account_username
        FROM event_featured_accounts fa
        LEFT JOIN members m ON fa.linked_account_id = m.id AND fa.linked_account_type = 'member'
        LEFT JOIN communities c ON fa.linked_account_id = c.id AND fa.linked_account_type = 'community'
        LEFT JOIN sponsors s ON fa.linked_account_id = s.id AND fa.linked_account_type = 'sponsor'
        LEFT JOIN venues v ON fa.linked_account_id = v.id AND fa.linked_account_type = 'venue'
        WHERE fa.event_id = $1
        ORDER BY fa.display_order ASC
      `;
      const featuredAccountsResult = await pool.query(featuredAccountsQuery, [eventId]);

      return {
        ...event,
        gallery: galleryResult.rows,
        highlights: highlightsResult.rows,
        things_to_know: thingsToKnowResult.rows,
        featured_accounts: featuredAccountsResult.rows
      };
    }));
    
    res.json({
      success: true,
      events: eventsWithDetails
    });
  } catch (error) {
    console.error("Error getting community events:", error);
    res.status(500).json({ error: "Failed to get events" });
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
        e.location_url,
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
      GROUP BY e.id, e.title, e.description, e.event_date, e.location_url, e.max_attendees, e.is_past, c.name, v.name, er.registration_status
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

// Discover events for home feed (interspersed with posts)
// Returns upcoming public events prioritized by:
// 1. Events from communities user follows
// 2. Popular/trending events (by attendee count)
// 3. Recent events
const discoverEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { limit = 10, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Build query based on user type
    // For members: prioritize events from followed communities
    // For communities: show events from similar categories
    const query = `
      WITH followed_communities AS (
        SELECT following_id 
        FROM follows 
        WHERE follower_id = $1 
          AND follower_type = $2 
          AND following_type = 'community'
      ),
      event_scores AS (
        SELECT 
          e.id,
          e.title,
          e.description,
          e.start_datetime as event_date,
          e.end_datetime,
          e.location_url,
          e.max_attendees,
          e.banner_url,
          e.event_type,
          e.virtual_link,
          e.is_published,
          e.created_at,
          c.id as community_id,
          c.name as community_name,
          c.username as community_username,
          c.logo_url as community_logo,
          c.category as community_category,
          COALESCE(
            (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'),
            0
          ) as attendee_count,
          CASE WHEN fc.following_id IS NOT NULL THEN 1 ELSE 0 END as is_following_community,
          -- Score: following bonus + recency + popularity
          (CASE WHEN fc.following_id IS NOT NULL THEN 100 ELSE 0 END) +
          (EXTRACT(EPOCH FROM (NOW() - e.created_at)) / -86400)::int + -- Newer is better
          (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 2) as score
        FROM events e
        INNER JOIN communities c ON e.community_id = c.id
        LEFT JOIN followed_communities fc ON e.community_id = fc.following_id
        WHERE e.is_published = true
          AND e.start_datetime > NOW() -- Only future events
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT $3 OFFSET $4
      )
      SELECT * FROM event_scores
    `;

    const result = await pool.query(query, [userId, userType, parseInt(limit), parseInt(offset)]);

    // For each event, get banner carousel images
    const eventsWithBanners = await Promise.all(result.rows.map(async (event) => {
      const bannersResult = await pool.query(
        `SELECT image_url, cloudinary_public_id, image_order 
         FROM event_banners 
         WHERE event_id = $1 
         ORDER BY image_order ASC 
         LIMIT 3`,
        [event.id]
      );

      return {
        ...event,
        banner_carousel: bannersResult.rows,
        // Format for display
        formatted_date: new Date(event.event_date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }),
        formatted_time: new Date(event.event_date).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      };
    }));

    res.json({
      success: true,
      events: eventsWithBanners,
      hasMore: result.rows.length === parseInt(limit)
    });

  } catch (error) {
    console.error("Error discovering events:", error);
    res.status(500).json({ error: "Failed to discover events" });
  }
};

// Search events by query
const searchEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { q, limit = 20, offset = 0, upcoming_only = 'true' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        events: [],
        hasMore: false
      });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const upcomingFilter = upcoming_only === 'true' ? 'AND e.start_datetime > NOW()' : '';

    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.start_datetime as event_date,
        e.end_datetime,
        e.location_url,
        e.max_attendees,
        e.banner_url,
        e.event_type,
        e.virtual_link,
        e.is_published,
        e.created_at,
        c.id as community_id,
        c.name as community_name,
        c.username as community_username,
        c.logo_url as community_logo,
        c.category as community_category,
        COALESCE(
          (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'),
          0
        ) as attendee_count,
        'event' as type
      FROM events e
      INNER JOIN communities c ON e.community_id = c.id
      WHERE e.is_published = true
        ${upcomingFilter}
        AND (
          LOWER(e.title) LIKE $1
          OR LOWER(e.description) LIKE $1
          OR LOWER(c.name) LIKE $1
          OR LOWER(c.username) LIKE $1
        )
      ORDER BY e.start_datetime ASC
      LIMIT $2 OFFSET $3
    `;

    console.log('[searchEvents] Query:', query);
    console.log('[searchEvents] Params:', { searchTerm, limit: parseInt(limit), offset: parseInt(offset) });

    const result = await pool.query(query, [searchTerm, parseInt(limit), parseInt(offset)]);
    
    console.log('[searchEvents] Found', result.rows.length, 'events');

    // Format events for display
    const events = result.rows.map(event => ({
      ...event,
      formatted_date: new Date(event.event_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      formatted_time: new Date(event.event_date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }));

    res.json({
      success: true,
      events,
      hasMore: result.rows.length === parseInt(limit)
    });

  } catch (error) {
    console.error("Error searching events:", error);
    res.status(500).json({ error: "Failed to search events" });
  }
};

/**
 * Update an existing event
 * Notifies registered attendees if key details change
 */
const updateEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { eventId } = req.params;

    // Only communities can edit events
    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: "Only communities can edit events" });
    }

    // Verify event exists and belongs to this community
    const existingResult = await pool.query(
      'SELECT * FROM events WHERE id = $1 AND creator_id = $2',
      [eventId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found or you don't have permission to edit it" });
    }

    const existingEvent = existingResult.rows[0];

    const {
      title,
      description,
      event_date,
      end_datetime,
      location_url,
      max_attendees,
      banner_carousel,
      gallery,
      event_type,
      virtual_link,
      venue_id,
      is_published
    } = req.body;

    // Validate Google Maps URL if provided
    if (location_url && !isValidGoogleMapsUrl(location_url)) {
      return res.status(400).json({ error: "Invalid Google Maps URL" });
    }

    // Track which key fields changed (for notifications)
    const changedFields = [];
    
    if (title && title !== existingEvent.title) {
      changedFields.push('title');
    }
    if (event_date && new Date(event_date).getTime() !== new Date(existingEvent.start_datetime).getTime()) {
      changedFields.push('date');
    }
    if (location_url && location_url !== existingEvent.location_url) {
      changedFields.push('location');
    }
    if (event_type && event_type !== existingEvent.event_type) {
      changedFields.push('event_type');
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (event_date !== undefined) {
      updates.push(`start_datetime = $${paramIndex++}`);
      values.push(event_date);
    }
    if (end_datetime !== undefined) {
      updates.push(`end_datetime = $${paramIndex++}`);
      values.push(end_datetime);
    }
    if (location_url !== undefined) {
      updates.push(`location_url = $${paramIndex++}`);
      values.push(location_url);
    }
    if (max_attendees !== undefined) {
      updates.push(`max_attendees = $${paramIndex++}`);
      values.push(max_attendees);
    }
    if (event_type !== undefined) {
      updates.push(`event_type = $${paramIndex++}`);
      values.push(event_type);
    }
    if (virtual_link !== undefined) {
      updates.push(`virtual_link = $${paramIndex++}`);
      values.push(virtual_link);
    }
    if (venue_id !== undefined) {
      updates.push(`venue_id = $${paramIndex++}`);
      values.push(venue_id);
    }
    if (is_published !== undefined) {
      updates.push(`is_published = $${paramIndex++}`);
      values.push(is_published);
    }

    // Update banner_url if new carousel provided
    if (banner_carousel && banner_carousel.length > 0) {
      updates.push(`banner_url = $${paramIndex++}`);
      values.push(banner_carousel[0].url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add event ID as last parameter
    values.push(eventId);
    
    const updateQuery = `
      UPDATE events 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    // Update banner carousel if provided
    if (banner_carousel && Array.isArray(banner_carousel)) {
      // Delete existing banners
      await pool.query('DELETE FROM event_banners WHERE event_id = $1', [eventId]);
      
      // Insert new banners
      if (banner_carousel.length > 0) {
        const bannerInserts = banner_carousel.map((banner, index) =>
          pool.query(
            `INSERT INTO event_banners (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
            [eventId, banner.url, banner.cloudinary_public_id || null, index]
          )
        );
        await Promise.all(bannerInserts);
      }
    }

    // Update gallery if provided
    if (gallery && Array.isArray(gallery)) {
      // Delete existing gallery
      await pool.query('DELETE FROM event_gallery WHERE event_id = $1', [eventId]);
      
      // Insert new gallery
      if (gallery.length > 0) {
        const galleryInserts = gallery.map((image, index) =>
          pool.query(
            `INSERT INTO event_gallery (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
            [eventId, image.url, image.cloudinary_public_id || null, index]
          )
        );
        await Promise.all(galleryInserts);
      }
    }

    // Notify registered attendees if key fields changed
    if (changedFields.length > 0) {
      // Get community name for notification
      const communityResult = await pool.query(
        'SELECT name FROM communities WHERE id = $1',
        [userId]
      );
      const communityName = communityResult.rows[0]?.name || 'Community';

      // Get all registered attendees
      const attendeesResult = await pool.query(
        `SELECT member_id FROM event_registrations 
         WHERE event_id = $1 AND registration_status = 'registered'`,
        [eventId]
      );

      // Create notification for each attendee
      const notificationPayload = JSON.stringify({
        event_id: parseInt(eventId),
        event_title: title || existingEvent.title,
        changed_fields: changedFields,
        community_name: communityName
      });

      const notificationPromises = attendeesResult.rows.map(attendee =>
        pool.query(
          `INSERT INTO notifications (
            recipient_id, recipient_type, actor_id, actor_type, 
            type, payload, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
          [
            attendee.member_id,
            'member',
            userId,
            'community',
            'event_updated',
            notificationPayload
          ]
        )
      );

      await Promise.all(notificationPromises);
      
      console.log(`[Event Update] Notified ${attendeesResult.rows.length} attendees about changes to event ${eventId}`);
    }

    res.json({
      success: true,
      event: result.rows[0],
      changedFields,
      notifiedAttendees: changedFields.length > 0 ? 
        (await pool.query('SELECT COUNT(*) FROM event_registrations WHERE event_id = $1', [eventId])).rows[0].count : 0,
      message: "Event updated successfully"
    });

  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
};

module.exports = {
  createEvent,
  getCommunityEvents,
  getMyEvents,
  getEventAttendees,
  recordSwipe,
  getEventMatches,
  requestNextEvent,
  discoverEvents,
  searchEvents,
  updateEvent
};

