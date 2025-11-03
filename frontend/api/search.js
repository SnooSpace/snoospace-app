import { apiGet } from './client';
import { getAuthToken } from './auth';

export async function searchMembers(query, { limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('query', query || '');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/members/search?${params.toString()}`, 15000, token);
}


