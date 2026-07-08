const { getCategoryColor } = require("../utils/categoryColors");

let hasEnsuredColumns = false;

// Helper to compute local time weekend range
const getUpcomingWeekendRange = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0: Sunday, 1: Monday, ... 6: Saturday
  
  const friday = new Date(now);
  friday.setDate(now.getDate() - currentDay + 5);
  friday.setHours(18, 0, 0, 0);

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - currentDay + 7);
  sunday.setHours(23, 59, 59, 999);

  if (now > sunday) {
    friday.setDate(friday.getDate() + 7);
    sunday.setDate(sunday.getDate() + 7);
  }

  return { start: friday, end: sunday };
};

// SQL helper for personalisation score calculation
const getPersonalizationScoreSql = (userId) => {
  return `
    (
      CASE WHEN EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = ${userId} 
          AND f.follower_type = 'member' 
          AND f.following_id = COALESCE(e.community_id, e.creator_id) 
          AND f.following_type = 'community'
      ) THEN 10 ELSE 0 END +
      COALESCE((
        SELECT COUNT(*)::int * 5 
        FROM event_registrations er
        INNER JOIN circles c ON (c.user_a_id = ${userId} AND c.user_b_id = er.member_id) OR (c.user_b_id = ${userId} AND c.user_a_id = er.member_id)
        WHERE er.event_id = e.id 
          AND er.registration_status IN ('registered', 'attended', 'confirmed')
      ), 0) +
      COALESCE((
        SELECT COUNT(*)::int * 3
        FROM event_registrations er
        INNER JOIN creator_follows cf ON cf.follower_id = ${userId} AND cf.creator_id = er.member_id
        WHERE er.event_id = e.id 
          AND er.registration_status IN ('registered', 'attended', 'confirmed')
      ), 0)
    )
  `;
};

