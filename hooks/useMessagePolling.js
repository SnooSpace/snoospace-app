import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getUnreadCount } from '../api/messages';

/**
 * Smart polling hook for message count updates (Instagram-like)
 * Features:
 * - 3-second base interval
 * - Exponential backoff when no new messages
 * - Stops when screen is off
 * - Adaptive polling (slower at night)
 */
export function useMessagePolling(onUpdate, options = {}) {
  const {
    baseInterval = 3000, // Base: 3 seconds
    enabled = true,
  } = options;
  
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastMessageCountRef = useRef(0);
  const lastChangeTimeRef = useRef(Date.now());
  const [currentInterval, setCurrentInterval] = useState(baseInterval);

  useEffect(() => {
    if (!enabled) return;

    const getAdaptiveInterval = () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Adaptive polling: Slower between 11 PM - 6 AM (night time)
      const isNightTime = hour >= 23 || hour < 6;
      
      // Exponential backoff: If no changes for 1 minute, slow down
      const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
      const hasBeenIdleFor1Min = timeSinceLastChange > 60000; // 60 seconds
      
      if (isNightTime) {
        // Night time: 10 seconds
        return 10000;
      } else if (hasBeenIdleFor1Min) {
        // No new messages for 1+ minute: slow to 10 seconds
        return 10000;
      } else {
        // Active time with recent changes: 3 seconds
        return baseInterval;
      }
    };

    const poll = async () => {
      // Don't poll if app is in background or screen is off
      if (appStateRef.current !== 'active') {
        return;
      }

      try {
        const response = await getUnreadCount();
        const newCount = response.unreadCount || 0;
        
        // Check if count changed
        if (newCount !== lastMessageCountRef.current) {
          lastChangeTimeRef.current = Date.now();
          lastMessageCountRef.current = newCount;
          
          // Reset to fast polling when change detected
          setCurrentInterval(baseInterval);
        }
        
        if (onUpdate) {
          onUpdate(newCount);
        }
        
        // Recalculate interval for next poll
        const newInterval = getAdaptiveInterval();
        if (newInterval !== currentInterval) {
          setCurrentInterval(newInterval);
        }
      } catch (error) {
        console.error('Message polling error:', error);
      }
    };

    // Poll immediately on mount
    poll();

    // Set up interval with current interval
    intervalRef.current = setInterval(poll, currentInterval);

    // Handle app state changes (foreground/background/screen off)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - poll immediately and reset to fast interval
        lastChangeTimeRef.current = Date.now();
        setCurrentInterval(baseInterval);
        poll();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [enabled, baseInterval, currentInterval, onUpdate]);

  // Restart interval when currentInterval changes
  useEffect(() => {
    if (!enabled || !intervalRef.current) return;
    
    // Clear old interval
    clearInterval(intervalRef.current);
    
    // Create new interval with updated timing
    const poll = async () => {
      if (appStateRef.current !== 'active') return;
      
      try {
        const response = await getUnreadCount();
        const newCount = response.unreadCount || 0;
        
        if (newCount !== lastMessageCountRef.current) {
          lastChangeTimeRef.current = Date.now();
          lastMessageCountRef.current = newCount;
          setCurrentInterval(baseInterval);
        }
        
        if (onUpdate) {
          onUpdate(newCount);
        }
      } catch (error) {
        console.error('Message polling error:', error);
      }
    };
    
    intervalRef.current = setInterval(poll, currentInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentInterval, enabled, baseInterval, onUpdate]);
}
