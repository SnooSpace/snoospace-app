function parsePgTextArray(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return [trimmed];
  const inner = trimmed.substring(1, trimmed.length - 1);
  if (!inner) return [];
  return inner
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      // remove surrounding quotes if present
      const m = item.match(/^"(.*)"$/);
      return m ? m[1] : item;
    })
    .filter((s) => s.length > 0);
}

async function signup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const {
      name,
      email,
      phone,
      dob,
      gender,
      location,
      interests,
      profile_photo_url,
      username,
    } = req.body || {};

    if (
      !name ||
      !email ||
      !phone ||
      !dob ||
      !gender ||
      !location ||
      !Array.isArray(interests)
    ) {
      return res.status(400).json({
        error:
          "All fields are required: name, email, phone, dob, gender, location (JSONB), interests[]",
      });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "phone must be 10 digits" });
    }
    const allowedGenders = ["Male", "Female", "Non-binary"];
    if (!allowedGenders.includes(gender)) {
      return res
        .status(400)
        .json({ error: "gender must be one of: Male, Female, Non-binary" });
    }
    if (interests.length < 3 || interests.length > 7) {
      return res
        .status(400)
        .json({ error: "interests must include between 3 and 7 items" });
    }
    // Validate location is an object with at least city
    if (typeof location !== "object" || location === null || !location.city) {
      return res.status(400).json({
        error: "location must be an object with at least a city field",
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
      // Check if username is already taken
      const existingUsername = await pool.query(
        `SELECT id FROM members WHERE username = $1 LIMIT 1`,
        [sanitizedUsername]
      );
      if (existingUsername.rows.length > 0) {
        return res.status(409).json({ error: "Username is already taken" });
      }
    }

    // No longer using supabase_user_id - we use email as login credential
    // and backend-generated id as account identity
    console.log(
      "[MemberSignup] Creating member for email:",
      email,
      "username:",
      sanitizedUsername
    );

    // INSERT with optional username
    const result = await pool.query(
      `INSERT INTO members (name, email, phone, dob, gender, location, interests, profile_photo_url, username)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
       RETURNING *`,
      [
        name,
        email,
        phone,
        dob,
        gender,
        JSON.stringify(location),
        JSON.stringify(interests),
        profile_photo_url || null,
        sanitizedUsername,
      ]
    );
    res.json({ member: result.rows[0] });
  } catch (err) {
    console.error("/members/signup error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      error: "Failed to signup member",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
      hint: err && err.hint ? err.hint : undefined,
      position: err && err.position ? err.position : undefined,
    });
  }
}

