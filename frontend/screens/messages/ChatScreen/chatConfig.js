/**
 * chatConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all ChatScreen tunable constants.
 *
 * ── HOW TO EXPERIMENT ────────────────────────────────────────────────────────
 * Change a value here, save, and Expo will hot-reload.
 * No other files need to be touched.
 *
 * ── HOW TO READ LOGS ─────────────────────────────────────────────────────────
 * Set CHAT_TEST_LOGGING = true, then filter the Metro console for [CHAT-PERF].
 * Each event is tagged so you can compare cold vs warm vs pagination runs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Master logging switch ────────────────────────────────────────────────────
// Set to true to emit [CHAT-PERF] measurement logs. Set to false for silence.
export const CHAT_TEST_LOGGING = true;

// ── Initial load (cold start — no cache) ─────────────────────────────────────
// How many messages to fetch from the API when the conversation is opened cold.
// Fewer = faster first paint but the user might hit pagination sooner.
// Default: 30. Try: 15, 20.
export const INITIAL_MESSAGES_LIMIT = 15;

// ── Warm start (cache hit) ───────────────────────────────────────────────────
// Max messages stored in the in-memory LRU cache per conversation.
// This is how many messages are painted on frame 0 before the network arrives.
// Default: 20. Try: 10, 15.
export const WARM_CACHE_MAX_MESSAGES = 15;

// ── Pagination batch (load-older) ────────────────────────────────────────────
// How many messages to fetch per "load older" page when the user scrolls up.
// Smaller = more fetches but lighter network hits; larger = fewer fetches but
// each fetch adds more height (more correction work for the convergence machine).
// Default: 12. Try: 8, 15, 20.
export const OLDER_PAGE_SIZE = 12;

// ── Opacity reveal — debounce quiet window ───────────────────────────────────
// The list stays hidden (opacity=0) until ContentSizeChange has been quiet for
// this many ms. Shorter = reveals sooner but may flash at wrong scroll position.
// Default: 90. Try: 60, 75.
export const REVEAL_DEBOUNCE_MS = 60;

// ── Opacity reveal — absolute hard fallback ──────────────────────────────────
// Maximum time the list can stay hidden, regardless of ContentSizeChange activity.
// Safety net for slow devices or large message histories.
// Default: 1200. Try: 800, 1000.
export const REVEAL_HARD_FALLBACK_MS = 1200;

// ── Opacity reveal — fade-in animation duration ──────────────────────────────
// Once the reveal decision is made, how long the list fades from 0 → 1.
// 0 = instant snap. Default: 50. Try: 0, 30, 80.
export const REVEAL_FADE_DURATION_MS = 50;
