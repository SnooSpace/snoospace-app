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
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { RotateCcw } from "lucide-react-native";
import { useVideoContext } from "../context/VideoContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// How long to wait before unloading off-screen video (ms)
const UNLOAD_DELAY_MS = 3000;

const VideoPlayer = ({
  source,
  style,
  aspectRatio = 1,
  autoplay = true,
  muted = true,
  loop = true, // For feed: controlled manually. For fullscreen: native loop
  showControls = true,
  isVisible = true, // Parent manages via viewability
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
}) => {
  const videoRef = useRef(null);
  const { isVideoActive, registerVideo } = useVideoContext();

  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(true); // Controls if video is loaded

  // "Watch Again" state - only for feed view (non-fullscreen)
  const [videoFinished, setVideoFinished] = useState(false);
  const [showWatchAgainOverlay, setShowWatchAgainOverlay] = useState(false);

  // Play button state (for non-autoplay or paused state)
  const [showPlayButton, setShowPlayButton] = useState(!autoplay);

  // Tracking refs
  const hasNotifiedPlaybackRef = useRef(false);
  const unloadTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);

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

  // Handle visibility changes with aggressive off-screen unloading
  useEffect(() => {
    // Clear any pending unload when visibility changes
    clearTimeout(unloadTimeoutRef.current);

    if (isVisible && shouldLoad) {
      // Visible - play if autoplay enabled and not finished
      if (autoplay && !videoFinished && videoRef.current) {
        videoRef.current.playAsync().catch(() => {});
      }
    } else if (!isVisible) {
      // Off-screen - pause immediately
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }

      // Schedule unload after delay (only for feed, not fullscreen)
      if (!isFullscreen) {
        unloadTimeoutRef.current = setTimeout(() => {
          if (!isUnmountingRef.current && videoRef.current && !isVisible) {
            console.log("[VideoPlayer] Unloading off-screen video:", postId);
            videoRef.current.unloadAsync().catch(() => {});
            setShouldLoad(false);
          }
        }, UNLOAD_DELAY_MS);
      }
    }

    return () => clearTimeout(unloadTimeoutRef.current);
  }, [isVisible, autoplay, videoFinished, isFullscreen, shouldLoad, postId]);

  // Re-load video when becoming visible again after unload
  useEffect(() => {
    if (isVisible && !shouldLoad && !isUnmountingRef.current) {
      console.log(
        "[VideoPlayer] Re-loading video after off-screen unload:",
        postId,
      );
      setShouldLoad(true);
      setIsLoading(true);
      // Reset finished state so video can play again
      setVideoFinished(false);
      setShowWatchAgainOverlay(false);
    }
  }, [isVisible, shouldLoad, postId]);

  // Handle playback status updates - MANUAL LOOP CONTROL
  const handlePlaybackStatusUpdate = useCallback(
    (status) => {
      if (!status.isLoaded) return;

      setIsLoading(false);
      setIsPlaying(status.isPlaying);

      // Notify parent of playback state for qualified view tracking
      if (status.isPlaying && !hasNotifiedPlaybackRef.current) {
        hasNotifiedPlaybackRef.current = true;
        onPlaybackStart?.(true);
      } else if (!status.isPlaying && hasNotifiedPlaybackRef.current) {
        onPlaybackStart?.(false);
      }

      // CRITICAL: Handle video completion - MANUAL LOOP
      if (status.didJustFinish) {
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
    [onPlaybackStart, onVideoEnd, isFullscreen],
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
      setIsLoading(true);

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
  const videoTransform = cropMetadata
    ? [
        { scale: cropMetadata.scale || 1 },
        { translateX: cropMetadata.translateX || 0 },
        { translateY: cropMetadata.translateY || 0 },
      ]
    : [];

  // Don't render Video if unloaded
  if (!shouldLoad) {
    return (
      <View
        style={[
          styles.container,
          { width: containerWidth, height: videoHeight },
          style,
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
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
        style={[styles.video, cropMetadata && { transform: videoTransform }]}
        resizeMode={ResizeMode.COVER}
        isLooping={false} // MANUAL LOOP - handled in handlePlaybackStatusUpdate
        isMuted={isMuted}
        shouldPlay={autoplay && isVisible && !videoFinished}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoad={handleLoad}
        onError={handleError}
        useNativeControls={false}
        progressUpdateIntervalMillis={500}
      />

      {/* Tap overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        {/* Loading indicator */}
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
});

// Memoize to prevent unnecessary re-renders
export default memo(VideoPlayer);
