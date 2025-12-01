import { apiPost, apiGet } from './client';

/**
 * Create a new event
 * @param {Object} eventData - Event details
 * @returns {Promise<Object>} Created event
 */
export async function createEvent(eventData) {
  const token = await (await import('./auth')).getAuthToken();
  return apiPost('/events', eventData, 15000, token);
}

/**
 * Get events created by the community (for Dashboard)
 * @returns {Promise<Object>} List of community events
 */
export async function getCommunityEvents() {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet('/events/community', 15000, token);
}

/**
 * Get events user is registered for
 * @returns {Promise<Object>} List of events
 */
export async function getMyEvents() {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet('/events/my-events', 15000, token);
}

/**
 * Get event details
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} Event details
 */
export async function getEventDetails(eventId) {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet(`/events/${eventId}`, 15000, token);
}

/**
 * Get attendees for an event
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} List of attendees
 */
export async function getEventAttendees(eventId) {
  const token = await (await import('./auth')).getAuthToken();
  return apiGet(`/events/${eventId}/attendees`, 15000, token);
}
