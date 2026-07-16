import { apiGet, apiPost } from './client';

// ─── Event reviews ────────────────────────────────────────────────────────────

/**
 * Fetch dimension questions for an event's category group.
 * @param {number|string} eventId
 * @param {string} token
 * @returns {{ dimensions: Array }}
 */
export async function getEventDimensions(eventId, token) {
  return apiGet(`/api/reviews/events/${eventId}/dimensions`, 15000, token);
}

/**
 * Submit an event review.
 * @param {number|string} eventId
 * @param {{ worth_it_rating, tags, dimension_ratings, comment }} body
 * @param {string} token
 */
export async function submitEventReview(eventId, body, token) {
  return apiPost(`/api/reviews/events/${eventId}`, body, 15000, token);
}

// ─── Open plan reviews ────────────────────────────────────────────────────────

/**
 * Submit an open plan review with attendee ratings.
 * @param {number|string} planId
 * @param {{ would_join_again, interacted_user_ids, attendee_ratings }} body
 * @param {string} token
 */
export async function submitOpenPlanReview(planId, body, token) {
  return apiPost(`/api/reviews/open-plans/${planId}`, body, 15000, token);
}

// ─── Reputation ───────────────────────────────────────────────────────────────

/**
 * Get reputation summary for a user (cold-start safe).
 * @param {number|string} userId
 * @param {string} token
 * @returns {{ status: 'building'|'active', percentage?: number, sample_size_bucket?: string }}
 */
export async function getUserReputation(userId, token) {
  return apiGet(`/api/users/${userId}/reputation`, 10000, token);
}

// ─── Organizer summary ────────────────────────────────────────────────────────

/**
 * Get aggregated review summary for organizers.
 * @param {number|string} eventId
 * @param {string} token
 */
export async function getOrganizerReviewSummary(eventId, token) {
  return apiGet(`/api/organizers/events/${eventId}/review-summary`, 15000, token);
}
