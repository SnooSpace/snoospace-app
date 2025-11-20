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

export async function searchSponsors(query, { limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('query', query || '');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/sponsors/search?${params.toString()}`, 15000, token);
}

export async function searchVenues(query, { limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('query', query || '');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/venues/search?${params.toString()}`, 15000, token);
}

export async function globalSearch(query, { limit = 20, offset = 0 } = {}) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('query', query || '');
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/search/global?${params.toString()}`, 15000, token);
}


