/**
 * useQualifiedView Hook
 *
 * Tracks qualified unique views for posts based on visibility and dwell time.
 * A view is only counted when:
 * 1. ≥65% of the post card is visible with center in viewport
 * 2. User dwells for the required time (text: 2s, image: 1.5s, video: 2s playback)
 * 3. User has NOT previously viewed this post (lifetime uniqueness)
 *
 * Intent safeguards:
 * - Fast scroll (>800px/s) → RESET timer
 * - App background → PAUSE timer
 * - Orientation change → RESET timer
 */
import { useRef, useCallback, useEffect } from "react";
import { AppState, Dimensions } from "react-native";
import { viewQueueService } from "../services/ViewQueueService";

const DWELL_THRESHOLDS = {
  text: 2000, // 2 seconds
  image: 1500, // 1.5 seconds
  video: 2000, // 2 seconds of playback
};

const VISIBILITY_THRESHOLD = 0.65; // 65% of card visible
const SCROLL_VELOCITY_LIMIT = 800; // px/s

export function useQualifiedView({ postId, postType = "text", onQualify }) {
  const timerRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const qualifiedRef = useRef(false);
  const startTimeRef = useRef(null);
  const isVisibleRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const threshold = DWELL_THRESHOLDS[postType] || DWELL_THRESHOLDS.text;

  // Reset timer completely (fast scroll, left viewport, orientation change)
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    accumulatedTimeRef.current = 0;
    startTimeRef.current = null;
  }, []);

  // Pause timer (app background) - preserves accumulated time
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      // Save accumulated time before pausing
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        accumulatedTimeRef.current += elapsed;
      }
      clearInterval(timerRef.current);
      timerRef.current = null;
      startTimeRef.current = null;
    }
  }, []);

  // Start or resume timer
  const startTimer = useCallback(() => {
    // Don't start if already qualified or timer running
    if (timerRef.current || qualifiedRef.current) return;

    // Check if already viewed via service (local cache, advisory)
    if (viewQueueService.hasViewed(postId)) {
      qualifiedRef.current = true;
      return;
    }

    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const totalTime = accumulatedTimeRef.current + elapsed;

      if (totalTime >= threshold && !qualifiedRef.current) {
        qualifiedRef.current = true;
        clearInterval(timerRef.current);
        timerRef.current = null;

        // Add to queue for server submission
        viewQueueService.addQualifiedView(postId, {
          postType,
          dwellTime: totalTime,
        });

        // Notify parent if callback provided
        onQualify?.(postId);
      }
    }, 100);
  }, [postId, postType, threshold, onQualify]);

  // Handle visibility changes from viewport observer
  const onVisibilityChange = useCallback(
    ({ visibilityRatio, isCenterVisible, scrollVelocity }) => {
      const meetsVisibility =
        visibilityRatio >= VISIBILITY_THRESHOLD && isCenterVisible;

      // Fast scroll → RESET (not pause)
      if (Math.abs(scrollVelocity) >= SCROLL_VELOCITY_LIMIT) {
        resetTimer();
        isVisibleRef.current = false;
        return;
      }

      if (meetsVisibility) {
        if (!isVisibleRef.current) {
          isVisibleRef.current = true;
          startTimer();
        }
      } else {
        // Left viewport → RESET
        isVisibleRef.current = false;
        resetTimer();
      }
    },
    [startTimer, resetTimer],
  );

  // Orientation change → RESET timer
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      resetTimer();
    });
    return () => subscription?.remove();
  }, [resetTimer]);

  // App state changes: background → PAUSE, foreground → resume if visible
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      const isActive = nextState === "active";

      if (wasActive && !isActive) {
        // Going to background → PAUSE
        pauseTimer();
      } else if (!wasActive && isActive) {
        // Coming to foreground → resume if still visible
        if (isVisibleRef.current && !qualifiedRef.current) {
          startTimer();
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription?.remove();
  }, [pauseTimer, startTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    onVisibilityChange,
    hasQualified: qualifiedRef.current,
  };
}

export default useQualifiedView;
