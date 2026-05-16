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
 *
 * IMPORTANT: After qualification, the hook continues tracking playback time
 * and sends a dwell-time update when the component unmounts or the user
 * navigates away, ensuring accurate total watch time for analytics.
 */
import { useRef, useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { viewQueueService } from "../services/ViewQueueService";

const PLAYBACK_THRESHOLD = 2000; // 2 seconds of playback

export function useVideoQualifiedView({
  postId,
  videoDuration = null,
  viewSource = "feed",
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
  const hasTrackedCompletion50Ref = useRef(false);
  const hasTrackedUnmuted25Ref = useRef(false);

  // Send dwell time update to backend
  // Called on unmount and app-background. Safe to call multiple times —
  // the backend uses GREATEST() so the stored value only ever increases.
  const sendDwellUpdate = useCallback(() => {
    if (!qualifiedRef.current) return;
    if (playbackTimeRef.current <= PLAYBACK_THRESHOLD) return; // No meaningful update beyond qualification

    // Cap at video duration — loops shouldn't inflate a single session
    let dwellMs = playbackTimeRef.current;
    if (videoDuration && videoDuration > 0) {
      dwellMs = Math.min(dwellMs, videoDuration * 1000);
    }

    viewQueueService.updateDwellTime(postId, dwellMs);
  }, [postId, videoDuration]);

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
        viewSource: viewSource || "feed",
      });

      onQualify?.(postId);
    },
    [postId, viewSource, onQualify],
  );

  // Track engaged view (private analytics)
  const trackEngagedView = useCallback(
    (engagementType) => {
      viewQueueService.addRepeatView(postId, engagementType);
      onEngagedView?.(postId, engagementType);
    },
    [postId, onEngagedView],
  );

  // Start playback tracking — continues tracking AFTER qualification
  const startTracking = useCallback(() => {
    if (timerRef.current) return; // Already tracking

    lastTimestampRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current || !lastTimestampRef.current) return;

      const now = Date.now();
      const delta = now - lastTimestampRef.current;
      lastTimestampRef.current = now;

      playbackTimeRef.current += delta;

      // Cap at video duration — prevents loops from inflating dwell time
      if (videoDuration && videoDuration > 0) {
        const maxMs = videoDuration * 1000;
        if (playbackTimeRef.current > maxMs) {
          playbackTimeRef.current = maxMs;
        }
      }

      // Check if playback threshold reached (qualification)
      if (!qualifiedRef.current && playbackTimeRef.current >= PLAYBACK_THRESHOLD) {
        markQualified("playback");
        // NOTE: Do NOT clearInterval here — keep tracking for accurate watch time
      }

      // Check for engaged view milestones (50% watched or unmuted + 25%)
      if (videoDuration && videoDuration > 0) {
        const videoDurationMs = videoDuration * 1000;
        const watchPercentage = playbackTimeRef.current / videoDurationMs;

        if (!hasTrackedCompletion50Ref.current && watchPercentage >= 0.5) {
          hasTrackedCompletion50Ref.current = true;
          trackEngagedView("completion_50");
        } else if (!hasTrackedUnmuted25Ref.current && hasUnmutedRef.current && watchPercentage >= 0.25) {
          hasTrackedUnmuted25Ref.current = true;
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
    // Accumulate any remaining time since last timestamp
    if (lastTimestampRef.current && isPlayingRef.current) {
      playbackTimeRef.current += Date.now() - lastTimestampRef.current;
      lastTimestampRef.current = null;
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
        // Send dwell update when app goes to background
        sendDwellUpdate();
      } else if (!wasActive && isActive) {
        if (isPlayingRef.current) {
          startTracking();
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription?.remove();
  }, [stopTracking, startTracking, sendDwellUpdate]);

  // Cleanup on unmount — send final dwell time
  useEffect(() => {
    return () => {
      stopTracking();
      sendDwellUpdate();
    };
  }, [stopTracking, sendDwellUpdate]);

  return {
    onPlaybackStateChange,
    onUnmute,
    onFullscreen,
    onLoop,
    hasQualified: qualifiedRef.current,
  };
}

export default useVideoQualifiedView;
