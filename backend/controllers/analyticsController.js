/**
 * Analytics Controller
 * Provides metrics and statistics for the admin dashboard
 */

const { createPool } = require("../config/db");
const pool = createPool();

// ============================================
// OVERVIEW STATS
// ============================================

/**
 * Get overview statistics for the dashboard
 * Returns total counts for users, events, posts
 */
async function getOverview(req, res) {
  try {
    // Get user counts by type
    const memberCountResult = await pool.query("SELECT COUNT(*) FROM members");
    const communityCountResult = await pool.query(
      "SELECT COUNT(*) FROM communities"
    );
    const sponsorCountResult = await pool.query(
      "SELECT COUNT(*) FROM sponsors"
    );
    const venueCountResult = await pool.query("SELECT COUNT(*) FROM venues");

    // Get event count
    const eventCountResult = await pool.query(
      "SELECT COUNT(*) FROM events WHERE is_cancelled = false"
    );

    // Get post count
    const postCountResult = await pool.query("SELECT COUNT(*) FROM posts");

    const totalMembers = parseInt(memberCountResult.rows[0].count, 10);
    const totalCommunities = parseInt(communityCountResult.rows[0].count, 10);
    const totalSponsors = parseInt(sponsorCountResult.rows[0].count, 10);
    const totalVenues = parseInt(venueCountResult.rows[0].count, 10);

    res.json({
      success: true,
      stats: {
        totalUsers:
          totalMembers + totalCommunities + totalSponsors + totalVenues,
        totalMembers,
        totalCommunities,
        totalSponsors,
        totalVenues,
        totalEvents: parseInt(eventCountResult.rows[0].count, 10),
        totalPosts: parseInt(postCountResult.rows[0].count, 10),
      },
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error.message, error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to fetch overview stats",
      details: error.message,
    });
  }
}

// ============================================
// USER ANALYTICS
// ============================================

/**
 * Get user analytics with growth data
 * @query period - 7d, 30d, 90d (default: 30d)
 */
async function getUserAnalytics(req, res) {
  try {
    const period = req.query.period || "30d";
    const days = parseInt(period.replace("d", ""), 10) || 30;

    // User counts by type
    const memberCount = await pool.query("SELECT COUNT(*) FROM members");
    const communityCount = await pool.query("SELECT COUNT(*) FROM communities");
    const sponsorCount = await pool.query("SELECT COUNT(*) FROM sponsors");
    const venueCount = await pool.query("SELECT COUNT(*) FROM venues");

    // Growth data - daily signups over the period
    const growthQuery = `
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      member_signups AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM members
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      ),
      community_signups AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM communities
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      )
      SELECT 
        d.date,
        COALESCE(m.count, 0) as members,
        COALESCE(c.count, 0) as communities
      FROM dates d
      LEFT JOIN member_signups m ON d.date = m.date
      LEFT JOIN community_signups c ON d.date = c.date
      ORDER BY d.date ASC
    `;
    const growthResult = await pool.query(growthQuery);

    // Recent signups (last 10) - simplified query without photo_url
    const recentSignupsQuery = `
      (
        SELECT id, name, 'member' as type, created_at, NULL as photo_url
        FROM members
        ORDER BY created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT id, name, 'community' as type, created_at, NULL as photo_url
        FROM communities
        ORDER BY created_at DESC
        LIMIT 5
      )
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const recentSignupsResult = await pool.query(recentSignupsQuery);

    res.json({
      success: true,
      analytics: {
        byType: {
          members: parseInt(memberCount.rows[0].count, 10),
          communities: parseInt(communityCount.rows[0].count, 10),
          sponsors: parseInt(sponsorCount.rows[0].count, 10),
          venues: parseInt(venueCount.rows[0].count, 10),
        },
        growth: growthResult.rows.map((row) => ({
          date: row.date.toISOString().split("T")[0],
          members: parseInt(row.members, 10),
          communities: parseInt(row.communities, 10),
        })),
        recentSignups: recentSignupsResult.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error.message, error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user analytics",
      details: error.message,
    });
  }
}

// ============================================
// EVENT ANALYTICS
// ============================================

/**
 * Get event analytics
 * @query period - 7d, 30d, 90d (default: 30d)
 */
async function getEventAnalytics(req, res) {
  try {
    const now = new Date();

    // Events by status
    const upcomingCount = await pool.query(
      "SELECT COUNT(*) FROM events WHERE start_datetime > $1 AND is_cancelled = false",
      [now]
    );
    const ongoingCount = await pool.query(
      "SELECT COUNT(*) FROM events WHERE start_datetime <= $1 AND end_datetime >= $2 AND is_cancelled = false",
      [now, now]
    );
    const completedCount = await pool.query(
      "SELECT COUNT(*) FROM events WHERE end_datetime < $1 AND is_cancelled = false",
      [now]
    );
    const cancelledCount = await pool.query(
      "SELECT COUNT(*) FROM events WHERE is_cancelled = true"
    );

    // Total tickets sold (sum of attendee counts or registrations)
    const ticketsResult = await pool.query(`
      SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id)
      ), 0) as total
      FROM events e
      WHERE e.is_cancelled = false
    `);

    // Recent events
    const recentEventsResult = await pool.query(`
      SELECT 
        e.id,
        e.title,
        e.start_datetime,
        c.name as community_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as attendee_count
      FROM events e
      LEFT JOIN communities c ON e.community_id = c.id
      WHERE e.is_cancelled = false
      ORDER BY e.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      analytics: {
        byStatus: {
          upcoming: parseInt(upcomingCount.rows[0].count, 10),
          ongoing: parseInt(ongoingCount.rows[0].count, 10),
          completed: parseInt(completedCount.rows[0].count, 10),
          cancelled: parseInt(cancelledCount.rows[0].count, 10),
        },
        ticketsSold: parseInt(ticketsResult.rows[0].total, 10),
        recentEvents: recentEventsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          start_datetime: row.start_datetime,
          community_name: row.community_name,
          attendee_count: parseInt(row.attendee_count, 10),
        })),
      },
    });
  } catch (error) {
    console.error(
      "Error fetching event analytics:",
      error.message,
      error.stack
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch event analytics",
      details: error.message,
    });
  }
}

