import { apiGet, apiPost, apiDelete, apiPatch } from './client';
import { getAuthToken } from './auth';

export async function getCommunityProfile() {
  const token = await getAuthToken();
  return apiGet('/communities/profile', 15000, token);
}

export async function updateCommunityProfile(updates, token) {
  if (!token) token = await getAuthToken();
  return apiPatch('/communities/profile', updates, 15000, token);
}

export async function changeUsername(username, token) {
  if (!token) token = await getAuthToken();
  return apiPost('/communities/username', { username }, 15000, token);
}

export async function startEmailChange(newEmail) {
  const token = await getAuthToken();
  return apiPost('/communities/email/change/start', { email: newEmail }, 15000, token);
}

export async function verifyEmailChange(newEmail, otp) {
  const token = await getAuthToken();
  return apiPost('/communities/email/change/verify', { email: newEmail, otp }, 15000, token);
}

export async function updateLocation(location) {
  const token = await getAuthToken();
  // location: { lat, lng, address?, city?, state?, country? }
  return apiPost('/communities/location', { location }, 12000, token);
}

export async function searchCommunities(query, { limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('query', query);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/communities/search?${params.toString()}`, 15000, token);
}

export async function getPublicCommunity(communityId) {
  const token = await getAuthToken();
  return apiGet(`/communities/${communityId}/public`, 15000, token);
}

export async function getCommunityPosts(communityId, { limit = 21, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/posts/user/${communityId}/community?${params.toString()}`, 15000, token);
}

export async function followCommunity(communityId) {
  const token = await getAuthToken();
  return apiPost('/follow', { followingId: communityId, followingType: 'community' }, 15000, token);
}

export async function unfollowCommunity(communityId) {
  const token = await getAuthToken();
  return apiDelete('/follow', { followingId: communityId, followingType: 'community' }, 15000, token);
}

export async function getCommunityFollowers(communityId, { limit = 30, offset = 0 } = {}) {
  const token = await getAuthToken();
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  return apiGet(`/followers/${communityId}/community?${params.toString()}`, 15000, token);
}

export async function getCommunityFollowing(communityId, { limit = 30, offset = 0 } = {}) {
  const token = await getAuthToken();
  const page = Math.floor(offset / limit) + 1;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  return apiGet(`/following/${communityId}/member?${params.toString()}`, 15000, token);
}

export async function getFollowStatusForCommunity(followingCommunityId) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('followingId', String(followingCommunityId));
  params.set('followingType', 'community');
  return apiGet(`/follow/status?${params.toString()}`, 15000, token);
}

export async function updateCommunityHeads(heads) {
  const token = await getAuthToken();
  return apiPatch('/communities/heads', { heads }, 15000, token);
}

