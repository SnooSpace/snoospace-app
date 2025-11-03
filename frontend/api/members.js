import { apiGet, apiPost, apiDelete } from './client';
import { getAuthToken } from './auth';

export async function getPublicMemberProfile(memberId) {
  const token = await getAuthToken();
  return apiGet(`/members/${memberId}/public`, 15000, token);
}

export async function getMemberPosts(memberId, { limit = 21, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  // Reuse existing endpoint shape if available, otherwise expect /posts/user/:userId/:userType
  return apiGet(`/posts/user/${memberId}/member?${params.toString()}`, 15000, token);
}

export async function followMember(memberId) {
  const token = await getAuthToken();
  // Backend expects camelCase keys
  return apiPost('/follow', { followingId: memberId, followingType: 'member' }, 15000, token);
}

export async function unfollowMember(memberId) {
  const token = await getAuthToken();
  return apiDelete('/follow', { followingId: memberId, followingType: 'member' }, 15000, token);
}


