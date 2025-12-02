const { createPool } = require("../config/db");

const pool = createPool();

/**
 * Enhanced Create Event
 * Supports: gallery, highlights, things to know, featured accounts
 */
const createEvent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    // Only communities can create events
    if (!userId || userType !== 'community') {
      return res.status(403).json({ error: "Only communities can create events" });
    }

    const {
      // Basic info
      title,
      description,
      event_date,
      end_date,
      gates_open_time,
      schedule_description,
      location,
      max_attendees,
      categories,
      event_type,
      virtual_link,
      venue_id,
      
      // Media
      banner_carousel, // Array of {url, cloudinary_public_id, order}
      gallery, // Array of {url, cloudinary_public_id, order}
      
      // Content sections
      highlights, // Array of {icon_name, title, description, order}
      things_to_know, // Array of {preset_id?, icon_name, label, order}
      featured_accounts, // Array of {linked_account_id?, linked_account_type?, display_name?, role, description?, profile_photo_url?, cloudinary_public_id?, order}
    } = req.body;

    // Validation
    if (!title || !event_date) {
      return res.status(400).json({ error: "Title and event date are required" });
    }

    if (!description || description.length < 50) {
      return res.status(400).json({ error: "Description must be at least 50 characters" });
    }

    if (event_type === 'virtual' && !virtual_link) {
      return res.status(400).json({ error: "Virtual link required for virtual events" });
    }

    if ((event_type === 'in-person' || event_type === 'hybrid') && !location) {
      return res.status(400).json({ error: "Location required for in-person/hybrid events" });
    }

    if (!things_to_know || things_to_know.length < 3) {
      return res.status(400).json({ error: "At least 3 'Things to Know' items are required" });
    }

    if (banner_carousel && banner_carousel.length > 5) {
      return res.status(400).json({ error: "Maximum 5 banner images allowed" });
    }

    if (gallery && gallery.length > 20) {
      return res.status(400).json({ error: "Maximum 20 gallery images allowed" });
    }

    if (highlights && highlights.length > 5) {
      return res.status(400).json({ error: "Maximum 5 highlights allowed" });
    }

    // Start transaction
    await client.query('BEGIN');

    // 1. Insert main event
    const eventQuery = `
      INSERT INTO events (
        community_id, creator_id, title, description, 
        start_datetime, end_datetime, gates_open_time, schedule_description,
        location, max_attendees, categories, event_type, virtual_link, venue_id,
        banner_url, cloudinary_banner_id, 
        has_featured_accounts, is_published, is_editable, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      RETURNING *
    `;

    const primaryBanner = banner_carousel?.[0];
    const eventValues = [
      userId, // community_id
      userId, // creator_id
      title,
      description,
      event_date,
      end_date || event_date,
      gates_open_time || null,
      schedule_description || null,
      location || null,
      max_attendees || null,
      categories || null,
      event_type || 'in-person',
      virtual_link || null,
      venue_id || null,
      primaryBanner?.url || null,
      primaryBanner?.cloudinary_public_id || null,
      !!(featured_accounts && featured_accounts.length > 0),
      true, // is_published
      true  // is_editable
    ];

    const eventResult = await client.query(eventQuery, eventValues);
    const event = eventResult.rows[0];
    const eventId = event.id;

    // 2. Insert banner carousel (gallery images marked as banners)
    if (banner_carousel && banner_carousel.length > 0) {
      for (const [index, banner] of banner_carousel.entries()) {
        await client.query(
          `INSERT INTO event_gallery (event_id, image_url, cloudinary_public_id, image_order) 
           VALUES ($1, $2, $3, $4)`,
          [eventId, banner.url, banner.cloudinary_public_id || null, index]
        );
      }
    }

    // 3. Insert additional gallery images
    if (gallery && gallery.length > 0) {
      const startOrder = banner_carousel?.length || 0;
      for (const [index, image] of gallery.entries()) {
        await client.query(
          `INSERT INTO event_gallery (event_id, image_url, cloudinary_public_id, image_order) 
           VALUES ($1, $2, $3, $4)`,
          [eventId, image.url, image.cloudinary_public_id || null, startOrder + index]
        );
      }
    }

    // 4. Insert highlights
    if (highlights && highlights.length > 0) {
      for (const highlight of highlights) {
        await client.query(
          `INSERT INTO event_highlights (event_id, icon_name, title, description, highlight_order) 
           VALUES ($1, $2, $3, $4, $5)`,
          [eventId, highlight.icon_name, highlight.title, highlight.description || null, highlight.order || 0]
        );
      }
    }

    // 5. Insert things to know
    if (things_to_know && things_to_know.length > 0) {
      for (const item of things_to_know) {
        await client.query(
          `INSERT INTO event_things_to_know (event_id, preset_id, icon_name, label, item_order) 
           VALUES ($1, $2, $3, $4, $5)`,
          [eventId, item.preset_id || null, item.icon_name, item.label, item.order || 0]
        );
      }
    }

    // 6. Insert featured accounts
    if (featured_accounts && featured_accounts.length > 0) {
      for (const account of featured_accounts) {
        await client.query(
          `INSERT INTO event_featured_accounts (
            event_id, linked_account_id, linked_account_type, display_name, 
            role, description, profile_photo_url, cloudinary_public_id, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            eventId,
            account.linked_account_id || null,
            account.linked_account_type || null,
            account.display_name || null,
            account.role,
            account.description || null,
            account.profile_photo_url || null,
            account.cloudinary_public_id || null,
            account.order || 0
          ]
        );
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      event: {
        ...event,
        banner_count: banner_carousel?.length || 0,
        gallery_count: gallery?.length || 0,
        highlights_count: highlights?.length || 0,
        things_to_know_count: things_to_know?.length || 0,
        featured_accounts_count: featured_accounts?.length || 0
      },
      message: "Event created successfully"
    });

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Failed to create event", details: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  createEvent
};
