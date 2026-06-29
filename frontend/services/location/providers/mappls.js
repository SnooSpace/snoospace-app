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

/**
 * Mappls internal keyword codes → human-readable category labels.
 * The autosuggest `keywords` array carries these codes instead of plain text.
 */
const MAPPLS_KEYWORD_MAP = {
  CLGANM: 'college',
  CLGMDC: 'medical college',
  RSTPUB: 'restaurant',
  HPTPVT: 'hospital',
  HOTPVT: 'hotel',
  SHPMLS: 'mall',
  GYMFIT: 'gym',
  PRKATM: 'park',
  STAMON: 'metro station',
  BUSPUB: 'bus stop',
  OFCPVT: 'office',
  BANPVT: 'bank',
  APDPVT: 'airport',
  RLYSTA: 'railway station',
  PETPVT: 'fuel station',
  MOSSOC: 'mosque',
  TMPSOC: 'temple',
  CHRSOC: 'church',
};

/**
 * Convert a Mappls `keywords` array to one human-readable category string.
 * Returns null if no known mapping exists (avoids showing raw codes in UI).
 */
function mapKeywordToCategory(keywords = []) {
  for (const kw of keywords) {
    if (MAPPLS_KEYWORD_MAP[kw]) return MAPPLS_KEYWORD_MAP[kw];
  }
  // Fall back to lowercased first keyword only if it looks readable (no digits)
  const first = keywords[0] ?? '';
  return /^[A-Z]+$/.test(first) ? null : first.toLowerCase() || null;
}

/**
 * Extract "Locality, City" from a Mappls placeAddress string.
 *
 * Mappls address format is always:
 *   "<street details>, <locality>, <city>, <state>, <pincode>"
 *   e.g. "Post Box No 1908, Bull Temple Road, Basavanagudi, Bengaluru, Karnataka, 560004"
 *
 * So: parts[-4] = locality, parts[-3] = city.
 */
