import { apiGet } from './client';

/**
 * Get discover feed - posts and events for explore grid
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of items to fetch (default: 30)
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.type - Filter: 'all', 'posts', 'events'
 * @returns {Promise<Object>} Feed items with grid_span info
 */
export async function getDiscoverFeed(options = {}) {
  const { limit = 30, offset = 0, type = 'all' } = options;
  const token = await (await import('./auth')).getAuthToken();
  return apiGet(`/discover/feed?limit=${limit}&offset=${offset}&type=${type}`, 15000, token);
}

/**
 * Get suggested communities based on user's interests
 * @param {number} limit - Number of suggestions (default: 10)
 * @returns {Promise<Object>} Community suggestions
 */
export async function getSuggestedCommunities(limit = 10) {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet(`/discover/suggestions?limit=${limit}`, 15000, token);
}
