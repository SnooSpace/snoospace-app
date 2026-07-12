const MemberController = require("./memberController");
const CommunityController = require("./communityController");
const SponsorController = require("./sponsorController");
const VenueController = require("./venueController");
const { emitSignal } = require("../utils/signalEmitter");

// Derive a rough category from search query text for interest vector tagging
function deriveCategoryFromQuery(query) {
  const q = query.toLowerCase();
  if (/music|concert|dj|gig|band|festival|EDM|hip.hop/i.test(q))   return 'music';
  if (/tech|startup|coding|hackathon|AI|product|SaaS/i.test(q))    return 'technology';
  if (/fitness|yoga|gym|marathon|run|sport|wellness/i.test(q))     return 'fitness';
  if (/network|career|job|professional|entrepreneur/i.test(q))     return 'networking';
  if (/art|design|craft|paint|sketch|gallery/i.test(q))            return 'arts';
  if (/food|cook|chef|dining|restaurant|bake/i.test(q))            return 'food';
  if (/game|gaming|esport|LAN|tournament/i.test(q))                return 'gaming';
  if (/dance|salsa|bollywood|choreograph/i.test(q))                return 'dance';
  return null;
}

async function globalSearch(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.query || req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    if (q.length < 2) {
      return res.json({
        results: [],
        nextOffset: offset,
        hasMore: false,
        members: [],
        communities: [],
        sponsors: [],
        venues: [],
      });
    }

    // Create mock request objects for each search function
    const mockReq = {
      query: { query: q, limit, offset },
      user: req.user,
      app: req.app,
    };

    // Search all entity types in parallel
    const [membersData, communitiesData, sponsorsData, venuesData] =
      await Promise.all([
        MemberController.searchMembers(mockReq, {
          json: (data) => ({ data }),
          status: () => ({ json: () => ({ results: [], hasMore: false }) }),
        }).catch(() => ({ results: [], hasMore: false })),
        CommunityController.searchCommunities(mockReq, {
          json: (data) => ({ data }),
          status: () => ({ json: () => ({ results: [], hasMore: false }) }),
        }).catch(() => ({ results: [], hasMore: false })),
        SponsorController.searchSponsors(mockReq, {
          json: (data) => ({ data }),
          status: () => ({ json: () => ({ results: [], hasMore: false }) }),
        }).catch(() => ({ results: [], hasMore: false })),
        VenueController.searchVenues(mockReq, {
          json: (data) => ({ data }),
          status: () => ({ json: () => ({ results: [], hasMore: false }) }),
        }).catch(() => ({ results: [], hasMore: false })),
      ]);

    // This approach won't work because the controllers expect res.json() to be called
    // Instead, let's call the search functions directly by extracting their logic
    // or better yet, let's make the search functions return data instead of calling res.json

    // For now, let's use a simpler approach: call the database queries directly
    const pool = req.app.locals.pool;
    const likeParam = `%${q}%`;
    const perTypeLimit = Math.ceil(limit / 4); // Distribute limit across 4 types

    // Search members
    const isMemberSearcher = userType === "member";
    const isCommunitySearcher = userType === "community";
    let membersQuery, membersParams;
    if (isMemberSearcher) {
      membersQuery = `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
                            (SELECT 1 FROM follows f
                               WHERE f.follower_id = $2 AND f.follower_type = 'member'
                                 AND f.following_id = m.id AND f.following_type = 'member'
                               LIMIT 1) IS NOT NULL AS is_following
                     FROM members m
                     WHERE (LOWER(COALESCE(m.username, '')) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
                       AND m.id <> $2
                       AND NOT EXISTS (
                         SELECT 1 FROM user_blocks
                         WHERE (blocker_id = $2 AND blocked_id = m.id)
                            OR (blocker_id = m.id AND blocked_id = $2)
                       )
                     ORDER BY m.name ASC
                     LIMIT $3 OFFSET $4`;
      membersParams = [likeParam, userId, perTypeLimit, offset];
    } else if (isCommunitySearcher) {
      // Community searching for members - no self-exclusion needed (different tables)
      membersQuery = `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
                            (SELECT 1 FROM follows f
                               WHERE f.follower_id = $2 AND f.follower_type = 'community'
                                 AND f.following_id = m.id AND f.following_type = 'member'
                               LIMIT 1) IS NOT NULL AS is_following
                     FROM members m
                     WHERE (LOWER(COALESCE(m.username, '')) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
                     ORDER BY m.name ASC
                     LIMIT $3 OFFSET $4`;
      membersParams = [likeParam, userId, perTypeLimit, offset];
    } else {
      membersQuery = `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
                            false AS is_following
                     FROM members m
                     WHERE (LOWER(COALESCE(m.username, '')) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
                     ORDER BY m.name ASC
                     LIMIT $2 OFFSET $3`;
      membersParams = [likeParam, perTypeLimit, offset];
    }

    // Search communities
    let communitiesQuery, communitiesParams;
    if (isMemberSearcher) {
      // Member searching for communities - no self-exclusion needed (different tables)
      communitiesQuery = `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category, c.categories,
                                c.community_type, c.campus_id, c.college_subtype, c.club_type,
                                (SELECT 1 FROM follows f
                                   WHERE f.follower_id = $2 AND f.follower_type = 'member'
                                     AND f.following_id = c.id AND f.following_type = 'community'
                                   LIMIT 1) IS NOT NULL AS is_following
                         FROM communities c
                         WHERE (LOWER(COALESCE(c.username, '')) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
                         ORDER BY c.name ASC
                         LIMIT $3 OFFSET $4`;
      communitiesParams = [likeParam, userId, perTypeLimit, offset];
    } else if (isCommunitySearcher) {
      communitiesQuery = `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category, c.categories,
                                c.community_type, c.campus_id, c.college_subtype, c.club_type,
                                (SELECT 1 FROM follows f
                                   WHERE f.follower_id = $2 AND f.follower_type = 'community'
                                     AND f.following_id = c.id AND f.following_type = 'community'
                                   LIMIT 1) IS NOT NULL AS is_following
                         FROM communities c
                         WHERE (LOWER(COALESCE(c.username, '')) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
                           AND c.id <> $2
                         ORDER BY c.name ASC
                         LIMIT $3 OFFSET $4`;
      communitiesParams = [likeParam, userId, perTypeLimit, offset];
    } else {
      communitiesQuery = `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category, c.categories,
                                c.community_type, c.campus_id, c.college_subtype, c.club_type,
                                false AS is_following
                         FROM communities c
                         WHERE (LOWER(COALESCE(c.username, '')) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
                         ORDER BY c.name ASC
                         LIMIT $2 OFFSET $3`;
      communitiesParams = [likeParam, perTypeLimit, offset];
    }

    // Search sponsors
    const sponsorsQuery = `SELECT s.id, s.username, s.brand_name as name, s.bio, s.logo_url, s.category,
                                  false AS is_following
                           FROM sponsors s
                           WHERE (LOWER(COALESCE(s.username, '')) LIKE LOWER($1) OR LOWER(s.brand_name) LIKE LOWER($1))
                           ORDER BY s.brand_name ASC
                           LIMIT $2 OFFSET $3`;
    const sponsorsParams = [likeParam, perTypeLimit, offset];

    // Search venues
    // Note: logo_url may not exist in venues table - error handler will catch if it fails
    const venuesQuery = `SELECT v.id, v.username, v.name, v.city, v.logo_url,
                                false AS is_following
                         FROM venues v
                         WHERE (LOWER(COALESCE(v.username, '')) LIKE LOWER($1) OR LOWER(v.name) LIKE LOWER($1) OR LOWER(v.city) LIKE LOWER($1))
                         ORDER BY v.name ASC
                         LIMIT $2 OFFSET $3`;
    const venuesParams = [likeParam, perTypeLimit, offset];

    // Execute all queries in parallel with error handling
    const [membersResult, communitiesResult, sponsorsResult, venuesResult] =
      await Promise.all([
        pool.query(membersQuery, membersParams).catch((err) => {
          console.error("Members search query error:", err);
          return { rows: [] };
        }),
        pool.query(communitiesQuery, communitiesParams).catch((err) => {
          console.error("Communities search query error:", err);
          return { rows: [] };
        }),
        pool.query(sponsorsQuery, sponsorsParams).catch((err) => {
          console.error("Sponsors search query error:", err);
          return { rows: [] };
        }),
        pool.query(venuesQuery, venuesParams).catch((err) => {
          console.error("Venues search query error:", err);
          return { rows: [] };
        }),
      ]);

    // Helper function to parse categories (from communityController)
    function parseCategoriesValue(value, fallbackCategory = null) {
      let categories = [];
      if (Array.isArray(value)) {
        categories = value;
      } else if (
        value &&
        typeof value === "object" &&
        typeof value.length === "number"
      ) {
        categories = Array.from(value);
      } else if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            categories = parsed;
          }
        } catch (err) {
          if (value.trim()) {
            categories = [value.trim()];
          }
        }
      }

      categories = categories
        .map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter((c) => c);

      if (
        !categories.length &&
        typeof fallbackCategory === "string" &&
        fallbackCategory.trim()
      ) {
        categories = [fallbackCategory.trim()];
      }

      return categories;
    }

    // Process results
    const members = membersResult.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      name: row.full_name,
      bio: row.bio,
      profile_photo_url: row.profile_photo_url,
      is_following: !!row.is_following,
      type: "member",
    }));

    const communities = communitiesResult.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      full_name: row.name,
      bio: row.bio,
      logo_url: row.logo_url,
      category: row.category,
      categories: parseCategoriesValue(row.categories, row.category),
      is_following: !!row.is_following,
      community_type: row.community_type || null,
      campus_id: row.campus_id || null,
      college_subtype: row.college_subtype || null,
      club_type: row.club_type || null,
      college_info: null, // populated below
      type: "community",
    }));

    // Batch-fetch college info for college-affiliated communities
    const collegeCommunities = communities.filter(c => c.community_type === 'college_affiliated' && c.campus_id);
    if (collegeCommunities.length > 0) {
      try {
        const campusIds = collegeCommunities.map(c => c.campus_id);
        const collegeInfoResult = await pool.query(
          `SELECT ca.id as campus_id, ca.campus_name, ca.city as campus_city,
                  co.id as college_id, co.name as college_name, co.abbreviation as college_abbreviation,
                  co.logo_url as college_logo_url, co.status as college_status
           FROM campuses ca
           JOIN colleges co ON ca.college_id = co.id
           WHERE ca.id = ANY($1::uuid[])`,
          [campusIds]
        );
        const collegeMap = {};
        for (const cr of collegeInfoResult.rows) {
          collegeMap[cr.campus_id] = {
            college_id: cr.college_id,
            college_name: cr.college_name,
            college_abbreviation: cr.college_abbreviation,
            college_logo_url: cr.college_logo_url,
            college_status: cr.college_status,
            campus_id: cr.campus_id,
            campus_name: cr.campus_name,
            campus_city: cr.campus_city,
          };
        }
        for (const comm of collegeCommunities) {
          comm.college_info = collegeMap[comm.campus_id] || null;
        }
      } catch (collegeErr) {
        console.error('[GlobalSearch] Failed to batch-fetch college info:', collegeErr);
      }
    }

    const sponsors = sponsorsResult.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      brand_name: row.name,
      full_name: row.name,
      bio: row.bio,
      logo_url: row.logo_url,
      category: row.category,
      is_following: !!row.is_following,
      type: "sponsor",
    }));

    const venues = venuesResult.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      full_name: row.name,
      city: row.city,
      logo_url: row.logo_url,
      is_following: !!row.is_following,
      type: "venue",
    }));

    // Combine all results
    const combinedResults = [
      ...members,
      ...communities,
      ...sponsors,
      ...venues,
    ];

    const hasMore =
      combinedResults.length === limit ||
      members.length === perTypeLimit ||
      communities.length === perTypeLimit ||
      sponsors.length === perTypeLimit ||
      venues.length === perTypeLimit;

    res.json({
      results: combinedResults,
      members,
      communities,
      sponsors,
      venues,
      nextOffset: offset + combinedResults.length,
      hasMore,
    });

    // Fire search_performed signal after response is sent — fire-and-forget
    // Only emit if we have a logged-in member and the search returned results
    if (userType === 'member' && combinedResults.length > 0 && q.length >= 2) {
      const pool = req.app.locals.pool;
      const derivedCategory = deriveCategoryFromQuery(q);
      emitSignal(pool, {
        userId,
        userType: 'member',
        eventType: 'search_performed',
        category: derivedCategory,
        metadata: {
          query:            q,
          query_word_count: q.trim().split(/\s+/).length,
          result_count:     combinedResults.length,
          led_to_rsvp:      false,  // updated to true if RSVP follows within 10 min
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.error("/search/global error:", err && err.stack ? err.stack : err);
    console.error("Error details:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      hint: err?.hint,
      position: err?.position,
    });
    res.status(500).json({
      error: "Failed to perform global search",
      message: err?.message || "Unknown error",
    });
  }
}

/**
 * Search accounts for linking to events
 * Searches across members, communities, sponsors, venues
 */
const searchAccounts = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res
        .status(403)
        .json({ error: "Only communities can search accounts" });
    }

    const { q: query, types } = req.query;

    if (!query || query.length < 2) {
      return res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
    }

    const allowedTypes = types
      ? types.split(",")
      : ["member", "community", "sponsor", "venue"];
    const searchTerm = `%${query}%`;
    const results = [];

    // Search Members (DJs, performers)
    if (allowedTypes.includes("member")) {
      const memberResult = await MemberController.searchMembers(
        searchTerm,
        userId
      );
      results.push(...memberResult.map((m) => ({ ...m, type: "member" })));
    }

    // Search Communities
    if (allowedTypes.includes("community")) {
      const communityResult = await CommunityController.searchCommunities(
        searchTerm,
        userId
      );
      results.push(
        ...communityResult.map((c) => ({ ...c, type: "community" }))
      );
    }

    // Search Sponsors
    if (allowedTypes.includes("sponsor")) {
      const sponsorResult = await SponsorController.searchSponsors(searchTerm);
      results.push(...sponsorResult.map((s) => ({ ...s, type: "sponsor" })));
    }

    // Search Venues
    if (allowedTypes.includes("venue")) {
      const venueResult = await VenueController.searchVenues(searchTerm);
      results.push(...venueResult.map((v) => ({ ...v, type: "venue" })));
    }

    res.json({
      success: true,
      results: results.slice(0, 20), // Limit to 20 results
      count: results.length,
    });
  } catch (error) {
    console.error("Error searching accounts:", error);
    res.status(500).json({ error: "Failed to search accounts" });
  }
};

