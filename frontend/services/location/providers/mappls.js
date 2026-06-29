/**
 * providers/mappls.js
 *
 * Mappls (MapmyIndia) provider.
 * India-optimised geocoding & place search via OAuth2 client_credentials.
 *
 * Token is cached in module scope for 24h (refreshed 5 min early).
 * Always fails gracefully (never throws) and returns [] or null on error.
 */

import { supabase } from '../../supabaseClient';

const OUTPOST_BASE = 'https://outpost.mappls.com/api/security/oauth/token';
const ATLAS_BASE = 'https://atlas.mappls.com/api/places';

// ─── OAuth2 Token manager ────────────────────────────────────────────────────

let _token = null;
let _tokenExpiry = null;

/**
 * Get a valid OAuth2 bearer token.
 * Fetches a new one from Mappls outpost if the cached one is expired.
 *
 * @returns {Promise<string>} access_token
 */
async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  try {
    const res = await fetch(OUTPOST_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.EXPO_PUBLIC_MAPPLS_CLIENT_ID ?? '',
        client_secret: process.env.EXPO_PUBLIC_MAPPLS_CLIENT_SECRET ?? '',
      }).toString(),
    });

    if (!res.ok) {
      console.warn('[MapplsProvider] Token fetch failed: HTTP', res.status);
      return null;
    }

    const data = await res.json();
    _token = data.access_token ?? null;
    // Refresh 5 minutes early to avoid mid-request expiry
    _tokenExpiry = Date.now() + ((data.expires_in ?? 86400) - 300) * 1000;
    return _token;
  } catch (err) {
    console.warn('[MapplsProvider] Token fetch error:', err?.message);
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Mappls suggestedLocation item → UnifiedPlaceResult
 * @param {Object} loc
 * @returns {import('../LocationService').UnifiedPlaceResult}
 */
function mapSuggestedLocation(loc) {
  return {
    placeId: loc.eLoc ?? '',
    name: loc.placeName ?? loc.placeAddress ?? '',
    address: loc.placeAddress ?? '',
    shortAddress: [loc.type, loc.city].filter(Boolean).join(', ') || loc.placeAddress || '',
    lat: parseFloat(loc.latitude) || 0,
    lng: parseFloat(loc.longitude) || 0,
    category: loc.type ? loc.type.toLowerCase() : null,
    provider: 'mappls',
  };
}

/**
 * Map a Mappls geocode result item → UnifiedPlaceResult
 * @param {Object} loc
 * @returns {import('../LocationService').UnifiedPlaceResult}
 */
function mapGeocodeResult(loc) {
  return {
    placeId: loc.eLoc ?? '',
    name: loc.placeName ?? loc.placeAddress ?? '',
    address: loc.placeAddress ?? loc.formattedAddress ?? '',
    shortAddress:
      [loc.addressTokens?.locality, loc.addressTokens?.city]
        .filter(Boolean)
        .join(', ') || loc.placeAddress || '',
    lat: parseFloat(loc.latitude) || 0,
    lng: parseFloat(loc.longitude) || 0,
    category: loc.type ? loc.type.toLowerCase() : null,
    provider: 'mappls',
  };
}

/** Check venue_cache first; upsert on miss */
async function checkVenueCache(eLoc) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('venue_cache')
      .select('*')
      .eq('provider', 'mappls')
      .eq('provider_place_id', eLoc)
      .single();
    if (data) {
      return {
        placeId: data.provider_place_id,
        name: data.name,
        address: data.address,
        shortAddress: data.short_address,
        lat: data.lat,
        lng: data.lng,
        category: data.category,
        provider: 'mappls',
      };
    }
  } catch {
    // cache miss or supabase unavailable — proceed to live API
  }
  return null;
}

async function upsertVenueCache(result, rawData) {
  if (!supabase) return;
  try {
    await supabase.from('venue_cache').upsert(
      {
        provider: 'mappls',
        provider_place_id: result.placeId,
        name: result.name,
        address: result.address,
        short_address: result.shortAddress,
        lat: result.lat,
        lng: result.lng,
        category: result.category,
        raw_data: rawData,
      },
      { onConflict: 'provider,provider_place_id' },
    );
  } catch {
    // best-effort; ignore errors
  }
}

