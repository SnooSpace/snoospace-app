/**
 * useVideoInsights — Data fetching hook
 *
 * Fetches aggregated video insights from the backend.
 * The token is optional — the endpoint is not auth-gated, but passing it
 * future-proofs for when creator-only gating is enforced server-side.
 */

import { useState, useEffect, useCallback } from 'react';
import { getVideoInsights } from '../api/videoInsights';

export function useVideoInsights(videoId, token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getVideoInsights(videoId, token);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [videoId, token]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { data, loading, error, refetch: fetchInsights };
}
