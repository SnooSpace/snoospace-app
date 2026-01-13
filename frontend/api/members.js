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
  // Backend expects camelCase keys
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
  { limit = 30, offset = 0 } = {}
) {
  const token = await getAuthToken();
  // Backend expects page + limit
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  return apiGet(
    `/followers/${memberId}/member?${params.toString()}`,
    15000,
    token
  );
}

export async function getMemberFollowing(
  memberId,
  { limit = 30, offset = 0 } = {}
) {
  const token = await getAuthToken();
  // Backend expects page + limit
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
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
