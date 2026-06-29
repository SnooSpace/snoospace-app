/**
 * services/location/useLocationSearch.js
 *
 * Debounced search hook for autocomplete UI.
 * Consumes the active provider (Mappls or Google) transparently.
 *
 * Usage:
 *   const { query, setQuery, results, loading, error, setUserLocation } =
 *     useLocationSearch({ debounceMs: 400 });
 */

import { useState, useEffect, useCallback } from 'react';
import { getActiveProvider } from './index';

/**
 * @param {{ debounceMs?: number }} options
 * @returns {{
 *   query: string,
 *   setQuery: (q: string) => void,
 *   results: import('./LocationService').UnifiedPlaceResult[],
 *   loading: boolean,
 *   error: string|null,
 *   userLocation: { lat: number, lng: number }|null,
 *   setUserLocation: (loc: { lat: number, lng: number }|null) => void,
 *   clearResults: () => void,
 * }}
 */
export function useLocationSearch({ debounceMs = 400 } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const search = useCallback(async (q, location) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const provider = getActiveProvider();
      const res = await provider.searchPlaces(q, {
        lat: location?.lat ?? 12.9716, // Bengaluru default
        lng: location?.lng ?? 77.5946,
        radius: 10000,
      });
      setResults(res ?? []);
    } catch (e) {
      setError(e.message ?? 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce: fires after the user stops typing for debounceMs
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query, userLocation);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, userLocation, search, debounceMs]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    userLocation,
    setUserLocation,
    clearResults,
  };
}

export default useLocationSearch;
