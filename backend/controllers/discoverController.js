const { createPool } = require("../config/db");

const pool = createPool();

/**
 * Get discover feed - mixed posts and events for explore page
 * Returns content from all users, not just followed
 * Prioritizes: engagement (likes/comments), recency, events
 */
const getDiscoverFeed = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { limit = 30, offset = 0, type = "all" } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const items = [];
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Fetch posts (from everyone, not just followed)
    if (type === "all" || type === "posts") {
      const postsQuery = `
        SELECT 
          p.id,
          p.caption,
          p.image_urls,
          p.like_count,
          p.comment_count,
          p.created_at,
          p.author_id,
          p.author_type,
          CASE 
            WHEN p.author_type = 'member' THEN m.name
            WHEN p.author_type = 'community' THEN c.name
            ELSE NULL
          END as author_name,
          CASE 
            WHEN p.author_type = 'member' THEN m.username
            WHEN p.author_type = 'community' THEN c.username
            ELSE NULL
          END as author_username,
          CASE 
            WHEN p.author_type = 'member' THEN m.profile_photo_url
            WHEN p.author_type = 'community' THEN c.logo_url
            ELSE NULL
          END as author_photo,
          'post' as item_type,
          -- Engagement score: likes + comments*2 + recency bonus
          (p.like_count + p.comment_count * 2 + 
           GREATEST(0, 10 - EXTRACT(DAY FROM NOW() - p.created_at))) as score
        FROM posts p
        LEFT JOIN members m ON p.author_id = m.id AND p.author_type = 'member'
        LEFT JOIN communities c ON p.author_id = c.id AND p.author_type = 'community'
        WHERE p.author_id != $1 OR p.author_type != $2
        ORDER BY score DESC, p.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const postsResult = await pool.query(postsQuery, [
        userId,
        userType,
        parsedLimit,
        parsedOffset,
      ]);

      // Transform posts for grid display
      postsResult.rows.forEach((post) => {
        items.push({
          id: post.id,
          item_type: "post",
          thumbnail_url: post.image_urls?.[0] || null,
          image_urls: post.image_urls,
          caption: post.caption,
          like_count: post.like_count,
          comment_count: post.comment_count,
          author_id: post.author_id,
          author_type: post.author_type,
          author_name: post.author_name,
          author_username: post.author_username,
          author_photo: post.author_photo,
          created_at: post.created_at,
          score: post.score,
          // Grid layout: posts take 1 column
          grid_span: 1,
        });
      });
    }

    // Fetch upcoming events
    if (type === "all" || type === "events") {
      const eventsQuery = `
        SELECT 
          e.id,
          e.title,
          e.description,
          e.banner_url,
          e.start_datetime as event_date,
          e.location_url,
          e.event_type,
          COALESCE(e.community_id, e.creator_id) as community_id,
          c.name as community_name,
          c.username as community_username,
          c.logo_url as community_logo,
          COALESCE(
            (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.registration_status = 'registered'),
            0
          ) as attendee_count,
          'event' as item_type,
          -- Events get higher base score to appear in feed
          50 + (COALESCE((SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id), 0) * 3) as score
        FROM events e
        INNER JOIN communities c ON COALESCE(e.community_id, e.creator_id) = c.id
        WHERE (e.is_published = true OR e.is_published IS NULL)
          AND e.is_cancelled IS NOT TRUE
          AND e.start_datetime > NOW()
        ORDER BY e.start_datetime ASC
        LIMIT $1 OFFSET $2
      `;

      // Fetch fewer events than posts (1:3 ratio)
      const eventLimit = Math.max(5, Math.floor(parsedLimit / 3));
      const eventsResult = await pool.query(eventsQuery, [
        eventLimit,
        Math.floor(parsedOffset / 3),
      ]);

      eventsResult.rows.forEach((event) => {
        items.push({
          id: event.id,
          item_type: "event",
          thumbnail_url: event.banner_url,
          title: event.title,
          description: event.description,
          event_date: event.event_date,
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
          location_url: event.location_url,
          event_type: event.event_type,
          community_id: event.community_id,
          community_name: event.community_name,
          community_username: event.community_username,
          community_logo: event.community_logo,
          attendee_count: parseInt(event.attendee_count),
          score: event.score,
          // Events take 2 columns in grid (stand out)
          grid_span: 2,
        });
      });
    }

    // Sort combined items by score
    items.sort((a, b) => b.score - a.score);

    // Interleave events with posts (insert event after every ~5-6 posts)
    const interleavedItems = [];
    const events = items.filter((i) => i.item_type === "event");
    const posts = items.filter((i) => i.item_type === "post");

    let eventIndex = 0;
    posts.forEach((post, index) => {
      interleavedItems.push(post);
      // Insert event after every 5-6 posts
      if ((index + 1) % 5 === 0 && eventIndex < events.length) {
        interleavedItems.push(events[eventIndex]);
        eventIndex++;
      }
    });
    // Add remaining events at the end
    while (eventIndex < events.length) {
      interleavedItems.push(events[eventIndex]);
      eventIndex++;
    }

    res.json({
      success: true,
      items: interleavedItems,
      hasMore: posts.length === parsedLimit,
    });
  } catch (error) {
    console.error("Error getting discover feed:", error);
    res.status(500).json({ error: "Failed to get discover feed" });
  }
};

/**
 * Get suggested communities based on user's interests
 * Excludes communities user already follows
 * Used for "Based on your Interests" section
 */
const getSuggestedCommunities = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;
    const { limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only members see suggestions (communities don't need to join other communities)
    if (userType !== "member") {
      return res.json({ success: true, suggestions: [] });
    }

    // Get user's interests
    const interestsResult = await pool.query(
      "SELECT interests FROM members WHERE id = $1",
      [userId]
    );

    const userInterests = interestsResult.rows[0]?.interests || [];

    // If no interests, return popular communities
    let suggestionsQuery;
    let queryParams;

    if (userInterests.length > 0) {
      // Find communities matching user interests (category matches)
      suggestionsQuery = `
        SELECT 
          c.id,
          c.name,
          c.username,
          c.logo_url,
          c.category,
          c.bio,
          COALESCE(
            (SELECT COUNT(*) FROM follows f 
             WHERE f.following_id = c.id AND f.following_type = 'community'),
            0
          )::int as follower_count,
          -- Matching score based on category match
          CASE 
            WHEN c.category = ANY($1) THEN 50
            ELSE 0
          END as match_score
        FROM communities c
        WHERE c.id NOT IN (
          -- Exclude already followed
          SELECT following_id FROM follows 
          WHERE follower_id = $2 AND follower_type = 'member' AND following_type = 'community'
        )
        ORDER BY match_score DESC, follower_count DESC
        LIMIT $3
      `;
      queryParams = [userInterests, userId, parseInt(limit)];
    } else {
      // Fallback: return popular communities
      suggestionsQuery = `
        SELECT 
          c.id,
          c.name,
          c.username,
          c.logo_url,
          c.category,
          c.bio,
          COALESCE(
            (SELECT COUNT(*) FROM follows f 
             WHERE f.following_id = c.id AND f.following_type = 'community'),
            0
          )::int as follower_count,
          0 as match_score
        FROM communities c
        WHERE c.id NOT IN (
          SELECT following_id FROM follows 
          WHERE follower_id = $1 AND follower_type = 'member' AND following_type = 'community'
        )
        ORDER BY follower_count DESC
        LIMIT $2
      `;
      queryParams = [userId, parseInt(limit)];
    }

    const result = await pool.query(suggestionsQuery, queryParams);

    const suggestions = result.rows.map((community) => ({
      id: community.id,
      name: community.name,
      username: community.username,
      logo_url: community.logo_url,
      category: community.category,
      bio: community.bio,
      follower_count: community.follower_count,
      is_following: false, // Always false since we exclude followed
    }));

    res.json({
      success: true,
      suggestions,
      hasMore: result.rows.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting suggested communities:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
};

module.exports = {
  getDiscoverFeed,
  getSuggestedCommunities,
};
