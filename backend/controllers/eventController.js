const { createPool } = require("../config/db");
const { isValidGoogleMapsUrl } = require("../utils/googleMapsValidation");

const pool = createPool();

// Create a new event
const createEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Only communities can create events
    if (!userId || userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can create events" });
    }

    const {
      title,
      description,
      event_date,
      location_url, // Changed from 'location'
      max_attendees,
      banner_carousel, // Array of {url, cloudinary_public_id, order}
      gallery, // Array of {url, cloudinary_public_id, order}
      event_type,
      virtual_link,
      venue_id,
      highlights, // Array of {icon_name, title, description}
      featured_accounts, // Array of {display_name, role, description, profile_photo_url, ...}
      things_to_know, // Array of {icon_name, label, preset_id}
      ticket_price, // Legacy: single ticket price (null = free)
      ticket_types, // Array of {name, description, base_price, total_quantity, ...}
      discount_codes, // Array of {code, discount_type, discount_value, max_uses, ...}
      pricing_rules, // Array of {name, rule_type, discount_type, discount_value, ...}
    } = req.body;

    // Validation
    if (!title || !event_date) {
      return res
        .status(400)
        .json({ error: "Title and event date are required" });
    }

    if (event_type === "virtual" && !virtual_link) {
      return res
        .status(400)
        .json({ error: "Virtual link required for virtual events" });
    }

    if (
      (event_type === "in-person" || event_type === "hybrid") &&
      !location_url
    ) {
      return res.status(400).json({
        error: "Google Maps link required for in-person/hybrid events",
      });
    }

    // Validate Google Maps URL format
    if (location_url && !isValidGoogleMapsUrl(location_url)) {
      return res.status(400).json({
        error:
          "Invalid Google Maps URL. Please paste a valid link from Google Maps.",
      });
    }

    // Insert event (use first banner as banner_url for backward compatibility)
    const banner_url =
      banner_carousel && banner_carousel.length > 0
        ? banner_carousel[0].url
        : null;

    const query = `
      INSERT INTO events (
        community_id, title, description, start_datetime, end_datetime, location_url,
        max_attendees, banner_url, event_type, virtual_link, venue_id,
        creator_id, is_published, ticket_price, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *
    `;

    const values = [
      userId, // community_id
      title,
      description || null,
      event_date,
      event_date, // end_datetime (same as start for now)
      location_url || null, // Changed from location
      max_attendees || null,
      banner_url,
      event_type || "in-person",
      virtual_link || null,
      venue_id || null,
      userId, // creator_id
      true, // is_published
      ticket_price || null, // Ticket price
    ];

    const result = await pool.query(query, values);
    const eventId = result.rows[0].id;

    // Save banner carousel images
    if (
      banner_carousel &&
      Array.isArray(banner_carousel) &&
      banner_carousel.length > 0
    ) {
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

    // Save highlights
    if (highlights && Array.isArray(highlights) && highlights.length > 0) {
      const highlightInserts = highlights.map((highlight, index) =>
        pool.query(
          `INSERT INTO event_highlights (event_id, icon_name, title, description, highlight_order) VALUES ($1, $2, $3, $4, $5)`,
          [
            eventId,
            highlight.icon_name || "star",
            highlight.title,
            highlight.description || null,
            index,
          ]
        )
      );
      await Promise.all(highlightInserts);
    }

    // Save featured accounts
    if (
      featured_accounts &&
      Array.isArray(featured_accounts) &&
      featured_accounts.length > 0
    ) {
      const featuredInserts = featured_accounts.map((account, index) =>
        pool.query(
          `INSERT INTO event_featured_accounts (
            event_id, linked_account_id, linked_account_type, display_name, 
            role, description, profile_photo_url, cloudinary_public_id, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            eventId,
            account.linked_account_id || null,
            account.linked_account_type || null,
            account.display_name,
            account.role || null,
            account.description || null,
            account.profile_photo_url || null,
            account.cloudinary_public_id || null,
            index,
          ]
        )
      );
      await Promise.all(featuredInserts);
    }

    // Save things to know
    if (
      things_to_know &&
      Array.isArray(things_to_know) &&
      things_to_know.length > 0
    ) {
      const thingsInserts = things_to_know.map((item, index) =>
        pool.query(
          `INSERT INTO event_things_to_know (event_id, preset_id, icon_name, label, item_order) VALUES ($1, $2, $3, $4, $5)`,
          [
            eventId,
            item.preset_id || null,
            item.icon_name || "information-circle",
            item.label,
            index,
          ]
        )
      );
      await Promise.all(thingsInserts);
    }

    // Save ticket types (multi-tier pricing)
    if (
      ticket_types &&
      Array.isArray(ticket_types) &&
      ticket_types.length > 0
    ) {
      const ticketInserts = ticket_types.map((ticket, index) =>
        pool.query(
          `INSERT INTO ticket_types (
            event_id, name, description, base_price, total_quantity,
            sale_start_at, sale_end_at, visibility, access_code,
            min_per_order, max_per_order, max_per_user, refund_policy,
            display_order, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            eventId,
            ticket.name,
            ticket.description || null,
            ticket.base_price || 0,
            ticket.total_quantity || null,
            ticket.sale_start_at || null,
            ticket.sale_end_at || null,
            ticket.visibility || "public",
            ticket.access_code || null,
            ticket.min_per_order || 1,
            ticket.max_per_order || 10,
            ticket.max_per_user || null,
            JSON.stringify(
              ticket.refund_policy || {
                allowed: true,
                deadline_hours_before: 24,
                percentage: 100,
              }
            ),
            index,
            ticket.is_active !== false,
          ]
        )
      );
      await Promise.all(ticketInserts);
    }

    // Save discount codes
    if (
      discount_codes &&
      Array.isArray(discount_codes) &&
      discount_codes.length > 0
    ) {
      const codeInserts = discount_codes.map((dc) =>
        pool.query(
          `INSERT INTO discount_codes (
            event_id, code, code_normalized, discount_type, discount_value,
            max_uses, max_uses_per_user, valid_from, valid_until,
            min_cart_value, applicable_ticket_ids, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            eventId,
            dc.code,
            dc.code.toUpperCase().trim(),
            dc.discount_type || "percentage",
            dc.discount_value,
            dc.max_uses || null,
            dc.max_uses_per_user || 1,
            dc.valid_from || null,
            dc.valid_until || null,
            dc.min_cart_value || null,
            dc.applicable_ticket_ids || null,
            dc.is_active !== false,
          ]
        )
      );
      await Promise.all(codeInserts);
    }

    // Save pricing rules (early bird, group discounts)
    if (
      pricing_rules &&
      Array.isArray(pricing_rules) &&
      pricing_rules.length > 0
    ) {
      const ruleInserts = pricing_rules.map((rule) =>
        pool.query(
          `INSERT INTO pricing_rules (
            event_id, ticket_type_id, name, rule_type, discount_type, discount_value,
            quantity_threshold, min_quantity, valid_from, valid_until, priority, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            eventId,
            rule.ticket_type_id || null,
            rule.name,
            rule.rule_type,
            rule.discount_type || "percentage",
            rule.discount_value,
            rule.quantity_threshold || null,
            rule.min_quantity || null,
            rule.valid_from || null,
            rule.valid_until || null,
            rule.priority || 100,
            rule.is_active !== false,
          ]
        )
      );
      await Promise.all(ruleInserts);
    }

    // Save discover categories (for Discover Feed)
    const { categories } = req.body;
    if (categories && Array.isArray(categories) && categories.length > 0) {
      const categoryInserts = categories.map((categoryId) =>
        pool.query(
          `INSERT INTO event_discover_categories (event_id, category_id, is_featured) 
           VALUES ($1, $2, false)
           ON CONFLICT (event_id, category_id) DO NOTHING`,
          [eventId, categoryId]
        )
      );
      await Promise.all(categoryInserts);
    }

    res.status(201).json({
      success: true,
      event: result.rows[0],
      message: "Event created successfully",
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
    if (!userId || userType !== "community") {
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
        e.is_cancelled,
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
    const eventsWithDetails = await Promise.all(
      events.map(async (event) => {
        const eventId = event.id;

        // Fetch gallery images
        const galleryResult = await pool.query(
          `SELECT id, image_url, cloudinary_public_id, image_order 
         FROM event_gallery 
         WHERE event_id = $1 
         ORDER BY image_order ASC`,
          [eventId]
        );

        // Fetch banner carousel images
        const bannerResult = await pool.query(
          `SELECT id, image_url, cloudinary_public_id, image_order 
         FROM event_banners 
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
        const featuredAccountsResult = await pool.query(featuredAccountsQuery, [
          eventId,
        ]);

        // Debug: Log what we're returning for this event
        console.log(
          `[getCommunityEvents] Event ${event.id} (${event.title}):`,
          {
            banner_count: bannerResult.rows.length,
            gallery_count: galleryResult.rows.length,
            highlights_count: highlightsResult.rows.length,
            things_to_know_count: thingsToKnowResult.rows.length,
            featured_accounts_count: featuredAccountsResult.rows.length,
          }
        );

        // Transform banner rows to match frontend expected format (url instead of image_url)
        const bannerCarousel = bannerResult.rows.map((b) => ({
          id: b.id,
          url: b.image_url,
          image_url: b.image_url,
          cloudinary_public_id: b.cloudinary_public_id,
          order: b.image_order,
        }));

        // Transform gallery rows to match frontend expected format
        const gallery = galleryResult.rows.map((g) => ({
          id: g.id,
          url: g.image_url,
          image_url: g.image_url,
          cloudinary_public_id: g.cloudinary_public_id,
          order: g.image_order,
        }));

        // Fetch ticket types
        const ticketTypesResult = await pool.query(
          `SELECT id, name, description, base_price, total_quantity, sold_count, reserved_count,
                sale_start_at, sale_end_at, visibility, access_code,
                min_per_order, max_per_order, max_per_user, refund_policy,
                display_order, is_active
         FROM ticket_types 
         WHERE event_id = $1
         ORDER BY display_order ASC`,
          [eventId]
        );

        // Fetch discount codes
        const discountCodesResult = await pool.query(
          `SELECT id, code, discount_type, discount_value, max_uses, current_uses,
                max_uses_per_user, valid_from, valid_until, min_cart_value,
                applicable_ticket_ids, is_active
         FROM discount_codes 
         WHERE event_id = $1
         ORDER BY created_at ASC`,
          [eventId]
        );

        // Fetch pricing rules
        const pricingRulesResult = await pool.query(
          `SELECT id, ticket_type_id, name, rule_type, discount_type, discount_value,
                quantity_threshold, min_quantity, valid_from, valid_until, priority, is_active
         FROM pricing_rules 
         WHERE event_id = $1
         ORDER BY priority ASC`,
          [eventId]
        );

        // Fetch categories (discover categories assigned to this event)
        const categoriesResult = await pool.query(
          `SELECT dc.id, dc.name, dc.slug, dc.icon_name, edc.is_featured, edc.display_order
           FROM event_discover_categories edc
           INNER JOIN discover_categories dc ON edc.category_id = dc.id
           WHERE edc.event_id = $1
           ORDER BY edc.display_order ASC`,
          [eventId]
        );

        return {
          ...event,
          banner_carousel: bannerCarousel,
          gallery: gallery,
          highlights: highlightsResult.rows,
          things_to_know: thingsToKnowResult.rows,
          featured_accounts: featuredAccountsResult.rows,
          ticket_types: ticketTypesResult.rows,
          discount_codes: discountCodesResult.rows,
          pricing_rules: pricingRulesResult.rows,
          categories: categoriesResult.rows,
        };
      })
    );

    res.json({
      success: true,
      events: eventsWithDetails,
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

    if (!userId || userType !== "member") {
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
      events: result.rows,
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

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      "SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2",
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not registered for this event" });
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
    const attendees = result.rows.map((attendee) => {
      const birthDate = new Date(attendee.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      return {
        ...attendee,
        age,
        photos:
          attendee.photos.length > 0
            ? attendee.photos
            : [
                {
                  id: 1,
                  photo_url:
                    attendee.profile_photo_url ||
                    "https://via.placeholder.com/300",
                  photo_order: 0,
                },
              ],
      };
    });

    res.json({
      success: true,
      attendees,
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

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (
      !swiped_id ||
      !swipe_direction ||
      !["left", "right"].includes(swipe_direction)
    ) {
      return res.status(400).json({ error: "Invalid swipe data" });
    }

    if (userId === swiped_id) {
      return res.status(400).json({ error: "Cannot swipe on yourself" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      "SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2",
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not registered for this event" });
    }

    // Check if already swiped on this person
    const existingSwipe = await pool.query(
      "SELECT id FROM event_swipes WHERE event_id = $1 AND swiper_id = $2 AND swiped_id = $3",
      [eventId, userId, swiped_id]
    );

    if (existingSwipe.rows.length > 0) {
      return res.status(400).json({ error: "Already swiped on this person" });
    }

    // Record the swipe
    await pool.query(
      "INSERT INTO event_swipes (event_id, swiper_id, swiped_id, swipe_direction) VALUES ($1, $2, $3, $4)",
      [eventId, userId, swiped_id, swipe_direction]
    );

    let isMatch = false;
    let matchData = null;

    // If it's a right swipe, check for mutual like
    if (swipe_direction === "right") {
      const mutualSwipe = await pool.query(
        "SELECT id FROM event_swipes WHERE event_id = $1 AND swiper_id = $2 AND swiped_id = $3 AND swipe_direction = $4",
        [eventId, swiped_id, userId, "right"]
      );

      if (mutualSwipe.rows.length > 0) {
        // It's a match! Create match record
        const member1Id = Math.min(userId, swiped_id);
        const member2Id = Math.max(userId, swiped_id);

        await pool.query(
          "INSERT INTO event_matches (event_id, member1_id, member2_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
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

        const matchResult = await pool.query(matchQuery, [
          member1Id,
          member2Id,
        ]);
        matchData = matchResult.rows[0];
        isMatch = true;
      }
    }

    res.json({
      success: true,
      isMatch,
      matchData,
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

    if (!userId || userType !== "member") {
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
      matches: result.rows,
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

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!requested_id) {
      return res.status(400).json({ error: "Requested member ID is required" });
    }

    if (userId === requested_id) {
      return res
        .status(400)
        .json({ error: "Cannot request next event with yourself" });
    }

    // Check if user is registered for this event
    const registrationCheck = await pool.query(
      "SELECT id FROM event_registrations WHERE event_id = $1 AND member_id = $2",
      [eventId, userId]
    );

    if (registrationCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not registered for this event" });
    }

    // Check if already sent a request
    const existingRequest = await pool.query(
      "SELECT id FROM next_event_requests WHERE current_event_id = $1 AND requester_id = $2 AND requested_id = $3",
      [eventId, userId, requested_id]
    );

    if (existingRequest.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Request already sent to this member" });
    }

    // Create the request
    const result = await pool.query(
      "INSERT INTO next_event_requests (requester_id, requested_id, current_event_id, message) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, requested_id, eventId, message || null]
    );

    res.json({
      success: true,
      requestId: result.rows[0].id,
      message: "Next event request sent successfully",
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
          AND (e.is_cancelled = false OR e.is_cancelled IS NULL) -- Exclude cancelled events
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT $3 OFFSET $4
      )
      SELECT * FROM event_scores
    `;

    const result = await pool.query(query, [
      userId,
      userType,
      parseInt(limit),
      parseInt(offset),
    ]);

    // For each event, get banner carousel images
    const eventsWithBanners = await Promise.all(
      result.rows.map(async (event) => {
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
          formatted_date: new Date(event.event_date).toLocaleDateString(
            "en-US",
            {
              weekday: "short",
              month: "short",
              day: "numeric",
            }
          ),
          formatted_time: new Date(event.event_date).toLocaleTimeString(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }
          ),
        };
      })
    );

    res.json({
      success: true,
      events: eventsWithBanners,
      hasMore: result.rows.length === parseInt(limit),
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
    const { q, limit = 20, offset = 0, upcoming_only = "true" } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        events: [],
        hasMore: false,
      });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;
    const upcomingFilter =
      upcoming_only === "true" ? "AND e.start_datetime > NOW()" : "";

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

    console.log("[searchEvents] Query:", query);
    console.log("[searchEvents] Params:", {
      searchTerm,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const result = await pool.query(query, [
      searchTerm,
      parseInt(limit),
      parseInt(offset),
    ]);

    console.log("[searchEvents] Found", result.rows.length, "events");

    // Format events for display
    const events = result.rows.map((event) => ({
      ...event,
      formatted_date: new Date(event.event_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      formatted_time: new Date(event.event_date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    }));

    res.json({
      success: true,
      events,
      hasMore: result.rows.length === parseInt(limit),
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
    if (!userId || userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can edit events" });
    }

    // Verify event exists and belongs to this community
    const existingResult = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND creator_id = $2",
      [eventId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Event not found or you don't have permission to edit it",
      });
    }

    const existingEvent = existingResult.rows[0];

    const {
      title,
      description,
      event_date,
      start_datetime,
      end_datetime,
      gates_open_time,
      location_url,
      max_attendees,
      banner_carousel,
      gallery,
      event_type,
      virtual_link,
      venue_id,
      is_published,
      highlights,
      featured_accounts,
      things_to_know,
      ticket_types, // Array of ticket type objects
      discount_codes, // Array of discount code objects
      pricing_rules, // Array of pricing rule objects
      categories, // Array of discover category IDs
    } = req.body;

    // Validate Google Maps URL if provided
    if (location_url && !isValidGoogleMapsUrl(location_url)) {
      return res.status(400).json({ error: "Invalid Google Maps URL" });
    }

    // Track which key fields changed (for notifications)
    const changedFields = [];

    if (title && title !== existingEvent.title) {
      changedFields.push("title");
    }
    if (
      event_date &&
      new Date(event_date).getTime() !==
        new Date(existingEvent.start_datetime).getTime()
    ) {
      changedFields.push("date");
    }
    if (location_url && location_url !== existingEvent.location_url) {
      changedFields.push("location");
    }
    if (event_type && event_type !== existingEvent.event_type) {
      changedFields.push("event_type");
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
    if (gates_open_time !== undefined) {
      updates.push(`gates_open_time = $${paramIndex++}`);
      values.push(gates_open_time);
    }
    if (start_datetime !== undefined) {
      updates.push(`start_datetime = $${paramIndex++}`);
      values.push(start_datetime);
    }
    // Note: highlights, featured_accounts, things_to_know are in separate tables
    // They are updated after the main query below

    // Update banner_url if new carousel provided
    if (banner_carousel && banner_carousel.length > 0) {
      updates.push(`banner_url = $${paramIndex++}`);
      values.push(banner_carousel[0].url);
    }

    if (
      updates.length === 0 &&
      !banner_carousel &&
      !gallery &&
      !highlights &&
      !featured_accounts &&
      !things_to_know
    ) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add event ID as last parameter
    values.push(eventId);

    const updateQuery = `
      UPDATE events 
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    // Update banner carousel if provided
    if (banner_carousel && Array.isArray(banner_carousel)) {
      console.log(
        `[updateEvent] Saving ${banner_carousel.length} banners for event ${eventId}`
      );
      if (banner_carousel.length > 0) {
        console.log(
          `[updateEvent] First banner:`,
          JSON.stringify(banner_carousel[0])
        );
      }
      // Delete existing banners
      await pool.query("DELETE FROM event_banners WHERE event_id = $1", [
        eventId,
      ]);

      // Insert new banners
      if (banner_carousel.length > 0) {
        const bannerInserts = banner_carousel.map((banner, index) => {
          // Support multiple possible field names from frontend
          const imageUrl = banner.url || banner.image_url || banner.secure_url;
          console.log(
            `[updateEvent] Banner ${index}: resolved URL = ${
              imageUrl ? imageUrl.substring(0, 50) + "..." : "NULL"
            }`
          );
          return pool.query(
            `INSERT INTO event_banners (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
            [
              eventId,
              imageUrl,
              banner.cloudinary_public_id || banner.public_id || null,
              index,
            ]
          );
        });
        await Promise.all(bannerInserts);
        console.log(
          `[updateEvent] Successfully saved ${banner_carousel.length} banners`
        );
      }
    }

    // Update gallery if provided
    if (gallery && Array.isArray(gallery)) {
      console.log(
        `[updateEvent] Saving ${gallery.length} gallery images for event ${eventId}`
      );
      if (gallery.length > 0) {
        console.log(
          `[updateEvent] First gallery image:`,
          JSON.stringify(gallery[0])
        );
      }
      // Delete existing gallery
      await pool.query("DELETE FROM event_gallery WHERE event_id = $1", [
        eventId,
      ]);

      // Insert new gallery
      if (gallery.length > 0) {
        const galleryInserts = gallery.map((image, index) => {
          // Support multiple possible field names from frontend
          const imageUrl = image.url || image.image_url || image.secure_url;
          console.log(
            `[updateEvent] Gallery ${index}: resolved URL = ${
              imageUrl ? imageUrl.substring(0, 50) + "..." : "NULL"
            }`
          );
          return pool.query(
            `INSERT INTO event_gallery (event_id, image_url, cloudinary_public_id, image_order) VALUES ($1, $2, $3, $4)`,
            [
              eventId,
              imageUrl,
              image.cloudinary_public_id || image.public_id || null,
              index,
            ]
          );
        });
        await Promise.all(galleryInserts);
        console.log(
          `[updateEvent] Successfully saved ${gallery.length} gallery images`
        );
      }
    }

    // Update highlights if provided
    if (highlights && Array.isArray(highlights)) {
      console.log(
        `[updateEvent] Saving ${highlights.length} highlights for event ${eventId}`
      );
      await pool.query("DELETE FROM event_highlights WHERE event_id = $1", [
        eventId,
      ]);
      if (highlights.length > 0) {
        const highlightInserts = highlights.map((h, index) =>
          pool.query(
            `INSERT INTO event_highlights (event_id, icon_name, title, description, highlight_order) VALUES ($1, $2, $3, $4, $5)`,
            [
              eventId,
              h.icon_name || "star",
              h.title,
              h.description || null,
              index,
            ]
          )
        );
        await Promise.all(highlightInserts);
        console.log(
          `[updateEvent] Successfully saved ${highlights.length} highlights`
        );
      }
    }

    // Update things_to_know if provided
    if (things_to_know && Array.isArray(things_to_know)) {
      console.log(
        `[updateEvent] Saving ${things_to_know.length} things_to_know for event ${eventId}`
      );
      await pool.query("DELETE FROM event_things_to_know WHERE event_id = $1", [
        eventId,
      ]);
      if (things_to_know.length > 0) {
        const thingsInserts = things_to_know.map((item, index) =>
          pool.query(
            `INSERT INTO event_things_to_know (event_id, icon_name, label, preset_id, item_order) VALUES ($1, $2, $3, $4, $5)`,
            [
              eventId,
              item.icon_name || "information-circle-outline",
              item.label,
              item.preset_id || null,
              index,
            ]
          )
        );
        await Promise.all(thingsInserts);
      }
    }

    // Update featured_accounts if provided
    if (featured_accounts && Array.isArray(featured_accounts)) {
      await pool.query(
        "DELETE FROM event_featured_accounts WHERE event_id = $1",
        [eventId]
      );
      if (featured_accounts.length > 0) {
        const accountInserts = featured_accounts.map((acc, index) =>
          pool.query(
            `INSERT INTO event_featured_accounts (
              event_id, display_name, role, description, profile_photo_url, 
              linked_account_type, linked_account_id, display_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              eventId,
              acc.display_name || acc.account_name,
              acc.role,
              acc.description || null,
              acc.profile_photo_url || acc.account_photo || null,
              acc.linked_account_type || null,
              acc.linked_account_id || null,
              index,
            ]
          )
        );
        await Promise.all(accountInserts);
      }
    }

    // Update ticket_types if provided
    if (ticket_types && Array.isArray(ticket_types)) {
      console.log(
        `[updateEvent] Saving ${ticket_types.length} ticket types for event ${eventId}`
      );

      // Delete existing ticket types
      await pool.query("DELETE FROM ticket_types WHERE event_id = $1", [
        eventId,
      ]);

      // Insert new ticket types
      if (ticket_types.length > 0) {
        const ticketInserts = ticket_types.map((ticket, index) =>
          pool.query(
            `INSERT INTO ticket_types (
              event_id, name, description, base_price, total_quantity,
              sale_start_at, sale_end_at, visibility, access_code,
              min_per_order, max_per_order, max_per_user, refund_policy,
              display_order, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              eventId,
              ticket.name,
              ticket.description || null,
              ticket.base_price || 0,
              ticket.total_quantity || null,
              ticket.sale_start_at || null,
              ticket.sale_end_at || null,
              ticket.visibility || "public",
              ticket.access_code || null,
              ticket.min_per_order || 1,
              ticket.max_per_order || 10,
              ticket.max_per_user || null,
              JSON.stringify(
                ticket.refund_policy || {
                  allowed: true,
                  deadline_hours_before: 24,
                  percentage: 100,
                }
              ),
              index,
              ticket.is_active !== false,
            ]
          )
        );
        await Promise.all(ticketInserts);
        console.log(
          `[updateEvent] Successfully saved ${ticket_types.length} ticket types`
        );
      }
    }

    // Update discount_codes if provided
    if (discount_codes && Array.isArray(discount_codes)) {
      console.log(
        `[updateEvent] Saving ${discount_codes.length} discount codes for event ${eventId}`
      );

      await pool.query("DELETE FROM discount_codes WHERE event_id = $1", [
        eventId,
      ]);

      if (discount_codes.length > 0) {
        const codeInserts = discount_codes.map((dc) =>
          pool.query(
            `INSERT INTO discount_codes (
              event_id, code, code_normalized, discount_type, discount_value,
              max_uses, max_uses_per_user, valid_from, valid_until,
              min_cart_value, applicable_ticket_ids, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              eventId,
              dc.code,
              dc.code.toUpperCase().trim(),
              dc.discount_type || "percentage",
              dc.discount_value,
              dc.max_uses || null,
              dc.max_uses_per_user || 1,
              dc.valid_from || null,
              dc.valid_until || null,
              dc.min_cart_value || null,
              dc.applicable_ticket_ids || null,
              dc.is_active !== false,
            ]
          )
        );
        await Promise.all(codeInserts);
        console.log(
          `[updateEvent] Successfully saved ${discount_codes.length} discount codes`
        );
      }
    }

    // Update pricing_rules if provided
    if (pricing_rules && Array.isArray(pricing_rules)) {
      console.log(
        `[updateEvent] Saving ${pricing_rules.length} pricing rules for event ${eventId}`
      );

      await pool.query("DELETE FROM pricing_rules WHERE event_id = $1", [
        eventId,
      ]);

      if (pricing_rules.length > 0) {
        const ruleInserts = pricing_rules.map((rule) =>
          pool.query(
            `INSERT INTO pricing_rules (
              event_id, ticket_type_id, name, rule_type, discount_type, discount_value,
              quantity_threshold, min_quantity, valid_from, valid_until, priority, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              eventId,
              rule.ticket_type_id || null,
              rule.name,
              rule.rule_type,
              rule.discount_type || "percentage",
              rule.discount_value,
              rule.quantity_threshold || null,
              rule.min_quantity || null,
              rule.valid_from || null,
              rule.valid_until || null,
              rule.priority || 100,
              rule.is_active !== false,
            ]
          )
        );
        await Promise.all(ruleInserts);
        console.log(
          `[updateEvent] Successfully saved ${pricing_rules.length} pricing rules`
        );
      }
    }

    // Update discover categories if provided
    if (categories && Array.isArray(categories)) {
      console.log(
        `[updateEvent] Saving ${categories.length} discover categories for event ${eventId}`
      );

      // Delete existing category assignments
      await pool.query(
        "DELETE FROM event_discover_categories WHERE event_id = $1",
        [eventId]
      );

      // Insert new category assignments
      if (categories.length > 0) {
        const categoryInserts = categories.map((categoryId) =>
          pool.query(
            `INSERT INTO event_discover_categories (event_id, category_id, is_featured) 
             VALUES ($1, $2, false)
             ON CONFLICT (event_id, category_id) DO NOTHING`,
            [eventId, categoryId]
          )
        );
        await Promise.all(categoryInserts);
        console.log(
          `[updateEvent] Successfully saved ${categories.length} discover categories`
        );
      }
    }

    // Notify registered attendees if key fields changed
    if (changedFields.length > 0) {
      // Get community name for notification
      const communityResult = await pool.query(
        "SELECT name FROM communities WHERE id = $1",
        [userId]
      );
      const communityName = communityResult.rows[0]?.name || "Community";

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
        community_name: communityName,
      });

      const notificationPromises = attendeesResult.rows.map((attendee) =>
        pool.query(
          `INSERT INTO notifications (
            recipient_id, recipient_type, actor_id, actor_type, 
            type, payload, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
          [
            attendee.member_id,
            "member",
            userId,
            "community",
            "event_updated",
            notificationPayload,
          ]
        )
      );

      await Promise.all(notificationPromises);

      console.log(
        `[Event Update] Notified ${attendeesResult.rows.length} attendees about changes to event ${eventId}`
      );
    }

    res.json({
      success: true,
      event: result.rows[0],
      changedFields,
      notifiedAttendees:
        changedFields.length > 0
          ? (
              await pool.query(
                "SELECT COUNT(*) FROM event_registrations WHERE event_id = $1",
                [eventId]
              )
            ).rows[0].count
          : 0,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
};

/**
 * Get single event by ID with all details
 */
const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Get main event data with community info
    const eventQuery = `
      SELECT 
        e.*,
        c.name as community_name,
        c.logo_url as community_logo,
        c.id as community_id,
        COALESCE(COUNT(DISTINCT er.member_id) FILTER (WHERE er.registration_status = 'registered'), 0) as attendee_count,
        (SELECT COUNT(*) FROM events WHERE creator_id = e.creator_id) as community_events_count
      FROM events e
      LEFT JOIN communities c ON e.creator_id = c.id
      LEFT JOIN event_registrations er ON e.id = er.event_id
      WHERE e.id = $1
      GROUP BY e.id, c.id
    `;

    const eventResult = await pool.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventResult.rows[0];

    // Fetch banners
    const bannersResult = await pool.query(
      `SELECT id, image_url, cloudinary_public_id, image_order 
       FROM event_banners 
       WHERE event_id = $1 
       ORDER BY image_order ASC`,
      [eventId]
    );

    // Fetch gallery
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
    const thingsResult = await pool.query(
      `SELECT id, preset_id, icon_name, label, item_order 
       FROM event_things_to_know 
       WHERE event_id = $1 
       ORDER BY item_order ASC`,
      [eventId]
    );

    // Fetch featured accounts with linked data
    const featuredQuery = `
      SELECT 
        fa.id,
        fa.linked_account_id,
        fa.linked_account_type,
        fa.display_name,
        fa.role,
        fa.description,
        fa.profile_photo_url,
        fa.display_order,
        CASE 
          WHEN fa.linked_account_type = 'member' THEN m.name
          WHEN fa.linked_account_type = 'community' THEN c.name
          WHEN fa.linked_account_type = 'sponsor' THEN s.brand_name
          ELSE fa.display_name
        END as account_name,
        CASE 
          WHEN fa.linked_account_type = 'member' THEN m.profile_photo_url
          WHEN fa.linked_account_type = 'community' THEN c.logo_url
          WHEN fa.linked_account_type = 'sponsor' THEN s.logo_url
          ELSE fa.profile_photo_url
        END as account_photo
      FROM event_featured_accounts fa
      LEFT JOIN members m ON fa.linked_account_id = m.id AND fa.linked_account_type = 'member'
      LEFT JOIN communities c ON fa.linked_account_id = c.id AND fa.linked_account_type = 'community'
      LEFT JOIN sponsors s ON fa.linked_account_id = s.id AND fa.linked_account_type = 'sponsor'
      WHERE fa.event_id = $1
      ORDER BY fa.display_order ASC
    `;
    const featuredResult = await pool.query(featuredQuery, [eventId]);

    // Fetch community heads (only if creator_id exists)
    let headsResult = { rows: [] };
    if (event.creator_id) {
      headsResult = await pool.query(
        `SELECT id, name, profile_pic_url, email, is_primary, member_id
         FROM community_heads 
         WHERE community_id = $1
         ORDER BY is_primary DESC, id ASC`,
        [event.creator_id]
      );
    }

    // Fetch ticket types
    const ticketTypesResult = await pool.query(
      `SELECT id, name, description, base_price, total_quantity, sold_count, reserved_count,
              sale_start_at, sale_end_at, visibility, access_code,
              min_per_order, max_per_order, max_per_user, refund_policy,
              display_order, is_active
       FROM ticket_types 
       WHERE event_id = $1 AND is_active = true
       ORDER BY display_order ASC`,
      [eventId]
    );

    // Transform banner and gallery data to include `url` field for frontend compatibility
    const bannerCarousel = bannersResult.rows.map((b) => ({
      id: b.id,
      url: b.image_url,
      image_url: b.image_url,
      cloudinary_public_id: b.cloudinary_public_id,
      order: b.image_order,
    }));

    const gallery = galleryResult.rows.map((g) => ({
      id: g.id,
      url: g.image_url,
      image_url: g.image_url,
      cloudinary_public_id: g.cloudinary_public_id,
      order: g.image_order,
    }));

    // Fetch discount codes
    const discountCodesResult = await pool.query(
      `SELECT id, code, discount_type, discount_value, max_uses, current_uses,
              max_uses_per_user, valid_from, valid_until, min_cart_value,
              applicable_ticket_ids, is_active
       FROM discount_codes 
       WHERE event_id = $1
       ORDER BY created_at ASC`,
      [eventId]
    );

    // Fetch pricing rules
    const pricingRulesResult = await pool.query(
      `SELECT id, ticket_type_id, name, rule_type, discount_type, discount_value,
              quantity_threshold, min_quantity, valid_from, valid_until, priority, is_active
       FROM pricing_rules 
       WHERE event_id = $1
       ORDER BY priority ASC`,
      [eventId]
    );

    // Fetch discover categories
    const categoriesResult = await pool.query(
      `SELECT dc.name 
       FROM event_discover_categories edc
       JOIN discover_categories dc ON edc.category_id = dc.id
       WHERE edc.event_id = $1
       ORDER BY dc.name ASC`,
      [eventId]
    );
    const categories = categoriesResult.rows.map((c) => c.name);

    console.log(`[getEventById] Event ${eventId}:`, {
      banner_count: bannerCarousel.length,
      gallery_count: gallery.length,
      highlights_count: highlightsResult.rows.length,
      things_to_know_count: thingsResult.rows.length,
      featured_accounts_count: featuredResult.rows.length,
      community_heads_count: headsResult.rows.length,
      ticket_types_count: ticketTypesResult.rows.length,
      discount_codes_count: discountCodesResult.rows.length,
      pricing_rules_count: pricingRulesResult.rows.length,
      categories_count: categories.length,
    });

    // Check if current user has bookmarked this event (members only)
    let isInterested = false;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (userId && userType === "member") {
      const interestCheck = await pool.query(
        "SELECT id FROM event_interests WHERE event_id = $1 AND member_id = $2",
        [eventId, userId]
      );
      isInterested = interestCheck.rows.length > 0;
    }

    res.json({
      success: true,
      event: {
        ...event,
        banner_carousel: bannerCarousel,
        gallery: gallery,
        highlights: highlightsResult.rows,
        things_to_know: thingsResult.rows,
        featured_accounts: featuredResult.rows,
        community_heads: headsResult.rows,
        ticket_types: ticketTypesResult.rows,
        discount_codes: discountCodesResult.rows,
        pricing_rules: pricingRulesResult.rows,
        categories: categories,
        is_interested: isInterested,
      },
    });
  } catch (error) {
    console.error("Error getting event:", error);
    res.status(500).json({ error: "Failed to get event" });
  }
};

/**
 * Delete an event permanently
 * Only the community that created the event can delete it
 * If event has registered attendees, only allow deletion after event date has passed
 */
const deleteEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { eventId } = req.params;

    // Only communities can delete events
    if (!userId || userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can delete events" });
    }

    // Verify event exists and belongs to this community
    const eventResult = await pool.query(
      `SELECT e.id, e.title, e.start_datetime, e.end_datetime, e.creator_id,
              (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as attendee_count
       FROM events e
       WHERE e.id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventResult.rows[0];

    // Check ownership - ensure both are compared as integers
    const creatorId = parseInt(event.creator_id);
    const requestUserId = parseInt(userId);

    console.log(
      `[deleteEvent] Checking ownership: creator_id=${creatorId}, userId=${requestUserId}, userType=${userType}`
    );

    if (creatorId !== requestUserId) {
      console.log(
        `[deleteEvent] Permission denied: creator_id (${creatorId}) !== userId (${requestUserId})`
      );
      return res.status(403).json({
        error: "You don't have permission to delete this event",
      });
    }

    // If event has registered attendees, only allow deletion after event date has passed
    const now = new Date();
    const eventEndDate = new Date(event.end_datetime || event.start_datetime);
    const hasAttendees = parseInt(event.attendee_count) > 0;

    if (hasAttendees && eventEndDate > now) {
      return res.status(400).json({
        error:
          "Cannot delete an upcoming event with registered attendees. Please cancel the event instead, or wait until after the event date has passed.",
        attendee_count: parseInt(event.attendee_count),
        event_end_datetime: event.end_datetime,
      });
    }

    // Get Cloudinary public IDs for cleanup (optional - don't fail if not present)
    let cloudinaryIds = [];
    try {
      const bannersResult = await pool.query(
        "SELECT cloudinary_public_id FROM event_banners WHERE event_id = $1 AND cloudinary_public_id IS NOT NULL",
        [eventId]
      );
      const galleryResult = await pool.query(
        "SELECT cloudinary_public_id FROM event_gallery WHERE event_id = $1 AND cloudinary_public_id IS NOT NULL",
        [eventId]
      );
      cloudinaryIds = [
        ...bannersResult.rows.map((r) => r.cloudinary_public_id),
        ...galleryResult.rows.map((r) => r.cloudinary_public_id),
      ];
    } catch (err) {
      console.warn(
        "[deleteEvent] Could not fetch Cloudinary IDs for cleanup:",
        err.message
      );
    }

    // Delete all related data (order matters for foreign key constraints)
    // Not using transaction so that missing tables don't abort the entire operation
    const deleteQueries = [
      "DELETE FROM event_registrations WHERE event_id = $1",
      "DELETE FROM event_swipes WHERE event_id = $1",
      "DELETE FROM event_matches WHERE event_id = $1",
      "DELETE FROM next_event_requests WHERE current_event_id = $1",
      "DELETE FROM pricing_rules WHERE event_id = $1",
      "DELETE FROM discount_codes WHERE event_id = $1",
      "DELETE FROM ticket_types WHERE event_id = $1",
      "DELETE FROM event_categories WHERE event_id = $1",
      "DELETE FROM event_discover_categories WHERE event_id = $1",
      "DELETE FROM event_highlights WHERE event_id = $1",
      "DELETE FROM event_things_to_know WHERE event_id = $1",
      "DELETE FROM event_featured_accounts WHERE event_id = $1",
      "DELETE FROM event_gallery WHERE event_id = $1",
      "DELETE FROM event_banners WHERE event_id = $1",
    ];

    for (const query of deleteQueries) {
      try {
        await pool.query(query, [eventId]);
      } catch (err) {
        // Table may not exist, continue
        console.warn(
          `[deleteEvent] Query failed (non-critical): ${query} - ${err.message}`
        );
      }
    }

    // Delete the event itself
    await pool.query("DELETE FROM events WHERE id = $1", [eventId]);

    // TODO: Clean up Cloudinary images in background (non-blocking)
    if (cloudinaryIds.length > 0) {
      console.log(
        `[deleteEvent] Would delete ${cloudinaryIds.length} Cloudinary images (cleanup not implemented)`
      );
    }

    console.log(
      `[deleteEvent] Event "${event.title}" (ID: ${eventId}) deleted by community ${userId}`
    );

    res.json({
      success: true,
      message: `Event "${event.title}" has been permanently deleted`,
      eventId: parseInt(eventId),
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
};

/**
 * Cancel an event (soft delete)
 * Sets is_cancelled = true and notifies all registered attendees
 * Only the community that created the event can cancel it
 */
const cancelEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { eventId } = req.params;

    // Only communities can cancel events
    if (!userId || userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can cancel events" });
    }

    // Verify event exists, belongs to this community, and is not already cancelled
    const eventResult = await pool.query(
      `SELECT e.id, e.title, e.start_datetime, e.end_datetime, e.is_cancelled, e.creator_id,
              c.name as community_name, c.logo_url as community_logo
       FROM events e
       LEFT JOIN communities c ON e.creator_id = c.id
       WHERE e.id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventResult.rows[0];

    // Check ownership - ensure both are compared as integers
    const creatorId = parseInt(event.creator_id);
    const requestUserId = parseInt(userId);

    if (creatorId !== requestUserId) {
      return res.status(403).json({
        error: "You don't have permission to cancel this event",
      });
    }

    // Check if already cancelled
    if (event.is_cancelled) {
      return res.status(400).json({ error: "Event is already cancelled" });
    }

    // Check if event is in the past
    const now = new Date();
    const eventEndDate = new Date(event.end_datetime || event.start_datetime);
    if (eventEndDate < now) {
      return res.status(400).json({ error: "Cannot cancel a past event" });
    }

    // Update event to cancelled
    await pool.query(
      `UPDATE events SET is_cancelled = true, updated_at = NOW() WHERE id = $1`,
      [eventId]
    );

    // Get all registered attendees
    const attendeesResult = await pool.query(
      `SELECT er.member_id, m.name as member_name
       FROM event_registrations er
       JOIN members m ON er.member_id = m.id
       WHERE er.event_id = $1 AND er.registration_status = 'registered'`,
      [eventId]
    );

    const attendees = attendeesResult.rows;
    console.log(
      `[cancelEvent] Notifying ${attendees.length} attendees about cancellation of event ${eventId}`
    );

    // Create in-app notifications for all attendees
    const notificationPayload = JSON.stringify({
      event_id: parseInt(eventId),
      event_title: event.title,
      community_name: event.community_name,
      community_logo: event.community_logo,
      event_date: event.start_datetime,
    });

    const notificationPromises = attendees.map((attendee) =>
      pool.query(
        `INSERT INTO notifications (
          recipient_id, recipient_type, actor_id, actor_type, 
          type, payload, is_read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [
          attendee.member_id,
          "member",
          userId,
          "community",
          "event_cancelled",
          notificationPayload,
        ]
      )
    );

    await Promise.all(notificationPromises);

    // Send push notifications to attendees (if push tokens exist)
    try {
      const pushTokensResult = await pool.query(
        `SELECT pt.expo_push_token, er.member_id
         FROM push_tokens pt
         JOIN event_registrations er ON pt.user_id = er.member_id AND pt.user_type = 'member'
         WHERE er.event_id = $1 AND er.registration_status = 'registered' AND pt.is_active = true`,
        [eventId]
      );

      if (pushTokensResult.rows.length > 0) {
        // Log for now - actual push implementation would use Expo Push API
        console.log(
          `[cancelEvent] Would send ${pushTokensResult.rows.length} push notifications`
        );
        // TODO: Implement actual Expo push notification sending
        // const messages = pushTokensResult.rows.map(row => ({
        //   to: row.expo_push_token,
        //   sound: 'default',
        //   title: 'Event Cancelled',
        //   body: `${event.community_name} has cancelled "${event.title}"`,
        //   data: { eventId, type: 'event_cancelled' },
        // }));
      }
    } catch (pushError) {
      console.warn(
        "[cancelEvent] Push notification query failed (non-critical):",
        pushError.message
      );
    }

    console.log(
      `[cancelEvent] Event "${event.title}" (ID: ${eventId}) cancelled by community ${userId}`
    );

    res.json({
      success: true,
      message: `Event "${event.title}" has been cancelled`,
      eventId: parseInt(eventId),
      notified_attendees: attendees.length,
    });
  } catch (error) {
    console.error("Error cancelling event:", error);
    res.status(500).json({ error: "Failed to cancel event" });
  }
};

/**
 * Toggle interest (bookmark) for an event
 * POST /events/:eventId/interest
 * Members only - toggles the interest status
 */
const toggleEventInterest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { eventId } = req.params;

    if (!userId || userType !== "member") {
      return res
        .status(403)
        .json({ error: "Only members can bookmark events" });
    }

    // Check if interest already exists
    const existingInterest = await pool.query(
      "SELECT id FROM event_interests WHERE event_id = $1 AND member_id = $2",
      [eventId, userId]
    );

    let isInterested;
    if (existingInterest.rows.length > 0) {
      // Remove interest
      await pool.query(
        "DELETE FROM event_interests WHERE event_id = $1 AND member_id = $2",
        [eventId, userId]
      );
      isInterested = false;
    } else {
      // Add interest
      await pool.query(
        "INSERT INTO event_interests (event_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [eventId, userId]
      );
      isInterested = true;
    }

    res.json({
      success: true,
      is_interested: isInterested,
    });
  } catch (error) {
    console.error("Error toggling event interest:", error);
    res.status(500).json({ error: "Failed to toggle interest" });
  }
};

/**
 * Get events user has marked as interested
 * GET /events/interested
 * Members only
 */
const getInterestedEvents = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res
        .status(403)
        .json({ error: "Only members can view interested events" });
    }

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
        e.is_cancelled,
        c.id as community_id,
        c.name as community_name,
        c.username as community_username,
        c.logo_url as community_logo,
        ei.created_at as interested_at
      FROM event_interests ei
      INNER JOIN events e ON ei.event_id = e.id
      INNER JOIN communities c ON e.community_id = c.id
      WHERE ei.member_id = $1
        AND e.is_published = true
        AND (e.is_cancelled = false OR e.is_cancelled IS NULL)
      ORDER BY e.start_datetime ASC
    `;

    const result = await pool.query(query, [userId]);

    // Format events for display
    const events = result.rows.map((event) => ({
      ...event,
      formatted_date: new Date(event.event_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      formatted_time: new Date(event.event_date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      is_past: new Date(event.event_date) < new Date(),
    }));

    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Error getting interested events:", error);
    res.status(500).json({ error: "Failed to get interested events" });
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
  updateEvent,
  getEventById,
  deleteEvent,
  cancelEvent,
  toggleEventInterest,
  getInterestedEvents,
};
