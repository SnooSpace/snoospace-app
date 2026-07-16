/**
 * recommendationConfig.js
 *
 * Single source of truth for all tunable parameters in the
 * "People You Should Meet" recommendation engine.
 *
 * All weights and caps live here — change this file to retune
 * the algorithm post-launch without touching scoring logic.
 * No restart required if you add a hot-reload mechanism later;
 * for now, a server restart picks up new values.
 */

module.exports = {
  // ── Candidate gate parameters ─────────────────────────────────────────────
  // Users inactive longer than this are excluded from scoring entirely.
  ACTIVE_WITHIN_DAYS: 21,

  // Maximum candidates to score per user per run.
  // Controls compute cost — increase cautiously as user base grows.
  CANDIDATE_POOL_LIMIT: 300,

  // How long (days) before a dismissed candidate can resurface.
  DISMISSAL_COOLDOWN_DAYS: 14,

  // ── Scoring weights (w1–w10) ───────────────────────────────────────────────────
  // Tuned post-launch based on engagement data. Starting values per spec.
  weights: {
    shared_events:        3.0,  // w1 — most on-thesis (physically co-present)
    shared_communities:   2.0,  // w2 — shared interest context
    mutual_circles:       1.5,  // w3 — social graph proximity
    sparks:               1.5,  // w4 — intent-declared compatibility
    same_college:         1.2,  // w5 — strong shared-context signal
    occupation:           1.0,  // w6 — conditional (requires professional spark)
    shared_interests:     0.8,  // w7 — rarity-weighted interest overlap
    proximity:            0.6,  // w8 — physical distance decay
    verification:         0.3,  // w9 — small trust signal, heavily capped

    // w10 — Positive co-attendee rating (from open_plan_attendee_ratings)
    // Uses same 180-day window as w1 (shared_events) for consistency.
    // Set to 0 to disable entirely without touching job logic.
    // Review Signal 10 contribution logs for the first 2 weeks post-launch
    // (logged individually in computeRecommendations.js) before trusting this silently.
    co_attendee_rating:   0.15,
  },

  // ── Signal caps ───────────────────────────────────────────────────────────
  caps: {
    // Mutual circles counted beyond this don't add more score.
    // Prevents dense social graphs from dominating.
    mutual_circles: 5,

    // Maximum raw boost value from verification_tier.
    // This cap is applied BEFORE multiplying by the weight,
    // so the maximum contribution from verification is:
    //   weight.verification × caps.verification = 0.3 × 0.1 = 0.03
    // — a small nudge, not a dominant factor.
    verification: 0.1,
  },

  // ── Verification tier → raw boost value ──────────────────────────────────
  // 'none' MUST map to exactly 0 — not a small positive value.
  // Before verification is rolled out, most users will be 'none',
  // and a nonzero default would create phantom scoring differences.
  verification_tier_values: {
    none:            0,
    selfie_verified: 0.05,
    id_verified:     0.1,
  },

  // ── Spark bucket classification ───────────────────────────────────────────
  // Defines which categories use same-tag overlap scoring vs
  // complementary seeking/offering scoring.
  // Maps to sparks.category values in DB.
  PROFESSIONAL_BUCKET: 'professional',
  OVERLAP_BUCKETS: ['social', 'activity', 'learning', 'travel'],

  // ── Shared interest minimum ───────────────────────────────────────────────
  // Shared interest signal is only counted if at least this many chips overlap.
  SHARED_INTEREST_MIN: 2,

  // ── Event attendance — signal strength multipliers ────────────────────────
  // 'attended'/'confirmed' = full signal weight (physically present)
  // 'registered' = excluded from v1 (RSVP ≠ attendance)
  // Set REGISTERED_WEIGHT to 0 to exclude, or e.g. 0.3 to include at lower weight.
  EVENT_ATTENDED_STATUSES: ['attended', 'confirmed'],
  // Not used in v1 but documented here for future tuning:
  // EVENT_REGISTERED_WEIGHT: 0.3,

  // ── Redis cache ───────────────────────────────────────────────────────────
  // Number of top candidates cached per user.
  REDIS_CACHE_SIZE: 30,

  // TTL in seconds (24 hours).
  REDIS_TTL_SECONDS: 86400,

  // Redis key prefix for user recommendation lists.
  REDIS_KEY_PREFIX: 'user',
  REDIS_KEY_SUFFIX: 'recs',
};
