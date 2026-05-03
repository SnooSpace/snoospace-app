/**
 * Audience Intelligence Rate Limiters
 *
 * Endpoint-specific limits for tracking and AQI recalculation routes.
 * Keyed by authenticated user ID where available, falling back to IP via the
 * express-rate-limit ipKeyGenerator helper (required for correct IPv6 handling).
 *
 * Rationale for limits:
 *   - A real user cannot physically trigger more than ~50 engagement events
 *     per hour (attending events, watching content, searching). 100/hr gives
 *     a 2x buffer before blocking.
 *   - 200 follows/hr is already very generous for organic follow behaviour.
 *   - AQI recalculation is an expensive DB operation — 5/day per user is
 *     more than enough for any legitimate use.
 */

const rateLimit = require('express-rate-limit');

// ipKeyGenerator handles IPv6 address normalisation correctly (required in v7+)
const { ipKeyGenerator } = rateLimit;

/**
 * Returns the rate-limit key for a request.
 * Authenticated users are keyed by their DB user ID to avoid IP collisions
 * (e.g. multiple users behind the same NAT). Unauthenticated fallback uses IP.
 */
function makeKeyGenerator(req) {
  if (req.user?.id != null) {
    // Return as string — express-rate-limit expects a string key
    return String(req.user.id);
  }
  return ipKeyGenerator(req);
}

/**
 * AQI key generator is keyed by the :userId route param when present.
 * Falls back to IP for unauthenticated calls.
 */
function aqiKeyGenerator(req) {
  if (req.params?.userId != null) {
    return String(req.params.userId);
  }
  return ipKeyGenerator(req);
}

// ─── Track Engagement ──────────────────────────────────────────────────────
// 100 events per hour per user (authenticated) or per IP (unauthenticated)
const trackingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  keyGenerator: makeKeyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many tracking events. Please try again later.',
    });
  },
  skipSuccessfulRequests: false,
});

// ─── Track Follow ─────────────────────────────────────────────────────────
// 200 follow events per hour per user
const followTrackingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  keyGenerator: makeKeyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many follow tracking events. Please try again later.',
    });
  },
});

// ─── AQI Recalculation ────────────────────────────────────────────────────
// 5 recalculations per 24 hours per userId (param) or IP fallback.
// This is an expensive DB operation — strict throttling is intentional.
const aqiCalculationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  keyGenerator: aqiKeyGenerator,
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'AQI recalculation limit reached. Please try again tomorrow.',
    });
  },
});

module.exports = {
  trackingRateLimit,
  followTrackingRateLimit,
  aqiCalculationRateLimit,
};
