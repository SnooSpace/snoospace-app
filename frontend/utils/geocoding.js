// Nominatim API integration for geocoding
// Free service - requires User-Agent header and rate limiting

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SnooSpace/1.0';

/**
 * Search for addresses using forward geocoding
 * @param {string} query - Search query (e.g., "123 Main St, San Francisco")
 * @returns {Promise<Array>} Array of location results
 */
export async function searchAddress(query) {
  try {
    if (!query || query.trim().length < 3) {
      return [];
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodedQuery}&limit=5&countrycodes=us&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT, // REQUIRED by Nominatim
      },
    });

    if (!response.ok) {
      console.error('Nominatim search error:', response.status, response.statusText);
      return [];
    }

    const results = await response.json();
    
    return results.map(result => ({
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      city: result.address?.city || result.address?.town || result.address?.village || '',
      state: result.address?.state || '',
      country: result.address?.country || '',
    }));
  } catch (error) {
    console.error('Search address error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to get address
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<string>} Full address string
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return 'Address not found';
    }

    const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.error('Nominatim reverse geocode error:', response.status, response.statusText);
      return 'Address not found';
    }

    const result = await response.json();
    
    if (result && result.display_name) {
      return result.display_name;
    }
    
    return 'Address not found';
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return 'Address not found';
  }
}

/**
 * Reverse geocode coordinates to get structured address object
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object>} Address object with address, city, state, country
 */
export async function reverseGeocodeStructured(latitude, longitude) {
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        address: '',
        city: '',
        state: '',
        country: '',
        lat: latitude,
        lng: longitude,
      };
    }

    const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      console.error('Nominatim reverse geocode error:', response.status, response.statusText);
      return {
        address: '',
        city: '',
        state: '',
        country: '',
        lat: latitude,
        lng: longitude,
      };
    }

    const result = await response.json();
    const addr = result.address || {};
    
    return {
      address: result.display_name || '',
      city: addr.city || addr.town || addr.village || '',
      state: addr.state || '',
      country: addr.country || '',
      lat: latitude,
      lng: longitude,
    };
  } catch (error) {
    console.error('Reverse geocode structured error:', error);
    return {
      address: '',
      city: '',
      state: '',
      country: '',
      lat: latitude,
      lng: longitude,
    };
  }
}

