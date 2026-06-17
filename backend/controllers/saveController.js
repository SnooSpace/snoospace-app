const { createPool } = require("../config/db");
const pool = createPool();

/**
 * Save a post
 * POST /posts/:postId/save
 */
const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;

    // Check if post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [
      postId,
    ]);

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if already saved
    const existingCheck = await pool.query(
      "SELECT id FROM post_saves WHERE post_id = $1 AND saver_id = $2 AND saver_type = $3",
      [postId, userId, userType],
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: "Post already saved" });
    }

    // Save the post
    await pool.query(
      `INSERT INTO post_saves (post_id, saver_id, saver_type)
       VALUES ($1, $2, $3)`,
      [postId, userId, userType],
    );

    // Increment save count
    await pool.query(
      "UPDATE posts SET save_count = save_count + 1 WHERE id = $1",
      [postId],
    );

    const updatedPost = await pool.query(
      "SELECT save_count FROM posts WHERE id = $1",
      [postId],
    );

    res.json({
      success: true,
      isSaved: true,
      saveCount: updatedPost.rows[0].save_count,
    });
  } catch (error) {
    console.error("Save post error:", error);
    res.status(500).json({ error: "Failed to save post" });
  }
};

/**
 * Unsave a post
 * DELETE /posts/:postId/save
 */
const unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;

    // Delete the save
    const result = await pool.query(
      `DELETE FROM post_saves 
       WHERE post_id = $1 AND saver_id = $2 AND saver_type = $3
       RETURNING id`,
      [postId, userId, userType],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Save not found" });
    }

    // Decrement save count
    await pool.query(
      "UPDATE posts SET save_count = GREATEST(0, save_count - 1) WHERE id = $1",
      [postId],
    );

    const updatedPost = await pool.query(
      "SELECT save_count FROM posts WHERE id = $1",
      [postId],
    );

    res.json({
      success: true,
      isSaved: false,
      saveCount: updatedPost.rows[0].save_count,
    });
  } catch (error) {
    console.error("Unsave post error:", error);
    res.status(500).json({ error: "Failed to unsave post" });
  }
};

/**
 * Get all saved posts for a user
 * GET /saved-posts
 */
const getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get saved regular posts with full post details
    const postsResult = await pool.query(
      `SELECT 
        p.*,
        ps.created_at as saved_at,
        TRUE as is_saved,
        -- Author details based on author_type
        CASE 
          WHEN p.author_type = 'member' THEN (SELECT name FROM members WHERE id = p.author_id)
          WHEN p.author_type = 'community' THEN (SELECT name FROM communities WHERE id = p.author_id)
          WHEN p.author_type = 'sponsor' THEN (SELECT brand_name FROM sponsors WHERE id = p.author_id)
          WHEN p.author_type = 'venue' THEN (SELECT name FROM venues WHERE id = p.author_id)
        END as author_name,
        CASE 
          WHEN p.author_type = 'member' THEN (SELECT username FROM members WHERE id = p.author_id)
          WHEN p.author_type = 'community' THEN (SELECT username FROM communities WHERE id = p.author_id)
          WHEN p.author_type = 'sponsor' THEN (SELECT username FROM sponsors WHERE id = p.author_id)
          WHEN p.author_type = 'venue' THEN (SELECT username FROM venues WHERE id = p.author_id)
        END as author_username,
        CASE 
          WHEN p.author_type = 'member' THEN (SELECT profile_photo_url FROM members WHERE id = p.author_id)
          WHEN p.author_type = 'community' THEN (SELECT logo_url FROM communities WHERE id = p.author_id)
          WHEN p.author_type = 'sponsor' THEN (SELECT logo_url FROM sponsors WHERE id = p.author_id)
          WHEN p.author_type = 'venue' THEN (SELECT logo_url FROM venues WHERE id = p.author_id)
        END as author_photo_url,
        -- Check if current user liked this post
        EXISTS(
          SELECT 1 FROM post_likes 
          WHERE post_id = p.id 
            AND liker_id = $1 
            AND liker_type = $2
        ) as is_liked
       FROM post_saves ps
       JOIN posts p ON ps.post_id = p.id
       WHERE ps.saver_id = $1 AND ps.saver_type = $2
       ORDER BY ps.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, userType, limit, offset],
    );

    // Also get saved opportunities (stored in opportunity_saves, separate from post_saves)
    let savedOpps = [];
    try {
      const oppsResult = await pool.query(
        `SELECT
          o.*,
          os.created_at as saved_at,
          TRUE as is_saved,
          'opportunity' as post_type,
          CASE
            WHEN o.creator_type = 'community' THEN c.name
            WHEN o.creator_type = 'member' THEN m.name
          END as creator_name,
          CASE
            WHEN o.creator_type = 'community' THEN c.logo_url
            WHEN o.creator_type = 'member' THEN m.profile_photo_url
          END as creator_photo,
          CASE
            WHEN o.creator_type = 'community' THEN c.username
            WHEN o.creator_type = 'member' THEN m.username
          END as creator_username,
          COALESCE(o.like_count, 0) as like_count,
          COALESCE(o.view_count, 0) as view_count,
          COALESCE(o.comment_count, 0) as comment_count,
          EXISTS(
            SELECT 1 FROM opportunity_likes ol
            WHERE ol.opportunity_id = o.id AND ol.liker_id = $1 AND ol.liker_type = $2
          ) AS is_liked
        FROM opportunity_saves os
        JOIN opportunities o ON os.opportunity_id = o.id
        LEFT JOIN communities c ON o.creator_id::integer = c.id AND o.creator_type = 'community'
        LEFT JOIN members m ON o.creator_id::integer = m.id AND o.creator_type = 'member'
        WHERE os.saver_id = $1 AND os.saver_type = $2
        ORDER BY os.created_at DESC`,
        [userId, userType],
      );

      // Also fetch skill_groups for each saved opportunity
      savedOpps = await Promise.all(
        oppsResult.rows.map(async (opp) => {
          try {
            const sgResult = await pool.query(
              `SELECT role, tools, sample_type FROM opportunity_skill_groups
               WHERE opportunity_id = $1 ORDER BY display_order`,
              [opp.id],
            );
            return { ...opp, skill_groups: sgResult.rows };
          } catch (_) {
            return { ...opp, skill_groups: [] };
          }
        }),
      );
    } catch (oppErr) {
      // opportunity_saves table may not exist yet — non-fatal
      console.warn("[getSavedPosts] Could not fetch saved opportunities:", oppErr.message);
    }

    const parsedPosts = postsResult.rows.map((row) => {
      const typeData = (() => {
        try {
          if (!row.type_data) return {};
          if (typeof row.type_data === "object") return row.type_data;
          return JSON.parse(row.type_data);
        } catch {
          return {};
        }
      })();
      const isAnon = typeData.is_anonymous === true;
      const isOwn = String(row.author_id) === String(userId) && row.author_type === userType;

      const updated = {
        ...row,
        type_data: typeData,
        image_urls: (() => {
          try {
            if (!row.image_urls) return [];
            if (Array.isArray(row.image_urls)) return row.image_urls;
            const parsed = JSON.parse(row.image_urls);
            return Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            return row.image_urls ? [row.image_urls] : [];
          }
        })(),
      };

      if (isAnon) {
        updated.author_name = "Anonymous";
        updated.author_username = null;
        updated.author_photo_url = null;
        if (!isOwn) {
          updated.author_id = null;
          updated.author_type = null;
        }
      }
      return updated;
    });

    // Merge and sort by saved_at descending
    const allSaved = [...parsedPosts, ...savedOpps].sort(
      (a, b) => new Date(b.saved_at) - new Date(a.saved_at),
    );

    res.json({
      posts: allSaved,
      hasMore: postsResult.rows.length === limit,
    });
  } catch (error) {
    console.error("Get saved posts error:", error);
    res.status(500).json({ error: "Failed to get saved posts" });
  }
};


/**
 * Check save status for multiple posts (batch)
 * POST /posts/save-status/batch
 */
const checkSaveStatus = async (req, res) => {
  try {
    const { postIds } = req.body; // array of post IDs
    const userId = req.user.id;
    const userType = req.user.type;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ error: "postIds array required" });
    }

    const result = await pool.query(
      `SELECT post_id 
       FROM post_saves 
       WHERE post_id = ANY($1) 
         AND saver_id = $2 
         AND saver_type = $3`,
      [postIds, userId, userType],
    );

    // Create a map of postId -> isSaved
    const saveStatus = {};
    postIds.forEach((id) => {
      saveStatus[id] = false;
    });
    result.rows.forEach((row) => {
      saveStatus[row.post_id] = true;
    });

    res.json({ saveStatus });
  } catch (error) {
    console.error("Check save status error:", error);
    res.status(500).json({ error: "Failed to check save status" });
  }
};

module.exports = {
  savePost,
  unsavePost,
  getSavedPosts,
  checkSaveStatus,
};
