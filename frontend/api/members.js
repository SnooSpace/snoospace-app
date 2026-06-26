import {
  apiGet,
  apiPost,
  apiDelete,
  apiPatch,
  BACKEND_BASE_URL,
} from "./client";
import { getAuthToken } from "./auth";

export async function getPublicMemberProfile(memberId) {
  const token = await getAuthToken();
  return apiGet(`/members/${memberId}/public`, 15000, token);
}

export async function getMemberPosts(
  memberId,
  { limit = 21, offset = 0 } = {}
) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  // Reuse existing endpoint shape if available, otherwise expect /posts/user/:userId/:userType
  return apiGet(
    `/posts/user/${memberId}/member?${params.toString()}`,
    15000,
    token
  );
}

export async function followMember(memberId) {
  const token = await getAuthToken();
  // NOTE: Still used for member→community/sponsor/venue paths via UniversalFollowersScreen.
  // NOT used for member↔member flows — see Circle API below.
  return apiPost(
    "/follow",
    { followingId: memberId, followingType: "member" },
    15000,
    token
  );
}

export async function unfollowMember(memberId) {
  const token = await getAuthToken();
  return apiDelete(
    "/follow",
    { followingId: memberId, followingType: "member" },
    15000,
    token
  );
}

// ─── Circle API ──────────────────────────────────────────────────────────────

/** Send a circle (connection) request to another member. */
export async function sendCircleRequest(receiverId) {
  const token = await getAuthToken();
  return apiPost("/circles/requests", { receiver_id: receiverId }, 15000, token);
}

/**
 * Respond to an incoming circle request.
 * @param {string} requestId  - UUID of the circle_request row
 * @param {'accepted'|'declined'} status
 */
export async function respondToCircleRequest(requestId, status) {
  const token = await getAuthToken();
  return apiPatch(`/circles/requests/${requestId}`, { status }, 15000, token);
}

/** Cancel a circle request you sent. */
export async function cancelCircleRequest(requestId) {
  const token = await getAuthToken();
  return apiDelete(`/circles/requests/${requestId}`, null, 15000, token);
}

/** Get paginated list of pending incoming requests. */
export async function getIncomingCircleRequests({ page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  return apiGet(`/circles/requests/incoming?page=${page}&limit=${limit}`, 15000, token);
}

/** Get paginated list of pending outgoing requests. */
export async function getOutgoingCircleRequests({ page = 1, limit = 20 } = {}) {
  const token = await getAuthToken();
  return apiGet(`/circles/requests/outgoing?page=${page}&limit=${limit}`, 15000, token);
}

/** Get count of pending incoming requests (for badge). */
export async function getIncomingCircleRequestCount() {
  const token = await getAuthToken();
  return apiGet("/circles/requests/count", 10000, token);
}

/** Get paginated list of circle members, with optional search. */
export async function getCircleMembers({ page = 1, limit = 20, search = "" } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (search) params.set("search", search);
  return apiGet(`/circles?${params.toString()}`, 15000, token);
}

/**
 * Get circle relationship status with a specific user.
 * Returns: { status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'in_circle' | 'self', request_id?: string }
 */
export async function getCircleStatus(userId) {
  const token = await getAuthToken();
  return apiGet(`/circles/${userId}/status`, 10000, token);
}

/** Remove a user from your circle (mutual removal). */
export async function removeFromCircle(userId, alsoUnfollow = false) {
  const token = await getAuthToken();
  return apiDelete(`/circles/${userId}`, alsoUnfollow ? { also_unfollow: true } : null, 15000, token);
}

/** Get another member's circle list (public/read-only view). */
export async function getPublicCircleMembers(userId, { page = 1, limit = 20, search = "" } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (search) params.set("search", search);
  return apiGet(`/circles/${userId}/members?${params.toString()}`, 15000, token);
}

// ─── Community→Member Circle API ─────────────────────────────────────────────

/** Community sends a circle invite to a member. */
export async function sendCommunityCircleInvite(memberId) {
  const token = await getAuthToken();
  return apiPost("/community-circles/invites", { member_id: memberId }, 15000, token);
}

/** Community cancels a pending circle invite. */
export async function cancelCommunityCircleInvite(inviteId) {
  const token = await getAuthToken();
  return apiDelete(`/community-circles/invites/${inviteId}`, null, 15000, token);
}

/** Member accepts or declines a community circle invite. */
export async function respondToCommunityCircleInvite(inviteId, status) {
  const token = await getAuthToken();
  return apiPatch(`/community-circles/invites/${inviteId}`, { status }, 15000, token);
}

/** Get community→member circle status (call as community). Returns: none | pending_outgoing | in_circle */
export async function getCommunityCircleStatus(memberId) {
  const token = await getAuthToken();
  return apiGet(`/community-circles/status/${memberId}`, 10000, token);
}

/** Get community→member circle status (call as member). Returns: none | pending_invite | in_circle */
export async function getMemberCommunityCircleStatus(communityId) {
  const token = await getAuthToken();
  return apiGet(`/community-circles/member-status/${communityId}`, 10000, token);
}

/** Community removes a member from its circle. */
export async function removeMemberFromCommunityCircle(memberId, alsoUnfollow = false) {
  const token = await getAuthToken();
  return apiDelete(`/community-circles/${memberId}`, alsoUnfollow ? { also_unfollow: true } : null, 15000, token);
}

/** Get a community's circle list. */
export async function getCommunityCircleMembers(communityId, { page = 1, limit = 20, search = "" } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit });
  if (search) params.set("search", search);
  return apiGet(`/community-circles/${communityId}/members?${params.toString()}`, 15000, token);
}

