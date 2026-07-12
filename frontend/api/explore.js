import { apiGet, apiPatch } from "./client";

/**
 * Get consolidated Explore feed data
 */
export const getExploreFeed = async (lat = null, lng = null) => {
  const token = await (await import('./auth')).getAuthToken();
  let path = "/explore/feed";
  if (lat !== null && lng !== null) {
    path += `?lat=${lat}&lng=${lng}`;
  }
  return await apiGet(path, 15000, token);
};

/**
 * Dismiss creator opportunities banner
 */
export const dismissOpportunitiesBanner = async () => {
  const token = await (await import('./auth')).getAuthToken();
  return await apiPatch("/explore/opportunities/dismiss", {}, 15000, token);
};

/**
 * Unified Search across different types
 * @param {string} query - search query string
 * @param {string} type - 'events' | 'people' | 'communities' | 'creators'
 */
export const unifiedSearch = async (query, type = 'events', limit = 20, offset = 0, eventSubFilter = 'all') => {
  const token = await (await import('./auth')).getAuthToken();
  const qStr = encodeURIComponent(query);
  return await apiGet(`/search?q=${qStr}&type=${type}&limit=${limit}&offset=${offset}&eventSubFilter=${eventSubFilter}`, 15000, token);
};
