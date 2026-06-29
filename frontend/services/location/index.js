/**
 * services/location/index.js
 *
 * Provider registry and active provider accessor.
 *
 * Reads EXPO_PUBLIC_LOCATION_PROVIDER at import time and exports
 * the correct provider. Default is 'mappls' (India-optimised).
 *
 * Usage:
 *   import { getActiveProvider, PROVIDER_NAME } from './services/location';
 *   const provider = getActiveProvider();
 *   const results = await provider.searchPlaces(query, { lat, lng });
 */

import MapplsProvider from './providers/mappls';
import GoogleProvider from './providers/google';

/** @type {'mappls'|'google'} */
export const PROVIDER_NAME =
  (process.env.EXPO_PUBLIC_LOCATION_PROVIDER ?? 'mappls').toLowerCase() === 'google'
    ? 'google'
    : 'mappls';

const PROVIDERS = {
  mappls: MapplsProvider,
  google: GoogleProvider,
};

/**
 * Returns the currently active location provider instance.
 * The provider is determined by EXPO_PUBLIC_LOCATION_PROVIDER.
 *
 * @returns {typeof MapplsProvider | typeof GoogleProvider}
 */
export function getActiveProvider() {
  return PROVIDERS[PROVIDER_NAME] ?? PROVIDERS.mappls;
}

// Convenience re-export — lets callers import everything from one place
export { MapplsProvider, GoogleProvider };

export default getActiveProvider();
