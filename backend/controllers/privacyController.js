/**
 * Privacy Controller
 *
 * Handles consent management, data transparency, and deletion requests
 * for DPDP Act (Digital Personal Data Protection Act 2023) compliance.
 *
 * All endpoints require authentication via authMiddleware.
 */

const { createPool } = require("../config/db");
const pool = createPool();

// Current consent version — increment when privacy policy changes
const CURRENT_CONSENT_VERSION = "v1.0";

// AQI tier labels for human-readable data summary
const TIER_LABELS = {
  1: "The Buyers",
  2: "The Aspirants",
  3: "The Browsers",
  4: "The Ghosts",
};

const TIER_EXPLANATIONS = {
  1: "Based on the events you attend and how you engage, you're among our most active users. Brands see you as a high-value audience member.",
  2: "You're building a strong engagement pattern. Your activity shows growing interest in premium events and content.",
  3: "You're exploring what SnooSpace has to offer. As you attend more events and engage with content, your profile grows.",
  4: "You're just getting started! Attend events, explore content, and engage with communities to build your profile.",
};

const TIER_BADGES = {
  1: "🏆",
  2: "⭐",
  3: "👥",
  4: "👻",
};

// ============================================================
// POST /privacy/consent
// ============================================================

async function updateConsent(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      behavioralTracking,
      brandTargeting,
      dataSharing,
    } = req.body;

    // Validate at least one consent field is provided
    if (
      behavioralTracking === undefined &&
      brandTargeting === undefined &&
      dataSharing === undefined
    ) {
      return res.status(400).json({ error: "At least one consent field is required" });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // 1. Read current consent state for audit log (previousState)
    const existing = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent, consent_version
       FROM user_privacy_consent WHERE user_id = $1`,
      [userId]
    );

    const previousState = existing.rows.length > 0
      ? {
          behavioral: existing.rows[0].behavioral_tracking_consent,
          brand: existing.rows[0].brand_targeting_consent,
          dataSharing: existing.rows[0].data_sharing_consent,
          version: existing.rows[0].consent_version,
        }
      : null;

    // Resolve final consent values (use existing if not provided in request)
    const finalBehavioral = behavioralTracking !== undefined
      ? !!behavioralTracking
      : (previousState?.behavioral ?? false);
    const finalBrand = brandTargeting !== undefined
      ? !!brandTargeting
      : (previousState?.brand ?? false);
    const finalDataSharing = dataSharing !== undefined
      ? !!dataSharing
      : (previousState?.dataSharing ?? false);

    // 2. Upsert into user_privacy_consent
    await pool.query(
      `INSERT INTO user_privacy_consent
         (user_id, behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent,
          consent_version, consented_at, last_updated_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
       ON CONFLICT (user_id) DO UPDATE SET
         behavioral_tracking_consent = $2,
         brand_targeting_consent = $3,
         data_sharing_consent = $4,
         consent_version = $5,
         last_updated_at = NOW(),
         ip_address = $6,
         consented_at = COALESCE(user_privacy_consent.consented_at, NOW())`,
      [userId, finalBehavioral, finalBrand, finalDataSharing, CURRENT_CONSENT_VERSION, ipAddress]
    );

    // 3. Determine audit action
    let action = "initial_consent";
    if (previousState) {
      if (behavioralTracking !== undefined && behavioralTracking !== previousState.behavioral) {
        action = behavioralTracking ? "opt_in_behavioral" : "opt_out_behavioral";
      } else if (brandTargeting !== undefined && brandTargeting !== previousState.brand) {
        action = brandTargeting ? "opt_in_brand" : "opt_out_brand";
      } else if (dataSharing !== undefined && dataSharing !== previousState.dataSharing) {
        action = dataSharing ? "opt_in_data_sharing" : "opt_out_data_sharing";
      } else {
        action = "consent_updated";
      }
    }

    const newState = {
      behavioral: finalBehavioral,
      brand: finalBrand,
      dataSharing: finalDataSharing,
      version: CURRENT_CONSENT_VERSION,
    };

    // 4. Insert into audit log
    await pool.query(
      `INSERT INTO user_privacy_consent_audit
         (user_id, action, previous_state, new_state, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, JSON.stringify(previousState), JSON.stringify(newState), ipAddress]
    );

    console.log(`[Privacy] Consent updated for user ${userId}: ${action}`);

    // 5. Return updated consent state
    res.json({
      success: true,
      consent: {
        behavioralTracking: finalBehavioral,
        brandTargeting: finalBrand,
        dataSharing: finalDataSharing,
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
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent,
              consent_version, consented_at, last_updated_at
       FROM user_privacy_consent WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No consent record — user hasn't gone through consent flow yet
      return res.json({
        success: true,
        hasConsented: false,
        consent: {
          behavioralTracking: false,
          brandTargeting: false,
          dataSharing: false,
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
        consentVersion: row.consent_version,
        consentedAt: row.consented_at,
        lastUpdatedAt: row.last_updated_at,
      },
      // Signal if policy version changed — frontend should re-prompt
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
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    // 1. Insert/upsert into data_deletion_requests with status 'pending'
    await pool.query(
      `INSERT INTO data_deletion_requests (user_id, status, requested_at)
       VALUES ($1, 'processing', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'processing',
         requested_at = NOW(),
         completed_at = NULL,
         tables_cleared = NULL`,
      [userId]
    );

    const tablesCleared = {};

    // 2. Clear user_behavior_events
    const behaviorResult = await pool.query(
      `DELETE FROM user_behavior_events WHERE user_id = $1`,
      [userId]
    );
    tablesCleared.user_behavior_events = parseInt(behaviorResult.rowCount) || 0;

    // 3. Clear user_interest_vectors
    const interestResult = await pool.query(
      `DELETE FROM user_interest_vectors WHERE user_id = $1`,
      [userId]
    );
    tablesCleared.user_interest_vectors = parseInt(interestResult.rowCount) || 0;

    // 4. Reset user_aqi_signals to defaults (do NOT delete the row)
    const aqiResult = await pool.query(
      `UPDATE user_aqi_signals SET
         paid_events_attended = 0,
         avg_ticket_price_paid = 0,
         free_events_attended = 0,
         events_hosted = 0,
         rsvp_to_attend_ratio = 0,
         multi_city_events = 0,
         content_depth_score = 0,
         search_sophistication_score = 0,
         network_quality_avg = 0,
         engagement_hour_pattern = '{}',
         professional_hours_ratio = 0,
         premium_categories_ratio = 0,
         aqi_score = NULL,
         aqi_tier = NULL,
         aqi_trajectory = 'stable',
         total_behavior_events = 0,
         onboarding_weight = 0.9,
         behavior_weight = 0.1,
         aqi_score_4w_ago = NULL,
         interest_vector_updated_at = NULL,
         last_calculated_at = NULL,
         updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    tablesCleared.user_aqi_signals = aqiResult.rowCount > 0 ? "reset_to_defaults" : "no_row";

    // 5. Clear user_drift_signals
    const driftResult = await pool.query(
      `DELETE FROM user_drift_signals WHERE user_id = $1`,
      [userId]
    );
    tablesCleared.user_drift_signals = parseInt(driftResult.rowCount) || 0;

    // 6. Set consent flags to false
    await pool.query(
      `UPDATE user_privacy_consent SET
         behavioral_tracking_consent = false,
         brand_targeting_consent = false,
         last_updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    // 7. Update deletion request status to 'completed'
    await pool.query(
      `UPDATE data_deletion_requests SET
         status = 'completed',
         completed_at = NOW(),
         tables_cleared = $2
       WHERE user_id = $1`,
      [userId, JSON.stringify(tablesCleared)]
    );

    // 8. Log to audit table
    await pool.query(
      `INSERT INTO user_privacy_consent_audit
         (user_id, action, previous_state, new_state, ip_address)
       VALUES ($1, 'data_deletion_requested', $2, $3, $4)`,
      [
        userId,
        JSON.stringify({ tablesCleared }),
        JSON.stringify({ behavioral: false, brand: false, dataSharing: false }),
        ipAddress,
      ]
    );

    console.log(`[Privacy] Data deletion completed for user ${userId}:`, tablesCleared);

    res.json({
      success: true,
      message: "Your behavioral data has been deleted. Your account and posts remain intact.",
      tablesCleared,
    });
  } catch (error) {
    console.error("[Privacy] requestDataDeletion error:", error.message, error.stack);

    // Mark as failed if possible
    try {
      await pool.query(
        `UPDATE data_deletion_requests SET status = 'failed' WHERE user_id = $1`,
        [req.user?.id]
      );
    } catch (_) { /* non-fatal */ }

    res.status(500).json({ error: "Failed to process data deletion request" });
  }
}

// ============================================================
// GET /privacy/my-data-summary
// ============================================================

async function getMyDataSummary(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Fetch AQI signals
    const aqiResult = await pool.query(
      `SELECT aqi_tier, total_behavior_events, aqi_trajectory, aqi_score, created_at
       FROM user_aqi_signals WHERE user_id = $1`,
      [userId]
    );

    const aqiSignals = aqiResult.rows[0] || {};
    const aqiTier = aqiSignals.aqi_tier || 4;

    // Fetch top 5 interests by decayed_score
    const interestsResult = await pool.query(
      `SELECT category, decayed_score
       FROM user_interest_vectors
       WHERE user_id = $1
       ORDER BY decayed_score DESC
       LIMIT 5`,
      [userId]
    );

    const topInterests = interestsResult.rows.map((r) => r.category);

    // Fetch follow quality — content follow percentage for this user as a follower
    const followResult = await pool.query(
      `SELECT
         COUNT(*) as total_follows,
         COUNT(*) FILTER (WHERE is_content_follow = true) as content_follows
       FROM follow_events
       WHERE follower_id = $1`,
      [userId]
    );

    const followData = followResult.rows[0] || {};
    const totalFollows = parseInt(followData.total_follows) || 0;
    const contentFollows = parseInt(followData.content_follows) || 0;
    const followQualityPct = totalFollows > 0
      ? Math.round((contentFollows / totalFollows) * 100)
      : 0;

    // Fetch consent state
    const consentResult = await pool.query(
      `SELECT behavioral_tracking_consent, brand_targeting_consent, data_sharing_consent
       FROM user_privacy_consent WHERE user_id = $1`,
      [userId]
    );

    const consent = consentResult.rows[0] || {};

    // Fetch account creation date
    const memberResult = await pool.query(
      `SELECT created_at FROM members WHERE id = $1`,
      [userId]
    );

    const accountCreatedAt = memberResult.rows[0]?.created_at || null;

    res.json({
      success: true,
      summary: {
        aqiTier,
        tierLabel: TIER_LABELS[aqiTier] || "Unknown",
        tierBadge: TIER_BADGES[aqiTier] || "👻",
        tierExplanation: TIER_EXPLANATIONS[aqiTier] || "",
        topInterests,
        behaviorEventCount: parseInt(aqiSignals.total_behavior_events) || 0,
        followQualityPct,
        trajectory: aqiSignals.aqi_trajectory || "stable",
        accountCreatedAt,
        consentState: {
          behavioral: consent.behavioral_tracking_consent ?? false,
          brand: consent.brand_targeting_consent ?? false,
          dataSharing: consent.data_sharing_consent ?? false,
        },
      },
    });
  } catch (error) {
    console.error("[Privacy] getMyDataSummary error:", error.message, error.stack);
    res.status(500).json({ error: "Failed to fetch data summary" });
  }
}

module.exports = {
  updateConsent,
  getConsent,
  requestDataDeletion,
  getMyDataSummary,
};
