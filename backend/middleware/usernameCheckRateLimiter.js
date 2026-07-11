/**
 * Username Check Rate Limiter
 *
 * Uses express-rate-limit (already installed) with an in-memory store.
 * Limits: 20 checks per 60-second sliding window per user (or IP fallback).
 *
 * Note: If Upstash Redis is added to the project in the future, swap the store
 * for @upstash/ratelimit to share state across multiple server instances.
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

/**
 * Key generator: prefer authenticated userId, fall back to IP.
 * Matches the pattern established in middleware/rateLimiter.js.
 */
function usernameCheckKeyGenerator(req) {
  // req.user is set by authMiddleware when a valid token is present.
  // This route is intentionally public (used on signup), so userId may be absent.
  if (req.user?.id != null) {
    return `uid:${req.user.id}`;
  }
  return ipKeyGenerator(req);
}

const usernameCheckRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 60-second window
  max: 20,               // 20 checks per window
  keyGenerator: usernameCheckKeyGenerator,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts. Please slow down.' });
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { usernameCheckRateLimiter };
