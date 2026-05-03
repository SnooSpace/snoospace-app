/**
 * Consent Gate Middleware
 *
 * DPDP Act 2023 compliance:
 *
 *   requireBehavioralConsent — drops tracking requests from users without consent.
 *     Silent 200 skip, app never breaks.
 *
 *   requireBrandAcknowledgment — blocks brand-facing intelligence endpoints
 *     (getBrandMatches) if the brand hasn't acknowledged the data usage terms.
 *     Returns 403 with reason 'brand_acknowledgment_required' — not silent,
 *     because the frontend must surface the blocking acknowledgment banner.
 *
 *   checkCreatorEventConsent — reads the creator's event_audience_intelligence_consent
 *     and sets req.creatorConsentedToEventIntelligence. Does not block — lets
 *     getCreatorStats decide which fields to strip.
 */

const { createPool } = require("../config/db");
const pool = createPool();

// ── requireBehavioralConsent ──────────────────────────────────────────────────

const requireBehavioralConsent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return next();

    const result = await pool.query(
      `SELECT behavioral_tracking_consent
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );

    const hasConsent = result.rows[0]?.behavioral_tracking_consent ?? false;

    if (!hasConsent) {
      return res.status(200).json({ status: "skipped", reason: "no_consent" });
    }

    next();
  } catch (error) {
    // Non-fatal — allow through on error rather than break the app
    console.error("[ConsentGate] behavioral consent check error:", error.message);
    next();
  }
};

// ── requireBrandAcknowledgment ────────────────────────────────────────────────
// Applied to: GET /audience/brand-matches/:brandId/:campaignId
// Hard block — brands MUST acknowledge before accessing match data.

const requireBrandAcknowledgment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";

    // Only enforce for sponsor accounts
    if (userType !== "sponsor") return next();
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const result = await pool.query(
      `SELECT brand_data_acknowledged
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = 'sponsor'`,
      [userId]
    );

    const acknowledged = result.rows[0]?.brand_data_acknowledged ?? false;

    if (!acknowledged) {
      return res.status(403).json({
        error: "Data usage acknowledgment required",
        reason: "brand_acknowledgment_required",
        message:
          "You must acknowledge SnooSpace's data usage terms before accessing audience intelligence data.",
      });
    }

    next();
  } catch (error) {
    // Fail safe — block on error to prevent unacknowledged data leakage
    console.error("[ConsentGate] brand acknowledgment check error:", error.message);
    return res.status(403).json({
      error: "Could not verify data usage acknowledgment. Please try again.",
      reason: "brand_acknowledgment_check_failed",
    });
  }
};

// ── checkCreatorEventConsent ──────────────────────────────────────────────────
// Applied to: GET /audience/creator-stats/:creatorId (when caller is sponsor)
// Non-blocking — sets req.creatorConsentedToEventIntelligence flag.
// getCreatorStats uses this to decide whether to strip event-level fields.

const checkCreatorEventConsent = async (req, res, next) => {
  try {
    const callerType = req.user?.type;
    const creatorId = req.params?.creatorId;

    // Only relevant when a brand is querying a community creator
    if (callerType !== "sponsor" || !creatorId) {
      req.creatorConsentedToEventIntelligence = true; // not restricted
      return next();
    }

    const result = await pool.query(
      `SELECT event_audience_intelligence_consent
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = 'community'`,
      [creatorId]
    );

    req.creatorConsentedToEventIntelligence =
      result.rows[0]?.event_audience_intelligence_consent ?? false;

    next();
  } catch (error) {
    console.error("[ConsentGate] creator event consent check error:", error.message);
    // Fail safe — restrict event data if we can't verify consent
    req.creatorConsentedToEventIntelligence = false;
    next();
  }
};

// ── requireBrandConsent (legacy — kept for backward compat) ───────────────────
// Kept so existing route wiring still works. Now effectively a no-op for
// brands because requireBrandAcknowledgment does the real enforcement.

const requireBrandConsent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type || "member";
    if (!userId) return next();

    const result = await pool.query(
      `SELECT brand_targeting_consent
       FROM user_privacy_consent
       WHERE user_id = $1 AND user_type = $2`,
      [userId, userType]
    );

    const hasConsent = result.rows[0]?.brand_targeting_consent ?? false;

    if (!hasConsent) {
      return res.status(200).json({ status: "skipped", reason: "no_brand_consent" });
    }

    next();
  } catch (error) {
    console.error("[ConsentGate] brand consent check error:", error.message);
    next();
  }
};

module.exports = {
  requireBehavioralConsent,
  requireBrandConsent,
  requireBrandAcknowledgment,
  checkCreatorEventConsent,
};
