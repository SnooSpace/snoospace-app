/**
 * Validates Google Maps URLs
 * Shared utility used by CreateEventModal and CommunityLocationScreen
 */

/**
 * Checks if a URL is a valid Google Maps link
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid Google Maps URL
 */
export const isValidGoogleMapsUrl = (url) => {
  if (!url) return false;
  const validDomains = [
    'maps.google.com',
    'www.google.com/maps',
    'maps.app.goo.gl',
    'goo.gl/maps',
    'g.co/maps',
  ];
  return validDomains.some(domain => url.includes(domain));
};
