async function signup(req, res) {
  try {
    console.log("==== COMMUNITY SIGNUP REQUEST ====");
    console.log("Request body:", req.body);

    const pool = req.app.locals.pool;
    const {
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      email,
      phone,
      secondary_phone,
      sponsor_types,
      heads,
      username,
    } = req.body || {};

    // No longer using supabase_user_id - we use email as the login credential
    // and backend-generated id as the account identity
    let user_id = null;

    console.log("[Signup] Request for email:", email, "username:", username);

    console.log("Validation check:", {
      name: !!name,
      category,
      categories,
      location: !!location,
      email: !!email,
      phone: !!phone,
      sponsor_types: Array.isArray(sponsor_types),
      sponsor_types_value: sponsor_types,
    });

    if (!name || !email || !phone || !Array.isArray(sponsor_types)) {
      console.log("Validation failed - missing required fields");
      return res.status(400).json({
        error: "Required: name, categories, email, phone, sponsor_types[]",
      });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    if (secondary_phone && !/^\d{10}$/.test(secondary_phone)) {
      return res
        .status(400)
        .json({ error: "secondary_phone must be 10 digits if provided" });
    }
    // Validate location if provided (location is optional - can be null if user skipped)
    if (location !== null && location !== undefined) {
      // Accept either address OR googleMapsUrl as valid location data
      if (
        typeof location !== "object" ||
        (!location.address && !location.googleMapsUrl)
      ) {
        return res.status(400).json({
          error:
            "location must be an object with at least address or googleMapsUrl field if provided",
        });
      }
    }
    // Allow "Open to All" as a single item, otherwise require minimum 3 items (no maximum)
    if (sponsor_types.length === 1 && sponsor_types[0] === "Open to All") {
      // This is valid - "Open to All" is allowed as a single item
    } else if (sponsor_types.length < 3) {
      return res.status(400).json({
        error:
          "sponsor_types must include at least 3 items, or select 'Open to All'",
      });
    }

    // Validate username if provided
    let sanitizedUsername = null;
    if (username && typeof username === "string") {
      sanitizedUsername = username.toLowerCase().trim();
      if (!/^[a-z0-9._]{3,30}$/.test(sanitizedUsername)) {
        return res.status(400).json({
          error:
            "Username must be 3-30 characters, lowercase letters, numbers, dots and underscores only",
        });
      }
      // Check if username is already taken across all user types
      const existingUsername = await pool.query(
        `SELECT id FROM communities WHERE username = $1 LIMIT 1`,
        [sanitizedUsername]
      );
      if (existingUsername.rows.length > 0) {
        return res.status(409).json({ error: "Username is already taken" });
      }
    }

    const { categories: categoryList, error: categoriesError } =
      normalizeCategoriesInput(category, categories, { required: true });
    if (categoriesError) {
      return res.status(400).json({ error: categoriesError });
    }
    const primaryCategory = categoryList[0] || null;

    // Heads: expect array of up to 3 with one primary
    console.log("Heads validation:", {
      heads: heads,
      isArray: Array.isArray(heads),
      length: heads?.length,
    });

    if (!Array.isArray(heads) || heads.length === 0) {
      console.log("Heads validation failed - not array or empty");
      return res.status(400).json({
        error: "heads[] required: at least one head with name and is_primary",
      });
    }
    const primaryHeads = heads.filter((h) => h && h.is_primary);
    console.log("Primary heads found:", primaryHeads.length);
    if (primaryHeads.length !== 1) {
      console.log("Heads validation failed - not exactly one primary head");
      return res
        .status(400)
        .json({ error: "Exactly one primary head is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Note: We no longer check for duplicate emails since we allow
      // multiple accounts with the same email (Instagram-style multi-account)

      // Prepare location JSONB (can be null if user skipped location)
      const locationJson = location ? JSON.stringify(location) : null;

      // INSERT with optional username - backend-generated id is the identity
      const communityResult = await client.query(
        `INSERT INTO communities (user_id, name, logo_url, bio, category, categories, location, email, phone, secondary_phone, sponsor_types, username)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb,$12)
         RETURNING *`,
        [
          user_id,
          name,
          logo_url || null,
          bio || null,
          primaryCategory,
          JSON.stringify(categoryList),
          locationJson,
          email,
          phone,
          secondary_phone || null,
          JSON.stringify(sponsor_types),
          sanitizedUsername,
        ]
      );
      const community = communityResult.rows[0];
      community.categories = parseCategoriesValue(
        community.categories,
        community.category
      );
      community.category = community.categories[0] || community.category;

      // Clear existing heads and insert provided ones
      await client.query(
        "DELETE FROM community_heads WHERE community_id = $1",
        [community.id]
      );
      for (const h of heads) {
        if (!h || !h.name) continue;
        await client.query(
          `INSERT INTO community_heads (community_id, name, email, phone, profile_pic_url, is_primary)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            community.id,
            h.name,
            h.email || null,
            h.phone || null,
            h.profile_pic_url || null,
            !!h.is_primary,
          ]
        );
      }

      await client.query("COMMIT");

      // Generate tokens for the new community account
      const { createSession } = require("./authControllerV2");
      const deviceId = req.headers["x-device-id"] || "signup-" + Date.now();

      let session = null;
      try {
        session = await createSession(
          pool,
          community.id,
          "community",
          deviceId,
          email
        );
        console.log("[Signup] Session created for new community:", {
          communityId: community.id,
          accessTokenLength: session?.accessToken?.length,
          refreshTokenLength: session?.refreshToken?.length,
        });
      } catch (sessionErr) {
        console.error("[Signup] Failed to create session:", sessionErr);
        // Don't fail the signup, just log the error
      }

      res.json({
        community,
        accessToken: session?.accessToken || null,
        refreshToken: session?.refreshToken || null,
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("/communities/signup error:", err);
    res.status(500).json({
      error: "Failed to signup community",
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
    });
  }
}

async function getProfile(req, res) {
  try {
    console.log("==== GET COMMUNITY PROFILE ====");
    console.log("JWT user:", {
      id: req.user?.id,
      email: req.user?.email,
      type: req.user?.type,
      supabase_user_id: req.user?.sub,
    });

    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      console.error("Auth failed: userId=", userId, "type=", userType);
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get community profile
    const communityResult = await pool.query(
      `SELECT id, name, email, phone, secondary_phone, category, categories, location, username, bio, logo_url, banner_url, sponsor_types, created_at
       FROM communities WHERE id = $1`,
      [userId]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const community = communityResult.rows[0];

    // Get all community heads
    const headsResult = await pool.query(
      `SELECT ch.id, ch.name, ch.email, ch.phone, ch.profile_pic_url, ch.is_primary, ch.created_at, ch.member_id,
              COALESCE(m1.id, m2.id) as linked_member_id,
              COALESCE(m1.username, m2.username) as member_username,
              COALESCE(m1.profile_photo_url, m2.profile_photo_url) as member_photo_url
       FROM community_heads ch
       LEFT JOIN members m1 ON m1.id = ch.member_id
       LEFT JOIN members m2 ON ch.member_id IS NULL AND LOWER(m2.email) = LOWER(ch.email)
       WHERE ch.community_id = $1
       ORDER BY ch.is_primary DESC, ch.created_at ASC`,
      [userId]
    );

    const heads = headsResult.rows.map((head) => ({
      id: head.id,
      name: head.name,
      email: head.email,
      phone: head.phone,
      profile_pic_url: head.profile_pic_url,
      is_primary: head.is_primary,
      created_at: head.created_at,
      member_id: head.member_id || head.linked_member_id || null,
      member_username: head.member_username || null,
      member_photo_url: head.member_photo_url || null,
    }));

    // Get follower/following/event counts
    const followCountsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'community') as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') as following_count,
        (SELECT COUNT(*) FROM events WHERE community_id = $1 AND is_published = true AND COALESCE(start_datetime, event_date) < NOW()) AS events_hosted_count,
        (SELECT COUNT(*) FROM events WHERE community_id = $1 AND is_published = true AND COALESCE(start_datetime, event_date) >= NOW() AND is_cancelled = false) AS events_scheduled_count`,
      [userId]
    );

    const followCounts = followCountsResult.rows[0];

    // Get user's posts
    const postsResult = await pool.query(
      `SELECT id, caption, image_urls, like_count, comment_count, created_at
       FROM posts 
       WHERE author_id = $1 AND author_type = 'community'
       ORDER BY created_at DESC
       LIMIT 6`,
      [userId]
    );

    const posts = postsResult.rows.map((post) => ({
      ...post,
      image_urls:
        typeof post.image_urls === "string"
          ? JSON.parse(post.image_urls)
          : post.image_urls,
    }));

    const profileData = {
      ...community,
      sponsor_types:
        typeof community.sponsor_types === "string"
          ? JSON.parse(community.sponsor_types)
          : community.sponsor_types,
      categories: parseCategoriesValue(
        community.categories,
        community.category
      ),
      follower_count: parseInt(followCounts.follower_count),
      following_count: parseInt(followCounts.following_count),
      events_hosted_count: parseInt(followCounts.events_hosted_count || 0, 10),
      events_scheduled_count: parseInt(
        followCounts.events_scheduled_count || 0,
        10
      ),
      location:
        typeof community.location === "string"
          ? JSON.parse(community.location)
          : community.location,
      heads: heads,
      banner_url: community.banner_url,
    };
    profileData.category =
      profileData.categories[0] || community.category || null;

    res.json({
      profile: profileData,
      posts,
    });
  } catch (error) {
    console.error("Error getting community profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function patchProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      name,
      bio,
      phone,
      category,
      categories,
      sponsor_types,
      location,
      banner_url,
    } = req.body || {};

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      const nameTrimmed = typeof name === "string" ? name.trim() : null;
      if (!nameTrimmed || nameTrimmed.length === 0) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      if (nameTrimmed.length > 100) {
        return res
          .status(400)
          .json({ error: "Name must be 100 characters or less" });
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(nameTrimmed);
    }

    if (bio !== undefined) {
      const bioTrimmed = typeof bio === "string" ? bio.trim() : null;
      if (bioTrimmed && bioTrimmed.length > 500) {
        return res
          .status(400)
          .json({ error: "Bio must be 500 characters or less" });
      }
      updates.push(`bio = $${paramIndex++}`);
      values.push(bioTrimmed || null);
    }

    if (phone !== undefined) {
      const phoneTrimmed = typeof phone === "string" ? phone.trim() : "";
      if (phoneTrimmed && !/^\d{10}$/.test(phoneTrimmed)) {
        return res.status(400).json({ error: "Phone must be 10 digits" });
      }
      updates.push(`phone = $${paramIndex++}`);
      values.push(phoneTrimmed || null);
    }

    if (req.body.hasOwnProperty("secondary_phone")) {
      const secondaryPhoneTrimmed =
        typeof req.body.secondary_phone === "string"
          ? req.body.secondary_phone.trim()
          : "";
      if (secondaryPhoneTrimmed && !/^\d{10}$/.test(secondaryPhoneTrimmed)) {
        return res
          .status(400)
          .json({ error: "Secondary phone must be 10 digits" });
      }
      updates.push(`secondary_phone = $${paramIndex++}`);
      values.push(secondaryPhoneTrimmed || null);
    }

    if (category !== undefined || categories !== undefined) {
      const { categories: normalizedCategories, error: categoriesError } =
        normalizeCategoriesInput(category, categories, { required: true });
      if (categoriesError) {
        return res.status(400).json({ error: categoriesError });
      }
      updates.push(`categories = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(normalizedCategories));
      updates.push(`category = $${paramIndex++}`);
      values.push(normalizedCategories[0] || null);
    }

    if (sponsor_types !== undefined) {
      if (!Array.isArray(sponsor_types)) {
        return res
          .status(400)
          .json({ error: "Sponsor types must be an array" });
      }
      // Allow "Open to All" as a single item, otherwise require minimum 3 items
      if (sponsor_types.length === 1 && sponsor_types[0] === "Open to All") {
        // Valid
      } else if (sponsor_types.length < 3) {
        return res.status(400).json({
          error:
            "sponsor_types must include at least 3 items, or select 'Open to All'",
        });
      }
      const sanitized = sponsor_types.filter(
        (s) =>
          typeof s === "string" && s.trim().length > 0 && s.trim().length <= 100
      );
      updates.push(`sponsor_types = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(sanitized));
    }

    if (location !== undefined) {
      if (location && typeof location === "object") {
        const locAddress = location.address
          ? String(location.address).trim().substring(0, 200)
          : null;
        const locState = location.state
          ? String(location.state).trim().substring(0, 100)
          : null;
        const locCountry = location.country
          ? String(location.country).trim().substring(0, 100)
          : null;
        const lat = location.lat != null ? parseFloat(location.lat) : null;
        const lng = location.lng != null ? parseFloat(location.lng) : null;

        const locationJson = JSON.stringify({
          address: locAddress,
          state: locState,
          country: locCountry,
          lat,
          lng,
        });
        updates.push(`location = $${paramIndex++}::jsonb`);
        values.push(locationJson);
      } else if (location === null) {
        updates.push(`location = NULL`);
      }
    }

    if (banner_url !== undefined) {
      const sanitizedBanner = banner_url ? String(banner_url).trim() : null;
      updates.push(`banner_url = $${paramIndex++}`);
      values.push(sanitizedBanner || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE communities SET ${updates.join(
      ", "
    )} WHERE id = $${paramIndex} RETURNING id, name, bio, phone, secondary_phone, category, categories, sponsor_types, location, banner_url`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const community = result.rows[0];
    res.json({
      success: true,
      profile: {
        name: community.name,
        bio: community.bio,
        phone: community.phone,
        secondary_phone: community.secondary_phone,
        category: community.category,
        categories: parseCategoriesValue(
          community.categories,
          community.category
        ),
        sponsor_types:
          typeof community.sponsor_types === "string"
            ? JSON.parse(community.sponsor_types)
            : community.sponsor_types,
        location:
          typeof community.location === "string"
            ? JSON.parse(community.location)
            : community.location,
        banner_url: community.banner_url || null,
      },
    });
  } catch (err) {
    console.error(
      "/communities/profile PATCH error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update profile" });
  }
}

async function searchCommunities(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.query || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    if (q.length < 2) {
      return res.json({ results: [], nextOffset: offset, hasMore: false });
    }

    const likeParam = `%${q}%`;
    // Only check is_following if the searcher is a member
    const isMemberSearcher = userType === "member";
    let query, params;

    if (isMemberSearcher) {
      query = `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category, c.categories,
                      (SELECT 1 FROM follows f
                         WHERE f.follower_id = $2 AND f.follower_type = 'member'
                           AND f.following_id = c.id AND f.following_type = 'community'
                         LIMIT 1) IS NOT NULL AS is_following
               FROM communities c
               WHERE (LOWER(c.username) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
                 AND c.id <> $2
               ORDER BY c.name ASC
               LIMIT $3 OFFSET $4`;
      params = [likeParam, userId, limit, offset];
    } else {
      query = `SELECT c.id, c.username, c.name, c.bio, c.logo_url, c.category, c.categories,
                      false AS is_following
               FROM communities c
               WHERE (LOWER(c.username) LIKE LOWER($1) OR LOWER(c.name) LIKE LOWER($1))
               ORDER BY c.name ASC
               LIMIT $2 OFFSET $3`;
      params = [likeParam, limit, offset];
    }

    const r = await pool.query(query, params);

    const results = r.rows.map((row) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      bio: row.bio,
      logo_url: row.logo_url,
      category: row.category,
      categories: parseCategoriesValue(row.categories, row.category),
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error(
      "/communities/search error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to search communities" });
  }
}

async function getPublicCommunity(req, res) {
  try {
    const pool = req.app.locals.pool;
    const authUserId = req.user?.id;
    const userType = req.user?.type;
    const targetId = req.params.id;

    // Allow all authenticated account types to view community profiles
    if (!authUserId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const communityR = await pool.query(
      `SELECT id, username, name, bio, logo_url, banner_url, category, categories, created_at, sponsor_types, location
       FROM communities
       WHERE id = $1`,
      [targetId]
    );
    if (communityR.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }
    const profile = communityR.rows[0];

    // Get all community heads
    const headsResult = await pool.query(
      `SELECT ch.id, ch.name, ch.email, ch.phone, ch.profile_pic_url, ch.is_primary, ch.created_at, ch.member_id,
              COALESCE(m1.id, m2.id) as linked_member_id,
              COALESCE(m1.username, m2.username) as member_username,
              COALESCE(m1.profile_photo_url, m2.profile_photo_url) as member_photo_url
       FROM community_heads ch
       LEFT JOIN members m1 ON m1.id = ch.member_id
       LEFT JOIN members m2 ON ch.member_id IS NULL AND LOWER(m2.email) = LOWER(ch.email)
       WHERE ch.community_id = $1
       ORDER BY ch.is_primary DESC, ch.created_at ASC`,
      [targetId]
    );

    const heads = headsResult.rows.map((head) => ({
      id: head.id,
      name: head.name,
      email: head.email,
      phone: head.phone,
      profile_pic_url: head.profile_pic_url,
      is_primary: head.is_primary,
      created_at: head.created_at,
      member_id: head.member_id || head.linked_member_id || null,
      member_username: head.member_username || null,
      member_photo_url: head.member_photo_url || null,
    }));

    const countsR = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'community') AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'community') AS following_count,
         (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'community') AS posts_count,
         (SELECT COUNT(*) FROM events WHERE community_id = $1 AND is_published = true AND COALESCE(start_datetime, event_date) < NOW()) AS events_hosted_count,
         (SELECT COUNT(*) FROM events WHERE community_id = $1 AND is_published = true AND COALESCE(start_datetime, event_date) >= NOW() AND is_cancelled = false) AS events_scheduled_count`,
      [targetId]
    );
    const counts = countsR.rows[0];

    // Check cross-entity follow relationships (members, communities, sponsors, venues)
    const followableTypes = ["member", "community", "sponsor", "venue"];
    let isFollowing = false;
    if (followableTypes.includes(userType)) {
      const isFollowingR = await pool.query(
        `SELECT 1 FROM follows 
         WHERE follower_id = $1 AND follower_type = $2
           AND following_id = $3 AND following_type = 'community'
         LIMIT 1`,
        [authUserId, userType, targetId]
      );
      isFollowing = isFollowingR.rows.length > 0;
    }

    res.json({
      id: profile.id,
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      logo_url: profile.logo_url,
      category: profile.category,
      categories: parseCategoriesValue(profile.categories, profile.category),
      created_at: profile.created_at,
      posts_count: parseInt(counts.posts_count || 0, 10),
      followers_count: parseInt(counts.followers_count || 0, 10),
      following_count: parseInt(counts.following_count || 0, 10),
      events_hosted_count: parseInt(counts.events_hosted_count || 0, 10),
      events_scheduled_count: parseInt(counts.events_scheduled_count || 0, 10),
      is_following: isFollowing,
      sponsor_types:
        typeof profile.sponsor_types === "string"
          ? JSON.parse(profile.sponsor_types)
          : profile.sponsor_types || [],
      location:
        typeof profile.location === "string"
          ? JSON.parse(profile.location)
          : profile.location,
      heads: heads,
      banner_url: profile.banner_url,
    });
  } catch (err) {
    console.error(
      "/communities/:id/public error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to load public profile" });
  }
}

async function changeUsernameEndpoint(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { username } = req.body || {};
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    const sanitized = username.toLowerCase().trim();
    if (!/^[a-z0-9._]{3,30}$/.test(sanitized)) {
      return res.status(400).json({
        error:
          "Username must be 3-30 characters, lowercase letters, numbers, and underscores only",
      });
    }

    const existing = await pool.query(
      `SELECT id FROM communities WHERE username = $1 AND id <> $2 LIMIT 1`,
      [sanitized, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    await pool.query(`UPDATE communities SET username = $1 WHERE id = $2`, [
      sanitized,
      userId,
    ]);

    res.json({ success: true, username: sanitized });
  } catch (err) {
    console.error(
      "/communities/username POST error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update username" });
  }
}

async function startEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email is in use across all user roles
    const { isEmailInUse } = require("../middleware/validators");
    const emailExists = await isEmailInUse(
      pool,
      emailTrimmed,
      "communities",
      userId
    );
    if (emailExists) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const supabase = require("../supabase");
    const { data, error } = await supabase.auth.signInWithOtp({
      email: emailTrimmed,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error(
      "/communities/email/change/start error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to send OTP" });
  }
}

async function verifyEmailChange(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const supabase = require("../supabase");

    const { data, error } = await supabase.auth.verifyOtp({
      email: emailTrimmed,
      token: otp,
      type: "email",
    });

    if (error) {
      return res.status(400).json({ error: error.message || "Invalid OTP" });
    }

    await pool.query(`UPDATE communities SET email = $1 WHERE id = $2`, [
      emailTrimmed,
      userId,
    ]);

    // Return the new access token so the frontend can update its stored token
    const newAccessToken = data?.session?.access_token;
    res.json({
      success: true,
      email: emailTrimmed,
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error(
      "/communities/email/change/verify error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to verify email" });
  }
}

async function updateLocation(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }
    const body = req.body || {};
    const loc = body.location;
    if (!loc || typeof loc !== "object") {
      return res.status(400).json({ error: "location object is required" });
    }
    const lat = loc.lat != null ? parseFloat(loc.lat) : null;
    const lng = loc.lng != null ? parseFloat(loc.lng) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res
        .status(400)
        .json({ error: "lat and lng are required numeric values" });
    }
    const address = loc.address
      ? String(loc.address).trim().substring(0, 200)
      : null;
    const state = loc.state ? String(loc.state).trim().substring(0, 100) : null;
    const country = loc.country
      ? String(loc.country).trim().substring(0, 100)
      : null;
    const locationJson = JSON.stringify({ address, state, country, lat, lng });

    await pool.query(
      `UPDATE communities SET location = $1::jsonb WHERE id = $2`,
      [locationJson, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(
      "/communities/location POST error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update location" });
  }
}

async function updateLogo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { logo_url } = req.body || {};
    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!logo_url) {
      return res.status(400).json({ error: "logo_url is required" });
    }
    const r = await pool.query(
      "UPDATE communities SET logo_url = $1 WHERE id = $2 RETURNING id, logo_url",
      [logo_url, userId]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ error: "Community not found" });
    res.json({ success: true, logo_url: r.rows[0].logo_url });
  } catch (err) {
    console.error("/communities/profile/logo error:", err);
    res.status(500).json({ error: "Failed to update logo" });
  }
}

