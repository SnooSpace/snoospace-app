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
  const [currentInterval, setCurrentInterval] = useState(baseInterval);
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
      // Night time: 1 minute
      return 60000;
    } else if (hasBeenIdle) {
      // No new posts for 2+ minutes: slow to max interval
      return Math.min(currentInterval * 1.5, maxInterval);
    } else {
      // Active time with recent changes: base interval
      return baseInterval;
    }
  }, [baseInterval, maxInterval, currentInterval]);

  // Check for new posts (lightweight check)
  const checkForNewPosts = useCallback(async () => {
    if (appStateRef.current !== 'active') {
      console.log('[FeedPolling] App not active, skipping poll');
      return null;
    }

    setIsPolling(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[FeedPolling] No auth token, skipping poll');
        return null;
      }

      // Fetch latest posts to check for new ones
      const response = await apiGet('/posts/feed', 15000, token);
      const posts = response.posts || [];
      
      if (posts.length === 0) {
        setIsPolling(false);
        return null;
      }

      // Check if we have newer posts than last time
      const latestTimestamp = posts[0]?.created_at;
      
      if (lastPostTimestampRef.current && latestTimestamp) {
        const lastTime = new Date(lastPostTimestampRef.current).getTime();
        const newTime = new Date(latestTimestamp).getTime();
        
        if (newTime > lastTime) {
          // New posts detected!
          const newCount = posts.filter(p => 
            new Date(p.created_at).getTime() > lastTime
          ).length;
          
          console.log(`[FeedPolling] ${newCount} new posts detected!`);
          setNewPostsCount(newCount);
          lastChangeTimeRef.current = Date.now();
          lastPostTimestampRef.current = latestTimestamp;
          
          // Reset to fast polling
          setCurrentInterval(baseInterval);
          
          // Auto-load: return the new posts for the component to update
          setIsPolling(false);
          return { posts, hasNew: true, newCount };
        }
      } else if (latestTimestamp) {
        // First poll - store timestamp
        lastPostTimestampRef.current = latestTimestamp;
      }
      
      // No new posts - apply backoff
      const newInterval = getAdaptiveInterval();
      if (newInterval !== currentInterval) {
        console.log(`[FeedPolling] Adjusting interval to ${newInterval / 1000}s`);
        setCurrentInterval(newInterval);
      }
      
      setIsPolling(false);
      return { posts, hasNew: false, newCount: 0 };
    } catch (error) {
      console.error('[FeedPolling] Error checking for new posts:', error);
      setIsPolling(false);
      return null;
    }
  }, [baseInterval, currentInterval, getAdaptiveInterval]);

  // Initialize last timestamp when first receiving posts
  const initializeTimestamp = useCallback((timestamp) => {
    if (timestamp && !lastPostTimestampRef.current) {
      console.log('[FeedPolling] Initializing timestamp:', timestamp);
      lastPostTimestampRef.current = timestamp;
    }
  }, []);

  // Main polling effect
  useEffect(() => {
    if (!enabled) {
      console.log('[FeedPolling] Polling disabled');
      return;
    }

    console.log(`[FeedPolling] Starting with ${currentInterval / 1000}s interval`);

    const poll = async () => {
      const result = await checkForNewPosts();
      if (result?.hasNew && onNewPostsLoaded) {
        onNewPostsLoaded(result.posts);
      }
    };

    // Initial poll after a short delay
    const initialTimer = setTimeout(poll, currentInterval);

    // Set up interval
    intervalRef.current = setInterval(poll, currentInterval);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - poll immediately
        console.log('[FeedPolling] App came to foreground, polling...');
        lastChangeTimeRef.current = Date.now();
        setCurrentInterval(baseInterval);
        poll();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [enabled, currentInterval, checkForNewPosts, onNewPostsLoaded, baseInterval]);

  // Restart interval when currentInterval changes
  useEffect(() => {
    if (!enabled) return;
    
    // Clear old interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    const poll = async () => {
      if (appStateRef.current !== 'active') return;
      
      const result = await checkForNewPosts();
      if (result?.hasNew && onNewPostsLoaded) {
        onNewPostsLoaded(result.posts);
      }
    };
    
    intervalRef.current = setInterval(poll, currentInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentInterval, enabled, checkForNewPosts, onNewPostsLoaded]);

  // Force refresh function for manual trigger
  const forceRefresh = useCallback(async () => {
    console.log('[FeedPolling] Force refresh triggered');
    lastChangeTimeRef.current = Date.now();
    setCurrentInterval(baseInterval);
    const result = await checkForNewPosts();
    if (result?.hasNew && onNewPostsLoaded) {
      onNewPostsLoaded(result.posts);
    }
    return result;
  }, [baseInterval, checkForNewPosts, onNewPostsLoaded]);

  return {
    isPolling,
    newPostsCount,
    currentInterval,
    forceRefresh,
    initializeTimestamp,
  };
}
