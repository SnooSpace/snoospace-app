/**
 * api/collabRequests.js
 *
 * API functions for the Collab Requests feature.
 * Matches the pattern established in api/members.js:
 *   - getAuthToken() for every call
 *   - apiGet / apiPost from client.js
 *   - 15s timeout for mutations, 15s for paginated lists
 */
import { apiGet, apiPost } from './client';
import { getAuthToken } from './auth';

// ─── Collab types (enum mirrors backend) ─────────────────────────────────────
// 'sponsorship' kept here for data-layer completeness but NOT shown in UI chips.
export const COLLAB_TYPES = [
  { value: 'event_partnership', label: 'Event Partnership' },
  { value: 'cross_promo',       label: 'Cross Promo' },
  { value: 'guest_collab',      label: 'Guest Collab' },
  { value: 'custom',            label: 'Custom' },
  // { value: 'sponsorship', label: 'Sponsorship' }, — hidden until Sponsor entity is built
];

export const DECLINE_REASONS = [
  { value: 'not_right_fit',         label: 'Not the right fit' },
  { value: 'different_focus_area',  label: 'Different focus area' },
  { value: 'timing_doesnt_work',    label: "Timing doesn't work" },
];

// ─── List endpoints ───────────────────────────────────────────────────────────

/**
 * GET /collab-requests/received
 * Returns paginated requests where current entity is the receiver.
 * Each request embeds `counterpart` with reputation — no N+1 needed.
 * @param {{ status?: string, board_post_id?: string|number, page?: number, limit?: number }} opts
 */
export async function getReceivedCollabRequests({ status, board_post_id, page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  if (board_post_id) params.set('board_post_id', board_post_id);
  return apiGet(`/collab-requests/received?${params.toString()}`, 15000, token);
}

/**
 * GET /collab-requests/sent
 * Returns paginated requests where current entity is the sender.
 * Each request embeds `counterpart` with reputation.
 * @param {{ status?: string, page?: number, limit?: number }} opts
 */
export async function getSentCollabRequests({ status, page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  return apiGet(`/collab-requests/sent?${params.toString()}`, 15000, token);
}

// ─── Single-request actions ───────────────────────────────────────────────────

/**
 * POST /collab-requests/:id/accept
 * Only the receiver may call this. Returns { request, chat_thread_id }.
 */
export async function acceptCollabRequest(requestId) {
  const token = await getAuthToken();
  return apiPost(`/collab-requests/${requestId}/accept`, {}, 15000, token);
}

/**
 * POST /collab-requests/:id/decline
 * Only the receiver may call this.
 * @param {string} requestId
 * @param {string|null} declineReason  — one of DECLINE_REASONS values, or null
 */
export async function declineCollabRequest(requestId, declineReason = null) {
  const token = await getAuthToken();
  const body = declineReason ? { decline_reason: declineReason } : {};
  return apiPost(`/collab-requests/${requestId}/decline`, body, 15000, token);
}

/**
 * POST /collab-requests/:id/withdraw
 * Only the sender may call this. Only valid while status = 'pending'.
 */
export async function withdrawCollabRequest(requestId) {
  const token = await getAuthToken();
  return apiPost(`/collab-requests/${requestId}/withdraw`, {}, 15000, token);
}

/**
 * POST /collab-requests
 * Create a new collab request as the current entity (sender).
 * @param {{ receiver_id, receiver_type, collab_type, pitch_text, attachment_url? }} body
 */
export async function createCollabRequest(body) {
  const token = await getAuthToken();
  return apiPost('/collab-requests', body, 15000, token);
}

/**
 * GET /collab-entities/:type/:id/reputation
 * For use on profile pages. List screens should use the embedded counterpart.reputation instead.
 */
export async function getCollabReputation(entityType, entityId) {
  const token = await getAuthToken();
  return apiGet(`/collab-entities/${entityType}/${entityId}/reputation`, 10000, token);
}

// ─── Board posts endpoints ───────────────────────────────────────────────────

/**
 * GET /board-posts
 * Returns paginated public board posts.
 * Query params: status?, collab_type?, page?, limit?
 */
export async function getBoardPosts({ status = 'open', collab_type, page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  if (collab_type) params.set('collab_type', collab_type);
  return apiGet(`/board-posts?${params.toString()}`, 15000, token);
}

/**
 * GET /board-posts/mine
 * Returns the caller's own board posts with request counts (pending, accepted, declined).
 */
export async function getMyBoardPosts() {
  const token = await getAuthToken();
  return apiGet('/board-posts/mine', 15000, token);
}

/**
 * POST /board-posts
 * Creates a new board post.
 * Body: { title, description, collab_type, spots_total }
 */
export async function createBoardPost(body) {
  const token = await getAuthToken();
  return apiPost('/board-posts', body, 15000, token);
}

/**
 * POST /board-posts/:id/join
 * Submits a join-request for a board post.
 * Body: { note? }
 */
export async function joinBoardPost(postId, body = {}) {
  const token = await getAuthToken();
  return apiPost(`/board-posts/${postId}/join`, body, 15000, token);
}

/**
 * POST /board-posts/:id/close
 * Closes an open board post and auto-declines remaining pending applicants.
 */
export async function closeBoardPost(postId) {
  const token = await getAuthToken();
  return apiPost(`/board-posts/${postId}/close`, {}, 15000, token);
}