async function patchHeads(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "community") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { heads } = req.body || {};
    if (!Array.isArray(heads) || heads.length === 0) {
      return res.status(400).json({ error: "heads[] required" });
    }
    if (heads.length > 5) {
      return res.status(400).json({ error: "You can add at most 5 heads" });
    }
    const primaryCount = heads.filter((h) => h && h.is_primary).length;
    if (primaryCount !== 1) {
      return res
        .status(400)
        .json({ error: "Exactly one primary head is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM community_heads WHERE community_id = $1",
        [userId]
      );
      for (const h of heads) {
        if (!h || !h.name) continue;
        const phoneDigits = h.phone
          ? String(h.phone).replace(/[^0-9]/g, "")
          : null;
        if (phoneDigits && phoneDigits.length !== 10) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Head phone numbers must be 10 digits" });
        }
        const memberIdValue =
          h.member_id != null ? parseInt(h.member_id, 10) : null;
        const memberId =
          Number.isFinite(memberIdValue) && memberIdValue > 0
            ? memberIdValue
            : null;
        await client.query(
          `INSERT INTO community_heads (community_id, name, email, phone, profile_pic_url, is_primary, member_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            userId,
            String(h.name).trim().substring(0, 120),
            h.email
              ? String(h.email).trim().toLowerCase().substring(0, 200)
              : null,
            phoneDigits || null,
            h.profile_pic_url || null,
            !!h.is_primary,
            memberId,
          ]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("/communities/heads PATCH error:", err);
    res.status(500).json({ error: "Failed to update heads" });
  }
}

function normalizeCategoriesInput(
  singleCategory,
  categoriesList,
  { required = true } = {}
) {
  const collected = [];

  const addValue = (raw) => {
    if (typeof raw !== "string") {
      throw new Error("Categories must be provided as strings");
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.length > 100) {
      throw new Error("Each category must be 100 characters or less");
    }
    if (!collected.includes(trimmed)) {
      if (collected.length >= 3) {
        throw new Error("You can select up to 3 categories");
      }
      collected.push(trimmed);
    }
  };

  if (categoriesList !== undefined) {
    if (!Array.isArray(categoriesList)) {
      return { error: "categories must be an array of strings" };
    }
    try {
      categoriesList.forEach(addValue);
    } catch (err) {
      return { error: err.message || "Invalid categories" };
    }
  }

  if (singleCategory !== undefined && singleCategory !== null) {
    if (typeof singleCategory !== "string") {
      return { error: "category must be a string" };
    }
    try {
      addValue(singleCategory);
    } catch (err) {
      return { error: err.message || "Invalid category" };
    }
  }

  if (!collected.length) {
    if (required) {
      return { error: "At least one category is required" };
    }
    return { categories: [] };
  }

  return { categories: collected };
}

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

module.exports = {
  signup,
  getProfile,
  patchProfile,
  searchCommunities,
  getPublicCommunity,
  changeUsernameEndpoint,
  startEmailChange,
  verifyEmailChange,
  updateLocation,
  updateLogo,
  patchHeads,
};