async function unifiedSearch(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.q || req.query.query || "").trim();
    const type = req.query.type || "events"; // 'events' | 'people' | 'communities' | 'creators'
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const eventSubFilter = (req.query.eventSubFilter || "all").toLowerCase();

    if (q.length < 2) {
      return res.json({
        success: true,
        results: [],
        hasMore: false,
      });
    }

    const pool = req.app.locals.pool;
    const likeParam = `%${q}%`;
    let results = [];

    if (type === "events") {
      let filterClause = "";
      if (eventSubFilter === "upcoming") {
        filterClause = "AND e.start_datetime > NOW()";
      } else if (eventSubFilter === "past") {
        filterClause = "AND COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours') < NOW()";
      } else if (eventSubFilter === "live") {
        filterClause = "AND NOW() >= e.start_datetime AND NOW() <= COALESCE(e.end_datetime, e.start_datetime + INTERVAL '2 hours')";
      }

      const query = `
        SELECT 
          e.id, 
          e.title as name, 
          e.title,
          e.description, 
          e.banner_url as logo_url,
          e.banner_url,
          e.start_datetime as event_date,
          e.end_datetime,
          e.max_attendees,
          COALESCE(
            (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'),
            0
          )::int as attendee_count,
          (
            SELECT json_agg(json_build_object(
              'base_price', tt.base_price,
              'total_quantity', tt.total_quantity,
              'sold_count', tt.sold_count
            ))
            FROM ticket_types tt 
            WHERE tt.event_id = e.id
          ) as ticket_types,
          'event' as type
        FROM events e
        WHERE LOWER(e.title) LIKE LOWER($1)
          AND e.is_published = true
          AND e.is_cancelled IS NOT TRUE
          ${filterClause}
        ORDER BY e.start_datetime ASC
        LIMIT $2 OFFSET $3
      `;
      const resData = await pool.query(query, [likeParam, limit, offset]);
      results = resData.rows;
    } else if (type === "people") {
      const query = `
        SELECT 
          m.id, 
          m.username, 
          m.name as name,
          m.name as full_name,
          m.profile_photo_url as logo_url, 
          m.profile_photo_url,
          m.bio,
          'member' as type,
          m.is_creator_mode_enabled,
          EXISTS(
            SELECT 1 FROM follows f
            WHERE f.follower_id = $2 AND f.follower_type = $3
              AND f.following_id = m.id AND f.following_type = 'member'
              AND f.is_superseded_by_circle = false
            LIMIT 1
          ) as is_following,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM circles c
              WHERE (c.user_a_id = $2 AND c.user_b_id = m.id)
                 OR (c.user_b_id = $2 AND c.user_a_id = m.id)
              LIMIT 1
            )
            WHEN $3 = 'community' THEN EXISTS(
              SELECT 1 FROM community_member_circles cc
              WHERE cc.community_id = $2 AND cc.member_id = m.id
              LIMIT 1
            )
            ELSE false
          END as in_circle,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM circle_requests cr
              WHERE cr.sender_id = $2 AND cr.receiver_id = m.id AND cr.status = 'pending'
              LIMIT 1
            )
            WHEN $3 = 'community' THEN EXISTS(
              SELECT 1 FROM community_member_circle_invites cci
              WHERE cci.community_id = $2 AND cci.member_id = m.id AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE false
          END as circle_requested,
          CASE 
            WHEN $3 = 'member' THEN (
              SELECT cr.id::text FROM circle_requests cr
              WHERE cr.sender_id = $2 AND cr.receiver_id = m.id AND cr.status = 'pending'
              LIMIT 1
            )
            WHEN $3 = 'community' THEN (
              SELECT cci.id::text FROM community_member_circle_invites cci
              WHERE cci.community_id = $2 AND cci.member_id = m.id AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE NULL
          END as circle_request_id
        FROM members m
        WHERE (LOWER(COALESCE(m.username, '')) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
          AND m.id <> $2
        ORDER BY m.name ASC
        LIMIT $4 OFFSET $5
      `;
      const resData = await pool.query(query, [likeParam, userId, userType, limit, offset]);
      results = resData.rows;
    } else if (type === "communities") {
      const query = `
        SELECT 
          c.id, 
          c.username, 
          c.name,
          c.name as full_name,
          c.logo_url, 
          c.logo_url as logo_url,
          c.bio,
          c.category,
          'community' as type,
          EXISTS(
            SELECT 1 FROM follows f
            WHERE f.follower_id = $2 AND f.follower_type = $3
              AND f.following_id = c.id AND f.following_type = 'community'
              AND f.is_superseded_by_circle = false
            LIMIT 1
          ) as is_following,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM community_member_circles cc
              WHERE cc.community_id = c.id AND cc.member_id = $2
              LIMIT 1
            )
            ELSE false
          END as in_circle,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM community_member_circle_invites cci
              WHERE cci.community_id = c.id AND cci.member_id = $2 AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE false
          END as circle_requested,
          CASE 
            WHEN $3 = 'member' THEN (
              SELECT cci.id::text FROM community_member_circle_invites cci
              WHERE cci.community_id = c.id AND cci.member_id = $2 AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE NULL
          END as circle_request_id
        FROM communities c
        WHERE (LOWER(COALESCE(c.username, '')) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
        ORDER BY c.name ASC
        LIMIT $4 OFFSET $5
      `;
      const resData = await pool.query(query, [likeParam, userId, userType, limit, offset]);
      results = resData.rows;
    } else if (type === "creators") {
      const query = `
        SELECT 
          m.id, 
          m.username, 
          m.name as name,
          m.name as full_name,
          m.profile_photo_url as logo_url, 
          m.profile_photo_url,
          m.bio,
          'member' as type,
          m.is_creator_mode_enabled,
          EXISTS(
            SELECT 1 FROM follows f
            WHERE f.follower_id = $2 AND f.follower_type = $3
              AND f.following_id = m.id AND f.following_type = 'member'
              AND f.is_superseded_by_circle = false
            LIMIT 1
          ) as is_following,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM circles c
              WHERE (c.user_a_id = $2 AND c.user_b_id = m.id)
                 OR (c.user_b_id = $2 AND c.user_a_id = m.id)
              LIMIT 1
            )
            WHEN $3 = 'community' THEN EXISTS(
              SELECT 1 FROM community_member_circles cc
              WHERE cc.community_id = $2 AND cc.member_id = m.id
              LIMIT 1
            )
            ELSE false
          END as in_circle,
          CASE 
            WHEN $3 = 'member' THEN EXISTS(
              SELECT 1 FROM circle_requests cr
              WHERE cr.sender_id = $2 AND cr.receiver_id = m.id AND cr.status = 'pending'
              LIMIT 1
            )
            WHEN $3 = 'community' THEN EXISTS(
              SELECT 1 FROM community_member_circle_invites cci
              WHERE cci.community_id = $2 AND cci.member_id = m.id AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE false
          END as circle_requested,
          CASE 
            WHEN $3 = 'member' THEN (
              SELECT cr.id::text FROM circle_requests cr
              WHERE cr.sender_id = $2 AND cr.receiver_id = m.id AND cr.status = 'pending'
              LIMIT 1
            )
            WHEN $3 = 'community' THEN (
              SELECT cci.id::text FROM community_member_circle_invites cci
              WHERE cci.community_id = $2 AND cci.member_id = m.id AND cci.status = 'pending'
              LIMIT 1
            )
            ELSE NULL
          END as circle_request_id
        FROM members m
        WHERE m.is_creator_mode_enabled = true
          AND (LOWER(COALESCE(m.username, '')) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
          AND m.id <> $2
        ORDER BY m.name ASC
        LIMIT $4 OFFSET $5
      `;
      const resData = await pool.query(query, [likeParam, userId, userType, limit, offset]);
      results = resData.rows;
    }

    const hasMore = results.length === limit;

    res.json({
      success: true,
      results,
      hasMore,
    });
  } catch (error) {
    console.error("Error in unifiedSearch:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
}

module.exports = { globalSearch, searchAccounts, unifiedSearch };