// ============================================
// ENGAGEMENT ANALYTICS
// ============================================

/**
 * Get engagement analytics (posts, comments, likes)
 * @query period - 7d, 30d, 90d (default: 30d)
 */
async function getEngagementAnalytics(req, res) {
  try {
    const period = req.query.period || "30d";
    const days = parseInt(period.replace("d", ""), 10) || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Post counts
    const postsTotal = await pool.query("SELECT COUNT(*) FROM posts");
    const postsToday = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE created_at >= $1",
      [today]
    );
    const postsThisWeek = await pool.query(
      "SELECT COUNT(*) FROM posts WHERE created_at >= $1",
      [weekAgo]
    );

    // Comment counts
    const commentsTotal = await pool.query(
      "SELECT COUNT(*) FROM post_comments"
    );
    const commentsToday = await pool.query(
      "SELECT COUNT(*) FROM post_comments WHERE created_at >= $1",
      [today]
    );
    const commentsThisWeek = await pool.query(
      "SELECT COUNT(*) FROM post_comments WHERE created_at >= $1",
      [weekAgo]
    );

    // Like counts
    const likesTotal = await pool.query("SELECT COUNT(*) FROM post_likes");
    const likesToday = await pool.query(
      "SELECT COUNT(*) FROM post_likes WHERE created_at >= $1",
      [today]
    );
    const likesThisWeek = await pool.query(
      "SELECT COUNT(*) FROM post_likes WHERE created_at >= $1",
      [weekAgo]
    );

    // Trend data - daily activity over the period
    const trendQuery = `
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      daily_posts AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM posts
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      ),
      daily_comments AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM post_comments
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      ),
      daily_likes AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM post_likes
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      )
      SELECT 
        d.date,
        COALESCE(p.count, 0) as posts,
        COALESCE(c.count, 0) as comments,
        COALESCE(l.count, 0) as likes
      FROM dates d
      LEFT JOIN daily_posts p ON d.date = p.date
      LEFT JOIN daily_comments c ON d.date = c.date
      LEFT JOIN daily_likes l ON d.date = l.date
      ORDER BY d.date ASC
    `;
    const trendResult = await pool.query(trendQuery);

    res.json({
      success: true,
      analytics: {
        posts: {
          total: parseInt(postsTotal.rows[0].count, 10),
          today: parseInt(postsToday.rows[0].count, 10),
          thisWeek: parseInt(postsThisWeek.rows[0].count, 10),
        },
        comments: {
          total: parseInt(commentsTotal.rows[0].count, 10),
          today: parseInt(commentsToday.rows[0].count, 10),
          thisWeek: parseInt(commentsThisWeek.rows[0].count, 10),
        },
        likes: {
          total: parseInt(likesTotal.rows[0].count, 10),
          today: parseInt(likesToday.rows[0].count, 10),
          thisWeek: parseInt(likesThisWeek.rows[0].count, 10),
        },
        trend: trendResult.rows.map((row) => ({
          date: row.date.toISOString().split("T")[0],
          posts: parseInt(row.posts, 10),
          comments: parseInt(row.comments, 10),
          likes: parseInt(row.likes, 10),
        })),
      },
    });
  } catch (error) {
    console.error(
      "Error fetching engagement analytics:",
      error.message,
      error.stack
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch engagement analytics",
      details: error.message,
    });
  }
}

module.exports = {
  getOverview,
  getUserAnalytics,
  getEventAnalytics,
  getEngagementAnalytics,
};