const getExploreFeed = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const pool = req.app.locals.pool;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!hasEnsuredColumns) {
      try {
        await pool.query(`
          ALTER TABLE members
            ADD COLUMN IF NOT EXISTS explore_banner_dismissed_at TIMESTAMPTZ
        `);
        hasEnsuredColumns = true;
      } catch (e) {
        console.warn("[exploreController] ensureExploreColumns warning:", e.message);
      }
    }

    // Get user's city
    const userLocResult = await pool.query(
      "SELECT location, is_creator_mode_enabled, explore_banner_dismissed_at FROM members WHERE id = $1",
      [userId]
    );
    const userLoc = userLocResult.rows[0]?.location || {};
    const userCity = userLoc.city || "Bangalore";
    const isCreator = !!userLocResult.rows[0]?.is_creator_mode_enabled;
    const bannerDismissedAt = userLocResult.rows[0]?.explore_banner_dismissed_at || null;

    const scoreSql = getPersonalizationScoreSql(userId);

    // 1. Live Now
    const queryLiveNow = async () => {
      const q = `
        SELECT e.id as "eventId", e.title, e.banner_url as "coverUrl"
        FROM events e
        WHERE e.start_datetime <= NOW()
          AND e.end_datetime >= NOW()
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY e.start_datetime ASC
      `;
      const result = await pool.query(q);
      return result.rows.map(row => ({
        ...row,
        title: row.title ? (row.title.length > 10 ? row.title.substring(0, 10) + "..." : row.title) : ""
      }));
    };

    // 2. Hero
    const queryHero = async () => {
      const q = `
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          e.start_datetime as "startTime",
          COALESCE((
            SELECT dc.name FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id LIMIT 1
          ), 'General') as category,
          COALESCE((
            SELECT dc.slug FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id LIMIT 1
          ), 'general') as category_slug,
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount",
          (
            SELECT COALESCE(json_agg(json_build_object('name', m2.name, 'profile_photo_url', m2.profile_photo_url)), '[]'::json)
            FROM (
              SELECT m3.name, m3.profile_photo_url
              FROM event_registrations er3
              INNER JOIN members m3 ON er3.member_id = m3.id
              WHERE er3.event_id = e.id AND er3.registration_status IN ('registered', 'attended', 'confirmed')
              ORDER BY (
                CASE WHEN EXISTS (
                  SELECT 1 FROM circles c
                  WHERE (c.user_a_id = $1 AND c.user_b_id = m3.id)
                     OR (c.user_b_id = $1 AND c.user_a_id = m3.id)
                ) THEN 1 ELSE 0 END
              ) DESC, er3.created_at DESC
              LIMIT 3
            ) m2
          ) as "attendeeAvatars",
          ${scoreSql} as score
        FROM events e
        WHERE e.start_datetime > NOW()
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT 1
      `;
      const result = await pool.query(q, [userId]);
      if (result.rows.length === 0) return null;
      return result.rows[0];
    };

    // 3. Weekend
    const queryWeekend = async () => {
      const { start, end } = getUpcomingWeekendRange();
      const q = `
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          COALESCE((
            SELECT dc.name FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id LIMIT 1
          ), 'General') as category,
          COALESCE((
            SELECT dc.slug FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id LIMIT 1
          ), 'general') as category_slug,
          ${scoreSql} as score
        FROM events e
        WHERE e.start_datetime >= $1
          AND e.start_datetime <= $2
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT 3
      `;
      const result = await pool.query(q, [start, end]);
      return result.rows;
    };

    // 4. Category Rails
    const queryCategoryRails = async () => {
      // Find top categories
      const topCatQuery = `
        SELECT category, raw_score 
        FROM user_interest_vectors 
        WHERE user_id = $1 
        ORDER BY raw_score DESC 
        LIMIT 5
      `;
      const topCatRes = await pool.query(topCatQuery, [userId]);
      let activeSlugs = topCatRes.rows.map(r => r.category);

      // Pad up to 5 categories using display order
      if (activeSlugs.length < 5) {
        const defaultCatQuery = `
          SELECT slug FROM discover_categories 
          WHERE is_active = true 
          ORDER BY display_order ASC
        `;
        const defaultCatRes = await pool.query(defaultCatQuery);
        for (const r of defaultCatRes.rows) {
          if (!activeSlugs.includes(r.slug)) {
            activeSlugs.push(r.slug);
            if (activeSlugs.length >= 5) break;
          }
        }
      }

      // Fetch rails in parallel
      const rails = await Promise.all(activeSlugs.map(async (slug) => {
        const catDetailsQuery = `
          SELECT id, name, slug FROM discover_categories 
          WHERE slug = $1 AND is_active = true LIMIT 1
        `;
        const catDetails = await pool.query(catDetailsQuery, [slug]);
        if (catDetails.rows.length === 0) return null;

        const categoryObj = catDetails.rows[0];
        const color = getCategoryColor(categoryObj.slug, categoryObj.id);

        const eventsQuery = `
          SELECT 
            e.id as "eventId", 
            e.title, 
            e.banner_url as "coverUrl",
            COALESCE((
              SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
            ), 0)::int as "attendeeCount",
            ${scoreSql} as score
          FROM events e
          INNER JOIN event_discover_categories edc ON e.id = edc.event_id
          WHERE edc.category_id = $1
            AND e.start_datetime > NOW()
            AND e.is_published = true
            AND e.is_cancelled IS NOT TRUE
          ORDER BY score DESC, e.start_datetime ASC
          LIMIT 10
        `;
        const eventsRes = await pool.query(eventsQuery, [categoryObj.id]);
        if (eventsRes.rows.length === 0) return null;

        return {
          category: categoryObj.name,
          categorySlug: categoryObj.slug,
          categoryColor: color,
          events: eventsRes.rows
        };
      }));

      // Filter out null/empty rails
      return rails.filter(Boolean);
    };

    // 5. Something Different
    const querySomethingDifferent = async () => {
      // Find low/no interaction category IDs
      const catQuery = `
        SELECT id, name, slug FROM discover_categories
        WHERE is_active = true
          AND slug NOT IN (
            SELECT category FROM user_interest_vectors
            WHERE user_id = $1 AND raw_score >= 1.0
          )
      `;
      const catRes = await pool.query(catQuery, [userId]);
      let catIds = catRes.rows.map(r => r.id);

      // Fallback to all active categories if none matches "low-interaction" filter
      if (catIds.length === 0) {
        const allActiveCatRes = await pool.query("SELECT id FROM discover_categories WHERE is_active = true");
        catIds = allActiveCatRes.rows.map(r => r.id);
      }

      if (catIds.length === 0) return [];

      const q = `
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount"
        FROM events e
        INNER JOIN event_discover_categories edc ON e.id = edc.event_id
        LEFT JOIN communities c ON COALESCE(e.community_id, e.creator_id) = c.id
        WHERE edc.category_id = ANY($1::int[])
          AND e.start_datetime > NOW()
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
          AND (
            LOWER(COALESCE(e.city, '')) = LOWER($2)
            OR LOWER(COALESCE(CASE WHEN c.location IS NOT NULL AND c.location != '' THEN c.location::jsonb ->> 'city' ELSE NULL END, '')) = LOWER($2)
          )
          AND (
            (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered') >= 3
            OR c.verification_status = 'approved'
          )
        ORDER BY e.start_datetime ASC
        LIMIT 10
      `;
      const result = await pool.query(q, [catIds, userCity]);
      return result.rows;
    };

    // 6. Creator Opportunities
    const queryCreatorOpportunities = async () => {
      if (!isCreator) return null;

      const q = `
        SELECT COUNT(*)::int as count FROM opportunities o
        LEFT JOIN creator_profiles cp ON cp.people_id = $1
        LEFT JOIN members m ON m.id = $1
        WHERE o.status = 'active'
          AND o.visibility = 'public'
          AND (o.expires_at IS NULL OR o.expires_at > NOW())
          AND ($2::timestamptz IS NULL OR o.created_at > $2::timestamptz)
          AND NOT EXISTS (
            SELECT 1 FROM opportunity_views ov
            WHERE ov.opportunity_id = o.id
              AND ov.viewer_id = $1
              AND ov.viewer_type = 'member'
          )
          AND (
            o.opportunity_types && cp.content_categories
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.interests, '[]'::jsonb)) AS user_interest
              WHERE user_interest = ANY(o.opportunity_types)
            )
          )
      `;
      const result = await pool.query(q, [userId, bannerDismissedAt]);
      const count = result.rows[0]?.count || 0;
      return count > 0 ? { count, hasUnviewed: true } : null;
    };

    const [liveNow, hero, weekend, categoryRails, somethingDifferent, creatorOpportunities] = await Promise.all([
      queryLiveNow(),
      queryHero(),
      queryWeekend(),
      queryCategoryRails(),
      querySomethingDifferent(),
      queryCreatorOpportunities()
    ]);

    res.json({
      success: true,
      liveNow,
      hero,
      weekend,
      categoryRails,
      somethingDifferent,
      creatorOpportunities
    });
  } catch (error) {
    console.error("Error getting explore feed:", error);
    res.status(500).json({ error: "Failed to get explore feed" });
  }
};

const dismissCreatorOpportunities = async (req, res) => {
  try {
    const userId = req.user?.id;
    const pool = req.app.locals.pool;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await pool.query(
      "UPDATE members SET explore_banner_dismissed_at = NOW() WHERE id = $1",
      [userId]
    );

    res.json({ success: true, message: "Banner dismissed successfully" });
  } catch (error) {
    console.error("Error dismissing opportunities banner:", error);
    res.status(500).json({ error: "Failed to dismiss opportunities banner" });
  }
};

module.exports = {
  getExploreFeed,
  dismissCreatorOpportunities
};
