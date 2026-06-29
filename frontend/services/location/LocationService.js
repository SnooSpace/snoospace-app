/**
 * LocationService.js
 *
 * Abstract interface contract that every location provider must implement.
 * This is plain JS documentation — not enforced at runtime — but use it as
 * the authoritative spec for what each provider must return.
 */

/**
 * @typedef {Object} UnifiedPlaceResult
 * @property {string} placeId        - Provider-specific unique ID
 * @property {string} name           - Display name of the place
 * @property {string} address        - Full formatted address
 * @property {string} shortAddress   - Locality + city only (e.g. "Indiranagar, Bengaluru")
 * @property {number} lat
 * @property {number} lng
 * @property {string|null} category  - e.g. "restaurant", "gym", "venue"
 * @property {'google'|'mappls'} provider
 */

/**
 * @typedef {Object} ReverseGeocodeResult
 * @property {string} address        - Full formatted address
 * @property {string} shortAddress   - Neighbourhood + city (e.g. "Koramangala, Bengaluru")
 * @property {string} city
 * @property {string} state
 * @property {string} pincode
 */

/**
 * Every provider must implement all four methods below and return results in
 * the unified shapes defined above. Never throw — degrade gracefully.
 *
 * @interface LocationProvider
 */
const LocationServiceInterface = {
  /**
   * Text search / autocomplete
   * @param {string} query
   * @param {{ lat: number, lng: number, radius?: number }} options
   * @returns {Promise<UnifiedPlaceResult[]>}
   */
  searchPlaces: async (query, options) => {
    throw new Error('searchPlaces() must be implemented by a provider');
  },

  /**
   * Nearby search
   * @param {number} lat
   * @param {number} lng
   * @param {{ radius?: number, category?: string }} options
   * @returns {Promise<UnifiedPlaceResult[]>}
   */
  nearbySearch: async (lat, lng, options) => {
    throw new Error('nearbySearch() must be implemented by a provider');
  },

  /**
   * Full place details by ID
   * @param {string} placeId
   * @returns {Promise<UnifiedPlaceResult|null>}
   */
  getPlaceDetails: async (placeId) => {
    throw new Error('getPlaceDetails() must be implemented by a provider');
  },

  /**
   * Convert coordinates to address tokens
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<ReverseGeocodeResult>}
   */
  reverseGeocode: async (lat, lng) => {
    throw new Error('reverseGeocode() must be implemented by a provider');
  },
};

export default LocationServiceInterface;
