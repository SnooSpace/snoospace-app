import { useState, useEffect } from "react";

/**
 * Location Name Cache Utility
 *
 * Resolves location names from Google Maps URLs (including shortened URLs)
 * and caches results to avoid repeated network requests.
 */

// In-memory cache for resolved location names
const locationCache = new Map();

// Pending resolution promises to avoid duplicate requests
const pendingResolutions = new Map();

/**
 * Check if URL is a shortened Google Maps link
 */
const isShortenedUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return /maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps/.test(url);
};

/**
 * Extract place name from a full Google Maps URL
 * @param {string} url - Full Google Maps URL
 * @returns {string|null} - Extracted place name or null
 */
const extractPlaceNameFromUrl = (url) => {
  if (!url) return null;

  try {
    // Pattern 1: /place/Place+Name+Here/ or /place/Place+Name+Here,Address/
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      let placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));

      // If the place name contains comma (address), take only the first part
      if (placeName.includes(",")) {
        placeName = placeName.split(",")[0].trim();
      }

      return placeName;
    }

    // Pattern 2: query=Place+Name
    const queryMatch = url.match(/query=([^&]+)/);
    if (queryMatch) {
      const queryValue = decodeURIComponent(queryMatch[1].replace(/\+/g, " "));
      // Check if it's coordinates (numbers only)
      if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(queryValue)) {
        return queryValue;
      }
    }

    // Pattern 3: search/Place+Name
    const searchMatch = url.match(/\/search\/([^/@?]+)/);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
    }

    return null;
  } catch (error) {
    console.error("[extractPlaceNameFromUrl] Error:", error);
    return null;
  }
};

/**
 * Resolve a shortened URL to its full URL
 * @param {string} url - Shortened URL
 * @returns {Promise<string|null>} - Full URL or null
 */
const resolveShortUrl = async (url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html",
      },
    });

    clearTimeout(timeoutId);
    return response.url || null;
  } catch (error) {
    console.error("[resolveShortUrl] Error:", error.message);
    return null;
  }
};

/**
 * Resolve location name from any Google Maps URL
 * Handles both full URLs and shortened URLs (maps.app.goo.gl)
 *
 * @param {string} url - Google Maps URL (full or shortened)
 * @param {string} fallback - Fallback name if resolution fails
 * @returns {Promise<string>} - Resolved location name
 */
export const resolveLocationName = async (url, fallback = "View Location") => {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmedUrl = url.trim();

  // Check cache first
  if (locationCache.has(trimmedUrl)) {
    return locationCache.get(trimmedUrl);
  }

  // Check if there's already a pending resolution for this URL
  if (pendingResolutions.has(trimmedUrl)) {
    return pendingResolutions.get(trimmedUrl);
  }

  // Create a new resolution promise
  const resolutionPromise = (async () => {
    try {
      let urlToExtract = trimmedUrl;

      // If it's a shortened URL, resolve it first
      if (isShortenedUrl(trimmedUrl)) {
        const resolvedUrl = await resolveShortUrl(trimmedUrl);
        if (resolvedUrl) {
          urlToExtract = resolvedUrl;
        } else {
          // Couldn't resolve shortened URL
          locationCache.set(trimmedUrl, fallback);
          return fallback;
        }
      }

      // Extract place name from the URL
      const placeName = extractPlaceNameFromUrl(urlToExtract);

      if (placeName) {
        locationCache.set(trimmedUrl, placeName);
        return placeName;
      }

      // Fallback if no name could be extracted
      locationCache.set(trimmedUrl, fallback);
      return fallback;
    } catch (error) {
      console.error("[resolveLocationName] Error:", error);
      locationCache.set(trimmedUrl, fallback);
      return fallback;
    } finally {
      // Remove from pending resolutions
      pendingResolutions.delete(trimmedUrl);
    }
  })();

  // Store the pending resolution
  pendingResolutions.set(trimmedUrl, resolutionPromise);

  return resolutionPromise;
};

/**
 * React Hook to get location name from a Google Maps URL
 * Handles async resolution and provides loading state
 *
 * @param {string} url - Google Maps URL
 * @param {Object} options - Options
 * @param {string} options.fallback - Fallback text (default: 'View Location')
 * @param {string} options.loadingText - Text to show while loading (default: same as fallback)
 * @returns {string} - Location name (or loading/fallback text)
 */
export const useLocationName = (url, options = {}) => {
  const { fallback = "View Location", loadingText = null } = options;

  const [locationName, setLocationName] = useState(() => {
    // Check cache synchronously first
    if (url && locationCache.has(url.trim())) {
      return locationCache.get(url.trim());
    }
    // For non-shortened URLs, try immediate extraction
    if (url && !isShortenedUrl(url)) {
      const extracted = extractPlaceNameFromUrl(url);
      if (extracted) return extracted;
    }
    return loadingText || fallback;
  });

  useEffect(() => {
    if (!url) {
      setLocationName(fallback);
      return;
    }

    let isMounted = true;

    resolveLocationName(url, fallback).then((name) => {
      if (isMounted) {
        setLocationName(name);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url, fallback]);

  return locationName;
};

/**
 * Clear the location cache (useful for testing or memory management)
 */
export const clearLocationCache = () => {
  locationCache.clear();
};

/**
 * Get cache size (useful for debugging)
 */
export const getLocationCacheSize = () => {
  return locationCache.size;
};

export default {
  resolveLocationName,
  useLocationName,
  clearLocationCache,
  getLocationCacheSize,
};
