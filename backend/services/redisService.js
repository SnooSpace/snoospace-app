/**
 * redisService.js
 *
 * Thin wrapper around @upstash/redis for the recommendations system.
 * Uses a lazy singleton so the client is only created once per process.
 *
 * All recommendation-specific key operations are encapsulated here.
 * Key format: user:{userId}:recs
 */

const { Redis } = require('@upstash/redis');
const cfg = require('../config/recommendationConfig');

let _redis = null;

/**
 * Returns the shared Redis client. Lazy-initialised on first call.
 * Returns null (gracefully) if env vars are not configured, so the
 * rest of the app doesn't crash in local dev without Redis set up.
 */
function getRedis() {
  if (_redis) return _redis;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[RedisService] UPSTASH_REDIS_REST_URL / TOKEN not set — Redis cache disabled');
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Build the Redis key for a user's recommendation list.
 * Format: user:{userId}:recs
 */
function recsKey(userId) {
  return `${cfg.REDIS_KEY_PREFIX}:${userId}:${cfg.REDIS_KEY_SUFFIX}`;
}

/**
 * Cache the top N recommendations for a user.
 * @param {string|number} userId
 * @param {Array<Object>} recs  — full recommendation objects (candidate_id, top_reasons, profile, …)
 */
async function setUserRecs(userId, recs) {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(recsKey(userId), JSON.stringify(recs), { ex: cfg.REDIS_TTL_SECONDS });
  } catch (err) {
    console.error(`[RedisService] setUserRecs(${userId}) error:`, err.message);
  }
}

/**
 * Retrieve cached recommendations for a user.
 * @param {string|number} userId
 * @returns {Array<Object>|null}  — parsed array, or null if cache miss / error
 */
async function getUserRecs(userId) {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(recsKey(userId));
    if (!raw) return null;
    // @upstash/redis auto-parses JSON when the stored value is valid JSON
    return Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch (err) {
    console.error(`[RedisService] getUserRecs(${userId}) error:`, err.message);
    return null;
  }
}

/**
 * Remove a specific candidate from a user's cached recommendation list.
 * Used after a dismissal so the frontend immediately sees the updated list.
 * @param {string|number} userId
 * @param {string|number} candidateId
 */
async function removeUserRec(userId, candidateId) {
  const redis = getRedis();
  if (!redis) return;

  try {
    const existing = await getUserRecs(userId);
    if (!existing || existing.length === 0) return;

    const cid = String(candidateId);
    const filtered = existing.filter(r => String(r.candidate_id) !== cid);

    if (filtered.length === existing.length) return; // candidate wasn't in cache

    // Re-set with same TTL (the TTL resets, but that's acceptable here)
    await redis.set(recsKey(userId), JSON.stringify(filtered), { ex: cfg.REDIS_TTL_SECONDS });
  } catch (err) {
    console.error(`[RedisService] removeUserRec(${userId}, ${candidateId}) error:`, err.message);
  }
}

/**
 * Delete the entire cached recommendation list for a user.
 * Called when the batch job re-computes a user's recommendations.
 * @param {string|number} userId
 */
async function deleteUserRecs(userId) {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(recsKey(userId));
  } catch (err) {
    console.error(`[RedisService] deleteUserRecs(${userId}) error:`, err.message);
  }
}

module.exports = {
  getRedis,
  setUserRecs,
  getUserRecs,
  removeUserRec,
  deleteUserRecs,
};
