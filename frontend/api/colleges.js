import { apiGet } from "./client";
import { getAuthToken } from "./auth";

/**
 * Fetch College Hub data: college details, member count, community count,
 * campus list, and affiliated communities.
 */
export async function getCollegeHub(collegeId) {
  const token = await getAuthToken();
  return apiGet(`/colleges/${collegeId}/hub`, 15000, token);
}

/**
 * Paginated list of members linked to this college, with follow status.
 */
export async function getCollegeMembers(collegeId, { limit = 30, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiGet(`/colleges/${collegeId}/members?${params.toString()}`, 15000, token);
}

/**
 * Paginated list of communities linked to this college, with follow status.
 */
export async function getCollegeCommunities(collegeId, { limit = 30, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiGet(`/colleges/${collegeId}/communities?${params.toString()}`, 15000, token);
}
