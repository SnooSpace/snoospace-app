/**
 * providers/google.js
 *
 * Google Places API (New) provider.
 * Uses REST endpoints — no native SDK — fully Expo-compatible.
 *
 * Auth: X-Goog-Api-Key header + X-Goog-FieldMask for billing tier control.
 * Always fails gracefully (never throws) and returns [] or null on error.
 */

import { supabase } from '../../supabaseClient';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const GEOCODING_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map a Google Places API (New) place object → UnifiedPlaceResult */
function mapPlace(place) {
  return {
    placeId: place.id ?? place.name ?? '',
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    shortAddress: place.shortFormattedAddress ?? place.formattedAddress ?? '',
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    category: place.types?.[0] ?? null,
    provider: 'google',
  };
}

/** Check venue_cache first; upsert on miss */
async function checkVenueCache(providerId) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('venue_cache')
      .select('*')
      .eq('provider', 'google')
      .eq('provider_place_id', providerId)
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
        provider: 'google',
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
        provider: 'google',
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
      console.warn(`[GoogleProvider] ${endpointName} failed: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[GoogleProvider] ${endpointName} error:`, err?.message);
    return null;
  }
}

// ─── Provider methods ────────────────────────────────────────────────────────

/**
 * searchPlaces — Text Search (New)
 * POST /places:searchText
 *
 * @param {string} query
 * @param {{ lat?: number, lng?: number, radius?: number }} options
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult[]>}
 */
async function searchPlaces(query, { lat = 12.9716, lng = 77.5946, radius = 5000 } = {}) {
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    maxResultCount: 10,
    languageCode: 'en',
  };

  const data = await safeFetch(
    `${PLACES_BASE}/places:searchText`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.shortFormattedAddress',
      },
      body: JSON.stringify(body),
    },
    'searchText',
  );

  if (!data?.places) return [];
  return data.places.map(mapPlace);
}

/**
 * nearbySearch — Nearby Search (New)
 * POST /places:searchNearby
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ radius?: number, category?: string }} options
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult[]>}
 */
async function nearbySearch(lat, lng, { radius = 2000, category } = {}) {
  // Map SnooSpace category names to Google place types
  const CATEGORY_TYPE_MAP = {
    restaurant: 'restaurant',
    cafe: 'cafe',
    bar: 'bar',
    gym: 'gym',
    park: 'park',
    movie: 'movie_theater',
    venue: 'event_venue',
    sports: 'sports_complex',
    hotel: 'lodging',
    mall: 'shopping_mall',
  };

  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    maxResultCount: 20,
    rankPreference: 'DISTANCE',
    ...(category && CATEGORY_TYPE_MAP[category]
      ? { includedTypes: [CATEGORY_TYPE_MAP[category]] }
      : {}),
  };

  const data = await safeFetch(
    `${PLACES_BASE}/places:searchNearby`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.shortFormattedAddress',
      },
      body: JSON.stringify(body),
    },
    'searchNearby',
  );

  if (!data?.places) return [];
  return data.places.map(mapPlace);
}

/**
 * getPlaceDetails — Place Details (New)
 * GET /places/{placeId}
 *
 * Checks Supabase venue_cache first; upserts on live API hit.
 *
 * @param {string} placeId
 * @returns {Promise<import('../LocationService').UnifiedPlaceResult|null>}
 */
async function getPlaceDetails(placeId) {
  // Check cache first
  const cached = await checkVenueCache(placeId);
  if (cached) return cached;

  const data = await safeFetch(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,types,shortFormattedAddress,internationalPhoneNumber,websiteUri,regularOpeningHours',
      },
    },
    'getPlaceDetails',
  );

  if (!data) return null;

  const result = mapPlace(data);
  await upsertVenueCache(result, data);
  return result;
}

/**
 * reverseGeocode — Geocoding API
 * GET /geocode/json?latlng=...
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<import('../LocationService').ReverseGeocodeResult>}
 */
async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: API_KEY,
    language: 'en',
    result_type: 'locality|sublocality',
  });

  const data = await safeFetch(
    `${GEOCODING_BASE}?${params.toString()}`,
    { method: 'GET' },
    'reverseGeocode',
  );

  const fallback = {
    address: '',
    shortAddress: '',
    city: '',
    state: '',
    pincode: '',
  };

  if (!data?.results?.length) return fallback;

  const result = data.results[0];
  const components = result.address_components || [];

  const get = (type) =>
    components.find((c) => c.types.includes(type))?.long_name ?? '';

  const sublocality =
    get('sublocality_level_1') || get('sublocality') || '';
  const city =
    get('locality') || get('administrative_area_level_2') || '';
  const state = get('administrative_area_level_1') || '';
  const pincode = get('postal_code') || '';

  const shortAddress = [sublocality, city].filter(Boolean).join(', ');

  return {
    address: result.formatted_address || '',
    shortAddress: shortAddress || city || result.formatted_address || '',
    city,
    state,
    pincode,
  };
}

// ─── Exported provider object ────────────────────────────────────────────────

const GoogleProvider = {
  searchPlaces,
  nearbySearch,
  getPlaceDetails,
  reverseGeocode,
};

export default GoogleProvider;
