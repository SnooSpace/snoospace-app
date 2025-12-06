/**
 * Utility functions for validating Google Maps URLs
 */

/**
 * Validates if a string is a valid Google Maps URL
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid Google Maps URL
 */
function isValidGoogleMapsUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // List of valid Google Maps domains
  const validDomains = [
    'maps.google.com',
    'www.google.com/maps',
    'maps.app.goo.gl',
    'goo.gl/maps',
    'g.co/maps',
  ];

  try {
    // Try to parse as URL
    const urlObj = new URL(url);
    
    // Check if URL contains any of the valid domains
    return validDomains.some(domain => url.includes(domain));
  } catch (error) {
    // Not a valid URL format
    return false;
  }
}

/**
 * Extracts the place name from a Google Maps URL
 * @param {string} url - Google Maps URL
 * @returns {string} - Extracted place name or 'Location'
 */
function getPlaceNameFromUrl(url) {
  try {
    // Google Maps URLs have format: /place/Location+Name/data=...
    const match = url.match(/\/place\/([^\/]+)/);
    if (match) {
      return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    return 'Location';
  } catch (error) {
    return 'Location';
  }
}

module.exports = {
  isValidGoogleMapsUrl,
  getPlaceNameFromUrl,
};
