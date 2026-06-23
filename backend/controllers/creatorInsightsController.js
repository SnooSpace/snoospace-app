/**
 * Creator Insights Controller
 *
 * Member-scoped audience intelligence endpoints.
 * Scoped to the authenticated member's own data — never touches community data.
 *
 * DO NOT merge into audienceIntelligenceController.js. That file handles
 * community-scoped audience data. This file handles member-scoped creator data.
 *
 * Routes (all require authMiddleware):
 *   GET /members/me/creator-insights/summary
 *   GET /members/me/creator-insights/reach
 *   GET /members/me/creator-insights/follower-trend
 */

// ── Follow quality label mapping ──────────────────────────────────────────────
function followQualityLabel(score) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 40) return "Fair";
  return "Low";
}

// ── Period → interval ─────────────────────────────────────────────────────────
function periodToInterval(period) {
  switch (period) {
    case "7d":  return "7 days";
    case "90d": return "90 days";
    default:    return "30 days"; // default: 30d
  }
}

// ============================================================
// GET /members/me/creator-insights/summary
// ============================================================

/**
 * Returns a top-level summary of the creator's audience health.
 *
 * audience_score: The member's personal AQI score from user_aqi_signals
 * (same formula as the community AQI, but scoped to the member's own
 * behavioral data — not their community's).
 *
 * follow_quality.breakdown: Uses follow_source from follow_events as a
 * proxy for intent. Dwell-time percentage cannot be computed here because
 * content total duration is not stored alongside follow_events.
 * // NOTE: When a video-duration column is added to posts/content tables,
 * // replace this with (content_consumed_duration_seconds / total_duration * 100)
 * // bucketing: Casual <25%, Interested 25–75%, High-intent >75%.
 *
 * Intent proxy mapping:
 *   High-intent → follow_source IN ('content_post', 'content_video')
 *   Interested  → follow_source IN ('event_attendance', 'event_recap')
 *   Casual      → all other sources (search_discovery, profile_visit, social_referral, unknown)
 */
