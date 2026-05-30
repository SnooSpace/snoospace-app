/**
 * VideoPlayer Component
 *
 * Production-grade video player with Instagram-like behavior:
 * - Viewport-aware autoplay (plays when visible)
 * - "Watch Again" overlay on completion (feed view only)
 * - Manual loop control for proper resource cleanup
 * - Aggressive off-screen unloading to prevent memory issues
 * - Global coordination via VideoContext
 *
 * Migrated from expo-av → expo-video (SDK 55)
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions, Text, Image, ActivityIndicator } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { RotateCcw } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoContext } from "../context/VideoContext";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { WatchTracker } from "../utils/watchTracker";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const UNLOAD_DELAY_MS = 5000;

const VideoPlayer = ({
  source,
  style,
  aspectRatio = 1,
  autoplay = true,
  muted = true,
  loop = true,
  showControls = true,
  isVisible = true,
  isScreenFocused = true,
  isFullscreen = false,
  onLoad,
  onError,
  onPress,
  onVideoEnd,
  containerWidth = SCREEN_WIDTH,
  onUnmute,
  onPlaybackStart,
  onFullscreen,
  postId,
  thumbnailUrl: propThumbnailUrl,
  lqipUrl = null,          // Low-Quality Image Placeholder (tiny blurred JPEG)
  hlsUrl = null,           // HLS streaming URL (for long videos, feature-flagged)
  durationSeconds = null,  // Video duration from DB (used for HLS threshold)
  shouldPreload = false,   // If true: load+buffer but don't play (feed preloading)
  cropMetadata = null,
  onPositionChange,
  onDoubleTap,
  viewerId = null,       // pass currentUserId so WatchTracker can associate events
  viewSource = 'for_you', // feed context passed from EditorialPostCard
}) => {
  const { isVideoActive, registerVideo } = useVideoContext();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoad, setShouldLoad] = useState(true);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [hasFirstFrameRendered, setHasFirstFrameRendered] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [showWatchAgainOverlay, setShowWatchAgainOverlay] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(!autoplay);

  const hasNotifiedPlaybackRef = useRef(false);
  const unloadTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const hasScrolledAwayWhileFinishedRef = useRef(false);
  const isVisibleRef = useRef(isVisible);
  const videoFinishedRef = useRef(videoFinished);

  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
  useEffect(() => { videoFinishedRef.current = videoFinished; }, [videoFinished]);

  // ── HLS preference for long videos ─────────────────────────────────────
  // Use HLS for videos >15s when the backend provides an HLS URL (feature-flagged).
  // Falls back to raw MP4 if HLS isn’t available.
  const effectiveSource = (hlsUrl && durationSeconds > 15) ? hlsUrl : source;

  // expo-video player
  const shouldCreatePlayer = shouldLoad || shouldPreload;
  const player = useVideoPlayer(
    shouldCreatePlayer && effectiveSource ? (typeof effectiveSource === "string" ? { uri: effectiveSource } : effectiveSource) : null,
    (p) => {
      p.muted = isMuted;
      p.loop = false; // manual loop
    }
  );

  const videoRef = useRef(null);

  // Register with VideoContext
  useEffect(() => {
    if (postId) {
      return registerVideo(postId, videoRef);
    }
  }, [postId, registerVideo]);

  // Cleanup on unmount — stop WatchTracker so an exit event is fired
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(unloadTimeoutRef.current);
      WatchTracker.stop();
    };
  }, []);

  // Subscribe to player status events
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        setIsLoading(false);
        setHasFirstFrameRendered(true);
        if (onLoad) onLoad(status);
      } else if (status.status === "error") {
        setIsLoading(false);
        if (onError) onError(status.error);
      }
    });

    const playingSub = player.addListener("playingChange", (isNowPlaying) => {
      setIsPlaying(isNowPlaying);

      if (isNowPlaying && !hasStartedPlaying) {
        setHasStartedPlaying(true);
      }

      if (isNowPlaying && !hasNotifiedPlaybackRef.current) {
        hasNotifiedPlaybackRef.current = true;
        onPlaybackStart?.(true);
      } else if (!isNowPlaying && hasNotifiedPlaybackRef.current) {
        hasNotifiedPlaybackRef.current = false; // reset so next play session fires again
        onPlaybackStart?.(false);
      }
    });

    return () => {
      statusSub?.remove();
      playingSub?.remove();
    };
  }, [player, hasStartedPlaying, onLoad, onError, onPlaybackStart]);

  // Report position to parent for fullscreen seek sync (500ms throttle is sufficient)
  useEffect(() => {
    if (!player || !onPositionChange) return;
    const interval = setInterval(() => {
      if (player.duration > 0) {
        onPositionChange(player.currentTime);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player, onPositionChange]);

  // Subscribe to playback end
  useEffect(() => {
    if (!player) return;

    const endedSub = player.addListener("playToEnd", () => {
      if (!hasStartedPlaying) return;
      onVideoEnd?.();
      WatchTracker.complete();

      if (isFullscreen) {
        player.replay();
      } else {
        setVideoFinished(true);
        setShowWatchAgainOverlay(true);
        setShowPlayButton(false);
      }
    });

    return () => endedSub?.remove();
  }, [player, hasStartedPlaying, isFullscreen, onVideoEnd]);

  // Screen focus handling
  useEffect(() => {
    if (!isScreenFocused && !isFullscreen) {
      clearTimeout(unloadTimeoutRef.current);
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
      setShouldLoad(true);
      setIsLoading(true);
    }
  }, [isScreenFocused, isFullscreen]);

  // Visibility / autoplay handling
  useEffect(() => {
    if (!player) return;
    clearTimeout(unloadTimeoutRef.current);

    if (isVisible && shouldLoad) {
      if (autoplay && !hasStartedPlaying) {
        // ── First time entering viewport → play from the start
        player.play();
      } else if (autoplay && hasStartedPlaying && !videoFinished) {
        // ── Returning mid-playback (scrolled away and back) → just resume.
        // Do NOT reset currentTime — player already holds the correct position.
        player.play();
      } else if (autoplay && hasStartedPlaying && videoFinished) {
        // ── Returning after the video already ended → re-show Watch Again.
        // Never auto-replay; let the user decide.
        setShowWatchAgainOverlay(true);
      }
      // If videoFinished and overlay already visible, do nothing.
    } else if (shouldPreload && !isVisible) {
      // ── Preloading: player is created and buffering, but don’t play.
      // The player will pre-download the first few seconds so playback
      // starts instantly when the user scrolls to this post.
      // Don’t unload — the preloadConfig memory cap already limits how
      // many videos are in this state.
    } else if (!isVisible) {
      player.pause();

      if (videoFinished) {
        hasScrolledAwayWhileFinishedRef.current = true;
      }

      if (!isFullscreen) {
        unloadTimeoutRef.current = setTimeout(() => {
          if (
            !isUnmountingRef.current &&
            !isVisibleRef.current &&
            !videoFinishedRef.current
          ) {
            setShouldLoad(false);
            setHasFirstFrameRendered(false);
          }
        }, UNLOAD_DELAY_MS);
      }
    }

    return () => clearTimeout(unloadTimeoutRef.current);
  }, [isVisible, autoplay, videoFinished, isFullscreen, shouldLoad, postId, hasStartedPlaying, player]);

  // ── WatchTracker: start/stop on visibility ───────────────────────────────
  // Only track in the feed view (not fullscreen) to avoid double-counting.
  useEffect(() => {
    if (isFullscreen || !postId) return;
    if (isVisible && isPlaying) {
      // Pass current player.duration (seconds) for completionRatio calculation
      const durationSec = player?.duration ?? 0;
      WatchTracker.start(postId, viewerId, viewSource, durationSec);
    } else if (!isVisible) {
      WatchTracker.stop();
    }
  }, [isVisible, isPlaying, isFullscreen, postId, viewerId, viewSource, player]);

  // Re-load after off-screen unload
  useEffect(() => {
    if (isVisible && !shouldLoad && !isUnmountingRef.current) {
      setShouldLoad(true);
      setIsLoading(true);
      setHasFirstFrameRendered(false);
      setVideoFinished(false);
      setShowWatchAgainOverlay(false);
      setHasStartedPlaying(false);
      hasNotifiedPlaybackRef.current = false;
    }
  }, [isVisible, shouldLoad]);

  // Sync muted prop from parent to local state
  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  // Sync mute state to player
  useEffect(() => {
    if (player) player.muted = isMuted;
  }, [player, isMuted]);

  const handleWatchAgain = useCallback(async () => {
    if (!player) return;
    setShowWatchAgainOverlay(false);
    setVideoFinished(false);
    player.currentTime = 0;
    player.play();
    setIsPlaying(true);
    WatchTracker.replay();
  }, [player]);

  const togglePlayPause = useCallback(async () => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      setShowPlayButton(true);
    } else {
      if (videoFinished) {
        player.currentTime = 0;
        setVideoFinished(false);
        setShowWatchAgainOverlay(false);
      }
      player.play();
      setIsPlaying(true);
      setShowPlayButton(false);
    }
  }, [player, isPlaying, videoFinished]);

  const toggleMute = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (!newMuted) {
      onUnmute?.();
    }
  }, [isMuted, onUnmute]);

  const handleFullscreen = useCallback(() => {
    onFullscreen?.();
    onPress?.();
  }, [onFullscreen, onPress]);

  const handleOverlayPress = useCallback(() => {
    if (showWatchAgainOverlay) {
      handleWatchAgain();
      return;
    }
    // Tapping a playing video with a fullscreen handler → open fullscreen
    if (isPlaying && onFullscreen && !showPlayButton) {
      handleFullscreen();
      return;
    }
    if (!isPlaying || showPlayButton) {
      togglePlayPause();
    } else if (onPress) {
      onPress();
    } else {
      togglePlayPause();
    }
  }, [showWatchAgainOverlay, handleWatchAgain, isPlaying, showPlayButton, togglePlayPause, onPress, onFullscreen, handleFullscreen]);

  const getThumbnailUrl = (videoSource) => {
    if (typeof videoSource !== "string") return null;
    if (videoSource.includes("cloudinary.com")) {
      return videoSource.replace("/upload", "/upload/so_auto,f_jpg,q_auto");
    }
    return videoSource;
  };

  const thumbnailUrl = propThumbnailUrl || getThumbnailUrl(source);

  const videoHeight = containerWidth / aspectRatio;

  // ── Client-side crop transforms ──────────────────────────────────────────
  // Cloudinary free tier can't re-encode cropped videos on-the-fly,
  // so we play the raw MP4 and replicate the crop visually using
  // scale + translate + overflow:hidden — exactly like the CropView preview.
  const cropStyle = useMemo(() => {
    if (!cropMetadata || !cropMetadata.hasUserCrop) return null;

    const {
      scale = 1,
      translateX = 0,
      translateY = 0,
      displayWidth,
      displayHeight,
      aspectRatio: presetAR,
    } = cropMetadata;

    if (!displayWidth || !displayHeight) return null;

    // frameHeight = the visible crop window height in CropView coords
    let frameHeight;
    if (Array.isArray(presetAR) && presetAR[0] > 0 && presetAR[1] > 0) {
      frameHeight = displayWidth * (presetAR[1] / presetAR[0]);
    } else {
      frameHeight = displayHeight;
    }

    // Map CropView dimensions → card container dimensions
    const containerH = videoHeight; // already sized for cropped AR
    const mapX = containerWidth / displayWidth;
    const mapY = containerH / frameHeight;

    // The video view size = original video display size scaled by user zoom,
    // then mapped to the card coordinate system
    const videoW = displayWidth * scale * mapX;
    const videoH = displayHeight * scale * mapY;

    // Centre of the video in card coords, plus the user's pan offset
    const tx = translateX * mapX;
    const ty = translateY * mapY;

    // Offset so the visible frame aligns with the container
    const offsetX = (videoW - containerWidth) / 2;
    const offsetY = (videoH - containerH) / 2;

    return {
      width: videoW,
      height: videoH,
      transform: [
        { translateX: -offsetX + tx },
        { translateY: -offsetY + ty },
      ],
    };
  }, [cropMetadata, containerWidth, videoHeight]);

  // ── Gestures ─────────────────────────────────────────────────────────────
  const singleTap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(handleOverlayPress)();
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onStart((e) => {
      if (onDoubleTap) {
        runOnJS(onDoubleTap)(e);
      }
    });

  const taps = Gesture.Exclusive(doubleTapGesture, singleTap);

  // Show thumbnail when unloaded
  if (!shouldLoad) {
    return (
      <View style={[styles.container, { width: containerWidth, height: videoHeight }, style]}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.video}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailFallback} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: videoHeight }, style]}>
      {/* Client-side crop: the VideoView is scaled up and translated so
          the container's overflow:hidden clips to the user's chosen frame. */}
      <VideoView
        ref={videoRef}
        player={player}
        style={cropStyle ? [{ position: 'absolute' }, cropStyle] : styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => {
          setHasFirstFrameRendered(true);
          setIsLoading(false);
        }}
      />

      {/* LQIP: ultra-low-res blurred placeholder — loads instantly (~2KB) */}
      {shouldLoad && lqipUrl && !hasFirstFrameRendered && (
        <Image
          source={{ uri: lqipUrl }}
          style={styles.lqipImage}
          blurRadius={20}
          resizeMode="cover"
        />
      )}

      {/* Thumbnail overlay until first frame renders */}
      {shouldLoad && thumbnailUrl && !hasFirstFrameRendered && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnailOverlay}
          resizeMode="cover"
        />
      )}

      {/* Tap overlay */}
      <GestureDetector gesture={taps}>
        <View style={styles.overlay}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {showPlayButton && !isLoading && !showWatchAgainOverlay && (
            <View style={styles.playButtonContainer}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={32} color="#fff" />
              </View>
            </View>
          )}

          {showWatchAgainOverlay && !isLoading && (
            <View style={styles.watchAgainOverlay}>
              <View style={styles.watchAgainButton}>
                <RotateCcw size={20} color="#fff" strokeWidth={2.5} />
                <Text style={styles.watchAgainText}>Watch again</Text>
              </View>
            </View>
          )}
        </View>
      </GestureDetector>

      {/* Controls: mute only (fullscreen opens via tap when playing) */}
      {showControls && !showWatchAgainOverlay && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.muteButton}
            onPress={toggleMute}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
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
  thumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  lqipImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  thumbnailFallback: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default memo(VideoPlayer);