/** Safe fetch wrapper — returns parsed JSON or null */
async function safeFetch(url, options, endpointName) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`[MapplsProvider] ${endpointName} failed: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[MapplsProvider] ${endpointName} error:`, err?.message);
    return null;
  }
}

// ─── Provider methods ────────────────────────────────────────────────────────

/**
 * searchPlaces — Mappls Autosuggest API
 *
 * @param {string} query
 * @param {{ lat?: number, lng?: number, radius?: number }} options
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult[]>}
 */
async function searchPlaces(query, { lat = 12.9716, lng = 77.5946, radius = 5000 } = {}) {
  const token = await getToken();
  if (!token) return [];

  const params = new URLSearchParams({
    query,
    location: `${lat},${lng}`,
    radius: String(radius),
    region: 'IND',
    maxResults: '10',
  });

  const data = await safeFetch(
    `${ATLAS_BASE}/search/json?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    'searchPlaces',
  );

  const locations = data?.suggestedLocations ?? data?.results?.suggestedLocations ?? [];
  return locations.map(mapSuggestedLocation);
}

/**
 * nearbySearch — Mappls Nearby API
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ radius?: number, category?: string }} options
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult[]>}
 */
async function nearbySearch(lat, lng, { radius = 2000, category } = {}) {
  const token = await getToken();
  if (!token) return [];

  const keyword = category || 'all';

  const params = new URLSearchParams({
    keywords: keyword,
    refLocation: `${lat},${lng}`,
    radius: String(radius),
    region: 'IND',
    sortBy: 'distance',
    page: '1',
    size: '20',
  });

  const data = await safeFetch(
    `${ATLAS_BASE}/nearby/json?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    'nearbySearch',
  );

  const locations = data?.suggestedLocations ?? [];
  return locations.map(mapSuggestedLocation);
}

/**
 * getPlaceDetails — Mappls eLoc / Geocode API
 * Checks Supabase venue_cache first; upserts on live API hit.
 *
 * @param {string} eLoc  - 6-character Mappls eLoc code
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult|null>}
 */
async function getPlaceDetails(eLoc) {
  // Check cache first
  const cached = await checkVenueCache(eLoc);
  if (cached) return cached;

  const token = await getToken();
  if (!token) return null;

  const params = new URLSearchParams({ eLoc });

  const data = await safeFetch(
    `${ATLAS_BASE}/geocode?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    'getPlaceDetails',
  );

  const results = data?.results;
  if (!results) return null;

  // results may be an array or single object
  const loc = Array.isArray(results) ? results[0] : results;
  if (!loc) return null;

  const result = mapGeocodeResult(loc);
  await upsertVenueCache(result, data);
  return result;
}

/**
 * reverseGeocode — Mappls Reverse Geocoding API
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<import('../LocationService').ReverseGeocodeResult>}
 */
async function reverseGeocode(lat, lng) {
  const token = await getToken();

  const fallback = {
    address: '',
    shortAddress: '',
    city: '',
    state: '',
    pincode: '',
  };

  if (!token) return fallback;

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  const data = await safeFetch(
    `${ATLAS_BASE}/revegeocoding/json?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    'reverseGeocode',
  );

  const results = data?.results;
  if (!results) return fallback;

  const loc = Array.isArray(results) ? results[0] : results;
  if (!loc) return fallback;

  const tokens = loc.addressTokens ?? {};
  const locality = tokens.locality ?? tokens.subLocality ?? '';
  const city = tokens.city ?? tokens.district ?? '';
  const state = tokens.state ?? '';
  const pincode = tokens.pincode ?? '';

  const shortAddress = [locality, city].filter(Boolean).join(', ');

  return {
    address: loc.formattedAddress ?? '',
    shortAddress: shortAddress || city || loc.formattedAddress || '',
    city,
    state,
    pincode,
  };
}

// ─── Exported provider object ────────────────────────────────────────────────

const MapplsProvider = {
  searchPlaces,
  nearbySearch,
  getPlaceDetails,
  reverseGeocode,
};

export default MapplsProvider;