async function getCreatorAudienceSummary(req, res) {
  try {
    // Use the shared pool from app.locals — same connection as all other controllers.
    // NEVER create a module-level pool here; that causes a separate DB connection
    // with potentially stale/wrong env vars and bypasses the app's connection management.
    const pool = req.app.locals.pool;
    const memberId = req.user?.id;
    if (!memberId) return res.status(401).json({ error: "Authentication required" });

    // ── 1. Audience score — member's personal AQI ─────────────────────────────
    const aqiResult = await pool.query(
      `SELECT aqi_score FROM user_aqi_signals WHERE user_id = $1`,
      [memberId]
    );
    const audienceScore = Math.round(parseFloat(aqiResult.rows[0]?.aqi_score ?? 0));

    // ── 2. Total followers — read denormalized count for O(1) lookup ─────────
    const followersResult = await pool.query(
      `SELECT creator_follower_count AS total FROM members WHERE id = $1`,
      [memberId]
    );
    const totalFollowers = parseInt(followersResult.rows[0]?.total ?? 0);

    // ── 3. Net new creator followers in last 7 days ────────────────────────────
    const deltaResult = await pool.query(
      `SELECT COUNT(*) AS new_follows
       FROM creator_follows
       WHERE creator_id = $1
         AND is_dormant = false
         AND created_at >= NOW() - INTERVAL '7 days'`,
      [memberId]
    );
    const followersDelta7d = parseInt(deltaResult.rows[0]?.new_follows ?? 0);

    // ── 4. Circle count (mutual connections) ─────────────────────────────────
    let circleCount = 0;
    try {
      const circleResult = await pool.query(
        `SELECT COUNT(*) AS cnt
         FROM circles
         WHERE user_a_id = $1 OR user_b_id = $1`,
        [memberId]
      );
      circleCount = parseInt(circleResult.rows[0]?.cnt ?? 0);
    } catch (_) {
      // circles table may not exist in all envs — non-fatal
    }

    // ── 5. Follow quality breakdown via follow_source proxy ───────────────────
    // // NOTE: Replace with dwell-time bucketing when total_duration is available
    let highIntent = 0, interested = 0, casual = 0, followQualityScore = 0;
    try {
      const intentResult = await pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE follow_source IN ('content_post', 'content_video')
           ) AS high_intent,
           COUNT(*) FILTER (
             WHERE follow_source IN ('event_attendance', 'event_recap')
           ) AS interested,
           COUNT(*) FILTER (
             WHERE follow_source NOT IN (
               'content_post', 'content_video', 'event_attendance', 'event_recap'
             ) OR follow_source IS NULL
           ) AS casual,
           COUNT(*) AS total_follow_events
         FROM follow_events
         WHERE creator_id = $1`,
        [memberId]
      );

      const intentRow = intentResult.rows[0] || {};
      highIntent = parseInt(intentRow.high_intent ?? 0);
      interested = parseInt(intentRow.interested ?? 0);
      casual     = parseInt(intentRow.casual     ?? 0);
      const totalIntentEvents = parseInt(intentRow.total_follow_events ?? 0);

      // Weighted score: High-intent × 1.0 + Interested × 0.6 + Casual × 0.2, normalized 0–100
      if (totalIntentEvents > 0) {
        const rawWeighted =
          (highIntent * 1.0 + interested * 0.6 + casual * 0.2) / totalIntentEvents;
        followQualityScore = Math.min(100, Math.round(rawWeighted * 100));
      }
    } catch (followEventsErr) {
      // follow_events table may not exist yet — non-fatal, return zeros
      console.warn("[CreatorInsights] follow_events query failed (table may not exist):", followEventsErr.message);
    }

    res.json({
      audience_score: audienceScore,
      follow_quality: {
        score: followQualityScore,
        label: followQualityLabel(followQualityScore),
        breakdown: {
          high_intent: highIntent,
          interested,
          casual,
        },
      },
      total_followers: totalFollowers,
      followers_delta_7d: followersDelta7d,
      circle_count: circleCount,
    });
  } catch (error) {
    console.error("[CreatorInsights] getCreatorAudienceSummary error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch creator audience summary" });
  }
}

// ============================================================
// GET /members/me/creator-insights/reach?period=7d|30d|90d
// ============================================================

/**
 * Returns content reach stats for this member's posts over the requested period.
 *
 * // TODO: total_views, total_impressions, avg_watch_pct, and top_content.views/watch_pct
 * // are null because member-scoped view/impression tracking tables do not exist yet.
 * // When the member content analytics pipeline is built, replace the null returns
 * // with queries against the view tracking table scoped to author_id = memberId.
 */
async function getCreatorReachStats(req, res) {
  try {
    const pool = req.app.locals.pool;
    const memberId = req.user?.id;
    if (!memberId) return res.status(401).json({ error: "Authentication required" });

    const rawPeriod = req.query.period || "30d";
    const validPeriods = ["7d", "30d", "90d"];
    const period = validPeriods.includes(rawPeriod) ? rawPeriod : "30d";
    const interval = periodToInterval(period);

    // Fetch top 3 most recent posts by this creator in the period
    // (using created_at as a proxy for relevance until view tracking is live)
    const postsResult = await pool.query(
      `SELECT id, image_urls, created_at
       FROM posts
       WHERE author_id = $1
         AND author_type = 'member'
         AND created_at >= NOW() - INTERVAL '${interval}'
       ORDER BY created_at DESC
       LIMIT 3`,
      [memberId]
    );

    const topContent = postsResult.rows.map((row) => ({
      post_id: row.id,
      // Extract first image URL as thumbnail (if available)
      thumbnail_url: Array.isArray(row.image_urls) && row.image_urls.length > 0
        ? row.image_urls[0]
        : null,
      views: null,      // TODO: populate from view tracking table
      watch_pct: null,  // TODO: populate from watch duration tracking
    }));

    res.json({
      period,
      total_views: null,        // TODO: member view tracking not built yet
      total_impressions: null,  // TODO: member impression tracking not built yet
      avg_watch_pct: null,      // TODO: watch duration tracking not built yet
      top_content: topContent.length > 0 ? topContent : null,
    });
  } catch (error) {
    console.error("[CreatorInsights] getCreatorReachStats error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch creator reach stats" });
  }
}

// ============================================================
// GET /members/me/creator-insights/follower-trend
// ============================================================

/**
 * Returns daily follower count for the last 30 days as a sparkline data series.
 *
 * Derived from follows.created_at timestamps (running total approach):
 *   Anchor = total followers today - sum of new follows in the last 30 days
 *   Each day's count = anchor + cumulative sum of new follows up to that date
 *
 * // TODO: Replace with materialized daily snapshot queries if this creator
 * // has >50K followers and query performance degrades.
 */
async function getCreatorFollowerTrend(req, res) {
  try {
    const pool = req.app.locals.pool;
    const memberId = req.user?.id;
    if (!memberId) return res.status(401).json({ error: "Authentication required" });

    // Get total current followers from denormalized column (fast)
    const totalResult = await pool.query(
      `SELECT creator_follower_count AS total FROM members WHERE id = $1`,
      [memberId]
    );
    const totalFollowers = parseInt(totalResult.rows[0]?.total ?? 0);

    // Get per-day new creator follows for the last 30 days
    const dailyResult = await pool.query(
      `SELECT
         DATE(created_at AT TIME ZONE 'UTC') AS day,
         COUNT(*) AS new_follows
       FROM creator_follows
       WHERE creator_id = $1
         AND is_dormant = false
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at AT TIME ZONE 'UTC')
       ORDER BY day ASC`,
      [memberId]
    );

    // Build a map of date → new follows
    const dailyMap = {};
    let sumLast30 = 0;
    for (const row of dailyResult.rows) {
      const dayStr = row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day);
      const count = parseInt(row.new_follows ?? 0);
      dailyMap[dayStr] = count;
      sumLast30 += count;
    }

    // Anchor: followers before the 30-day window
    const anchor = Math.max(0, totalFollowers - sumLast30);

    // Build trend array — one entry per day for the last 30 days
    const trend = [];
    let running = anchor;
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      running += dailyMap[dateStr] ?? 0;
      trend.push({ date: dateStr, count: running });
    }

    res.json({ trend });
  } catch (error) {
    console.error("[CreatorInsights] getCreatorFollowerTrend error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch follower trend" });
  }
}

module.exports = {
  getCreatorAudienceSummary,
  getCreatorReachStats,
  getCreatorFollowerTrend,
};
