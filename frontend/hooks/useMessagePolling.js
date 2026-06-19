import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getUnreadCount } from '../api/messages';

/**
 * Smart polling hook for message count updates (Instagram-like)
 * Features:
 * - 3-second base interval
 * - Exponential backoff when no new messages
 * - Stops when screen is off
 * - Adaptive polling (slower at night)
 *
 * FIX: currentInterval is now stored in a ref (not state) to prevent
 * the main useEffect from re-running on every poll tick, which was
 * causing interval thrash (clear + re-create every 3s).
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
  // Use ref so interval adjustments don't trigger useEffect restarts
  const currentIntervalRef = useRef(baseInterval);

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

    const restartInterval = (ms) => {
      currentIntervalRef.current = ms;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(poll, ms);
    };

    const poll = async () => {
      // Don't poll if app is in background or screen is off
      if (appStateRef.current !== 'active') {
        return;
      }

      try {
        const response = await getUnreadCount();
        const newCount = response.unreadCount || 0;
        const prevCount = lastMessageCountRef.current;
        
        // Always track latest count in ref (keep in sync regardless of notification)
        lastMessageCountRef.current = newCount;

        // Check if count changed
        if (newCount !== prevCount) {
          lastChangeTimeRef.current = Date.now();
          
          // Reset to fast polling when change detected
          if (currentIntervalRef.current !== baseInterval) {
            restartInterval(baseInterval);
          }

          // Only notify the caller when the value actually changed —
          // avoids scheduling a setMessageUnread() (and a header re-render)
          // every 3 seconds when nothing has happened.
          if (onUpdate) {
            onUpdate(newCount);
          }
        } else {
          // Recalculate interval for next poll (may slow down if idle)
          const newInterval = getAdaptiveInterval();
          if (newInterval !== currentIntervalRef.current) {
            restartInterval(newInterval);
          }
        }
      } catch (error) {
        console.error('Message polling error:', error);
      }
    };

    // Poll immediately on mount
    poll();

    // Set up interval
    currentIntervalRef.current = baseInterval;
    intervalRef.current = setInterval(poll, baseInterval);

    // Handle app state changes (foreground/background/screen off)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - poll immediately and reset to fast interval
        lastChangeTimeRef.current = Date.now();
        restartInterval(baseInterval);
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
  // Only re-run if enabled or baseInterval changes — NOT on currentInterval
  }, [enabled, baseInterval, onUpdate]);
}
