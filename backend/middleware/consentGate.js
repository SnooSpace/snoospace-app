/**
 * Consent Gate Middleware
 *
 * Intercepts audience intelligence tracking endpoints and silently drops
 * requests from users who have not given consent. The app never breaks
 * for a non-consenting user — they just aren't tracked.
 *
 * DPDP Act compliance: No behavioral data is collected without explicit consent.
 */

const { createPool } = require("../config/db");
const pool = createPool();

/**
 * requireBehavioralConsent
 *
 * Applied to behavioral tracking endpoints:
 *   - POST /audience/track-engagement
 *   - POST /audience/track-follow
 *   - POST /audience/recalculate-interest-vectors/:userId
 *
 * If the user has not given behavioral tracking consent:
 *   - Returns 200 with { status: 'skipped', reason: 'no_consent' }
 *   - Does NOT reject or error — the app continues to function normally
 */
const requireBehavioralConsent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(); // unauthenticated requests pass through to auth middleware

    const result = await pool.query(
      `SELECT behavioral_tracking_consent 
       FROM user_privacy_consent 
       WHERE user_id = $1`,
      [userId]
    );

    const hasConsent = result.rows[0]?.behavioral_tracking_consent ?? false;

    if (!hasConsent) {
      // Silently acknowledge but do not process
      // User experience is unaffected — they just aren't tracked
      return res.status(200).json({
        status: "skipped",
        reason: "no_consent",
      });
    }

    next();
  } catch (error) {
    // Non-fatal — if consent check fails, allow request to proceed
    // Better to over-track temporarily than break the app
    console.error("[ConsentGate] behavioral consent check error:", error.message);
    next();
  }
};

/**
 * requireBrandConsent
 *
 * Applied to brand-facing intelligence endpoints:
 *   - GET /audience/creator-stats/:creatorId (when called by a brand)
 *   - GET /audience/brand-matches/:brandId/:campaignId
 *
 * Same silent-skip pattern as requireBehavioralConsent.
 */
const requireBrandConsent = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const result = await pool.query(
      `SELECT brand_targeting_consent 
       FROM user_privacy_consent 
       WHERE user_id = $1`,
      [userId]
    );

    const hasConsent = result.rows[0]?.brand_targeting_consent ?? false;

    if (!hasConsent) {
      return res.status(200).json({
        status: "skipped",
        reason: "no_brand_consent",
      });
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
};
