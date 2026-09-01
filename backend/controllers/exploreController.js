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
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          true as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree"
        FROM events e
        WHERE e.start_datetime <= NOW()
          AND e.end_datetime >= NOW()
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY e.start_datetime ASC
      `;
      const result = await pool.query(q, [userId]);
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
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
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
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
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
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
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
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $3) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
          ${scoreSql} as score
        FROM events e
        WHERE e.start_datetime >= $1
          AND e.start_datetime <= $2
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY score DESC, e.start_datetime ASC
        LIMIT 3
      `;
      const result = await pool.query(q, [start, end, userId]);
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

      // Pad up to 5 categories prioritizing those with active upcoming events
      if (activeSlugs.length < 5) {
        const defaultCatQuery = `
          SELECT dc.slug FROM discover_categories dc 
          WHERE dc.is_active = true 
          ORDER BY (
            CASE WHEN EXISTS (
              SELECT 1 FROM event_discover_categories edc
              INNER JOIN events e ON e.id = edc.event_id
              WHERE edc.category_id = dc.id
                AND e.start_datetime > NOW()
                AND e.is_published = true
                AND e.is_cancelled IS NOT TRUE
            ) THEN 1 ELSE 0 END
          ) DESC, dc.display_order ASC
        `;
        const defaultCatRes = await pool.query(defaultCatQuery);
        for (const r of defaultCatRes.rows) {
          if (!activeSlugs.includes(r.slug)) {
            activeSlugs.push(r.slug);
            if (activeSlugs.length >= 5) break;
          }
        }
      }

      if (activeSlugs.length === 0) return [];

      // Fetch category metadata and preserve priority order
      const catDetailsQuery = `
        SELECT id, name, slug FROM discover_categories 
        WHERE slug = ANY($1::text[]) AND is_active = true
      `;
      const catDetailsRes = await pool.query(catDetailsQuery, [activeSlugs]);
      if (catDetailsRes.rows.length === 0) return [];

      const catMap = new Map(catDetailsRes.rows.map(c => [c.slug, c]));
      const orderedCategories = activeSlugs
        .map(slug => catMap.get(slug))
        .filter(Boolean);

      if (orderedCategories.length === 0) return [];

      // Build VALUES(category_id, priority) clause
      const valuesClause = orderedCategories
        .map((cat, idx) => `(${parseInt(cat.id, 10)}, ${idx + 1})`)
        .join(", ");

      const eventsQuery = `
        SELECT DISTINCT ON (e.id)
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
          cp.category_id as "categoryId",
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount",
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
          ${scoreSql} as score
        FROM events e
        INNER JOIN event_discover_categories edc ON e.id = edc.event_id
        INNER JOIN (
          VALUES ${valuesClause}
        ) AS cp(category_id, priority) ON edc.category_id = cp.category_id
        WHERE e.start_datetime > NOW()
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
        ORDER BY e.id, cp.priority ASC, score DESC
      `;
      const eventsRes = await pool.query(eventsQuery, [userId]);

      // Group results in JS by category
      const categoryEventsMap = new Map();
      for (const cat of orderedCategories) {
        categoryEventsMap.set(String(cat.id), []);
      }

      for (const row of eventsRes.rows) {
        const list = categoryEventsMap.get(String(row.categoryId));
        if (list) {
          list.push({
            eventId: row.eventId,
            title: row.title,
            coverUrl: row.coverUrl,
            attendeeCount: row.attendeeCount,
            isInterested: Boolean(row.isInterested),
            spotsLeft: row.spotsLeft !== null ? Number(row.spotsLeft) : null,
            isLiveNow: Boolean(row.isLiveNow),
            isFree: Boolean(row.isFree),
            eventType: row.eventType || "in-person",
            score: Number(row.score) || 0,
            startDatetime: row.startDatetime
          });
        }
      }

      const rails = [];
      for (const cat of orderedCategories) {
        const events = categoryEventsMap.get(String(cat.id)) || [];
        if (events.length > 0) {
          // Sort by score DESC, then startDatetime ASC
          events.sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            const timeA = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
            const timeB = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
            return timeA - timeB;
          });

          const cappedEvents = events.slice(0, 10).map(({ startDatetime, ...rest }) => ({
            ...rest,
            startDatetime,
            category: cat.name,
            category_slug: cat.slug
          }));

          rails.push({
            category: cat.name,
            categorySlug: cat.slug,
            categoryColor: getCategoryColor(cat.slug, cat.id),
            events: cappedEvents
          });
        }
      }

      return rails;
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
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
          COALESCE((
            SELECT dc.name FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id AND edc.category_id = ANY($1::int[])
            ORDER BY edc.display_order ASC, dc.display_order ASC
            LIMIT 1
          ), 'General') as "categoryName",
          COALESCE((
            SELECT dc.slug FROM discover_categories dc 
            INNER JOIN event_discover_categories edc ON dc.id = edc.category_id 
            WHERE edc.event_id = e.id AND edc.category_id = ANY($1::int[])
            ORDER BY edc.display_order ASC, dc.display_order ASC
            LIMIT 1
          ), 'general') as "categorySlug",
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount",
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $3) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree"
        FROM events e
        LEFT JOIN communities c ON COALESCE(e.community_id, e.creator_id) = c.id
        WHERE EXISTS (
          SELECT 1 FROM event_discover_categories edc2
          WHERE edc2.event_id = e.id AND edc2.category_id = ANY($1::int[])
        )
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
      const result = await pool.query(q, [catIds, userCity, userId]);
      return result.rows;
    };

    // 6. Curated Lists
    const queryCuratedLists = async () => {
      try {
        const q = `
          SELECT 
            cl.id,
            cl.title,
            cl.subtitle,
            cl.cover_url as "coverUrl",
            cl.display_order as "displayOrder",
            COALESCE(
              json_agg(
                json_build_object(
                  'eventId', e.id,
                  'title', e.title,
                  'coverUrl', e.banner_url,
                  'startDatetime', e.start_datetime,
                  'eventType', e.event_type,
                  'isInterested', EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1),
                  'isFree', (e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL)
                ) ORDER BY cle.display_order ASC
              ) FILTER (WHERE e.id IS NOT NULL),
              '[]'::json
            ) as events
          FROM curated_lists cl
          LEFT JOIN curated_list_events cle ON cl.id = cle.curated_list_id
          LEFT JOIN events e ON cle.event_id = e.id AND e.is_published = true AND (e.is_cancelled IS NOT TRUE)
          WHERE cl.is_active = true
          GROUP BY cl.id, cl.title, cl.subtitle, cl.cover_url, cl.display_order
          ORDER BY cl.display_order ASC, cl.created_at DESC
        `;
        const result = await pool.query(q, [userId]);
        return result.rows;
      } catch (err) {
        console.warn("[exploreController.queryCuratedLists] error:", err.message);
        return [];
      }
    };

    // 7. Creator Opportunities
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

    // 0. Categories Quick-Nav (sorted by display_order)
    const queryCategories = async () => {
      const q = `
        SELECT 
          id, 
          name, 
          slug, 
          icon_name as "iconName", 
          display_order as "displayOrder"
        FROM discover_categories
        WHERE is_active = true
          AND (visible_from IS NULL OR visible_from <= NOW())
          AND (visible_until IS NULL OR visible_until >= NOW())
        ORDER BY display_order ASC, id ASC
      `;
      const res = await pool.query(q);
      return res.rows;
    };

    // 6. What's Hot on SnooSpace (Featured/Boosted + 48h Velocity Score)
    const queryWhatsHot = async () => {
      // Step A: Fetch manually boosted/featured events within active window
      const featuredQuery = `
        SELECT 
          e.id as "eventId", 
          e.title, 
          e.banner_url as "coverUrl",
          e.start_datetime as "startDatetime",
          e.event_type as "eventType",
          true as "isFeatured",
          COALESCE((
            SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
          ), 0)::int as "attendeeCount",
          EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
          CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
          CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
          CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
          ${scoreSql} as score
        FROM events e
        WHERE e.is_featured = true
          AND (e.featured_until IS NULL OR e.featured_until > NOW())
          AND e.start_datetime > NOW()
          AND (e.is_published = true OR e.is_published IS NULL)
          AND e.is_cancelled IS NOT TRUE
        ORDER BY e.featured_until ASC NULLS LAST, e.start_datetime ASC
        LIMIT 10
      `;
      const featuredRes = await pool.query(featuredQuery, [userId]);
      const featuredEvents = featuredRes.rows.map(r => ({
        ...r,
        spotsLeft: r.spotsLeft !== null ? Number(r.spotsLeft) : null,
        score: Number(r.score) || 0
      }));

      const featuredIds = featuredEvents.map(e => e.eventId);
      const remainingSlots = Math.max(0, 10 - featuredEvents.length);

      let velocityEvents = [];
      if (remainingSlots > 0) {
        const velocityQuery = `
          SELECT 
            e.id as "eventId", 
            e.title, 
            e.banner_url as "coverUrl",
            e.start_datetime as "startDatetime",
            e.event_type as "eventType",
            false as "isFeatured",
            COALESCE((
              SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'
            ), 0)::int as "attendeeCount",
            EXISTS (SELECT 1 FROM event_interests ei WHERE ei.event_id = e.id AND ei.member_id = $1) as "isInterested",
            CASE WHEN e.max_attendees IS NOT NULL THEN GREATEST(0, e.max_attendees - COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'), 0)::int) ELSE NULL END as "spotsLeft",
            CASE WHEN e.start_datetime <= NOW() AND (e.end_datetime >= NOW() OR e.end_datetime IS NULL) AND e.start_datetime >= NOW() - INTERVAL '4 hours' THEN true ELSE false END as "isLiveNow",
            CASE WHEN e.is_paid = false OR e.ticket_price = 0 OR e.ticket_price IS NULL THEN true ELSE false END as "isFree",
            (
              COALESCE((
                SELECT COUNT(*)::int * 3
                FROM event_registrations er
                WHERE er.event_id = e.id 
                  AND er.created_at >= NOW() - INTERVAL '48 hours'
                  AND er.registration_status IN ('registered', 'attended', 'confirmed')
              ), 0) +
              COALESCE((
                SELECT COUNT(*)::int * 1
                FROM event_interests ei
                WHERE ei.event_id = e.id 
                  AND ei.created_at >= NOW() - INTERVAL '48 hours'
              ), 0)
            ) as "velocityScore",
            ${scoreSql} as score
          FROM events e
          WHERE e.start_datetime > NOW()
            AND (e.is_published = true OR e.is_published IS NULL)
            AND e.is_cancelled IS NOT TRUE
            ${featuredIds.length > 0 ? `AND e.id != ALL($2::bigint[])` : ''}
          ORDER BY "velocityScore" DESC, score DESC, e.start_datetime ASC
          LIMIT $${featuredIds.length > 0 ? '3' : '2'}
        `;
        const params = featuredIds.length > 0 ? [userId, featuredIds, remainingSlots] : [userId, remainingSlots];
        const velocityRes = await pool.query(velocityQuery, params);
        velocityEvents = velocityRes.rows.map(r => ({
          ...r,
          spotsLeft: r.spotsLeft !== null ? Number(r.spotsLeft) : null,
          score: Number(r.score) || 0
        }));
      }

      return [...featuredEvents, ...velocityEvents];
    };

    const [categories, liveNow, hero, weekend, whatsHot, categoryRails, somethingDifferent, curatedLists, creatorOpportunities] = await Promise.all([
      queryCategories(),
      queryLiveNow(),
      queryHero(),
      queryWeekend(),
      queryWhatsHot(),
      queryCategoryRails(),
      querySomethingDifferent(),
      queryCuratedLists(),
      queryCreatorOpportunities()
    ]);

    // Cross-section deduplication for "Something Different"
    const existingEventIds = new Set();
    if (hero?.eventId) {
      existingEventIds.add(String(hero.eventId));
    }
    if (Array.isArray(liveNow)) {
      for (const item of liveNow) {
        if (item?.eventId) existingEventIds.add(String(item.eventId));
      }
    }
    if (Array.isArray(weekend)) {
      for (const item of weekend) {
        if (item?.eventId) existingEventIds.add(String(item.eventId));
      }
    }
    if (Array.isArray(whatsHot)) {
      for (const item of whatsHot) {
        if (item?.eventId) existingEventIds.add(String(item.eventId));
      }
    }
    if (Array.isArray(categoryRails)) {
      for (const rail of categoryRails) {
        if (Array.isArray(rail?.events)) {
          for (const event of rail.events) {
            if (event?.eventId) existingEventIds.add(String(event.eventId));
          }
        }
      }
    }

    const dedupedSomethingDifferent = (somethingDifferent || []).filter(
      (item) => item?.eventId && !existingEventIds.has(String(item.eventId))
    );

    res.json({
      success: true,
      categories: categories || [],
      liveNow,
      hero,
      weekend,
      whatsHot: whatsHot || [],
      categoryRails,
      somethingDifferent: dedupedSomethingDifferent,
      curatedLists: curatedLists || [],
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