function extractShortAddress(placeAddress) {
  if (!placeAddress) return '';
  const parts = placeAddress.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return placeAddress; // too short to be confident
  const locality = parts[parts.length - 4];
  const city = parts[parts.length - 3];
  if (locality && city) return `${locality}, ${city}`;
  if (city) return city;
  return placeAddress;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Mappls suggestedLocation item → UnifiedPlaceResult
 *
 * @param {Object} loc
 * @returns {import('../LocationService').UnifiedPlaceResult}
 */
function mapSuggestedLocation(loc) {
  const fullAddress = loc.placeAddress ?? '';

  return {
    placeId: loc.eLoc ?? '',
    name: loc.placeName ?? fullAddress,
    address: fullAddress,
    // extractShortAddress gives "Basavanagudi, Bengaluru" from the full address.
    // Falls back to the full address if parsing fails.
    shortAddress: extractShortAddress(fullAddress) || fullAddress,
    // Use null (not 0) when coordinates are missing so the caller can detect
    // the gap and call getPlaceDetails to fetch real coords via placedetail API.
    lat: parseFloat(loc.latitude) || null,
    lng: parseFloat(loc.longitude) || null,
    // Map internal keyword codes to readable labels; skip raw 'POI' type.
    category: mapKeywordToCategory(loc.keywords ?? []) ||
      (loc.type && loc.type.toLowerCase() !== 'poi' ? loc.type.toLowerCase() : null),
    provider: 'mappls',
  };
}

/**
 * Map a Mappls geocode result item → UnifiedPlaceResult
 *
 * The eLoc geocode endpoint can return coordinates in either:
 *   - loc.latitude / loc.longitude  (standard geocode response)
 *   - loc.lat / loc.lng             (some copResults variants)
 *
 * @param {Object} loc
 * @returns {import('../LocationService').UnifiedPlaceResult}
 */
function mapGeocodeResult(loc) {
  const tokens = loc.addressTokens ?? {};
  const locality = tokens.locality ?? tokens.subLocality ?? '';
  const city = tokens.city ?? tokens.district ?? '';
  const shortAddress = [locality, city].filter(Boolean).join(', ') || loc.placeAddress || '';

  const rawType = loc.type ? loc.type.toLowerCase() : null;
  const category = rawType === 'poi' ? null : rawType;

  // Mappls uses different field names depending on the API endpoint
  const lat = parseFloat(loc.latitude ?? loc.lat) || null;
  const lng = parseFloat(loc.longitude ?? loc.lng) || null;

  return {
    placeId: loc.eLoc ?? '',
    name: loc.placeName ?? loc.placeAddress ?? '',
    address: loc.placeAddress ?? loc.formattedAddress ?? '',
    shortAddress,
    lat,
    lng,
    category,
    provider: 'mappls',
  };
}

/** Check venue_cache first; upsert on miss.
 * IMPORTANT: Only return a cached entry if it has valid coordinates.
 * Entries saved during broken previous API calls may have lat/lng = null.
 * Returning those would permanently mask the real coordinates.
 */
async function checkVenueCache(eLoc) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('venue_cache')
      .select('*')
      .eq('provider', 'mappls')
      .eq('provider_place_id', eLoc)
      .single();
    // Reject cache hits with null/zero coordinates — they are stale from
    // a previous broken API call and would silently hide the real coords.
    if (data && data.lat && data.lng) {
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
  // Never cache entries with missing coordinates — they would poison the cache
  // and all subsequent calls would return broken data indefinitely.
  if (!result.lat || !result.lng) {
    console.warn('[Mappls] upsertVenueCache: skipping write for', result.placeId, '— no coordinates');
    return;
  }
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
 * Geocode a place name + address via Google Geocoding API.
 *
 * Used as fallback when Mappls placedetail returns 404 (free-tier plan
 * restriction — confirmed) and Mappls /geocode returns no lat/lng (only
 * address normalization, also confirmed).
 *
 * We already have EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for the map renderer,
 * so there is no additional cost or key required.
 *
 * @param {string} placeName  - e.g. "BMS Engineering College"
 * @param {string} address    - full placeAddress from autosuggest
 * @param {string} eLoc       - original eLoc to keep as placeId
 */
async function _geocodeViaGoogle(placeName, address, eLoc) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('[Mappls] _geocodeViaGoogle: no Google API key');
    return null;
  }

  // Prefer "Place Name, Address" — gives Google the best chance of hitting
  // the POI directly rather than just the street.
  const query = placeName ? `${placeName}, ${address}` : address;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  console.log('[Mappls] _geocodeViaGoogle query:', query);

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('[Mappls] _geocodeViaGoogle status:', data.status);

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('[Mappls] _geocodeViaGoogle failed:', data.status, data.error_message ?? '');
      return null;
    }

    const g = data.results[0];
    const lat = g.geometry?.location?.lat;
    const lng = g.geometry?.location?.lng;

    if (!lat || !lng) {
      console.warn('[Mappls] _geocodeViaGoogle: geometry missing in result');
      return null;
    }

    const result = {
      placeId: eLoc,
      name: placeName || g.formatted_address,
      address: g.formatted_address || address,
      shortAddress: extractShortAddress(address) || g.formatted_address,
      lat,
      lng,
      category: null,
      provider: 'mappls',
    };

    console.log('[Mappls] _geocodeViaGoogle resolved:', lat, lng, result.name);
    // Cache the result so future taps skip all API calls
    await upsertVenueCache(result, data);
    return result;
  } catch (e) {
    console.warn('[Mappls] _geocodeViaGoogle exception:', e.message);
    return null;
  }
}

/**
 * getPlaceDetails — Resolve Mappls eLoc → coordinates.
 *
 * Strategy (in order):
 * 1. Check Supabase venue_cache (skip entries with null coords)
 * 2. Try Mappls place detail (may be plan-restricted)
 * 3. Fall back to Google Geocoding API (always works, uses existing key)
 *
 * @param {string} eLoc          - 6-character Mappls eLoc code
 * @param {string} [placeName]   - place name from autosuggest (improves Google geocode accuracy)
 * @param {string} [fallbackAddress] - full placeAddress from autosuggest
 */
