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
      const { postId, type, dwellTime, trigger, engagementType, postType, viewSource } =
        view;

      if (!postId) continue;

      // Skip submission-prefixed IDs (e.g. "sub_8") that are not real post IDs.
      // The ChallengeSubmissionsScreen reuses the view tracking service with
      // synthetic "sub_<id>" keys for viewport tracking — these must not be
      // forwarded to the posts view tables which expect plain integer post IDs.
      const numericPostId = parseInt(postId, 10);
      if (isNaN(numericPostId) || String(numericPostId) !== String(postId)) continue;


      if (type === "qualified") {
        // Try to insert unique view (will fail on duplicate due to UNIQUE constraint)
        // Use SAVEPOINT to prevent one failure from aborting the entire transaction
        const savepointName = `sp_view_${postId}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(
            `INSERT INTO unique_view_events (post_id, user_id, user_type, dwell_time_ms, trigger_type, post_type, view_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              postId,
              userId,
              userType,
              dwellTime || null,
              trigger || "dwell",
              postType || null,
              viewSource || null,
            ],
          );

          // Increment public view count (first-time qualification only)
          await client.query(
            `UPDATE posts SET public_view_count = COALESCE(public_view_count, 0) + 1 WHERE id = $1`,
            [postId],
          );

          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          accepted.push(postId);
        } catch (e) {
          // Rollback to savepoint to allow transaction to continue
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
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

        // Reset unseen impression state on EVERY qualified dwell (≥2s), whether this
        // is the user's first-ever qualification or a repeat dwell on an already-qualified
        // post. This must run outside the savepoint block so a 23505 duplicate error
        // on unique_view_events does NOT prevent the strike count from being cleared.
        try {
          await client.query(
            `UPDATE post_impression_state
             SET unseen_count = 0, retired_at = NULL
             WHERE user_id = $1 AND user_type = $2 AND post_id = $3`,
            [userId, userType, postId],
          );
        } catch (resetErr) {
          // Non-fatal — log but do not abort the outer transaction
          console.error(
            `[ViewsController] post_impression_state reset failed for post ${postId}:`,
            resetErr,
          );
        }
      } else if (type === "repeat") {
        // Log repeat/engaged view.
        // Uses ON CONFLICT DO NOTHING so duplicate PKs are silently skipped
        // rather than throwing a 23505 error that aborts the whole transaction.
        try {
          await client.query(
            `INSERT INTO repeat_view_events (post_id, user_id, user_type, engagement_type, dwell_time_ms)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
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
          // Unexpected error — log but do not let it abort the transaction
          const savepointName = `sp_repeat_${postId}`;
          try { await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`); } catch (_) {}
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

/**
 * GET /posts/:postId/view-stats
 *
 * Public view stats — no ownership check.
 * Returns unique viewer count and total impression count (including revisits).
 * Used by the post card "View Insights" bottom sheet visible to all users.
 */
async function getPostViewStats(req, res) {
  try {
    const { postId } = req.params;

    const result = await pool.query(
      `SELECT
         p.public_view_count AS unique_views,
         p.public_view_count + COUNT(r.id) AS total_views
       FROM posts p
       LEFT JOIN repeat_view_events r ON r.post_id = p.id
       WHERE p.id = $1
       GROUP BY p.public_view_count`,
      [postId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const row = result.rows[0];
    return res.json({
      post_id: parseInt(postId),
      unique_views: parseInt(row.unique_views || 0),
      total_views: parseInt(row.total_views || 0),
    });
  } catch (e) {
    console.error("[ViewsController] getPostViewStats error:", e);
    return res.status(500).json({ error: "Failed to get view stats" });
  }
}

/**
 * GET /events/:eventId/view-stats
 *
 * Returns unique viewer count (from events.view_count) and total impression count
 * (unique_views + COUNT(event_repeat_view_events)).
 */
async function getEventViewStats(req, res) {
  try {
    const { eventId } = req.params;
    const result = await pool.query(
      `SELECT
         COALESCE(e.view_count, 0) AS unique_views,
         COALESCE(e.view_count, 0) + COUNT(r.id) AS total_views
       FROM events e
       LEFT JOIN event_repeat_view_events r ON r.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.view_count`,
      [eventId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    const row = result.rows[0];
    return res.json({
      event_id: parseInt(eventId),
      unique_views: parseInt(row.unique_views || 0),
      total_views: parseInt(row.total_views || 0),
    });
  } catch (e) {
    console.error("[ViewsController] getEventViewStats error:", e);
    return res.status(500).json({ error: "Failed to get event view stats" });
  }
}

/**
 * GET /opportunities/:opportunityId/view-stats
 *
 * Returns unique viewer count (from opportunities.view_count) and total impression count
 * (unique_views + COUNT(opportunity_repeat_view_events)).
 */
async function getOpportunityViewStats(req, res) {
  try {
    const { opportunityId } = req.params;
    const result = await pool.query(
      `SELECT
         COALESCE(o.view_count, 0) AS unique_views,
         COALESCE(o.view_count, 0) + COUNT(r.id) AS total_views
       FROM opportunities o
       LEFT JOIN opportunity_repeat_view_events r ON r.opportunity_id = o.id
       WHERE o.id = $1
       GROUP BY o.view_count`,
      [opportunityId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const row = result.rows[0];
    return res.json({
      opportunity_id: opportunityId,
      unique_views: parseInt(row.unique_views || 0),
      total_views: parseInt(row.total_views || 0),
    });
  } catch (e) {
    console.error("[ViewsController] getOpportunityViewStats error:", e);
    return res.status(500).json({ error: "Failed to get opportunity view stats" });
  }
}

/**
 * PATCH /posts/views/:postId/dwell
 *
 * Updates the dwell_time_ms for an existing unique_view_event.
 * Called when video playback ends to record actual total watch time.
 */
async function updateDwellTime(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { postId } = req.params;
    const { dwellTimeMs } = req.body;

    if (!postId || !dwellTimeMs || typeof dwellTimeMs !== 'number') {
      return res.status(400).json({ error: 'postId and dwellTimeMs (number) are required' });
    }

    // Only update if the new dwell time is greater than what's already stored
    const result = await pool.query(
      `UPDATE unique_view_events
       SET dwell_time_ms = GREATEST(COALESCE(dwell_time_ms, 0), $1)
       WHERE post_id = $2 AND user_id = $3 AND user_type = $4
       RETURNING dwell_time_ms`,
      [Math.round(dwellTimeMs), postId, userId, userType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No unique view event found for this post' });
    }

    return res.json({ success: true, dwell_time_ms: result.rows[0].dwell_time_ms });
  } catch (e) {
    console.error('[ViewsController] updateDwellTime error:', e);
    return res.status(500).json({ error: 'Failed to update dwell time' });
  }
}

/**
 * POST /posts/views/unseen
 *
 * Records an unseen impression (scrolled past without qualifying).
 * Deduplicated per session via last_session_id in post_impression_state.
 */
async function submitUnseenImpression(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { postId, postIds, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    let idsToProcess = [];
    if (postId !== undefined && postId !== null) {
      idsToProcess.push(postId);
    } else if (Array.isArray(postIds)) {
      idsToProcess = postIds;
    } else if (Array.isArray(req.body.views)) {
      idsToProcess = req.body.views.map((v) => (typeof v === "object" ? v.postId : v));
    }

    const validIds = idsToProcess
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (validIds.length === 0) {
      return res.status(400).json({ error: "No valid post IDs provided" });
    }

    for (const id of validIds) {
      await pool.query(
        `INSERT INTO post_impression_state (user_id, user_type, post_id, unseen_count, last_session_id)
         VALUES ($1, $2, $3, 1, $4)
         ON CONFLICT (user_id, user_type, post_id)
         DO UPDATE SET
           unseen_count = CASE
             WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
             THEN LEAST(post_impression_state.unseen_count + 1, 2)
             ELSE post_impression_state.unseen_count
           END,
           last_session_id = EXCLUDED.last_session_id,
           retired_at = CASE
             WHEN post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
               AND post_impression_state.unseen_count + 1 >= 2
             THEN COALESCE(post_impression_state.retired_at, NOW())
             ELSE post_impression_state.retired_at
           END
         WHERE post_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id`,
        [userId, userType, id, sessionId]
      );
      console.log(`[UNSEEN] Backend upserted unseen impression: post ${id} for user ${userId} (session: ${sessionId}) — strike ${2} triggers retirement if unseen_count was already 1`);
    }

    return res.json({ success: true, processed: validIds.length });
  } catch (e) {
    console.error("[ViewsController] submitUnseenImpression error:", e);
    return res.status(500).json({ error: "Failed to record unseen impression" });
  }
}

/**
 * POST /events/views/unseen
 *
 * Records an unseen impression for an Event (scrolled past without qualifying).
 * Mirrors submitUnseenImpression exactly but targets event_impression_state
 * with an INTEGER event_id (no UUID handling needed — events.id is INTEGER).
 */
async function submitUnseenEventImpression(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { eventId, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const numericEventId = parseInt(eventId, 10);
    if (!eventId || isNaN(numericEventId)) {
      return res.status(400).json({ error: "Valid eventId is required" });
    }

    await pool.query(
      `INSERT INTO event_impression_state (user_id, user_type, event_id, unseen_count, last_session_id)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (user_id, user_type, event_id)
       DO UPDATE SET
         unseen_count = CASE
           WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
           THEN LEAST(event_impression_state.unseen_count + 1, 2)
           ELSE event_impression_state.unseen_count
         END,
         last_session_id = EXCLUDED.last_session_id,
         retired_at = CASE
           WHEN event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
             AND event_impression_state.unseen_count + 1 >= 2
           THEN COALESCE(event_impression_state.retired_at, NOW())
           ELSE event_impression_state.retired_at
         END
       WHERE event_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id`,
      [userId, userType, numericEventId, sessionId]
    );

    console.log(`[UNSEEN-EVENT] Upserted unseen impression: event ${numericEventId} for user ${userId} (session: ${sessionId})`);
    return res.json({ success: true });
  } catch (e) {
    console.error("[ViewsController] submitUnseenEventImpression error:", e);
    return res.status(500).json({ error: "Failed to record unseen event impression" });
  }
}

/**
 * POST /opportunities/views/unseen
 *
 * Records an unseen impression for an Opportunity (scrolled past without qualifying).
 * Mirrors submitUnseenImpression exactly but targets opportunity_impression_state
 * with a UUID opportunity_id — no parseInt guard applied here.
 */
async function submitUnseenOpportunityImpression(req, res) {
  try {
    const userId = req.user.id;
    const userType = req.user.type;
    const { opportunityId, sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!opportunityId) {
      return res.status(400).json({ error: "opportunityId is required" });
    }

    await pool.query(
      `INSERT INTO opportunity_impression_state (user_id, user_type, opportunity_id, unseen_count, last_session_id)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (user_id, user_type, opportunity_id)
       DO UPDATE SET
         unseen_count = CASE
           WHEN opportunity_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
           THEN LEAST(opportunity_impression_state.unseen_count + 1, 2)
           ELSE opportunity_impression_state.unseen_count
         END,
         last_session_id = EXCLUDED.last_session_id,
         retired_at = CASE
           WHEN opportunity_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id
             AND opportunity_impression_state.unseen_count + 1 >= 2
           THEN COALESCE(opportunity_impression_state.retired_at, NOW())
           ELSE opportunity_impression_state.retired_at
         END
       WHERE opportunity_impression_state.last_session_id IS DISTINCT FROM EXCLUDED.last_session_id`,
      [userId, userType, opportunityId, sessionId]
    );

    console.log(`[UNSEEN-OPP] Upserted unseen impression: opportunity ${opportunityId} for user ${userId} (session: ${sessionId})`);
    return res.json({ success: true });
  } catch (e) {
    console.error("[ViewsController] submitUnseenOpportunityImpression error:", e);
    return res.status(500).json({ error: "Failed to record unseen opportunity impression" });
  }
}

module.exports = {
  submitViewsBatch,
  getPostViewAnalytics,
  getViewedPosts,
  getPostViewStats,
  getEventViewStats,
  getOpportunityViewStats,
  updateDwellTime,
  submitUnseenImpression,
  submitUnseenEventImpression,
  submitUnseenOpportunityImpression,
};
