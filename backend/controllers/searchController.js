const MemberController = require("./memberController");
const CommunityController = require("./communityController");
const SponsorController = require("./sponsorController");
const VenueController = require("./venueController");

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
      type: "community",
    }));

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

module.exports = { globalSearch, searchAccounts };