async function getPlaceDetails(eLoc, fallbackAddress = null, placeName = null) {
  // 1. Cache (only valid entries with real coordinates)
  const cached = await checkVenueCache(eLoc);
  if (cached) return cached;

  const token = await getToken();

  // 2. Confirmed correct Mappls Place Details endpoint (verified from official docs).
  // Source: https://about.mappls.com/api/advanced-maps/doc/place-details-api.php
  // GET https://explore.mappls.com/apis/O2O/entity/{eLoc}
  // eLoc goes in the URL path (not a query param).
  // Auth: same OAuth2 Bearer token as all Atlas calls.
  // Free-tier note: coordinates come back as the string "RESTRICTED" on the
  //   free developer plan — this is a plan limitation, not a code bug.
  if (token) {
    const url = `https://explore.mappls.com/apis/O2O/entity/${encodeURIComponent(eLoc)}`;
    console.log('[Mappls] Place Detail GET:', url);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (!res.ok) {
        // Differentiated error logging so future failures are immediately obvious
        if (res.status === 401) {
          console.warn('[Mappls] Place Detail 401 — token invalid or expired.');
        } else if (res.status === 403) {
          console.warn('[Mappls] Place Detail 403 — API not enabled in Mappls Console for this project.');
        } else if (res.status === 404) {
          console.warn('[Mappls] Place Detail 404 — plan may not include this endpoint. Upgrade or contact Mappls support.');
        } else {
          console.warn('[Mappls] Place Detail HTTP', res.status);
        }
      } else {
        const data = await res.json();
        console.log('[Mappls] Place Detail RAW:', JSON.stringify(data, null, 2));

        const rawLat = data.latitude ?? data.lat;
        const rawLng = data.longitude ?? data.lng;

        if (rawLat === 'RESTRICTED' || rawLng === 'RESTRICTED') {
          // Confirmed free-plan behaviour — coordinates are plan-gated.
          // Must upgrade Mappls plan OR use Google Geocoding fallback.
          console.warn('[Mappls] Place Detail: coordinates are RESTRICTED (free-plan limit). Using Google fallback.');
        } else {
          const lat = parseFloat(rawLat ?? null);
          const lng = parseFloat(rawLng ?? null);

          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            console.log('[Mappls] Place Detail SUCCESS:', lat, lng, data.placeName ?? data.name ?? '');
            const name = data.placeName ?? data.name ?? placeName ?? '';
            const address = data.placeAddress ?? data.address ?? fallbackAddress ?? '';
            const result = {
              placeId: eLoc, name, address,
              shortAddress: extractShortAddress(address),
              lat, lng,
              category: mapKeywordToCategory(data.keywords ?? []) || (data.type ?? '').toLowerCase() || null,
              provider: 'mappls',
            };
            await upsertVenueCache(result, data);
            return result;
          }
          // 200, non-RESTRICTED, but still no usable coordinates
          console.warn('[Mappls] Place Detail 200 but no coordinate fields. Keys:', Object.keys(data ?? {}));
        }
      }
    } catch (e) {
      console.warn('[Mappls] Place Detail network error:', e.message);
    }
  }

  // 3. Google Geocoding fallback
  // Mappls /geocode confirmed to NOT return lat/lng on the free tier.
  // Google Geocoding returns geometry.location for all POIs reliably.
  // Requires: Google Cloud Console → APIs & Services → Enable "Geocoding API".
  const address = fallbackAddress ?? null;
  if (address) {
    console.log('[Mappls] Falling back to Google Geocoding for:', placeName ?? eLoc);
    return await _geocodeViaGoogle(placeName ?? '', address, eLoc);
  }

  console.warn('[Mappls] getPlaceDetails: exhausted all options for', eLoc);
  return null;
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
