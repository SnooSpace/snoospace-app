import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { apiGet } from '../api/client';
import { getAuthToken } from '../api/auth';

/**
 * Smart polling hook for home feed updates
 * Features:
 * - 30-second base interval
 * - Exponential backoff when no new posts (up to 2 minutes)
 * - Stops when app is in background
 * - Adaptive polling (slower at night)
 * - Auto-loads new posts when detected
 */
export function useFeedPolling(options = {}) {
  const {
    baseInterval = 30000, // Base: 30 seconds
    maxInterval = 120000, // Max: 2 minutes
    enabled = true,
    onNewPostsLoaded = null,
  } = options;
  
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastPostTimestampRef = useRef(null);
  const lastChangeTimeRef = useRef(Date.now());
  // Use a ref for the current interval value so poll closures always read
  // the latest value without triggering effect restarts.
  const currentIntervalRef = useRef(baseInterval);
  const [isPolling, setIsPolling] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);

  // Get adaptive interval based on time of day and activity
  const getAdaptiveInterval = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    
    // Adaptive polling: Slower between 11 PM - 6 AM (night time)
    const isNightTime = hour >= 23 || hour < 6;
    
    // Exponential backoff: If no changes for 2 minutes, slow down
    const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
    const hasBeenIdle = timeSinceLastChange > 120000; // 2 minutes
    
    if (isNightTime) {
      return 60000;
    } else if (hasBeenIdle) {
      return Math.min(currentIntervalRef.current * 1.5, maxInterval);
    } else {
      return baseInterval;
    }
  }, [baseInterval, maxInterval]);

  // Restart the polling interval with a new ms value
  const restartInterval = useCallback((ms, pollFn) => {
    currentIntervalRef.current = ms;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(pollFn, ms);
  }, []);

  // Check for new posts (lightweight check)
  // Uses refs for interval state so this callback is stable across renders.
  const checkForNewPosts = useCallback(async (pollFn) => {
    if (appStateRef.current !== 'active') {
      console.log('[FeedPolling] App not active, skipping poll');
      return null;
    }

    setIsPolling(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[FeedPolling] No auth token, skipping poll');
        setIsPolling(false);
        return null;
      }

      const response = await apiGet('/posts/feed', 15000, token);
      const posts = response.posts || [];
      
      if (posts.length === 0) {
        setIsPolling(false);
        return null;
      }

      const latestTimestamp = posts[0]?.created_at;
      
      if (lastPostTimestampRef.current && latestTimestamp) {
        const lastTime = new Date(lastPostTimestampRef.current).getTime();
        const newTime = new Date(latestTimestamp).getTime();
        
        if (newTime > lastTime) {
          const newCount = posts.filter(p => 
            new Date(p.created_at).getTime() > lastTime
          ).length;
          
          console.log(`[FeedPolling] ${newCount} new posts detected!`);
          setNewPostsCount(newCount);
          lastChangeTimeRef.current = Date.now();
          lastPostTimestampRef.current = latestTimestamp;
          
          // Reset to fast polling if we have a poll fn to reschedule
          if (pollFn && currentIntervalRef.current !== baseInterval) {
            restartInterval(baseInterval, pollFn);
          }
          
          setIsPolling(false);
          return { posts, hasNew: true, newCount };
        }
      } else if (latestTimestamp) {
        lastPostTimestampRef.current = latestTimestamp;
      }
      
      // No new posts - apply backoff
      const newInterval = getAdaptiveInterval();
      if (pollFn && newInterval !== currentIntervalRef.current) {
        console.log(`[FeedPolling] Adjusting interval to ${newInterval / 1000}s`);
        restartInterval(newInterval, pollFn);
      }
      
      setIsPolling(false);
      return { posts, hasNew: false, newCount: 0 };
    } catch (error) {
      console.error('[FeedPolling] Error checking for new posts:', error);
      setIsPolling(false);
      return null;
    }
  }, [baseInterval, getAdaptiveInterval, restartInterval]);

  // Initialize last timestamp when first receiving posts
  const initializeTimestamp = useCallback((timestamp) => {
    if (timestamp && !lastPostTimestampRef.current) {
      console.log('[FeedPolling] Initializing timestamp:', timestamp);
      lastPostTimestampRef.current = timestamp;
    }
  }, []);

  // Single stable polling effect — never restarts due to internal state changes
  useEffect(() => {
    if (!enabled) {
      console.log('[FeedPolling] Polling disabled');
      return;
    }

    currentIntervalRef.current = baseInterval;
    console.log(`[FeedPolling] Starting with ${baseInterval / 1000}s interval`);

    const poll = async () => {
      const result = await checkForNewPosts(poll);
      if (result?.hasNew && onNewPostsLoaded) {
        onNewPostsLoaded(result.posts);
      }
    };

    // Initial poll after one interval
    const initialTimer = setTimeout(poll, baseInterval);
    intervalRef.current = setInterval(poll, baseInterval);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[FeedPolling] App came to foreground, polling...');
        lastChangeTimeRef.current = Date.now();
        restartInterval(baseInterval, poll);
        poll();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  // Only restart when enabled/baseInterval/callbacks change — NOT on currentInterval
  }, [enabled, baseInterval, checkForNewPosts, onNewPostsLoaded, restartInterval]);

  // Force refresh function for manual trigger
  const forceRefresh = useCallback(async () => {
    console.log('[FeedPolling] Force refresh triggered');
    lastChangeTimeRef.current = Date.now();
    currentIntervalRef.current = baseInterval;
    const result = await checkForNewPosts(null);
    if (result?.hasNew && onNewPostsLoaded) {
      onNewPostsLoaded(result.posts);
    }
    return result;
  }, [baseInterval, checkForNewPosts, onNewPostsLoaded]);

  return {
    isPolling,
    newPostsCount,
    currentInterval: currentIntervalRef.current,
    forceRefresh,
    initializeTimestamp,
  };
}
