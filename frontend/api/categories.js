import { apiGet, apiPost, apiDelete, apiPatch } from "./client";

/**
 * Get discover feed V2 with categories and events
 * Returns categories with their events for the new carousel-based discover feed
 */
export const getDiscoverFeedV2 = async () => {
  return await apiGet("/discover/v2/feed");
};

/**
 * Get all active discover categories
 */
export const getDiscoverCategories = async () => {
  return await apiGet("/discover/categories");
};

/**
 * Get a specific category with its events
 * @param {number} categoryId - Category ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of events to fetch
 * @param {number} options.offset - Offset for pagination
 */
export const getCategoryById = async (categoryId, options = {}) => {
  const { limit = 20, offset = 0 } = options;
  return await apiGet(
    `/discover/categories/${categoryId}?limit=${limit}&offset=${offset}`
  );
};

/**
 * Get categories assigned to an event
 * @param {number} eventId - Event ID
 */
export const getEventCategories = async (eventId) => {
  return await apiGet(`/events/${eventId}/categories`);
};

/**
 * Assign categories to an event
 * @param {number} eventId - Event ID
 * @param {number[]} categoryIds - Array of category IDs
 */
export const assignEventCategories = async (eventId, categoryIds) => {
  return await apiPatch(`/events/${eventId}/categories`, { categoryIds });
};

/**
 * Get signup interests (for member/sponsor signup screens)
 * @param {string} userType - 'member', 'sponsor', or 'all'
 */
export const getSignupInterests = async (userType = "all") => {
  const response = await apiGet(
    `/catalog/signup-interests?userType=${userType}`
  );
  return response.interests || [];
};

// ============================================
// ADMIN API FUNCTIONS
// ============================================

/**
 * Get all categories (admin view, includes inactive)
 */
export const getAllCategoriesAdmin = async () => {
  return await apiGet("/admin/categories");
};

/**
 * Create a new category (admin only)
 * @param {Object} data - Category data
 */
export const createCategory = async (data) => {
  return await apiPost("/admin/categories", data);
};

/**
 * Update a category (admin only)
 * @param {number} categoryId - Category ID
 * @param {Object} data - Updated category data
 */
export const updateCategory = async (categoryId, data) => {
  return await apiPatch(`/admin/categories/${categoryId}`, data);
};

/**
 * Delete a category (admin only)
 * @param {number} categoryId - Category ID
 */
export const deleteCategory = async (categoryId) => {
  return await apiDelete(`/admin/categories/${categoryId}`);
};

/**
 * Reorder categories (admin only)
 * @param {Array<{id: number, display_order: number}>} order - New order
 */
export const reorderCategories = async (order) => {
  return await apiPost("/admin/categories/reorder", { order });
};

/**
 * Toggle featured status of an event in a category (admin only)
 * @param {number} eventId - Event ID
 * @param {number} categoryId - Category ID
 * @param {boolean} isFeatured - New featured status
 */
export const toggleEventFeatured = async (eventId, categoryId, isFeatured) => {
  return await apiPatch(
    `/admin/events/${eventId}/categories/${categoryId}/featured`,
    { is_featured: isFeatured }
  );
};

/**
 * Get all interests (admin view)
 */
export const getAllInterestsAdmin = async () => {
  return await apiGet("/admin/interests");
};

/**
 * Create a new interest (admin only)
 * @param {Object} data - Interest data
 */
export const createInterest = async (data) => {
  return await apiPost("/admin/interests", data);
};

/**
 * Update an interest (admin only)
 * @param {number} interestId - Interest ID
 * @param {Object} data - Updated interest data
 */
export const updateInterest = async (interestId, data) => {
  return await apiPatch(`/admin/interests/${interestId}`, data);
};

/**
 * Delete an interest (admin only)
 * @param {number} interestId - Interest ID
 */
export const deleteInterest = async (interestId) => {
  return await apiDelete(`/admin/interests/${interestId}`);
};
