import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { apiGet } from '../api/client';
import { getAuthToken } from '../api/auth';

/**
 * Lightweight polling hook for profile counts (followers, following, posts)
 * Features:
 * - 5-second interval for real-time feel
 * - Pauses when modal is open
 * - Stops when app is in background
 * - Minimal API load (counts only)
 */
export function useProfileCountsPolling(options = {}) {
  const {
    userId,
    userType = 'member',
    interval = 5000, // 5 seconds
    enabled = true,
    paused = false, // For pausing when modal is open
  } = options;
  
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  // Use a ref for previous counts comparison to avoid fetchCounts recreating
  // every time counts state changes (which caused the main useEffect to restart
  // the interval on every single poll tick)
  const countsRef = useRef({ followers: 0, following: 0, posts: 0, circles: 0 });
  const [counts, setCounts] = useState({
    followers: 0,
    following: 0,
    posts: 0,
    circles: 0,
  });
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch counts from API
  const fetchCounts = useCallback(async () => {
    if (!userId || !userType) {
      console.log('[CountsPolling] Missing userId or userType');
      return null;
    }

    if (appStateRef.current !== 'active') {
      console.log('[CountsPolling] App not active, skipping poll');
      return null;
    }

    if (paused) {
      console.log('[CountsPolling] Polling paused (modal open)');
      return null;
    }

    setIsPolling(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[CountsPolling] No auth token, skipping poll');
        setIsPolling(false);
        return null;
      }

      // Single API call returns followers + following + post_count in one round-trip
      const countsResponse = await apiGet(
        `/profile/counts/${userId}/${userType}`,
        10000,
        token
      );

      const newCounts = {
        followers: typeof countsResponse?.followers_count === 'number'
          ? countsResponse.followers_count
          : parseInt(countsResponse?.followers_count || 0, 10),
        following: typeof countsResponse?.following_count === 'number'
          ? countsResponse.following_count
          : parseInt(countsResponse?.following_count || 0, 10),
        posts: typeof countsResponse?.post_count === 'number'
          ? countsResponse.post_count
          : parseInt(countsResponse?.post_count || 0, 10),
        circles: typeof countsResponse?.circle_count === 'number'
          ? countsResponse.circle_count
          : parseInt(countsResponse?.circle_count || 0, 10),
      };

      // Compare against ref (not state) to avoid recreating fetchCounts on every tick
      const prev = countsRef.current;
      const hasChanged =
        newCounts.followers !== prev.followers ||
        newCounts.following !== prev.following ||
        newCounts.posts !== prev.posts ||
        newCounts.circles !== prev.circles;

      if (hasChanged) {
        console.log('[CountsPolling] Counts changed:', {
          old: prev,
          new: newCounts,
        });
        countsRef.current = newCounts;
        setCounts(newCounts);
        setLastUpdated(new Date());
      }

      setIsPolling(false);
      return newCounts;
    } catch (error) {
      console.error('[CountsPolling] Error fetching counts:', error);
      setIsPolling(false);
      return null;
    }
  // Remove `counts` from deps — use countsRef.current for comparison instead
  }, [userId, userType, paused]);

  // Initialize counts
  const initializeCounts = useCallback((initialCounts) => {
    if (initialCounts) {
      console.log('[CountsPolling] Initializing counts:', initialCounts);
      const init = {
        followers: initialCounts.follower_count || initialCounts.followers || 0,
        following: initialCounts.following_count || initialCounts.following || 0,
        posts: initialCounts.post_count || initialCounts.posts || 0,
        circles: initialCounts.circle_count || initialCounts.circles || 0,
      };
      countsRef.current = init;
      setCounts(init);
    }
  }, []);

  // Main polling effect
  useEffect(() => {
    if (!enabled || !userId) {
      console.log('[CountsPolling] Polling disabled or no userId');
      return;
    }

    console.log(`[CountsPolling] Starting with ${interval / 1000}s interval for ${userType}:${userId}`);

    // Don't poll immediately - wait for first interval
    // This avoids duplicate requests on mount when loadProfile already fetches
    intervalRef.current = setInterval(() => {
      if (!paused) {
        fetchCounts();
      }
    }, interval);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - poll immediately
        console.log('[CountsPolling] App came to foreground, polling...');
        if (!paused) {
          fetchCounts();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [enabled, userId, userType, interval, fetchCounts, paused]);

  // Handle pause state changes
  useEffect(() => {
    if (paused) {
      console.log('[CountsPolling] Pausing polling');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else if (enabled && userId && !intervalRef.current) {
      console.log('[CountsPolling] Resuming polling');
      intervalRef.current = setInterval(fetchCounts, interval);
    }
  }, [paused, enabled, userId, interval, fetchCounts]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    console.log('[CountsPolling] Force refresh triggered');
    return await fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    isPolling,
    lastUpdated,
    forceRefresh,
    initializeCounts,
  };
}