async function getProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get member profile
    const memberResult = await pool.query(
      `SELECT id, name, email, phone, dob, gender, interests, username, bio, profile_photo_url, pronouns, location, created_at,
              intent_badges, available_today, available_this_week, prompt_question, prompt_answer, appear_in_discover,
              discover_photos, openers, show_pronouns
       FROM members WHERE id = $1`,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = memberResult.rows[0];

    // Get follower/following counts
    const followCountsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'member') as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') as following_count`,
      [userId]
    );

    const followCounts = followCountsResult.rows[0];

    // Get user's posts
    const postsResult = await pool.query(
      `SELECT id, caption, image_urls, like_count, comment_count, created_at
       FROM posts 
       WHERE author_id = $1 AND author_type = 'member'
       ORDER BY created_at DESC
       LIMIT 6`,
      [userId]
    );

    const posts = postsResult.rows.map((post) => {
      let imageUrls = post.image_urls;
      // Safely parse image_urls - only if it's a JSON-formatted string
      if (typeof imageUrls === "string") {
        try {
          // Only parse if it looks like JSON (starts with [ or {)
          if (imageUrls.startsWith("[") || imageUrls.startsWith("{")) {
            imageUrls = JSON.parse(imageUrls);
          } else {
            // It's a plain URL string, wrap in array
            imageUrls = [imageUrls];
          }
        } catch (e) {
          // If parsing fails, treat as single URL
          imageUrls = imageUrls ? [imageUrls] : [];
        }
      } else if (!Array.isArray(imageUrls)) {
        imageUrls = imageUrls ? [imageUrls] : [];
      }
      return {
        ...post,
        image_urls: imageUrls,
      };
    });

    // Safely parse interests
    let interests = member.interests;
    if (typeof interests === "string") {
      try {
        if (interests.startsWith("[") || interests.startsWith("{")) {
          interests = JSON.parse(interests);
        } else {
          // It's a comma-separated string, split it
          interests = interests
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      } catch (e) {
        interests = interests
          ? interests
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : [];
      }
    } else if (!Array.isArray(interests)) {
      interests = [];
    }

    // Safely parse location
    let location = member.location;
    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch (e) {
        location = null;
      }
    }

    const profileData = {
      ...member,
      interests,
      follower_count: parseInt(followCounts.follower_count),
      following_count: parseInt(followCounts.following_count),
      pronouns: parsePgTextArray(member.pronouns),
      location,
      // Discover profile fields
      intent_badges: parsePgTextArray(member.intent_badges) || [],
      available_today: member.available_today || false,
      available_this_week: member.available_this_week || false,
      prompt_question: member.prompt_question || "",
      prompt_answer: member.prompt_answer || "",
      appear_in_discover: member.appear_in_discover !== false,
      // New discover profile fields
      discover_photos: (() => {
        if (!member.discover_photos) return [];
        if (Array.isArray(member.discover_photos))
          return member.discover_photos;
        if (typeof member.discover_photos === "string") {
          try {
            return JSON.parse(member.discover_photos);
          } catch {
            return [];
          }
        }
        return [];
      })(),
      openers: (() => {
        if (!member.openers) return [];
        if (Array.isArray(member.openers)) return member.openers;
        if (typeof member.openers === "string") {
          try {
            return JSON.parse(member.openers);
          } catch {
            return [];
          }
        }
        return [];
      })(),
      show_pronouns: member.show_pronouns !== false,
    };

    res.json({
      profile: profileData,
      posts,
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function updatePhoto(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { photo_url } = req.body || {};

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!photo_url) {
      return res.status(400).json({ error: "photo_url is required" });
    }

    const r = await pool.query(
      `UPDATE members SET profile_photo_url = $1 WHERE id = $2 RETURNING id, profile_photo_url`,
      [photo_url, userId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    res.json({ success: true, profile_photo_url: r.rows[0].profile_photo_url });
  } catch (err) {
    console.error("/members/profile/photo error:", err);
    res.status(500).json({ error: "Failed to update photo" });
  }
}

async function searchMembers(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const q = (req.query.query || req.query.q || "").trim();
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
      query = `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
                      (SELECT 1 FROM follows f
                         WHERE f.follower_id = $2 AND f.follower_type = 'member'
                           AND f.following_id = m.id AND f.following_type = 'member'
                         LIMIT 1) IS NOT NULL AS is_following
               FROM members m
               WHERE (LOWER(m.username) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
                 AND m.id <> $2
               ORDER BY m.name ASC
               LIMIT $3 OFFSET $4`;
      params = [likeParam, userId, limit, offset];
    } else {
      query = `SELECT m.id, m.username, m.name as full_name, m.bio, m.profile_photo_url,
                      false AS is_following
               FROM members m
               WHERE (LOWER(m.username) LIKE LOWER($1) OR LOWER(m.name) LIKE LOWER($1))
               ORDER BY m.name ASC
               LIMIT $2 OFFSET $3`;
      params = [likeParam, limit, offset];
    }

    const r = await pool.query(query, params);

    const results = r.rows.map((row) => ({
      id: row.id,
      username: row.username,
      full_name: row.full_name,
      name: row.full_name, // Also include as 'name' for compatibility
      bio: row.bio,
      profile_photo_url: row.profile_photo_url,
      is_following: !!row.is_following,
    }));

    const hasMore = results.length === limit;
    res.json({ results, nextOffset: offset + results.length, hasMore });
  } catch (err) {
    console.error("/members/search error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to search members" });
  }
}

