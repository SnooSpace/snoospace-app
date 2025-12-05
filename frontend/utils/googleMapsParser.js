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

  // Pattern 6: /place/ URL with embedded coordinates in data parameter
  // Example: https://www.google.com/maps/place/Name/data=!3d12.9716!4d77.5946
  // The !3d is latitude and !4d is longitude
  const placeDataPattern = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
  const placeDataMatch = cleanUrl.match(placeDataPattern);
  if (placeDataMatch) {
    return {
      lat: parseFloat(placeDataMatch[1]),
      lng: parseFloat(placeDataMatch[2]),
    };
  }

  // Pattern 7: Plus Code in URL (Google's Open Location Code)
  // Example: XG7Q+XF5 or similar format embedded in place name
  // Plus codes are 8 characters: 4 chars + "+" + 2-3 chars
  // For now, we'll skip Plus Code decoding as it requires additional logic
  // Instead, try to find hex-encoded place ID and note it for potential future use
  
  return null;
};

/**
 * Checks if a URL is a shortened Google Maps link
 * @param {string} url - URL to check
 * @returns {boolean} - True if shortened URL
 */
const isShortenedUrl = (url) => {
  const shortenedPatterns = [
    /goo\.gl/,
    /maps\.app\.goo\.gl/,
    /g\.co\/maps/,
  ];
  
  return shortenedPatterns.some(pattern => pattern.test(url));
};

/**
 * Resolves a shortened URL to its final destination by following redirects
 * @param {string} url - Shortened URL (e.g., goo.gl link)
 * @returns {Promise<string|null>} - Resolved full URL or null if failed
 */
const resolveShortUrl = async (url) => {
  try {
    console.log('🔗 [resolveShortUrl] Resolving:', url);
    
    // Use GET request instead of HEAD for better compatibility in React Native
    // React Native's fetch follows redirects automatically
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html',
      },
    });
    
    clearTimeout(timeoutId);
    
    console.log('✅ [resolveShortUrl] Response status:', response.status);
    console.log('✅ [resolveShortUrl] Final URL:', response.url);
    
    // response.url contains the final URL after all redirects
    return response.url || null;
  } catch (error) {
    console.error('❌ [resolveShortUrl] Error:', error.message);
    return null;
  }
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
    console.log('🗺️ [parseGoogleMapsLink] Starting parse for:', url);
    let urlToParse = url;
    
    // Step 1: Check if URL is shortened (goo.gl, maps.app.goo.gl, etc.)
    if (isShortenedUrl(url)) {
      console.log('✅ [parseGoogleMapsLink] Detected shortened URL');
      
      // Step 2: Resolve to full URL by following redirects
      const resolvedUrl = await resolveShortUrl(url);
      
      if (!resolvedUrl) {
        console.error('❌ [parseGoogleMapsLink] Failed to resolve URL');
        return null;
      }
      
      console.log('✅ [parseGoogleMapsLink] Resolved to:', resolvedUrl);
      urlToParse = resolvedUrl;
    } else {
      console.log('ℹ️ [parseGoogleMapsLink] Not a shortened URL, parsing directly');
    }
    
    // Step 3: Extract coordinates from the URL (either original or resolved)
    const coords = extractCoordinatesFromGoogleMapsUrl(urlToParse);
    
    if (!coords) {
      console.error('❌ [parseGoogleMapsLink] No coordinates found in URL:', urlToParse);
      return null;
    }

    console.log('✅ [parseGoogleMapsLink] Extracted coordinates:', coords);

    // Validate coordinates
    if (!validateCoordinates(coords.lat, coords.lng)) {
      console.error('❌ [parseGoogleMapsLink] Invalid coordinates:', coords);
      return null;
    }

    console.log('🔄 [parseGoogleMapsLink] Reverse geocoding...');
    // Reverse geocode to get address details
    const addressData = await reverseGeocodeStructured(coords.lat, coords.lng);
    
    console.log('✅ [parseGoogleMapsLink] Success! Full location:', {
      lat: coords.lat,
      lng: coords.lng,
      ...addressData,
    });

    return {
      lat: coords.lat,
      lng: coords.lng,
      ...addressData,
    };
  } catch (error) {
    console.error('❌ [parseGoogleMapsLink] Error:', error);
    return null;
  }
};
