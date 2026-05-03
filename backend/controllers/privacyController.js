/**
 * Privacy Controller
 *
 * Handles consent management, data transparency, and deletion requests
 * for DPDP Act (Digital Personal Data Protection Act 2023) compliance.
 *
 * Role-aware: member / community / sponsor / venue
 * Polymorphic consent table keyed on (user_id, user_type).
 */

const { createPool } = require("../config/db");
const pool = createPool();

const CURRENT_CONSENT_VERSION = "v1.0";

const TIER_LABELS = {
  1: "The Buyers", 2: "The Aspirants", 3: "The Browsers", 4: "The Ghosts",
};
const TIER_EXPLANATIONS = {
  1: "Based on the events you attend and how you engage, you're among our most active users. Brands see you as a high-value audience member.",
  2: "You're building a strong engagement pattern. Your activity shows growing interest in premium events and content.",
  3: "You're exploring what SnooSpace has to offer. As you attend more events and engage with content, your profile grows.",
  4: "You're just getting started! Attend events, explore content, and engage with communities to build your profile.",
};
const TIER_BADGES = { 1: "🏆", 2: "⭐", 3: "👥", 4: "👻" };

// ============================================================
// POST /privacy/consent
// ============================================================

async function updateConsent(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const {
      behavioralTracking,
      brandTargeting,
      dataSharing,
      eventAudienceIntelligence,
      brandDataAcknowledged,
    } = req.body;

    const allUndefined = [
      behavioralTracking, brandTargeting, dataSharing,
      eventAudienceIntelligence, brandDataAcknowledged,
    ].every((v) => v === undefined);

    if (allUndefined) {
      return res.status(400).json({ error: "At least one consent field is required" });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // 1. Read current state for audit log
    const existing = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent,
              event_audience_intelligence_consent, brand_data_acknowledged, consent_version
       FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );

    const prev = existing.rows[0] || null;
    const previousState = prev
      ? {
          behavioral: prev.behavioral_tracking_consent,
          brand: prev.brand_targeting_consent,
          dataSharing: prev.data_sharing_consent,
          eventAudienceIntelligence: prev.event_audience_intelligence_consent,
          brandDataAcknowledged: prev.brand_data_acknowledged,
          version: prev.consent_version,
        }
      : null;

    // Resolve final values — fall back to existing if not provided
    const finalBehavioral = behavioralTracking !== undefined
      ? !!behavioralTracking : (previousState?.behavioral ?? false);
    const finalBrand = brandTargeting !== undefined
      ? !!brandTargeting : (previousState?.brand ?? false);
    const finalDataSharing = dataSharing !== undefined
      ? !!dataSharing : (previousState?.dataSharing ?? false);
    const finalEventAudience = eventAudienceIntelligence !== undefined
      ? !!eventAudienceIntelligence : (previousState?.eventAudienceIntelligence ?? false);
    const finalBrandAck = brandDataAcknowledged !== undefined
      ? !!brandDataAcknowledged : (previousState?.brandDataAcknowledged ?? false);

    // 2. Upsert — composite key (user_id, user_type)
    await pool.query(
      `INSERT INTO user_privacy_consent
         (user_id, user_type, behavioral_tracking_consent, brand_targeting_consent,
          data_sharing_consent, event_audience_intelligence_consent, brand_data_acknowledged,
          consent_version, consented_at, last_updated_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
       ON CONFLICT (user_id, user_type) DO UPDATE SET
         behavioral_tracking_consent = $3,
         brand_targeting_consent = $4,
         data_sharing_consent = $5,
         event_audience_intelligence_consent = $6,
         brand_data_acknowledged = $7,
         consent_version = $8,
         last_updated_at = NOW(),
         ip_address = $9,
         consented_at = COALESCE(user_privacy_consent.consented_at, NOW())`,
      [userId, userType, finalBehavioral, finalBrand, finalDataSharing,
       finalEventAudience, finalBrandAck, CURRENT_CONSENT_VERSION, ipAddress]
    );

    // 3. Determine audit action
    let action = previousState ? "consent_updated" : "initial_consent";
    if (previousState) {
      if (brandDataAcknowledged !== undefined && brandDataAcknowledged && !previousState.brandDataAcknowledged) {
        action = "brand_data_acknowledged";
      } else if (eventAudienceIntelligence !== undefined && eventAudienceIntelligence !== previousState.eventAudienceIntelligence) {
        action = eventAudienceIntelligence ? "opt_in_event_audience" : "opt_out_event_audience";
      } else if (behavioralTracking !== undefined && behavioralTracking !== previousState.behavioral) {
        action = behavioralTracking ? "opt_in_behavioral" : "opt_out_behavioral";
      } else if (brandTargeting !== undefined && brandTargeting !== previousState.brand) {
        action = brandTargeting ? "opt_in_brand" : "opt_out_brand";
      } else if (dataSharing !== undefined && dataSharing !== previousState.dataSharing) {
        action = dataSharing ? "opt_in_data_sharing" : "opt_out_data_sharing";
      }
    }

    const newState = {
      behavioral: finalBehavioral, brand: finalBrand, dataSharing: finalDataSharing,
      eventAudienceIntelligence: finalEventAudience, brandDataAcknowledged: finalBrandAck,
      version: CURRENT_CONSENT_VERSION,
    };

    // 4. Audit log
    await pool.query(
      `INSERT INTO user_privacy_consent_audit
         (user_id, user_type, action, previous_state, new_state, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, userType, action, JSON.stringify(previousState), JSON.stringify(newState), ipAddress]
    );

    console.log(`[Privacy] Consent updated for ${userType} ${userId}: ${action}`);

    res.json({
      success: true,
      consent: {
        behavioralTracking: finalBehavioral,
        brandTargeting: finalBrand,
        dataSharing: finalDataSharing,
        eventAudienceIntelligence: finalEventAudience,
        brandDataAcknowledged: finalBrandAck,
        consentVersion: CURRENT_CONSENT_VERSION,
      },
    });
  } catch (error) {
    console.error("[Privacy] updateConsent error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to update consent" });
  }
}

// ============================================================
// GET /privacy/consent
// ============================================================

async function getConsent(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const result = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent,
              event_audience_intelligence_consent, brand_data_acknowledged,
              consent_version, consented_at, last_updated_at
       FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasConsented: false,
        consent: {
          behavioralTracking: false, brandTargeting: false, dataSharing: false,
          eventAudienceIntelligence: false, brandDataAcknowledged: false,
          consentVersion: CURRENT_CONSENT_VERSION,
        },
      });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      hasConsented: true,
      consent: {
        behavioralTracking: row.behavioral_tracking_consent,
        brandTargeting: row.brand_targeting_consent,
        dataSharing: row.data_sharing_consent,
        eventAudienceIntelligence: row.event_audience_intelligence_consent,
        brandDataAcknowledged: row.brand_data_acknowledged,
        consentVersion: row.consent_version,
        consentedAt: row.consented_at,
        lastUpdatedAt: row.last_updated_at,
      },
      requiresReConsent: row.consent_version !== CURRENT_CONSENT_VERSION,
    });
  } catch (error) {
    console.error("[Privacy] getConsent error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch consent state" });
  }
}

// ============================================================
// POST /privacy/request-deletion
// ============================================================

async function requestDataDeletion(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    // Sponsors don't have behavioral data to delete
    if (userType === "sponsor") {
      return res.status(400).json({
        error: "Brand accounts do not have behavioral data subject to deletion",
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    await pool.query(
      `INSERT INTO data_deletion_requests (user_id, status, requested_at)
       VALUES ($1, 'processing', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'processing', requested_at = NOW(),
         completed_at = NULL, tables_cleared = NULL`,
      [userId]
    );

    const tablesCleared = {};

    const behaviorResult = await pool.query(`DELETE FROM user_behavior_events WHERE user_id = $1`, [userId]);
    tablesCleared.user_behavior_events = parseInt(behaviorResult.rowCount) || 0;

    const interestResult = await pool.query(`DELETE FROM user_interest_vectors WHERE user_id = $1`, [userId]);
    tablesCleared.user_interest_vectors = parseInt(interestResult.rowCount) || 0;

    const aqiResult = await pool.query(
      `UPDATE user_aqi_signals SET
         paid_events_attended = 0, avg_ticket_price_paid = 0, free_events_attended = 0,
         events_hosted = 0, rsvp_to_attend_ratio = 0, multi_city_events = 0,
         content_depth_score = 0, search_sophistication_score = 0,
         network_quality_avg = 0, engagement_hour_pattern = '{}',
         professional_hours_ratio = 0, premium_categories_ratio = 0,
         aqi_score = NULL, aqi_tier = NULL, aqi_trajectory = 'stable',
         total_behavior_events = 0, onboarding_weight = 0.9, behavior_weight = 0.1,
         aqi_score_4w_ago = NULL, interest_vector_updated_at = NULL,
         last_calculated_at = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    tablesCleared.user_aqi_signals = aqiResult.rowCount > 0 ? "reset_to_defaults" : "no_row";

    const driftResult = await pool.query(`DELETE FROM user_drift_signals WHERE user_id = $1`, [userId]);
    tablesCleared.user_drift_signals = parseInt(driftResult.rowCount) || 0;

    // Reset consent flags (keep brand_data_acknowledged untouched for sponsors)
    await pool.query(
      `UPDATE user_privacy_consent SET
         behavioral_tracking_consent = false,
         brand_targeting_consent = false,
         event_audience_intelligence_consent = false,
         last_updated_at = NOW()
       WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );

    await pool.query(
      `UPDATE data_deletion_requests SET
         status = 'completed', completed_at = NOW(), tables_cleared = $2
       WHERE user_id = $1`,
      [userId, JSON.stringify(tablesCleared)]
    );

    await pool.query(
      `INSERT INTO user_privacy_consent_audit
         (user_id, user_type, action, previous_state, new_state, ip_address)
       VALUES ($1, $2, 'data_deletion_requested', $3, $4, $5)`,
      [userId, userType,
       JSON.stringify({ tablesCleared }),
       JSON.stringify({ behavioral: false, brand: false, dataSharing: false }),
       ipAddress]
    );

    console.log(`[Privacy] Data deletion completed for ${userType} ${userId}:`, tablesCleared);

    res.json({
      success: true,
      message: "Your behavioral data has been deleted. Your account and posts remain intact.",
      tablesCleared,
    });
  } catch (error) {
    console.error("[Privacy] requestDataDeletion error:", error.message, error.stack);
    try {
      await pool.query(
        `UPDATE data_deletion_requests SET status = 'failed' WHERE user_id = $1`,
        [req.user?.id]
      );
    } catch (_) {}
    res.status(500).json({ error: "Failed to process data deletion request" });
  }
}

// ============================================================
// GET /privacy/my-data-summary  (role-aware)
// ============================================================

async function getMyDataSummary(req, res) {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    // ── Fetch consent state (common to all roles) ─────────────────────────────
    const consentResult = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent,
              event_audience_intelligence_consent, brand_data_acknowledged
       FROM user_privacy_consent WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );
    const consent = consentResult.rows[0] || {};

    // ── SPONSOR summary ───────────────────────────────────────────────────────
    if (userType === "sponsor") {
      const matchResult = await pool.query(
        `SELECT
           COUNT(DISTINCT campaign_id) as campaign_count,
           COUNT(DISTINCT creator_id) as matched_creators,
           MAX(created_at) as last_match_at
         FROM brand_creator_matches WHERE brand_id = $1`,
        [userId]
      );
      const matchData = matchResult.rows[0] || {};

      return res.json({
        success: true,
        role: "sponsor",
        summary: {
          campaignCount: parseInt(matchData.campaign_count) || 0,
          matchedCreators: parseInt(matchData.matched_creators) || 0,
          lastMatchAt: matchData.last_match_at || null,
          brandDataAcknowledged: consent.brand_data_acknowledged ?? false,
          consentState: {
            brandDataAcknowledged: consent.brand_data_acknowledged ?? false,
          },
        },
      });
    }

    // ── MEMBER + COMMUNITY — shared personal AQI data ─────────────────────────
    const aqiResult = await pool.query(
      `SELECT aqi_tier, total_behavior_events, aqi_trajectory, aqi_score, created_at
       FROM user_aqi_signals WHERE user_id = $1`,
      [userId]
    );
    const aqiSignals = aqiResult.rows[0] || {};
    const aqiTier = aqiSignals.aqi_tier || 4;

    const interestsResult = await pool.query(
      `SELECT category FROM user_interest_vectors
       WHERE user_id = $1 ORDER BY decayed_score DESC LIMIT 5`,
      [userId]
    );
    const topInterests = interestsResult.rows.map((r) => r.category);

    const followResult = await pool.query(
      `SELECT COUNT(*) as total_follows,
              COUNT(*) FILTER (WHERE is_content_follow = true) as content_follows
       FROM follow_events WHERE follower_id = $1`,
      [userId]
    );
    const followData = followResult.rows[0] || {};
    const totalFollows = parseInt(followData.total_follows) || 0;
    const contentFollows = parseInt(followData.content_follows) || 0;
    const followQualityPct = totalFollows > 0
      ? Math.round((contentFollows / totalFollows) * 100) : 0;

    // ── Meaningful activity breakdown (display only — total_behavior_events unchanged) ──
    const activityResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'event_attended')                       AS events_attended,
         COUNT(*) FILTER (WHERE event_type IN ('content_watched', 'content_shared'))  AS content_engaged,
         COUNT(*) FILTER (WHERE event_type = 'search_performed')                      AS searches_performed
       FROM user_behavior_events WHERE user_id = $1`,
      [userId]
    );
    const activity = activityResult.rows[0] || {};

    // Account creation date — check members table first, then communities
    const table = userType === "community" ? "communities" : "members";
    const accountResult = await pool.query(
      `SELECT created_at FROM ${table} WHERE id = $1`, [userId]
    );
    const accountCreatedAt = accountResult.rows[0]?.created_at || null;

    const baseSummary = {
      aqiTier,
      tierLabel: TIER_LABELS[aqiTier] || "Unknown",
      tierBadge: TIER_BADGES[aqiTier] || "👻",
      tierExplanation: TIER_EXPLANATIONS[aqiTier] || "",
      topInterests,
      // Display breakdown — meaningful categories instead of raw event count
      eventsAttended:    parseInt(activity.events_attended)    || 0,
      contentEngaged:    parseInt(activity.content_engaged)    || 0,
      searchesPerformed: parseInt(activity.searches_performed) || 0,
      // Internal threshold counter — kept for Top Interests threshold logic
      behaviorEventCount: parseInt(aqiSignals.total_behavior_events) || 0,
      followQualityPct,
      trajectory: aqiSignals.aqi_trajectory || "stable",
      accountCreatedAt,
      consentState: {
        behavioral: consent.behavioral_tracking_consent ?? false,
        brand: consent.brand_targeting_consent ?? false,
        dataSharing: consent.data_sharing_consent ?? false,
        eventAudienceIntelligence: consent.event_audience_intelligence_consent ?? false,
      },
    };

    // ── COMMUNITY — append event audience stats ────────────────────────────────
    if (userType === "community") {
      const casResult = await pool.query(
        `SELECT total_followers, follow_quality_score,
                tier1_followers, tier2_followers, tier1_percentage, tier2_percentage,
                audience_buying_power_score, weekly_follow_quality_trend, calculated_at
         FROM creator_audience_stats WHERE creator_id = $1`,
        [userId]
      );
      const cas = casResult.rows[0] || null;

      return res.json({
        success: true,
        role: "community",
        summary: {
          ...baseSummary,
          eventAudienceStats: cas
            ? {
                totalFollowers: cas.total_followers || 0,
                followQualityScore: cas.follow_quality_score || 0,
                tier1Followers: cas.tier1_followers || 0,
                tier2Followers: cas.tier2_followers || 0,
                tier1Percentage: cas.tier1_percentage || 0,
                tier2Percentage: cas.tier2_percentage || 0,
                audienceBuyingPowerScore: cas.audience_buying_power_score || 0,
                weeklyTrend: cas.weekly_follow_quality_trend || [],
                calculatedAt: cas.calculated_at,
              }
            : null,
        },
      });
    }

    // ── MEMBER ────────────────────────────────────────────────────────────────
    res.json({ success: true, role: "member", summary: baseSummary });

  } catch (error) {
    console.error("[Privacy] getMyDataSummary error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch data summary" });
  }
}

module.exports = { updateConsent, getConsent, requestDataDeletion, getMyDataSummary };
