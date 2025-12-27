import { apiPost, apiGet } from "./client";

/**
 * Create a new event
 * @param {Object} eventData - Event details
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost("/events", eventData, 15000, token);
}

/**
 * Get events created by the community (for Dashboard)
 * @returns {Promise<Object>} List of community events
 */
export async function getCommunityEvents() {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet("/events/community", 15000, token);
}

/**
 * Get events user is registered for
 * @returns {Promise<Object>} List of events
 */
export async function getMyEvents() {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet("/events/my-events", 15000, token);
}

/**
 * Get event details
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} Event details
 */
export async function getEventDetails(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/events/${eventId}`, 15000, token);
}

/**
 * Get attendees for an event
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} List of attendees
 */
export async function getEventAttendees(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/events/${eventId}/attendees`, 15000, token);
}

/**
 * Discover events for home feed (interspersed with posts)
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of events to fetch (default: 10)
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} List of events prioritized by following and popularity
 */
export async function discoverEvents(options = {}) {
  const { limit = 10, offset = 0 } = options;
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(
    `/events/discover?limit=${limit}&offset=${offset}`,
    15000,
    token
  );
}

/**
 * Search events by query
 * @param {string} query - Search query
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of events to fetch (default: 20)
 * @param {number} options.offset - Offset for pagination
 * @param {boolean} options.upcomingOnly - Only show upcoming events (default: true)
 * @returns {Promise<Object>} List of matching events
 */
export async function searchEvents(query, options = {}) {
  const { limit = 20, offset = 0, upcomingOnly = true } = options;
  const token = await (await import("./auth")).getAuthToken();
  const upcoming = upcomingOnly ? "true" : "false";
  return apiGet(
    `/events/search?q=${encodeURIComponent(
      query
    )}&limit=${limit}&offset=${offset}&upcoming_only=${upcoming}`,
    15000,
    token
  );
}

/**
 * Update an existing event
 * @param {string|number} eventId - Event ID
 * @param {Object} eventData - Updated event details
 * @returns {Promise<Object>} Updated event with notification info
 */
export async function updateEvent(eventId, eventData) {
  const { apiPatch } = await import("./client");
  const token = await (await import("./auth")).getAuthToken();
  return apiPatch(`/events/${eventId}`, eventData, 15000, token);
}

/**
 * Delete an event permanently (community owner only)
 * Note: Cannot delete upcoming events with registered attendees
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} Delete confirmation
 */
export async function deleteEvent(eventId) {
  const { apiDelete } = await import("./client");
  const token = await (await import("./auth")).getAuthToken();
  return apiDelete(`/events/${eventId}`, null, 15000, token);
}

/**
 * Cancel an event (soft delete - community owner only)
 * Attendees will be notified via push and in-app notifications
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} Cancelled event details with notification count
 */
export async function cancelEvent(eventId) {
  const { apiPatch } = await import("./client");
  const token = await (await import("./auth")).getAuthToken();
  return apiPatch(`/events/${eventId}/cancel`, {}, 15000, token);
}

/**
 * Toggle event interest (bookmark) status
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} { success: boolean, is_interested: boolean }
 */
export async function toggleEventInterest(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(`/events/${eventId}/interest`, {}, 15000, token);
}

/**
 * Get events user has marked as interested
 * @returns {Promise<Object>} List of interested events
 */
export async function getInterestedEvents() {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet("/events/interested", 15000, token);
}
