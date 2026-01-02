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
 * Get attendees for an event (for matching feature)
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} List of attendees
 */
export async function getEventAttendees(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/events/${eventId}/attendees`, 15000, token);
}

/**
 * Get event registrations with ticket details (for community owners)
 * Returns attendees with gender, age, username, and tickets purchased
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} { success: boolean, eventTitle: string, attendees: Array }
 */
export async function getEventRegistrations(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/events/${eventId}/registrations`, 15000, token);
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

/**
 * Register for an event (book tickets)
 * @param {string|number} eventId - Event ID
 * @param {Object} bookingData - Booking details
 * @param {Array} bookingData.tickets - [{ticketTypeId, quantity, unitPrice, ticketName}]
 * @param {string} bookingData.promoCode - Applied promo code (optional)
 * @param {number} bookingData.totalAmount - Total amount
 * @param {number} bookingData.discountAmount - Discount applied
 * @returns {Promise<Object>} { success: boolean, registrationId: number, qrCodeHash: string }
 */
export async function registerForEvent(eventId, bookingData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(`/events/${eventId}/register`, bookingData, 15000, token);
}

/**
 * Cancel event registration
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} { success: boolean, refundAmount: number, message: string }
 */
export async function cancelEventRegistration(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(`/events/${eventId}/cancel-registration`, {}, 15000, token);
}

/**
 * Get user's ticket for an event (for QR code display)
 * @param {string|number} eventId - Event ID
 * @returns {Promise<Object>} { success: boolean, ticket: Object }
 */
export async function getMyTicket(eventId) {
  const token = await (await import("./auth")).getAuthToken();
  return apiGet(`/events/${eventId}/my-ticket`, 15000, token);
}

/**
 * Verify ticket QR code (for community scanning)
 * @param {string|number} eventId - Event ID
 * @param {string} qrData - The QR code data string
 * @returns {Promise<Object>} { success: boolean, verified: boolean, attendee: Object }
 */
export async function verifyTicket(eventId, qrData) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(`/events/${eventId}/verify-ticket`, { qrData }, 15000, token);
}

/**
 * Request an invite for an invite-only event
 * @param {string|number} eventId - Event ID
 * @param {string} message - Optional message to the organizer
 * @returns {Promise<Object>} { success: boolean, request: Object }
 */
export async function requestEventInvite(eventId, message = null) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(
    `/events/${eventId}/invite-requests`,
    { message },
    15000,
    token
  );
}

/**
 * Confirm RSVP for a gifted free ticket
 * @param {string|number} giftId - Gift ID
 * @param {string} response - 'going' or 'not_going'
 * @returns {Promise<Object>} { success: boolean, status: string, message: string }
 */
export async function confirmGiftRSVP(giftId, response) {
  const token = await (await import("./auth")).getAuthToken();
  return apiPost(`/gifts/${giftId}/confirm`, { response }, 15000, token);
}