async function getPublicMember(req, res) {
  try {
    const pool = req.app.locals.pool;
    const authUserId = req.user?.id;
    const userType = req.user?.type;
    const targetId = req.params.id;

    if (!authUserId || !userType) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const memberR = await pool.query(
      `SELECT id, username, name as full_name, bio, profile_photo_url, created_at, interests, pronouns
       FROM members
       WHERE id = $1`,
      [targetId]
    );
    if (memberR.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }
    const profile = memberR.rows[0];

    const countsR = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM follows WHERE following_id = $1 AND following_type = 'member') AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND follower_type = 'member') AS following_count,
         (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND author_type = 'member') AS posts_count`,
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
           AND following_id = $3 AND following_type = 'member'
         LIMIT 1`,
        [authUserId, userType, targetId]
      );
      isFollowing = isFollowingR.rows.length > 0;
    }

    res.json({
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      bio: profile.bio,
      profile_photo_url: profile.profile_photo_url,
      created_at: profile.created_at,
      posts_count: parseInt(counts.posts_count || 0, 10),
      followers_count: parseInt(counts.followers_count || 0, 10),
      following_count: parseInt(counts.following_count || 0, 10),
      is_following: isFollowing,
      interests:
        typeof profile.interests === "string"
          ? JSON.parse(profile.interests)
          : profile.interests || [],
      pronouns: parsePgTextArray(profile.pronouns),
    });
  } catch (err) {
    console.error(
      "/members/:id/public error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to load public profile" });
  }
}

