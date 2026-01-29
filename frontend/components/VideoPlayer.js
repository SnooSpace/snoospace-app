/**
 * VideoPlayer Component
 *
 * Production-grade video player with Instagram-like behavior:
 * - Viewport-aware autoplay (plays when visible)
 * - "Watch Again" overlay on completion (feed view only)
 * - Manual loop control for proper resource cleanup
 * - Aggressive off-screen unloading to prevent memory issues
 * - Global coordination via VideoContext
 */
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  Image,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { RotateCcw } from "lucide-react-native";
import { useVideoContext } from "../context/VideoContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// How long to wait before unloading off-screen video (ms)
// Reduced to 5s for better memory management while allowing quick scroll-backs
// Memory impact: ~1-2 videos max in memory at once
const UNLOAD_DELAY_MS = 5000;

const VideoPlayer = ({
  source,
  style,
  aspectRatio = 1,
  autoplay = true,
  muted = true,
  loop = true, // For feed: controlled manually. For fullscreen: native loop
  showControls = true,
  isVisible = true, // Parent manages via viewability
  isScreenFocused = true, // Parent manages via screen focus (navigation)
  isFullscreen = false, // True when playing in fullscreen modal
  onLoad,
  onError,
  onPress, // Callback when video is tapped
  onVideoEnd, // Callback when video finishes (for external handling)
  containerWidth = SCREEN_WIDTH,
  cropMetadata,
  // Qualified view tracking
  onUnmute,
  onPlaybackStart,
  onFullscreen,
  postId, // For VideoContext registration
  // HLS streaming support (new)
  thumbnailUrl: propThumbnailUrl, // Pre-generated thumbnail from API
}) => {
  const videoRef = useRef(null);
  const { isVideoActive, registerVideo } = useVideoContext();

  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(true); // Controls if video is loaded
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false); // Track if video has ever played
  const [hasFirstFrameRendered, setHasFirstFrameRendered] = useState(false); // Track if first video frame is visible

  // "Watch Again" state - only for feed view (non-fullscreen)
  const [videoFinished, setVideoFinished] = useState(false);
  const [showWatchAgainOverlay, setShowWatchAgainOverlay] = useState(false);

  // Play button state (for non-autoplay or paused state)
  const [showPlayButton, setShowPlayButton] = useState(!autoplay);

  // Tracking refs
  const hasNotifiedPlaybackRef = useRef(false);
  const unloadTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const hasScrolledAwayWhileFinishedRef = useRef(false); // Tracks if user left while video was finished

  // CRITICAL: Refs for values that need to be checked inside setTimeout
  // This prevents stale closure bugs where setTimeout sees old values
  const isVisibleRef = useRef(isVisible);
  const videoFinishedRef = useRef(videoFinished);

  // Keep refs in sync with state
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    videoFinishedRef.current = videoFinished;
  }, [videoFinished]);

  // Register with VideoContext for cleanup tracking
  useEffect(() => {
    if (postId) {
      return registerVideo(postId, videoRef);
    }
  }, [postId, registerVideo]);

  // CRITICAL: Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(unloadTimeoutRef.current);
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // SCREEN FOCUS HANDLING: Full reset when navigating away from screen
  // This ensures clean, fresh playback when the user returns
  useEffect(() => {
    if (!isScreenFocused && !isFullscreen) {
      // Screen lost focus - IMMEDIATELY unload and reset everything
      console.log("[VideoPlayer] Screen lost focus, fully resetting:", postId);

      // Stop any pending unload
      clearTimeout(unloadTimeoutRef.current);

      // Unload the video immediately
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {});
      }

      // Reset ALL state for fresh playback on return
      setShouldLoad(false);
      setHasFirstFrameRendered(false);
      setVideoFinished(false);
      setShowWatchAgainOverlay(false);
      setHasStartedPlaying(false);
      setIsPlaying(false);
      setIsLoading(true);
      hasNotifiedPlaybackRef.current = false;
      hasScrolledAwayWhileFinishedRef.current = false;
    } else if (isScreenFocused && !shouldLoad && !isUnmountingRef.current) {
      // Screen regained focus - reload the video fresh
      console.log(
        "[VideoPlayer] Screen regained focus, reloading fresh:",
        postId,
      );
      setShouldLoad(true);
      setIsLoading(true);
    }
  }, [isScreenFocused, isFullscreen, postId, shouldLoad]);

  // Handle visibility changes with aggressive off-screen unloading
  useEffect(() => {
    // Clear any pending unload when visibility changes
    clearTimeout(unloadTimeoutRef.current);

    if (isVisible && shouldLoad) {
      // Visible - always restart from beginning (Instagram behavior)
      // This handles both: returning from scroll AND returning from different screen
      if (autoplay && videoRef.current && hasStartedPlaying) {
        // Video was previously playing - restart from beginning
        console.log("[VideoPlayer] Restarting video from beginning:", postId);

        // Reset all playback state
        setVideoFinished(false);
        setShowWatchAgainOverlay(false);
        hasScrolledAwayWhileFinishedRef.current = false;

        // Seek to beginning and play
        videoRef.current
          .setStatusAsync({ positionMillis: 0 })
          .then(() => {
            if (videoRef.current) {
              return videoRef.current.playAsync();
            }
          })
          .then(() => {
            console.log("[VideoPlayer] Restart complete:", postId);
          })
          .catch((err) => {
            console.log("[VideoPlayer] Restart error:", err);
          });
      } else if (autoplay && videoRef.current && !hasStartedPlaying) {
        // First time playing - just start
        videoRef.current.playAsync().catch(() => {});
      }
    } else if (!isVisible) {
      // Off-screen - pause immediately AND reset visual state
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }

      // Show thumbnail immediately when going off-screen (not after delay)
      // This prevents the "frozen frame" issue
      setHasFirstFrameRendered(false);

      // Track if we're leaving while video is finished (for auto-restart on return)
      if (videoFinished) {
        hasScrolledAwayWhileFinishedRef.current = true;
        console.log(
          "[VideoPlayer] Scrolled away while finished, will auto-restart on return:",
          postId,
        );
      }

      // Schedule unload after delay (only for feed, not fullscreen)
      if (!isFullscreen) {
        unloadTimeoutRef.current = setTimeout(() => {
          // CRITICAL FIX: Use refs to get CURRENT values, not stale closure values
          // This prevents unloading videos that became visible again during the delay
          // Also prevents unloading videos showing "Watch Again" overlay
          if (
            !isUnmountingRef.current &&
            videoRef.current &&
            !isVisibleRef.current && // Check CURRENT visibility via ref
            !videoFinishedRef.current // Don't unload if showing Watch Again
          ) {
            console.log("[VideoPlayer] Unloading off-screen video:", postId);
            videoRef.current.unloadAsync().catch(() => {});
            setShouldLoad(false);
          } else {
            console.log(
              "[VideoPlayer] Skipping unload - video is visible or showing Watch Again:",
              postId,
            );
          }
        }, UNLOAD_DELAY_MS);
      }
    }

    return () => clearTimeout(unloadTimeoutRef.current);
  }, [
    isVisible,
    autoplay,
    videoFinished,
    isFullscreen,
    shouldLoad,
    postId,
    hasStartedPlaying,
  ]);

  // Re-load video when becoming visible again after unload
  useEffect(() => {
    if (isVisible && !shouldLoad && !isUnmountingRef.current) {
      console.log(
        "[VideoPlayer] Re-loading video after off-screen unload:",
        postId,
      );
      setShouldLoad(true);
      setIsLoading(true);
      setHasFirstFrameRendered(false); // Reset so thumbnail shows until first frame
      // Reset all playback state for fresh start
      setVideoFinished(false);
      setShowWatchAgainOverlay(false);
      setHasStartedPlaying(false); // Reset so didJustFinish check works correctly
      hasNotifiedPlaybackRef.current = false; // Reset playback notification
    }
  }, [isVisible, shouldLoad, postId]);

  // Handle playback status updates - MANUAL LOOP CONTROL
  const handlePlaybackStatusUpdate = useCallback(
    (status) => {
      if (!status.isLoaded) return;

      setIsLoading(false);
      setIsPlaying(status.isPlaying);

      // Mark that video has started playing at least once
      if (status.isPlaying && !hasStartedPlaying) {
        setHasStartedPlaying(true);
      }

      // Notify parent of playback state for qualified view tracking
      if (status.isPlaying && !hasNotifiedPlaybackRef.current) {
        hasNotifiedPlaybackRef.current = true;
        onPlaybackStart?.(true);
      } else if (!status.isPlaying && hasNotifiedPlaybackRef.current) {
        onPlaybackStart?.(false);
      }

      // CRITICAL: Handle video completion - MANUAL LOOP
      // SAFEGUARD: Only process didJustFinish if this VideoPlayer instance
      // actually played the video (hasStartedPlaying). This prevents stale
      // "finished" events from expo-av's cached position when a different
      // instance (e.g., Profile screen) finished the same video.
      if (status.didJustFinish && hasStartedPlaying) {
        console.log(
          "[VideoPlayer] Video finished, isFullscreen:",
          isFullscreen,
        );
        onVideoEnd?.();

        if (isFullscreen) {
          // Fullscreen: Auto-loop by replaying
          videoRef.current?.replayAsync().catch(() => {});
        } else {
          // Feed view: Show "Watch Again" overlay
          setVideoFinished(true);
          setShowWatchAgainOverlay(true);
          setShowPlayButton(false);
        }
      }
    },
    [onPlaybackStart, onVideoEnd, isFullscreen, hasStartedPlaying],
  );

  const handleLoad = useCallback(
    (status) => {
      setIsLoading(false);
      if (onLoad) onLoad(status);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (error) => {
      console.error("[VideoPlayer] Error loading video:", error);
      setIsLoading(false);
      if (onError) onError(error);
    },
    [onError],
  );

  // Watch Again handler
  const handleWatchAgain = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      console.log("[VideoPlayer] Watch Again triggered");
      setShowWatchAgainOverlay(false);
      setVideoFinished(false);
      // NOTE: Don't set loading state - video is already loaded, just seeking to beginning
      // Setting isLoading here caused unnecessary UI flash and perceived delay

      // Replay from beginning
      await videoRef.current.setPositionAsync(0);
      await videoRef.current.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error("[VideoPlayer] Watch Again error:", error);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
        setShowPlayButton(true);
      } else {
        // If video finished, restart from beginning
        if (videoFinished) {
          await videoRef.current.setPositionAsync(0);
          setVideoFinished(false);
          setShowWatchAgainOverlay(false);
        }
        await videoRef.current.playAsync();
        setIsPlaying(true);
        setShowPlayButton(false);
      }
    } catch (error) {
      console.error("[VideoPlayer] Toggle play/pause error:", error);
    }
  }, [videoFinished]);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const newMuted = !isMuted;
      await videoRef.current.setIsMutedAsync(newMuted);
      setIsMuted(newMuted);

      if (!newMuted) {
        onUnmute?.();
      }
    } catch (error) {
      console.error("[VideoPlayer] Toggle mute error:", error);
    }
  }, [isMuted, onUnmute]);

  const handleFullscreen = useCallback(() => {
    onFullscreen?.();
    onPress?.();
  }, [onFullscreen, onPress]);

  const handleOverlayPress = useCallback(() => {
    // If Watch Again overlay is showing, trigger replay
    if (showWatchAgainOverlay) {
      handleWatchAgain();
      return;
    }

    // If paused, play
    if (!isPlaying || showPlayButton) {
      togglePlayPause();
    } else if (onPress) {
      // If playing, execute custom onPress (e.g., fullscreen)
      onPress();
    } else {
      togglePlayPause();
    }
  }, [
    showWatchAgainOverlay,
    handleWatchAgain,
    isPlaying,
    showPlayButton,
    togglePlayPause,
    onPress,
  ]);

  const videoHeight = containerWidth / aspectRatio;

  // Calculate video transform based on cropMetadata

  // Helper function to generate thumbnail URL from video URL
  const getThumbnailUrl = (videoSource) => {
    if (typeof videoSource !== "string") return null;

    // For Cloudinary videos, we can generate thumbnail by appending transformation
    if (videoSource.includes("cloudinary.com")) {
      // Extract the video URL and insert transformation to get first frame
      // Format: /upload/so_0/ gets the frame at 0 seconds
      const transformedUrl = videoSource.replace(
        "/upload",
        "/upload/so_0,f_jpg,q_auto",
      );
      return transformedUrl;
    }

    // For other sources, we'll use a generic approach - return the video URL
    // The poster frame will be extracted by the native video player
    return videoSource;
  };

  // Apply optimizations to the video source
  // Source may be HLS URL (.m3u8) or fallback MP4
  const optimizedSource = source;

  // Use prop thumbnail if provided, otherwise generate from source
  // Prop thumbnail is preferred (optimized by backend)
  const thumbnailUrl = propThumbnailUrl || getThumbnailUrl(source);

  // CRITICAL FIX: Only apply transforms when user actually panned/zoomed
  // Check for hasUserCrop flag OR detect non-default values
  const hasUserCrop =
    cropMetadata?.hasUserCrop ||
    (cropMetadata &&
      (cropMetadata.scale !== 1 ||
        Math.abs(cropMetadata.translateX || 0) > 0.5 ||
        Math.abs(cropMetadata.translateY || 0) > 0.5));

  // Only apply transforms if user actually modified the crop
  const videoTransform = hasUserCrop
    ? [
        { scale: cropMetadata.scale || 1 },
        { translateX: cropMetadata.translateX || 0 },
        { translateY: cropMetadata.translateY || 0 },
      ]
    : [];

  // Use CONTAIN for user-cropped videos (to show the cropped view properly)
  // Use COVER for natural videos (fills container without transforms)
  const videoResizeMode = hasUserCrop ? ResizeMode.CONTAIN : ResizeMode.COVER;

  // Show thumbnail when video is unloaded (Instagram-style)
  if (!shouldLoad) {
    return (
      <View
        style={[
          styles.container,
          { width: containerWidth, height: videoHeight },
          style,
        ]}
      >
        {/* Show thumbnail image instead of loading the full video */}
        {thumbnailUrl ? (
          <>
            <Image
              source={{ uri: thumbnailUrl }}
              style={[
                styles.video,
                hasUserCrop && { transform: videoTransform },
              ]}
              resizeMode={hasUserCrop ? "contain" : "cover"}
            />
            {/* Clean thumbnail without play icon - Instagram style */}
          </>
        ) : (
          // Fallback: show black background
          <View style={styles.thumbnailFallback} />
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: containerWidth, height: videoHeight },
        style,
      ]}
    >
      <Video
        ref={videoRef}
        source={typeof source === "string" ? { uri: source } : source}
        style={[styles.video, hasUserCrop && { transform: videoTransform }]}
        resizeMode={videoResizeMode}
        isLooping={false} // MANUAL LOOP - handled in handlePlaybackStatusUpdate
        isMuted={isMuted}
        shouldPlay={autoplay && isVisible && !videoFinished}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoad={handleLoad}
        onError={handleError}
        useNativeControls={false}
        // CRITICAL OPTIMIZATIONS for faster loading
        progressUpdateIntervalMillis={250} // More frequent updates
        usePoster={false} // Don't wait for poster
        posterSource={thumbnailUrl ? { uri: thumbnailUrl } : undefined} // Show thumbnail immediately
        posterStyle={{ resizeMode: hasUserCrop ? "contain" : "cover" }}
        // Preload video content aggressively for smoother playback
        // This is especially important for tall videos which have more data
        preferredForwardBufferDuration={5} // Buffer 5 seconds ahead (default is 0)
        onReadyForDisplay={() => {
          // CRITICAL: Video's first frame is now rendered and visible
          // Only NOW should we hide the thumbnail overlay
          console.log(
            "[VideoPlayer] Ready for display (first frame rendered):",
            postId,
          );
          setHasFirstFrameRendered(true);
          setIsLoading(false); // Hide spinner as soon as first frame is ready
        }}
      />

      {/* Thumbnail Overlay - remains visible until first video frame renders */}
      {/* This prevents black frame flash during decoder warmup */}
      {shouldLoad && thumbnailUrl && !hasFirstFrameRendered && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={[
            styles.thumbnailOverlay,
            hasUserCrop && { transform: videoTransform },
          ]}
          resizeMode={hasUserCrop ? "contain" : "cover"}
        />
      )}

      {/* Tap overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        {/* Loading indicator - only show when actively loading (not just waiting) */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Play button (shown when paused, not when Watch Again visible) */}
        {showPlayButton && !isLoading && !showWatchAgainOverlay && (
          <View style={styles.playButtonContainer}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="#fff" />
            </View>
          </View>
        )}

        {/* Watch Again Overlay - Instagram-style */}
        {showWatchAgainOverlay && !isLoading && (
          <View style={styles.watchAgainOverlay}>
            <View style={styles.watchAgainButton}>
              <RotateCcw size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.watchAgainText}>Watch again</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Controls overlay */}
      {showControls && !showWatchAgainOverlay && (
        <View style={styles.controlsContainer}>
          {/* Mute button */}
          <TouchableOpacity
            style={styles.muteButton}
            onPress={toggleMute}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 4,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  controlsContainer: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
  },
  muteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Watch Again Overlay Styles
  watchAgainOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  watchAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    gap: 8,
  },
  watchAgainText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  // Thumbnail overlay - covers video surface until first frame renders
  thumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1, // Above video, below controls
  },
  thumbnailPlayIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 6,
  },
  thumbnailFallback: {
    flex: 1,
    backgroundColor: "#000",
  },
});

// Memoize to prevent unnecessary re-renders
export default memo(VideoPlayer);
