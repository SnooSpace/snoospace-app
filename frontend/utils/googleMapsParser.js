import { reverseGeocodeStructured } from './geocoding';

/**
 * Extracts coordinates (lat, lng) from various Google Maps URL formats
 * @param {string} url - Google Maps URL
 * @returns {Object|null} - { lat, lng } or null if parsing fails
 */
export const extractCoordinatesFromGoogleMapsUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Clean up the URL
  const cleanUrl = url.trim();

  // Pattern 1: @lat,lng format (most common in place URLs)
  // Example: https://www.google.com/maps/place/Name/@18.5204,73.8567,17z
  const atPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const atMatch = cleanUrl.match(atPattern);
  if (atMatch) {
    return {
      lat: parseFloat(atMatch[1]),
      lng: parseFloat(atMatch[2]),
    };
  }

  // Pattern 2: q= query parameter
  // Example: https://maps.google.com/?q=18.5204,73.8567
  const qPattern = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const qMatch = cleanUrl.match(qPattern);
  if (qMatch) {
    return {
      lat: parseFloat(qMatch[1]),
      lng: parseFloat(qMatch[2]),
    };
  }

  // Pattern 3: loc: prefix
  // Example: https://maps.google.com/maps?q=loc:18.5204+73.8567
  const locPattern = /q=loc:(-?\d+\.\d+)[+\s](-?\d+\.\d+)/;
  const locMatch = cleanUrl.match(locPattern);
  if (locMatch) {
    return {
      lat: parseFloat(locMatch[1]),
      lng: parseFloat(locMatch[2]),
    };
  }

  // Pattern 4: /dir/ directions format
  // Example: https://www.google.com/maps/dir//18.5204,73.8567
  const dirPattern = /\/dir\/[^/]*\/(-?\d+\.\d+),(-?\d+\.\d+)/;
  const dirMatch = cleanUrl.match(dirPattern);
  if (dirMatch) {
    return {
      lat: parseFloat(dirMatch[1]),
      lng: parseFloat(dirMatch[2]),
    };
  }

  // Pattern 5: search with query parameter
  // Example: https://www.google.com/maps/search/?api=1&query=18.5204,73.8567
  const searchPattern = /query=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const searchMatch = cleanUrl.match(searchPattern);
  if (searchMatch) {
    return {
      lat: parseFloat(searchMatch[1]),
      lng: parseFloat(searchMatch[2]),
    };
  }

  return null;
};

/**
 * Validates latitude and longitude values
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} - Whether coordinates are valid
 */
export const validateCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Parses a Google Maps URL and returns a full location object with address
 * @param {string} url - Google Maps URL
 * @returns {Promise<Object|null>} - Location object { lat, lng, address, city, state, country } or null
 */
export const parseGoogleMapsLink = async (url) => {
  try {
    // Extract coordinates
    const coords = extractCoordinatesFromGoogleMapsUrl(url);
    
    if (!coords) {
      return null;
    }

    // Validate coordinates
    if (!validateCoordinates(coords.lat, coords.lng)) {
      console.error('Invalid coordinates:', coords);
      return null;
    }

    // Reverse geocode to get address details
    const addressData = await reverseGeocodeStructured(coords.lat, coords.lng);
    
    return {
      lat: coords.lat,
      lng: coords.lng,
      ...addressData,
    };
  } catch (error) {
    console.error('Error parsing Google Maps link:', error);
    return null;
  }
};
