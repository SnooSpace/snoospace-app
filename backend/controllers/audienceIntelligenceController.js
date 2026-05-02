/**
 * Audience Intelligence Controller
 *
 * Handles follow-intent tracking, AQI calculation, creator audience stats,
 * brand-creator matching, and admin audience analytics.
 */

const { createPool } = require("../config/db");
const pool = createPool();
const {
  getLearnedDemographicScore,
  resolveOccupationFallback,
  resolveAgeFallback,
  getPlatformMedianAqi,
} = require("../utils/demographicScoreLookup");
const { recalculateInterestVectors, detectDrift } = require("../utils/interestVectorEngine");

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize a raw count to a 0–100 score relative to a platform average.
 * Uses a simple sigmoid-style clamp: score = min(100, (value / benchmark) * 50)
 */
function normalizeScore(value, benchmark) {
  if (!benchmark || benchmark <= 0) return Math.min(100, value * 10);
  return Math.min(100, (value / benchmark) * 50);
}

// ============================================================
// POST /audience/track-follow
// ============================================================

async function trackFollow(req, res) {
  try {
    const {
      followerId,
      creatorId,
      followSource = "unknown",
      sourceContentId = null,
      sourceEventId = null,
      contentConsumedDurationSeconds = null,
    } = req.body;

    if (!followerId || !creatorId) {
      return res
        .status(400)
        .json({ error: "followerId and creatorId are required" });
    }

    // Valid follow sources
    const validSources = [
      "content_post",
      "content_video",
      "event_recap",
      "event_attendance",
      "search_discovery",
      "profile_visit",
      "social_referral",
      "unknown",
    ];
    const safeSource = validSources.includes(followSource)
      ? followSource
      : "unknown";

    await pool.query(
      `INSERT INTO follow_events
        (follower_id, creator_id, follow_source, source_content_id, source_event_id, content_consumed_duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        followerId,
        creatorId,
        safeSource,
        sourceContentId,
        sourceEventId,
        contentConsumedDurationSeconds,
      ],
    );

    // Trigger debounced creator stats recalculation (only if last calc > 1 hour)
    try {
      const lastCalc = await pool.query(
        `SELECT calculated_at FROM creator_audience_stats WHERE creator_id = $1`,
        [creatorId],
      );

      const shouldRecalculate =
        lastCalc.rows.length === 0 ||
        !lastCalc.rows[0].calculated_at ||
        Date.now() - new Date(lastCalc.rows[0].calculated_at).getTime() >
          3600000;

      if (shouldRecalculate) {
        // Fire async — don't await
        recalculateCreatorStats(creatorId).catch((err) =>
          console.error(
            `[AQI] Async creator stats recalc failed for ${creatorId}:`,
            err.message,
          ),
        );
      }
    } catch (e) {
      // Non-fatal
      console.error("[AQI] Debounce check failed:", e.message);
    }

    res.json({ success: true, message: "Follow event tracked" });
  } catch (error) {
    console.error("[AQI] trackFollow error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to track follow event" });
  }
}
// Signal strength by action type — stronger actions get higher weight
const SIGNAL_STRENGTH_MAP = {
  paid_event_attended: 3.0,
  event_hosted: 3.0,
  free_event_attended: 1.5,
  event_rsvp: 1.0,
  content_watched_long: 1.0,
  content_shared: 2.0,
  search_performed: 0.5,
  profile_visited: 0.3,
  content_watched_short: 0.3,
};

/**
 * Calculate onboarding weight decay based on total behavior events.
 * Starts at 0.90, decays toward 0.02 as behavior accumulates.
 */
function calculateOnboardingWeight(totalEvents) {
  return Math.max(0.02, 0.90 * Math.exp(-0.008 * totalEvents));
}

// ============================================================
// POST /audience/track-engagement
// ============================================================

async function trackEngagement(req, res) {
  try {
    const {
      userId,
      contentType,
      contentId,
      durationSeconds = 0,
      eventCategory,
      hourOfDay,
      isPaidEvent = false,
      ticketPrice = 0,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Ensure user_aqi_signals row exists
    await pool.query(
      `INSERT INTO user_aqi_signals (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    // --- V2: Determine signal strength and event type ---
    let eventType = "content_watched";
    let signalStrength = 0.3;

    if (isPaidEvent) {
      eventType = "event_attended";
      signalStrength = SIGNAL_STRENGTH_MAP.paid_event_attended;
    } else if (contentType === "event") {
      eventType = "event_attended";
      signalStrength = SIGNAL_STRENGTH_MAP.free_event_attended;
    } else if (contentType === "share") {
      eventType = "content_shared";
      signalStrength = SIGNAL_STRENGTH_MAP.content_shared;
    } else if (contentType === "search") {
      eventType = "search_performed";
      signalStrength = SIGNAL_STRENGTH_MAP.search_performed;
    } else if (durationSeconds > 60) {
      signalStrength = SIGNAL_STRENGTH_MAP.content_watched_long;
    }

    // --- V2: Insert into behavior event stream ---
    await pool.query(
      `INSERT INTO user_behavior_events (user_id, event_type, category, metadata, signal_strength)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        eventType,
        eventCategory || null,
        JSON.stringify({ contentType, contentId, durationSeconds, ticketPrice }),
        signalStrength,
      ],
    );

    // --- V2: Upsert interest vector if category exists ---
    if (eventCategory) {
      await pool.query(
        `INSERT INTO user_interest_vectors (user_id, category, raw_score, signal_count, last_signal_at)
         VALUES ($1, $2, $3, 1, NOW())
         ON CONFLICT (user_id, category) DO UPDATE SET
           raw_score = user_interest_vectors.raw_score + $3,
           signal_count = user_interest_vectors.signal_count + 1,
           last_signal_at = NOW()`,
        [userId, eventCategory.toLowerCase(), signalStrength],
      );
    }

    // --- V2: Update dynamic weights ---
    await pool.query(
      `UPDATE user_aqi_signals SET
         total_behavior_events = total_behavior_events + 1,
         onboarding_weight = GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1))),
         behavior_weight = 1.0 - GREATEST(0.02, 0.90 * EXP(-0.008 * (total_behavior_events + 1)))
       WHERE user_id = $1`,
      [userId],
    );

    // --- Original v1 user_aqi_signals updates (preserved) ---
    const updates = [];
    const params = [userId];
    let paramIndex = 2;

    if (isPaidEvent) {
      updates.push(`paid_events_attended = paid_events_attended + 1`);
      updates.push(
        `avg_ticket_price_paid = (avg_ticket_price_paid * paid_events_attended + $${paramIndex}) / (paid_events_attended + 1)`,
      );
      params.push(ticketPrice);
      paramIndex++;
    } else if (contentType === "event") {
      updates.push(`free_events_attended = free_events_attended + 1`);
    }

    if (durationSeconds > 0 && (contentType === "post" || contentType === "video")) {
      const depthContribution = Math.min(100, durationSeconds / 3);
      updates.push(
        `content_depth_score = (content_depth_score * 0.9) + ($${paramIndex} * 0.1)`,
      );
      params.push(depthContribution);
      paramIndex++;
    }

    if (hourOfDay !== undefined && hourOfDay >= 0 && hourOfDay <= 23) {
      updates.push(
        `engagement_hour_pattern = jsonb_set(
          COALESCE(engagement_hour_pattern, '{}'::jsonb),
          $${paramIndex}::text[],
          (COALESCE((engagement_hour_pattern->>'${hourOfDay}')::int, 0) + 1)::text::jsonb
        )`,
      );
      params.push(`{${hourOfDay}}`);
      paramIndex++;

      if (hourOfDay >= 8 && hourOfDay <= 19) {
        updates.push(`professional_hours_ratio = (professional_hours_ratio * 0.95) + (1.0 * 0.05)`);
      } else {
        updates.push(`professional_hours_ratio = (professional_hours_ratio * 0.95) + (0.0 * 0.05)`);
      }
    }

    const premiumCategories = ["wellness", "tech", "technology", "business", "luxury", "finance", "professional"];
    if (eventCategory) {
      const isPremium = premiumCategories.includes(eventCategory.toLowerCase());
      updates.push(
        `premium_categories_ratio = (premium_categories_ratio * 0.9) + ($${paramIndex} * 0.1)`,
      );
      params.push(isPremium ? 1.0 : 0.0);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      await pool.query(
        `UPDATE user_aqi_signals SET ${updates.join(", ")} WHERE user_id = $1`,
        params,
      );
    }

    res.json({ success: true, message: "Engagement tracked" });
  } catch (error) {
    console.error("[AQI] trackEngagement error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to track engagement" });
  }
}

// ============================================================
// POST /audience/calculate-aqi/:userId
// ============================================================

async function calculateAqi(req, res) {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Fetch user signals
    const result = await pool.query(
      `SELECT * FROM user_aqi_signals WHERE user_id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No AQI signals found for this user" });
    }

    const signals = result.rows[0];

    // Fetch platform averages for normalization
    const avgResult = await pool.query(`
      SELECT 
        COALESCE(AVG(paid_events_attended), 1) as avg_paid_events,
        COALESCE(AVG(avg_ticket_price_paid), 100) as avg_ticket_price,
        COALESCE(AVG(events_hosted), 1) as avg_events_hosted
      FROM user_aqi_signals
      WHERE aqi_score IS NOT NULL
    `);

    const platformAvg = avgResult.rows[0];

    // --- Step 1: Calculate raw behavioral AQI (0-100) ---
    const paidEventsScore = normalizeScore(signals.paid_events_attended, parseFloat(platformAvg.avg_paid_events));
    const avgTicketPriceScore = normalizeScore(parseFloat(signals.avg_ticket_price_paid), parseFloat(platformAvg.avg_ticket_price));
    const rsvpAttendRatio = parseFloat(signals.rsvp_to_attend_ratio) * 100;
    const contentDepth = parseFloat(signals.content_depth_score);
    const professionalHours = parseFloat(signals.professional_hours_ratio) * 100;
    const networkQuality = parseFloat(signals.network_quality_avg);
    const eventsHostedScore = normalizeScore(signals.events_hosted, parseFloat(platformAvg.avg_events_hosted));

    const behavioralAqi =
      paidEventsScore * 0.27 +
      avgTicketPriceScore * 0.22 +
      rsvpAttendRatio * 0.15 +
      contentDepth * 0.13 +
      professionalHours * 0.10 +
      networkQuality * 0.08 +
      eventsHostedScore * 0.05;

    // --- Step 2: Calculate onboarding AQI from learned demographic scores ---
    // Fetch user's occupation and dob from members table
    const memberResult = await pool.query(
      `SELECT occupation, dob FROM members WHERE id = $1 LIMIT 1`,
      [userId],
    );

    let occupationScore = await getPlatformMedianAqi(pool);
    let ageScore = await getPlatformMedianAqi(pool);

    if (memberResult.rows.length > 0) {
      const member = memberResult.rows[0];

      // Occupation — learned score with fallback chain
      if (member.occupation) {
        const occFallback = await resolveOccupationFallback(pool, member.occupation);
        const occResult = await getLearnedDemographicScore(pool, "occupation_exact", member.occupation, occFallback);
        occupationScore = occResult.score;
      }

      // Age — learned score with fallback chain
      if (member.dob) {
        const userAge = Math.floor((Date.now() - new Date(member.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const ageFallback = await resolveAgeFallback(pool, userAge);
        const ageResult = await getLearnedDemographicScore(pool, "age_exact", String(userAge), ageFallback);
        ageScore = ageResult.score;
      }
    }

    const onboardingAqi = (occupationScore * 0.65) + (ageScore * 0.35);

    // --- Step 3: Blend using dynamic weights ---
    const onboardingWeight = parseFloat(signals.onboarding_weight) || 0.9;
    const behaviorWeight = parseFloat(signals.behavior_weight) || 0.1;

    const aqiScore = (onboardingAqi * onboardingWeight) + (behavioralAqi * behaviorWeight);
    const clampedScore = Math.min(100, Math.max(0, Math.round(aqiScore * 100) / 100));

    // Determine tier
    let aqiTier;
    if (clampedScore >= 75) aqiTier = 1;
    else if (clampedScore >= 50) aqiTier = 2;
    else if (clampedScore >= 25) aqiTier = 3;
    else aqiTier = 4;

    // --- Step 4: Compute trajectory ---
    const previousScore = parseFloat(signals.aqi_score_4w_ago) || 0;
    const delta = clampedScore - previousScore;
    let trajectory = "stable";
    if (delta > 5) trajectory = "rising";
    else if (delta < -5) trajectory = "declining";

    // Update
    await pool.query(
      `UPDATE user_aqi_signals
       SET aqi_score = $2, aqi_tier = $3, aqi_trajectory = $4,
           last_calculated_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId, clampedScore, aqiTier, trajectory],
    );

    res.json({
      success: true,
      aqi: {
        userId: parseInt(userId),
        score: clampedScore,
        tier: aqiTier,
        trajectory,
        tierLabel: aqiTier === 1 ? "The Buyers" : aqiTier === 2 ? "The Aspirants" : aqiTier === 3 ? "The Browsers" : "The Ghosts",
        weights: { onboardingWeight, behaviorWeight },
        components: {
          behavioral: Math.round(behavioralAqi * 100) / 100,
          onboarding: Math.round(onboardingAqi * 100) / 100,
          occupationScore: Math.round(occupationScore * 100) / 100,
          ageScore: Math.round(ageScore * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("[AQI] calculateAqi error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to calculate AQI" });
  }
}

// ============================================================
// GET /audience/creator-stats/:creatorId
// ============================================================

async function getCreatorStats(req, res) {
  try {
    const { creatorId } = req.params;

    const result = await pool.query(
      `SELECT * FROM creator_audience_stats WHERE creator_id = $1`,
      [creatorId],
    );

    if (result.rows.length === 0) {
      // Return empty defaults if not calculated yet
      return res.json({
        success: true,
        stats: {
          creator_id: parseInt(creatorId),
          total_followers: 0,
          content_follows: 0,
          social_follows: 0,
          discovery_follows: 0,
          follow_quality_score: 0,
          tier1_followers: 0,
          tier2_followers: 0,
          tier3_followers: 0,
          tier4_followers: 0,
          tier1_percentage: 0,
          tier2_percentage: 0,
          audience_buying_power_score: 0,
          top_spending_categories: [],
          geographic_breakdown: {},
          engagement_authenticity_score: 0,
          weekly_follow_quality_trend: [],
          calculated_at: null,
        },
      });
    }

    res.json({ success: true, stats: result.rows[0] });
  } catch (error) {
    console.error("[AQI] getCreatorStats error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch creator stats" });
  }
}

// ============================================================
// GET /audience/brand-matches/:brandId/:campaignId
// ============================================================

async function getBrandMatches(req, res) {
  try {
    const { brandId, campaignId } = req.params;

    const result = await pool.query(
      `SELECT
        bcm.*,
        c.name as creator_name,
        c.username as creator_username,
        c.logo_url as creator_avatar,
        cas.total_followers,
        cas.follow_quality_score,
        cas.audience_buying_power_score,
        cas.tier1_followers,
        cas.tier2_followers,
        cas.top_spending_categories,
        cas.weekly_follow_quality_trend
      FROM brand_creator_matches bcm
      LEFT JOIN communities c ON bcm.creator_id = c.id
      LEFT JOIN creator_audience_stats cas ON bcm.creator_id = cas.creator_id
      WHERE bcm.brand_id = $1 AND bcm.campaign_id = $2
      ORDER BY bcm.total_match_score DESC
      LIMIT 20`,
      [brandId, campaignId],
    );

    res.json({ success: true, matches: result.rows });
  } catch (error) {
    console.error("[AQI] getBrandMatches error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch brand matches" });
  }
}

// ============================================================
// POST /audience/calculate-creator-stats/:creatorId
// (Expensive async job)
// ============================================================

async function calculateCreatorStatsEndpoint(req, res) {
  try {
    const { creatorId } = req.params;

    // Fire the heavy calculation async
    recalculateCreatorStats(creatorId).catch((err) =>
      console.error(
        `[AQI] Creator stats recalculation failed for ${creatorId}:`,
        err.message,
      ),
    );

    res.json({
      success: true,
      message: "Creator stats recalculation started",
    });
  } catch (error) {
    console.error(
      "[AQI] calculateCreatorStats error:",
      error.message,
      error.stack,
    );
    res.status(500).json({ error: "Failed to start creator stats calculation" });
  }
}

/**
 * Heavy async recalculation of all creator_audience_stats fields
 */
async function recalculateCreatorStats(creatorId) {
  // Get all followers of this creator from the follows table
  const followersResult = await pool.query(
    `SELECT follower_id FROM follows WHERE following_id = $1 AND following_type = 'community'`,
    [creatorId],
  );

  const followerIds = followersResult.rows.map((r) => r.follower_id);
  const totalFollowers = followerIds.length;

  if (totalFollowers === 0) {
    // Insert/update with zero values
    await pool.query(
      `INSERT INTO creator_audience_stats (creator_id, total_followers, calculated_at)
       VALUES ($1, 0, NOW())
       ON CONFLICT (creator_id) DO UPDATE SET total_followers = 0, calculated_at = NOW()`,
      [creatorId],
    );
    return;
  }

  // Count follow sources from follow_events
  const sourceCountsResult = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE is_content_follow = true) as content_follows,
      COUNT(*) FILTER (WHERE follow_source IN ('social_referral')) as social_follows,
      COUNT(*) FILTER (WHERE follow_source IN ('search_discovery', 'profile_visit')) as discovery_follows
    FROM follow_events
    WHERE creator_id = $1`,
    [creatorId],
  );

  const sourceCounts = sourceCountsResult.rows[0];
  const contentFollows = parseInt(sourceCounts.content_follows) || 0;
  const socialFollows = parseInt(sourceCounts.social_follows) || 0;
  const discoveryFollows = parseInt(sourceCounts.discovery_follows) || 0;
  const followQualityScore =
    totalFollowers > 0
      ? Math.round((contentFollows / totalFollowers) * 10000) / 100
      : 0;

  // Get AQI tier breakdown for followers
  let tier1 = 0, tier2 = 0, tier3 = 0, tier4 = 0;
  let totalAqi = 0;
  let aqiCount = 0;

  if (followerIds.length > 0) {
    const tierResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE aqi_tier = 1) as tier1,
        COUNT(*) FILTER (WHERE aqi_tier = 2) as tier2,
        COUNT(*) FILTER (WHERE aqi_tier = 3) as tier3,
        COUNT(*) FILTER (WHERE aqi_tier = 4) as tier4,
        COALESCE(AVG(aqi_score), 0) as avg_aqi,
        COUNT(*) FILTER (WHERE aqi_score IS NOT NULL) as aqi_count
      FROM user_aqi_signals
      WHERE user_id = ANY($1)`,
      [followerIds],
    );

    const tiers = tierResult.rows[0];
    tier1 = parseInt(tiers.tier1) || 0;
    tier2 = parseInt(tiers.tier2) || 0;
    tier3 = parseInt(tiers.tier3) || 0;
    tier4 = parseInt(tiers.tier4) || 0;
    totalAqi = parseFloat(tiers.avg_aqi) || 0;
    aqiCount = parseInt(tiers.aqi_count) || 0;
  }

  const tier1Pct =
    totalFollowers > 0
      ? Math.round((tier1 / totalFollowers) * 10000) / 100
      : 0;
  const tier2Pct =
    totalFollowers > 0
      ? Math.round((tier2 / totalFollowers) * 10000) / 100
      : 0;

  // Audience buying power = weighted tier presence
  const audienceBuyingPower = Math.min(
    100,
    tier1Pct * 1.5 + tier2Pct * 0.8 + (totalAqi * 0.3),
  );

  // Engagement authenticity score — higher if more content-follows and higher tier density
  const authenticityScore = Math.min(
    100,
    followQualityScore * 0.6 + tier1Pct * 0.25 + tier2Pct * 0.15,
  );

  // Get existing weekly trend and append current week
  const existingStats = await pool.query(
    `SELECT weekly_follow_quality_trend FROM creator_audience_stats WHERE creator_id = $1`,
    [creatorId],
  );

  let weeklyTrend = [];
  if (existingStats.rows.length > 0 && existingStats.rows[0].weekly_follow_quality_trend) {
    weeklyTrend = existingStats.rows[0].weekly_follow_quality_trend;
  }
  // Keep only last 7 weeks + add current
  weeklyTrend = weeklyTrend.slice(-7);
  weeklyTrend.push({
    week: new Date().toISOString().split("T")[0],
    score: followQualityScore,
  });

  // Upsert creator_audience_stats
  await pool.query(
    `INSERT INTO creator_audience_stats (
      creator_id, total_followers, content_follows, social_follows, discovery_follows,
      follow_quality_score, tier1_followers, tier2_followers, tier3_followers, tier4_followers,
      tier1_percentage, tier2_percentage, audience_buying_power_score,
      top_spending_categories, geographic_breakdown, engagement_authenticity_score,
      weekly_follow_quality_trend, calculated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
    ON CONFLICT (creator_id) DO UPDATE SET
      total_followers = $2, content_follows = $3, social_follows = $4, discovery_follows = $5,
      follow_quality_score = $6, tier1_followers = $7, tier2_followers = $8,
      tier3_followers = $9, tier4_followers = $10,
      tier1_percentage = $11, tier2_percentage = $12,
      audience_buying_power_score = $13, top_spending_categories = $14,
      geographic_breakdown = $15, engagement_authenticity_score = $16,
      weekly_follow_quality_trend = $17, calculated_at = NOW()`,
    [
      creatorId,
      totalFollowers,
      contentFollows,
      socialFollows,
      discoveryFollows,
      followQualityScore,
      tier1,
      tier2,
      tier3,
      tier4,
      tier1Pct,
      tier2Pct,
      Math.round(audienceBuyingPower * 100) / 100,
      JSON.stringify([]), // top_spending_categories — populate from event registrations
      JSON.stringify({}), // geographic_breakdown — populate from member locations
      Math.round(authenticityScore * 100) / 100,
      JSON.stringify(weeklyTrend),
    ],
  );

  console.log(
    `[AQI] Recalculated creator stats for ${creatorId}: ${totalFollowers} followers, ` +
    `FQS=${followQualityScore}%, T1=${tier1Pct}%, BPS=${Math.round(audienceBuyingPower)}`,
  );
}

// ============================================================
// ADMIN: GET /admin/audience/community/:communityId
// ============================================================

async function getAdminCommunityAudienceStats(req, res) {
  try {
    const { communityId } = req.params;

    // Get creator audience stats
    const statsResult = await pool.query(
      `SELECT * FROM creator_audience_stats WHERE creator_id = $1`,
      [communityId],
    );

    // Get community info
    const communityResult = await pool.query(
      `SELECT id, name, username, logo_url, category FROM communities WHERE id = $1`,
      [communityId],
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    // Get follow events summary
    const followEventsResult = await pool.query(
      `SELECT follow_source, COUNT(*) as count
       FROM follow_events WHERE creator_id = $1
       GROUP BY follow_source
       ORDER BY count DESC`,
      [communityId],
    );

    // Get recent follow events
    const recentFollowsResult = await pool.query(
      `SELECT fe.*, m.name as follower_name, m.username as follower_username
       FROM follow_events fe
       LEFT JOIN members m ON fe.follower_id = m.id
       WHERE fe.creator_id = $1
       ORDER BY fe.followed_at DESC
       LIMIT 20`,
      [communityId],
    );

    res.json({
      success: true,
      community: communityResult.rows[0],
      audienceStats: statsResult.rows[0] || null,
      followSourceBreakdown: followEventsResult.rows,
      recentFollows: recentFollowsResult.rows,
    });
  } catch (error) {
    console.error(
      "[AQI] getAdminCommunityAudienceStats error:",
      error.message,
      error.stack,
    );
    res.status(500).json({ error: "Failed to fetch community audience stats" });
  }
}

// ============================================================
// ADMIN: GET /admin/audience/overview
// ============================================================

async function getAdminAudienceOverview(req, res) {
  try {
    // Platform-wide AQI distribution
    const aqiDistribution = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE aqi_tier = 1) as tier1_count,
        COUNT(*) FILTER (WHERE aqi_tier = 2) as tier2_count,
        COUNT(*) FILTER (WHERE aqi_tier = 3) as tier3_count,
        COUNT(*) FILTER (WHERE aqi_tier = 4) as tier4_count,
        COUNT(*) as total_scored,
        COALESCE(AVG(aqi_score), 0) as platform_avg_aqi
      FROM user_aqi_signals
      WHERE aqi_score IS NOT NULL
    `);

    // Top communities by audience quality
    const topCommunities = await pool.query(`
      SELECT
        cas.creator_id,
        c.name as community_name,
        c.username,
        c.logo_url,
        cas.total_followers,
        cas.follow_quality_score,
        cas.audience_buying_power_score,
        cas.tier1_percentage,
        cas.tier2_percentage
      FROM creator_audience_stats cas
      LEFT JOIN communities c ON cas.creator_id = c.id
      ORDER BY cas.audience_buying_power_score DESC
      LIMIT 20
    `);

    // Follow source distribution across platform
    const followSourceDist = await pool.query(`
      SELECT follow_source, COUNT(*) as count
      FROM follow_events
      GROUP BY follow_source
      ORDER BY count DESC
    `);

    // Total follow events
    const totalFollowEvents = await pool.query(
      `SELECT COUNT(*) as count FROM follow_events`,
    );

    res.json({
      success: true,
      overview: {
        aqiDistribution: aqiDistribution.rows[0],
        topCommunities: topCommunities.rows,
        followSourceDistribution: followSourceDist.rows,
        totalFollowEvents: parseInt(totalFollowEvents.rows[0].count),
      },
    });
  } catch (error) {
    console.error(
      "[AQI] getAdminAudienceOverview error:",
      error.message,
      error.stack,
    );
    res.status(500).json({ error: "Failed to fetch audience overview" });
  }
}

// ============================================================
// V2: POST /audience/recalculate-interest-vectors/:userId
// ============================================================

async function recalculateInterestVectorsEndpoint(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    await recalculateInterestVectors(pool, userId);
    res.json({ success: true, message: "Interest vectors recalculated" });
  } catch (error) {
    console.error("[AQI] recalculateInterestVectors error:", error.message);
    res.status(500).json({ error: "Failed to recalculate interest vectors" });
  }
}

// ============================================================
// V2: POST /audience/detect-drift/:userId
// ============================================================

async function detectDriftEndpoint(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    await detectDrift(pool, userId);
    res.json({ success: true, message: "Drift detection completed" });
  } catch (error) {
    console.error("[AQI] detectDrift error:", error.message);
    res.status(500).json({ error: "Failed to detect drift" });
  }
}

