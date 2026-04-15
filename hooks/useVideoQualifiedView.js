/**
 * useVideoQualifiedView Hook
 *
 * Specialized hook for video posts. A qualified view counts when:
 * - ≥2 seconds of actual playback, OR
 * - User unmutes audio, OR
 * - User expands to fullscreen
 *
 * Looping videos NEVER generate additional public views.
 * Replays are tracked as private analytics only.
 */
import { useRef, useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { viewQueueService } from "../services/ViewQueueService";

const PLAYBACK_THRESHOLD = 2000; // 2 seconds of playback

export function useVideoQualifiedView({
  postId,
  videoDuration = null,
  onQualify,
  onEngagedView,
}) {
  const playbackTimeRef = useRef(0);
  const qualifiedRef = useRef(false);
  const hasUnmutedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastTimestampRef = useRef(null);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Mark view as qualified (only happens once)
  const markQualified = useCallback(
    (trigger) => {
      if (qualifiedRef.current) return;
      if (viewQueueService.hasViewed(postId)) {
        qualifiedRef.current = true;
        return;
      }

      qualifiedRef.current = true;

      viewQueueService.addQualifiedView(postId, {
        postType: "video",
        dwellTime: playbackTimeRef.current,
        trigger, // 'playback', 'unmute', or 'fullscreen'
      });

      onQualify?.(postId);
    },
    [postId, onQualify],
  );

  // Track engaged view (private analytics)
  const trackEngagedView = useCallback(
    (engagementType) => {
      viewQueueService.addRepeatView(postId, engagementType);
      onEngagedView?.(postId, engagementType);
    },
    [postId, onEngagedView],
  );

  // Start playback tracking
  const startTracking = useCallback(() => {
    if (timerRef.current || qualifiedRef.current) return;

    lastTimestampRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current || !lastTimestampRef.current) return;

      const now = Date.now();
      const delta = now - lastTimestampRef.current;
      lastTimestampRef.current = now;

      playbackTimeRef.current += delta;

      // Check if playback threshold reached
      if (playbackTimeRef.current >= PLAYBACK_THRESHOLD) {
        markQualified("playback");
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Check for engaged view (50% watched or unmuted + 25%)
      if (videoDuration) {
        const watchPercentage = playbackTimeRef.current / videoDuration;

        if (watchPercentage >= 0.5) {
          trackEngagedView("completion_50");
        } else if (hasUnmutedRef.current && watchPercentage >= 0.25) {
          trackEngagedView("unmuted_25");
        }
      }
    }, 100);
  }, [markQualified, trackEngagedView, videoDuration]);

  // Stop tracking (preserve accumulated time)
  const stopTracking = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Called when video play state changes
  const onPlaybackStateChange = useCallback(
    (isPlaying) => {
      isPlayingRef.current = isPlaying;

      if (isPlaying) {
        lastTimestampRef.current = Date.now();
        startTracking();
      } else {
        // Preserve playback time on pause
        if (lastTimestampRef.current) {
          playbackTimeRef.current += Date.now() - lastTimestampRef.current;
          lastTimestampRef.current = null;
        }
      }
    },
    [startTracking],
  );

  // Called when user unmutes
  const onUnmute = useCallback(() => {
    if (!hasUnmutedRef.current) {
      hasUnmutedRef.current = true;

      // Unmuting immediately qualifies the view
      markQualified("unmute");

      trackEngagedView("unmute");
    }
  }, [markQualified, trackEngagedView]);

  // Called when user goes fullscreen
  const onFullscreen = useCallback(() => {
    // Fullscreen immediately qualifies the view
    markQualified("fullscreen");

    trackEngagedView("fullscreen");
  }, [markQualified, trackEngagedView]);

  // Called when video loops (track as repeat, don't add public view)
  const onLoop = useCallback(() => {
    // Only track privately, never add to public count
    viewQueueService.addRepeatView(postId, "loop");
  }, [postId]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      const isActive = nextState === "active";

      if (wasActive && !isActive) {
        stopTracking();
      } else if (!wasActive && isActive) {
        if (isPlayingRef.current && !qualifiedRef.current) {
          startTracking();
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription?.remove();
  }, [stopTracking, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  return {
    onPlaybackStateChange,
    onUnmute,
    onFullscreen,
    onLoop,
    hasQualified: qualifiedRef.current,
  };
}

export default useVideoQualifiedView;
