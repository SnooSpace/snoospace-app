/**
 * Qualified Views Controller
 *
 * Handles batch submission and tracking of qualified views.
 * Server-side deduplication ensures ONE public view per user per post, lifetime.
 *
 * Key endpoints:
 * - POST /posts/views/batch - Submit batch of view events
 * - GET /posts/:id/analytics - Get view analytics for a post (creator only)
 */
const { createPool } = require("../config/db");

const pool = createPool();

/**
 * POST /posts/views/batch
 *
 * Accepts a batch of view events and processes them:
 * - Qualified views: Deduped via UNIQUE constraint, increment public_view_count
 * - Repeat views: Stored for analytics only
 *
 * Request body:
 * {
 *   views: [
 *     { postId, type: 'qualified'|'repeat', dwellTime?, trigger?, engagementType? }
 *   ]
 * }
 *
 * Response:
 * {
 *   accepted: [postIds that were new unique views],
 *   duplicate: [postIds that were already viewed],
 *   repeat_logged: [postIds logged as repeat views]
 * }
 */
async function submitViewsBatch(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { views } = req.body;

    if (!Array.isArray(views) || views.length === 0) {
      return res.status(400).json({ error: "views array is required" });
    }

    // Limit batch size
    const maxBatchSize = 100;
    const batch = views.slice(0, maxBatchSize);

    const accepted = [];
    const duplicate = [];
    const repeatLogged = [];

    await client.query("BEGIN");

    for (const view of batch) {
      const { postId, type, dwellTime, trigger, engagementType, postType } =
        view;

      if (!postId) continue;

      if (type === "qualified") {
        // Try to insert unique view (will fail on duplicate due to UNIQUE constraint)
        try {
          await client.query(
            `INSERT INTO unique_view_events (post_id, user_id, user_type, dwell_time_ms, trigger_type, post_type)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              postId,
              userId,
              userType,
              dwellTime || null,
              trigger || "dwell",
              postType || null,
            ],
          );

          // Increment public view count
          await client.query(
            `UPDATE posts SET public_view_count = COALESCE(public_view_count, 0) + 1 WHERE id = $1`,
            [postId],
          );

          accepted.push(postId);
        } catch (e) {
          if (e.code === "23505") {
            // Unique constraint violation - already viewed
            duplicate.push(postId);
          } else {
            console.error(
              `[ViewsController] Error processing view for post ${postId}:`,
              e,
            );
            // Continue processing other views
          }
        }
      } else if (type === "repeat") {
        // Log repeat/engaged view (no unique constraint)
        try {
          await client.query(
            `INSERT INTO repeat_view_events (post_id, user_id, user_type, engagement_type, dwell_time_ms)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              postId,
              userId,
              userType,
              engagementType || "revisit",
              dwellTime || null,
            ],
          );
          repeatLogged.push(postId);
        } catch (e) {
          console.error(
            `[ViewsController] Error logging repeat view for post ${postId}:`,
            e,
          );
        }
      }
    }

    await client.query("COMMIT");

    return res.json({
      accepted,
      duplicate,
      repeat_logged: repeatLogged,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[ViewsController] submitViewsBatch error:", e);
    return res.status(500).json({ error: "Failed to process views" });
  } finally {
    client.release();
  }
}

/**
 * GET /posts/:id/analytics
 *
 * Returns view analytics for a post (creator only).
 * Includes: unique views, repeat views, engaged views, avg dwell time.
 */
async function getPostViewAnalytics(req, res) {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;
    const userType = req.user.type;

    // Verify the user is the post author
    const postResult = await pool.query(
      `SELECT author_id, author_type, public_view_count FROM posts WHERE id = $1`,
      [postId],
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postResult.rows[0];
    if (post.author_id !== userId || post.author_type !== userType) {
      return res
        .status(403)
        .json({ error: "Not authorized to view analytics" });
    }

    // Get unique view stats
    const uniqueStats = await pool.query(
      `SELECT 
        COUNT(*) as unique_views,
        AVG(dwell_time_ms)::INTEGER as avg_dwell_time
       FROM unique_view_events
       WHERE post_id = $1`,
      [postId],
    );

    // Get repeat/engaged view stats
    const repeatStats = await pool.query(
      `SELECT 
        COUNT(*) as repeat_views,
        COUNT(*) FILTER (WHERE engagement_type IN ('expand', 'zoom', 'unmute', 'fullscreen', 'completion_50', 'unmuted_25')) as engaged_views,
        COUNT(*) FILTER (WHERE engagement_type = 'loop') as loop_count,
        COUNT(*) FILTER (WHERE engagement_type = 'replay') as replay_count
       FROM repeat_view_events
       WHERE post_id = $1`,
      [postId],
    );

    return res.json({
      post_id: parseInt(postId),
      public_view_count: post.public_view_count || 0,
      unique_views: parseInt(uniqueStats.rows[0]?.unique_views || 0),
      repeat_views: parseInt(repeatStats.rows[0]?.repeat_views || 0),
      engaged_views: parseInt(repeatStats.rows[0]?.engaged_views || 0),
      avg_dwell_time_ms: uniqueStats.rows[0]?.avg_dwell_time || 0,
      loop_count: parseInt(repeatStats.rows[0]?.loop_count || 0),
      replay_count: parseInt(repeatStats.rows[0]?.replay_count || 0),
    });
  } catch (e) {
    console.error("[ViewsController] getPostViewAnalytics error:", e);
    return res.status(500).json({ error: "Failed to get analytics" });
  }
}

/**
 * Check if user has viewed a post (for client-side cache validation)
 * Called on feed load to sync local cache with server truth
 */
async function getViewedPosts(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { postIds } = req.query;

    if (!postIds) {
      return res.json({ viewed: [] });
    }

    const ids = postIds
      .split(",")
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return res.json({ viewed: [] });
    }

    const result = await pool.query(
      `SELECT post_id FROM unique_view_events 
       WHERE user_id = $1 AND user_type = $2 AND post_id = ANY($3)`,
      [userId, userType, ids],
    );

    return res.json({
      viewed: result.rows.map((r) => r.post_id),
    });
  } catch (e) {
    console.error("[ViewsController] getViewedPosts error:", e);
    return res.status(500).json({ error: "Failed to check viewed posts" });
  }
}

module.exports = {
  submitViewsBatch,
  getPostViewAnalytics,
  getViewedPosts,
};
