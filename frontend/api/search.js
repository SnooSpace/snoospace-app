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

/**
 * Search across all account types (members, communities, sponsors, venues)
 * Used for Featured Accounts linking
 */
export async function searchAccounts(query) {
  if (!query || query.length < 2) {
    return { results: [] };
  }

  try {
    const token = await getAuthToken();
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('limit', '10'); // Limit results for dropdown
    
    // Search all account types in parallel
    const [membersRes, communitiesRes, sponsorsRes, venuesRes] = await Promise.all([
      apiGet(`/members/search?${params.toString()}`, 10000, token).catch(() => ({ results: [] })),
      apiGet(`/communities/search?${params.toString()}`, 10000, token).catch(() => ({ results: [] })),
      apiGet(`/sponsors/search?${params.toString()}`, 10000, token).catch(() => ({ results: [] })),
      apiGet(`/venues/search?${params.toString()}`, 10000, token).catch(() => ({ results: [] })),
    ]);

    // Combine results with type information
    // Backend returns { results: [...] } format
    const results = [
      ...(membersRes.results || []).map(m => ({...m,
        type: 'member',
        display_name: m.full_name || m.name,
      })),
      ...(communitiesRes.results || []).map(c => ({ 
        ...c,
        type: 'community',
        display_name: c.name,
      })),
      ...(sponsorsRes.results || []).map(s => ({ 
        ...s,
        type: 'sponsor',
        display_name: s.brand_name || s.name,
      })),
      ...(venuesRes.results || []).map(v => ({ 
        ...v,
        type: 'venue',
        display_name: v.name,
      })),
    ];

    return { results };
  } catch (error) {
    console.error('Error in searchAccounts:', error);
    return { results: [] };
  }
}

