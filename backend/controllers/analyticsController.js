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

    // Get event count (including cancelled)
    const eventCountResult = await pool.query("SELECT COUNT(*) FROM events");

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

// ============================================
// ADVANCED ANALYTICS
// ============================================

/**
 * Get advanced analytics: DAU/WAU/MAU, retention, geo, device distribution
 * @query period - 7d, 30d, 90d (default: 30d)
 */
async function getAdvancedAnalytics(req, res) {
  try {
    // DAU/WAU/MAU from sessions.last_used_at
    const dauResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_used_at >= CURRENT_DATE
    `);

    const wauResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_used_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    const mauResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_used_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // Active users trend (last 30 days)
    const activeUsersTrend = await pool.query(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      daily_active AS (
        SELECT DATE(last_used_at) as date, COUNT(DISTINCT user_id) as count
        FROM sessions
        WHERE last_used_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(last_used_at)
      )
      SELECT d.date, COALESCE(da.count, 0) as active_users
      FROM dates d
      LEFT JOIN daily_active da ON d.date = da.date
      ORDER BY d.date ASC
    `);

    // Retention rates - members who signed up X days ago and were active today
    // D1: Signed up yesterday, active today
    // D7: Signed up 7 days ago, active in last 7 days
    // D30: Signed up 30 days ago, active in last 30 days

    const retentionQuery = async (daysAgo, activePeriod) => {
      const result = await pool.query(`
        WITH cohort AS (
          SELECT id FROM members
          WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '${daysAgo} days'
        ),
        retained AS (
          SELECT DISTINCT s.user_id
          FROM sessions s
          INNER JOIN cohort c ON s.user_id = c.id
          WHERE s.user_type = 'member'
            AND s.last_used_at >= CURRENT_DATE - INTERVAL '${activePeriod} days'
        )
        SELECT 
          (SELECT COUNT(*) FROM cohort) as cohort_size,
          (SELECT COUNT(*) FROM retained) as retained_count
      `);
      return result.rows[0];
    };

    const d1 = await retentionQuery(1, 1);
    const d7 = await retentionQuery(7, 1);
    const d30 = await retentionQuery(30, 1);

    // Geographic distribution from members.location
    const geoResult = await pool.query(`
      SELECT 
        location->>'country' as country,
        location->>'city' as city,
        COUNT(*) as count
      FROM members
      WHERE location IS NOT NULL 
        AND location->>'country' IS NOT NULL
      GROUP BY location->>'country', location->>'city'
      ORDER BY count DESC
      LIMIT 20
    `);

    // Country summary
    const countryResult = await pool.query(`
      SELECT 
        location->>'country' as country,
        COUNT(*) as count
      FROM members
      WHERE location IS NOT NULL 
        AND location->>'country' IS NOT NULL
      GROUP BY location->>'country'
      ORDER BY count DESC
      LIMIT 10
    `);

    // Device distribution - count unique EXISTING users by their most recent session's platform
    const deviceResult = await pool.query(`
      WITH latest_sessions AS (
        SELECT DISTINCT ON (s.user_id, s.user_type) 
          s.user_id, s.user_type, s.platform, s.os_version
        FROM sessions s
        WHERE s.last_used_at >= CURRENT_DATE - INTERVAL '30 days'
          AND (
            (s.user_type = 'member' AND EXISTS (SELECT 1 FROM members WHERE id = s.user_id))
            OR (s.user_type = 'community' AND EXISTS (SELECT 1 FROM communities WHERE id = s.user_id))
            OR (s.user_type = 'sponsor' AND EXISTS (SELECT 1 FROM sponsors WHERE id = s.user_id))
            OR (s.user_type = 'venue' AND EXISTS (SELECT 1 FROM venues WHERE id = s.user_id))
          )
        ORDER BY s.user_id, s.user_type, s.last_used_at DESC
      )
      SELECT 
        COALESCE(platform, 'Unknown') as platform,
        COUNT(*) as user_count
      FROM latest_sessions
      GROUP BY platform
      ORDER BY user_count DESC
    `);

    // OS version distribution - only existing users
    const osResult = await pool.query(`
      WITH latest_sessions AS (
        SELECT DISTINCT ON (s.user_id, s.user_type) 
          s.user_id, s.user_type, s.platform, s.os_version
        FROM sessions s
        WHERE s.last_used_at >= CURRENT_DATE - INTERVAL '30 days'
          AND s.platform IS NOT NULL
          AND (
            (s.user_type = 'member' AND EXISTS (SELECT 1 FROM members WHERE id = s.user_id))
            OR (s.user_type = 'community' AND EXISTS (SELECT 1 FROM communities WHERE id = s.user_id))
            OR (s.user_type = 'sponsor' AND EXISTS (SELECT 1 FROM sponsors WHERE id = s.user_id))
            OR (s.user_type = 'venue' AND EXISTS (SELECT 1 FROM venues WHERE id = s.user_id))
          )
        ORDER BY s.user_id, s.user_type, s.last_used_at DESC
      )
      SELECT 
        platform,
        os_version,
        COUNT(*) as count
      FROM latest_sessions
      GROUP BY platform, os_version
      ORDER BY count DESC
      LIMIT 15
    `);

    res.json({
      success: true,
      analytics: {
        activeUsers: {
          dau: parseInt(dauResult.rows[0].count, 10),
          wau: parseInt(wauResult.rows[0].count, 10),
          mau: parseInt(mauResult.rows[0].count, 10),
          trend: activeUsersTrend.rows.map((row) => ({
            date: row.date.toISOString().split("T")[0],
            activeUsers: parseInt(row.active_users, 10),
          })),
        },
        retention: {
          d1: {
            cohortSize: parseInt(d1.cohort_size, 10),
            retainedCount: parseInt(d1.retained_count, 10),
            rate:
              d1.cohort_size > 0
                ? Math.round((d1.retained_count / d1.cohort_size) * 100)
                : 0,
          },
          d7: {
            cohortSize: parseInt(d7.cohort_size, 10),
            retainedCount: parseInt(d7.retained_count, 10),
            rate:
              d7.cohort_size > 0
                ? Math.round((d7.retained_count / d7.cohort_size) * 100)
                : 0,
          },
          d30: {
            cohortSize: parseInt(d30.cohort_size, 10),
            retainedCount: parseInt(d30.retained_count, 10),
            rate:
              d30.cohort_size > 0
                ? Math.round((d30.retained_count / d30.cohort_size) * 100)
                : 0,
          },
        },
        geographic: {
          byLocation: geoResult.rows.map((row) => ({
            country: row.country,
            city: row.city,
            count: parseInt(row.count, 10),
          })),
          byCountry: countryResult.rows.map((row) => ({
            country: row.country,
            count: parseInt(row.count, 10),
          })),
        },
        devices: {
          byPlatform: deviceResult.rows.map((row) => ({
            platform: row.platform,
            userCount: parseInt(row.user_count, 10),
          })),
          byOS: osResult.rows.map((row) => ({
            platform: row.platform,
            osVersion: row.os_version,
            count: parseInt(row.count, 10),
          })),
        },
      },
    });
  } catch (error) {
    console.error(
      "Error fetching advanced analytics:",
      error.message,
      error.stack
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch advanced analytics",
      details: error.message,
    });
  }
}

module.exports = {
  getOverview,
  getUserAnalytics,
  getEventAnalytics,
  getEngagementAnalytics,
  getAdvancedAnalytics,
};
