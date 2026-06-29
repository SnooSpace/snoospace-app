/**
 * services/location/searchCache.js
 *
 * Two-level AsyncStorage cache for location search:
 *
 * 1. Recent Searches — last 10 queries the user typed (not API-keyed)
 *    Key: @snooLocationRecent
 *    Shape: [{ query, results[], timestamp }]
 *
 * 2. Query Cache — API results keyed by provider|query|lat|lng
 *    Key: @snooSearchCache
 *    TTL: 7 days
 *    Shape: { [cacheKey]: { results[], timestamp } }
 *
 * All operations are best-effort — never throw.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = '@snooLocationRecent';
const QUERY_CACHE_KEY = '@snooSearchCache';

const MAX_RECENTS = 10;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Recent Searches ──────────────────────────────────────────────────────────

/**
 * Load the last N recent searches.
 * @returns {Promise<Array<{ query: string, results: import('./LocationService').UnifiedPlaceResult[], timestamp: number }>>}
 */
export async function getRecents() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) ?? [];
  } catch {
    return [];
  }
}

/**
 * Prepend a new query+results to recents. Dedupes by query string (case-insensitive).
 * Trims list to MAX_RECENTS.
 *
 * @param {string} query
 * @param {import('./LocationService').UnifiedPlaceResult[]} results
 */
export async function saveRecent(query, results) {
  if (!query?.trim() || !results?.length) return;
  try {
    const existing = await getRecents();
    // Remove any prior entry for the same query (case-insensitive)
    const filtered = existing.filter(
      (r) => r.query.toLowerCase() !== query.trim().toLowerCase(),
    );
    const updated = [
      { query: query.trim(), results: results.slice(0, 5), timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // best-effort
  }
}

/**
 * Clear all recent searches.
 */
export async function clearRecents() {
  try {
    await AsyncStorage.removeItem(RECENT_KEY);
  } catch {}
}

// ─── Query Cache ──────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key.
 * Rounds lat/lng to 3 decimal places (~100m precision) to maximise reuse.
 *
 * @param {string} provider
 * @param {string} query
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function buildCacheKey(provider, query, lat, lng) {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  return `${provider}|${query.trim().toLowerCase()}|${roundedLat}|${roundedLng}`;
}

/**
 * Read cached results for a given key. Returns null if missing or expired.
 *
 * @param {string} cacheKey
 * @returns {Promise<import('./LocationService').UnifiedPlaceResult[] | null>}
 */
export async function getQueryCache(cacheKey) {
  try {
    const raw = await AsyncStorage.getItem(QUERY_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[cacheKey];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      // Expired — leave cleanup to clearExpiredCache()
      return null;
    }
    return entry.results ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist search results for a given key.
 *
 * @param {string} cacheKey
 * @param {import('./LocationService').UnifiedPlaceResult[]} results
 */
export async function saveQueryCache(cacheKey, results) {
  if (!results?.length) return;
  try {
    const raw = await AsyncStorage.getItem(QUERY_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[cacheKey] = { results, timestamp: Date.now() };
    await AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

/**
 * Remove all expired entries from the query cache.
 * Call this on app startup to prevent unbounded growth.
 */
export async function clearExpiredCache() {
  try {
    const raw = await AsyncStorage.getItem(QUERY_CACHE_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(store)) {
      if (now - store[key].timestamp > CACHE_TTL_MS) {
        delete store[key];
        changed = true;
      }
    }
    if (changed) {
      await AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(store));
    }
  } catch {
    // best-effort
  }
}