async function patchProfile(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      name,
      bio,
      phone,
      pronouns,
      interests,
      location,
      // Discovery profile fields
      intent_badges,
      available_today,
      available_this_week,
      prompt_question,
      prompt_answer,
      appear_in_discover,
      // New discover profile fields
      discover_photos,
      openers,
      show_pronouns,
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
      if (bioTrimmed && bioTrimmed.length > 150) {
        return res
          .status(400)
          .json({ error: "Bio must be 150 characters or less" });
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

    if (pronouns !== undefined) {
      if (pronouns === null) {
        updates.push(`pronouns = NULL`);
      } else if (Array.isArray(pronouns)) {
        if (pronouns.length > 10) {
          return res.status(400).json({ error: "Maximum 10 pronouns allowed" });
        }
        const sanitized = pronouns.filter(
          (p) =>
            typeof p === "string" &&
            p.trim().length > 0 &&
            p.trim().length <= 50
        );
        updates.push(`pronouns = $${paramIndex++}::text[]`);
        values.push(sanitized);
      } else if (typeof pronouns === "string") {
        updates.push(`pronouns = $${paramIndex++}::text[]`);
        values.push([pronouns]);
      }
    }

    if (interests !== undefined) {
      if (!Array.isArray(interests)) {
        return res.status(400).json({ error: "Interests must be an array" });
      }
      if (interests.length > 20) {
        return res.status(400).json({ error: "Maximum 20 interests allowed" });
      }
      const sanitized = interests.filter(
        (i) =>
          typeof i === "string" && i.trim().length > 0 && i.trim().length <= 100
      );
      updates.push(`interests = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(sanitized));
    }

    if (location !== undefined) {
      if (location && typeof location === "object") {
        const locCity = location.city
          ? String(location.city).trim().substring(0, 100)
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
          city: locCity,
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

    // Discovery profile fields
    if (intent_badges !== undefined) {
      if (Array.isArray(intent_badges)) {
        const sanitized = intent_badges
          .filter((b) => typeof b === "string" && b.trim().length > 0)
          .slice(0, 3); // Max 3 badges
        updates.push(`intent_badges = $${paramIndex++}::text[]`);
        values.push(sanitized);
      }
    }

    if (available_today !== undefined) {
      updates.push(`available_today = $${paramIndex++}`);
      values.push(!!available_today);
    }

    if (available_this_week !== undefined) {
      updates.push(`available_this_week = $${paramIndex++}`);
      values.push(!!available_this_week);
    }

    if (prompt_question !== undefined) {
      const sanitized =
        typeof prompt_question === "string"
          ? prompt_question.trim().substring(0, 200)
          : null;
      updates.push(`prompt_question = $${paramIndex++}`);
      values.push(sanitized);
    }

    if (prompt_answer !== undefined) {
      const sanitized =
        typeof prompt_answer === "string"
          ? prompt_answer.trim().substring(0, 200)
          : null;
      updates.push(`prompt_answer = $${paramIndex++}`);
      values.push(sanitized);
    }

    if (appear_in_discover !== undefined) {
      updates.push(`appear_in_discover = $${paramIndex++}`);
      values.push(!!appear_in_discover);
    }

    // New discover profile fields
    if (discover_photos !== undefined) {
      if (Array.isArray(discover_photos)) {
        // Store as JSONB array of photo URLs/objects
        updates.push(`discover_photos = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(discover_photos.slice(0, 4))); // Max 4 photos
      }
    }

    if (openers !== undefined) {
      if (Array.isArray(openers)) {
        // Store as JSONB array of {prompt, response} objects
        const sanitized = openers
          .filter(
            (o) =>
              o &&
              typeof o.prompt === "string" &&
              typeof o.response === "string"
          )
          .slice(0, 3) // Max 3 openers
          .map((o) => ({
            prompt: o.prompt.trim().substring(0, 200),
            response: o.response.trim().substring(0, 200),
          }));
        updates.push(`openers = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(sanitized));
      }
    }

    if (show_pronouns !== undefined) {
      updates.push(`show_pronouns = $${paramIndex++}`);
      values.push(!!show_pronouns);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE members SET ${updates.join(
      ", "
    )} WHERE id = $${paramIndex} RETURNING id, name, bio, phone, pronouns, interests, location`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    const member = result.rows[0];
    res.json({
      success: true,
      profile: {
        name: member.name,
        bio: member.bio,
        phone: member.phone,
        pronouns: parsePgTextArray(member.pronouns),
        interests:
          typeof member.interests === "string"
            ? JSON.parse(member.interests)
            : member.interests,
        location:
          typeof member.location === "string"
            ? JSON.parse(member.location)
            : member.location,
      },
    });
  } catch (err) {
    console.error(
      "/members/profile PATCH error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update profile" });
  }
}

async function changeUsernameEndpoint(req, res) {
  try {
    const pool = req.app.locals.pool;
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId || userType !== "member") {
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
      `SELECT id FROM members WHERE username = $1 AND id <> $2 LIMIT 1`,
      [sanitized, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    await pool.query(`UPDATE members SET username = $1 WHERE id = $2`, [
      sanitized,
      userId,
    ]);

    res.json({ success: true, username: sanitized });
  } catch (err) {
    console.error(
      "/members/username POST error:",
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

    if (!userId || userType !== "member") {
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
      "members",
      userId
    );
    if (emailExists) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const supabase = require("../supabase");
    // Use Supabase OTP to deliver a 6-digit code to the new email.
    // Allow sending to emails that are not yet registered by enabling shouldCreateUser.
    // This does NOT switch the authenticated user; we only use the OTP as proof of inbox control
    // before committing the new email to our members table.
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
      "/members/email/change/start error:",
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

    if (!userId || userType !== "member") {
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

    await pool.query(`UPDATE members SET email = $1 WHERE id = $2`, [
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
      "/members/email/change/verify error:",
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
    if (!userId || userType !== "member") {
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
    const city = loc.city ? String(loc.city).trim().substring(0, 100) : null;
    const state = loc.state ? String(loc.state).trim().substring(0, 100) : null;
    const country = loc.country
      ? String(loc.country).trim().substring(0, 100)
      : null;
    const locationJson = JSON.stringify({ city, state, country, lat, lng });

    await pool.query(`UPDATE members SET location = $1::jsonb WHERE id = $2`, [
      locationJson,
      userId,
    ]);
    await pool.query(
      `INSERT INTO member_location_history (member_id, location) VALUES ($1, $2::jsonb)`,
      [userId, locationJson]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(
      "/members/location POST error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update location" });
  }
}

// ============================================================
// SIGNUP DRAFT FUNCTIONS (Multi-Account System)
// ============================================================

/**
 * Create a draft profile after OTP verification
 * Profile is created with signup_status = 'IN_PROGRESS'
 */
async function createDraft(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailLower = email.toLowerCase().trim();
    console.log("[MemberSignup] Creating draft profile for:", emailLower);

    // Create minimal draft record
    const result = await pool.query(
      `INSERT INTO members (email, signup_status, last_completed_step)
       VALUES ($1, 'IN_PROGRESS', 'email')
       RETURNING id, email, signup_status, last_completed_step, created_at`,
      [emailLower]
    );

    const draft = result.rows[0];
    console.log("[MemberSignup] Draft created with id:", draft.id);

    res.json({
      success: true,
      profile_id: draft.id,
      signup_status: draft.signup_status,
      last_completed_step: draft.last_completed_step,
    });
  } catch (err) {
    console.error(
      "/members/signup/draft error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to create draft profile" });
  }
}

/**
 * Update draft profile with step data
 * Called after each signup step to persist data
 */
async function updateDraft(req, res) {
  try {
    const pool = req.app.locals.pool;
    const profileId = req.params.id;
    const stepData = req.body || {};

    if (!profileId) {
      return res.status(400).json({ error: "Profile ID is required" });
    }

    // Verify draft exists and is IN_PROGRESS
    const existing = await pool.query(
      `SELECT id, signup_status FROM members WHERE id = $1`,
      [profileId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Draft profile not found" });
    }

    if (existing.rows[0].signup_status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Profile is not a draft" });
    }

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = {
      name: "name",
      phone: "phone",
      dob: "dob",
      gender: "gender",
      pronouns: "pronouns",
      interests: "interests",
      location: "location",
      profile_photo_url: "profile_photo_url",
      show_pronouns: "show_pronouns",
      last_completed_step: "last_completed_step",
    };

    for (const [key, column] of Object.entries(allowedFields)) {
      if (stepData[key] !== undefined) {
        if (key === "pronouns" && Array.isArray(stepData[key])) {
          updates.push(`${column} = $${paramIndex++}::text[]`);
          values.push(stepData[key]);
        } else if (key === "interests" && Array.isArray(stepData[key])) {
          updates.push(`${column} = $${paramIndex++}::jsonb`);
          values.push(JSON.stringify(stepData[key]));
        } else if (key === "location" && typeof stepData[key] === "object") {
          updates.push(`${column} = $${paramIndex++}::jsonb`);
          values.push(JSON.stringify(stepData[key]));
        } else if (key === "show_pronouns") {
          updates.push(`${column} = $${paramIndex++}`);
          values.push(!!stepData[key]);
        } else {
          updates.push(`${column} = $${paramIndex++}`);
          values.push(stepData[key]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(profileId);
    const query = `UPDATE members SET ${updates.join(
      ", "
    )} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);
    console.log(
      "[MemberSignup] Draft updated, step:",
      stepData.last_completed_step
    );

    res.json({
      success: true,
      profile_id: result.rows[0].id,
      last_completed_step: result.rows[0].last_completed_step,
    });
  } catch (err) {
    console.error(
      "/members/signup/draft/:id error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to update draft profile" });
  }
}

/**
 * Check for incomplete signup (IN_PROGRESS profiles)
 * Called on app launch to resume signup
 */
async function resumeSignup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { email } = req.query;

    console.log(
      "[resumeSignup] 🔍 Checking for IN_PROGRESS signup, email:",
      email
    );

    if (!email) {
      console.log("[resumeSignup] ❌ No email provided");
      return res.status(400).json({ error: "Email is required" });
    }

    const emailLower = email.toLowerCase().trim();
    console.log("[resumeSignup] 📧 Looking for email:", emailLower);

    // Find IN_PROGRESS profile for this email
    const result = await pool.query(
      `SELECT id, email, name, phone, dob, gender, pronouns, show_pronouns, 
              interests, location, profile_photo_url, signup_status, last_completed_step
       FROM members 
       WHERE LOWER(email) = $1 AND signup_status = 'IN_PROGRESS'
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailLower]
    );

    console.log("[resumeSignup] 📊 Query returned", result.rows.length, "rows");

    if (result.rows.length === 0) {
      console.log("[resumeSignup] ℹ️ No IN_PROGRESS signup found");
      return res.json({ hasInProgressSignup: false });
    }

    const profile = result.rows[0];

    // Parse JSONB fields
    let parsedProfile = {
      ...profile,
      pronouns: parsePgTextArray(profile.pronouns),
      interests:
        typeof profile.interests === "string"
          ? JSON.parse(profile.interests)
          : profile.interests,
      location:
        typeof profile.location === "string"
          ? JSON.parse(profile.location)
          : profile.location,
    };

    res.json({
      hasInProgressSignup: true,
      profile: parsedProfile,
      last_completed_step: profile.last_completed_step,
    });
  } catch (err) {
    console.error(
      "/members/signup/resume error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to check for incomplete signup" });
  }
}

/**
 * Complete signup - sets signup_status = 'ACTIVE'
 * Final step after username is set
 */
async function completeSignup(req, res) {
  try {
    const pool = req.app.locals.pool;
    const profileId = req.params.id;
    const { username } = req.body || {};

    if (!profileId) {
      return res.status(400).json({ error: "Profile ID is required" });
    }

    // Validate username
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    const sanitizedUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9._]{3,30}$/.test(sanitizedUsername)) {
      return res.status(400).json({
        error:
          "Username must be 3-30 characters, lowercase letters, numbers, dots and underscores only",
      });
    }

    // Check if username is taken
    const existingUsername = await pool.query(
      `SELECT id FROM members WHERE username = $1 AND id <> $2 LIMIT 1`,
      [sanitizedUsername, profileId]
    );
    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken" });
    }

    // Verify profile exists and is IN_PROGRESS
    const existing = await pool.query(`SELECT * FROM members WHERE id = $1`, [
      profileId,
    ]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = existing.rows[0];
    if (profile.signup_status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Profile is not in signup flow" });
    }

    // Validate all required fields are present
    const requiredFields = [
      "name",
      "phone",
      "dob",
      "gender",
      "location",
      "interests",
    ];
    const missingFields = requiredFields.filter((field) => !profile[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Complete the signup
    const result = await pool.query(
      `UPDATE members 
       SET username = $1, signup_status = 'ACTIVE', last_completed_step = 'complete'
       WHERE id = $2
       RETURNING *`,
      [sanitizedUsername, profileId]
    );

    console.log("[MemberSignup] Signup completed for:", sanitizedUsername);

    res.json({
      success: true,
      member: result.rows[0],
    });
  } catch (err) {
    console.error(
      "/members/signup/complete error:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ error: "Failed to complete signup" });
  }
}

module.exports = {
  signup,
  getProfile,
  updatePhoto,
  searchMembers,
  getPublicMember,
  patchProfile,
  changeUsernameEndpoint,
  startEmailChange,
  verifyEmailChange,
  updateLocation,
  // Signup draft functions
  createDraft,
  updateDraft,
  resumeSignup,
  completeSignup,
};