export async function updateMemberProfile(updates, token) {
  if (!token) token = await getAuthToken();
  return apiPatch("/members/profile", updates, 15000, token);
}

export async function changeUsername(username, token) {
  if (!token) token = await getAuthToken();
  return apiPost("/members/username", { username }, 15000, token);
}

export async function startEmailChange(newEmail) {
  const token = await getAuthToken();
  return apiPost(
    "/members/email/change/start",
    { email: newEmail },
    15000,
    token
  );
}

export async function verifyEmailChange(newEmail, otp) {
  const token = await getAuthToken();
  const result = await apiPost(
    "/members/email/change/verify",
    { email: newEmail, otp },
    15000,
    token
  );

  // Update stored token with new token from verification
  if (result?.accessToken) {
    const { setAuthSession } = await import("./auth");
    await setAuthSession(result.accessToken, newEmail);
  }

  return result;
}

export async function updateLocation(location) {
  const token = await getAuthToken();
  // location: { lat, lng, city?, state?, country? }
  return apiPost("/members/location", { location }, 12000, token);
}

export async function fetchInterests() {
  const token = await getAuthToken();
  const result = await apiGet("/catalog/interests", 15000, token);
  return result?.interests || [];
}

export async function fetchPronouns() {
  // Public endpoint - no auth required (used during signup before user has a token)
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/pronouns`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[fetchPronouns] Error:", data?.error || res.statusText);
      return [];
    }
    return data?.pronouns || [];
  } catch (error) {
    console.error("[fetchPronouns] Network error:", error.message);
    return [];
  }
}

export async function getMemberFollowers(
  memberId,
  { limit = 30, offset = 0, search = "" } = {}
) {
  const token = await getAuthToken();
  // Backend expects page + limit
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  if (search) params.set("search", search);
  return apiGet(
    `/followers/${memberId}/member?${params.toString()}`,
    15000,
    token
  );
}

export async function getMemberFollowing(
  memberId,
  { limit = 30, offset = 0, search = "" } = {}
) {
  const token = await getAuthToken();
  // Backend expects page + limit
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  if (search) params.set("search", search);
  return apiGet(
    `/following/${memberId}/member?${params.toString()}`,
    15000,
    token
  );
}

export async function getFollowStatusForMember(followingMemberId) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set("followingId", String(followingMemberId));
  params.set("followingType", "member");
  return apiGet(`/follow/status?${params.toString()}`, 15000, token);
}

/**
 * Check for incomplete signup (IN_PROGRESS profiles)
 * Returns profile data and last_completed_step if resuming is needed
 */
export async function checkSignupResume(email) {
  const params = new URLSearchParams();
  params.set("email", email);
  return apiGet(`/members/signup/resume?${params.toString()}`, 10000);
}

/**
 * Create a draft signup profile after OTP verification
 * Creates an IN_PROGRESS profile in the database
 */
export async function createSignupDraft(email) {
  return apiPost("/members/signup/draft", { email }, 10000);
}

/**
 * Update draft signup profile with step data
 * @param {number} profileId - The draft profile ID
 * @param {object} data - Profile data to update
 * @param {string} completedStep - The step that was just completed
 */
export async function updateSignupDraft(profileId, data, completedStep) {
  return apiPatch(
    `/members/signup/draft/${profileId}`,
    { ...data, last_completed_step: completedStep },
    10000
  );
}

/**
 * Complete signup and set profile to ACTIVE
 */
export async function completeSignup(profileId) {
  return apiPost(`/members/signup/complete/${profileId}`, {}, 10000);
}

/**
 * Fetch public events attended by a member (for their public profile Events tab)
 * Returns { events: [...] }
 */
export async function getMemberPublicEvents(memberId) {
  const token = await getAuthToken();
  return apiGet(`/members/${memberId}/events`, 15000, token);
}

/**
 * Fetch public open plans hosted/attended by a member (for their public profile Events tab)
 * Returns { hosted: [...], attending: [...] }
 * NOTE: Only location_public (general area) is returned — never the exact location.
 */
export async function getMemberPublicPlans(memberId) {
  const token = await getAuthToken();
  return apiGet(`/members/${memberId}/plans`, 15000, token);
}

// ── Creator Insights API ──────────────────────────────────────────────────────

/**
 * GET /members/me/creator-insights/summary
 * Returns audience score, follow quality breakdown, follower count and delta.
 */
export async function getCreatorAudienceSummary() {
  const token = await getAuthToken();
  return apiGet("/members/me/creator-insights/summary", 15000, token);
}

/**
 * GET /members/me/creator-insights/reach?period=7d|30d|90d
 * Returns content reach stats (views, watch%, top posts) for the given period.
 */
export async function getCreatorReachStats(period = "30d") {
  const token = await getAuthToken();
  return apiGet(`/members/me/creator-insights/reach?period=${period}`, 15000, token);
}

/**
 * GET /members/me/creator-insights/follower-trend
 * Returns 30-day daily follower count array for sparkline rendering.
 */
export async function getCreatorFollowerTrend() {
  const token = await getAuthToken();
  return apiGet("/members/me/creator-insights/follower-trend", 15000, token);
}

// ── Creator Follow API ────────────────────────────────────────────────────────

/**
 * POST /creators/:creatorId/follow
 * Follow a Creator Mode member's content feed.
 */
export async function followCreator(creatorId) {
  const token = await getAuthToken();
  return apiPost(`/creators/${creatorId}/follow`, {}, 8000, token);
}

/**
 * DELETE /creators/:creatorId/follow
 * Permanently unfollow a creator (row deleted, not dormant).
 */
export async function unfollowCreator(creatorId) {
  const token = await getAuthToken();
  return apiDelete(`/creators/${creatorId}/follow`, null, 8000, token);
}

/** DELETE /creators/me/followers/:followerId — creator removes a follower from their list */
export async function removeCreatorFollower(followerId) {
  const token = await getAuthToken();
  return apiDelete(`/creators/me/followers/${followerId}`, null, 8000, token);
}

/**
 * GET /creators/:creatorId/followers?page&limit&type
 * Returns paginated follower list. type: 'all' | 'notable'
 */
export async function getCreatorFollowers(creatorId, { page = 1, limit = 20, type = "all", search = "" } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ page, limit, type });
  if (search) params.set("search", search);
  return apiGet(
    `/creators/${creatorId}/followers?${params.toString()}`,
    10000,
    token
  );
}

/**
 * GET /creators/:creatorId/follow-status
 * Returns { is_following, is_in_circle } for the current viewer.
 */
export async function getCreatorFollowStatus(creatorId) {
  const token = await getAuthToken();
  return apiGet(`/creators/${creatorId}/follow-status`, 8000, token);
}