// ============================================================
// V2: GET /audience/active-categories
// ============================================================

async function getActiveCategories(req, res) {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(DISTINCT user_id) as user_count
      FROM user_interest_vectors
      WHERE decayed_score > 10
      GROUP BY category
      HAVING COUNT(DISTINCT user_id) >= 100
      ORDER BY user_count DESC
    `);

    res.json({
      success: true,
      categories: result.rows.map((r) => ({
        category: r.category,
        userCount: parseInt(r.user_count),
      })),
    });
  } catch (error) {
    console.error("[AQI] getActiveCategories error:", error.message);
    res.status(500).json({ error: "Failed to fetch active categories" });
  }
}

// ============================================================
// V2: GET /audience/user-interests/:userId
// ============================================================

async function getUserInterests(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const result = await pool.query(
      `SELECT category, raw_score, decayed_score, signal_count, trend, trend_delta, last_signal_at
       FROM user_interest_vectors
       WHERE user_id = $1 AND decayed_score > 5
       ORDER BY decayed_score DESC`,
      [userId],
    );

    res.json({ success: true, interests: result.rows });
  } catch (error) {
    console.error("[AQI] getUserInterests error:", error.message);
    res.status(500).json({ error: "Failed to fetch user interests" });
  }
}

module.exports = {
  trackFollow,
  trackEngagement,
  calculateAqi,
  getCreatorStats,
  getBrandMatches,
  calculateCreatorStatsEndpoint,
  getAdminCommunityAudienceStats,
  getAdminAudienceOverview,
  recalculateInterestVectorsEndpoint,
  detectDriftEndpoint,
  getActiveCategories,
  getUserInterests,
};
