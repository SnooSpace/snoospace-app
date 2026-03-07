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
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { View, TouchableOpacity, StyleSheet, Dimensions, Text, Image } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { RotateCcw } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoContext } from "../context/VideoContext";
import SnooLoader from "./ui/SnooLoader";

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
  cropMetadata,
  onUnmute,
  onPlaybackStart,
  onFullscreen,
  postId,
  thumbnailUrl: propThumbnailUrl,
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

  // expo-video player
  const player = useVideoPlayer(
    shouldLoad && source ? (typeof source === "string" ? { uri: source } : source) : null,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(unloadTimeoutRef.current);
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
        onPlaybackStart?.(false);
      }
    });

    return () => {
      statusSub?.remove();
      playingSub?.remove();
    };
  }, [player, hasStartedPlaying, onLoad, onError, onPlaybackStart]);

  // Subscribe to playback end
  useEffect(() => {
    if (!player) return;

    const endedSub = player.addListener("playToEnd", () => {
      if (!hasStartedPlaying) return;
      onVideoEnd?.();

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
      if (autoplay && hasStartedPlaying) {
        setVideoFinished(false);
        setShowWatchAgainOverlay(false);
        hasScrolledAwayWhileFinishedRef.current = false;
        player.currentTime = 0;
        player.play();
      } else if (autoplay && !hasStartedPlaying) {
        player.play();
      }
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
    if (!isPlaying || showPlayButton) {
      togglePlayPause();
    } else if (onPress) {
      onPress();
    } else {
      togglePlayPause();
    }
  }, [showWatchAgainOverlay, handleWatchAgain, isPlaying, showPlayButton, togglePlayPause, onPress]);

  const getThumbnailUrl = (videoSource) => {
    if (typeof videoSource !== "string") return null;
    if (videoSource.includes("cloudinary.com")) {
      return videoSource.replace("/upload", "/upload/so_0,f_jpg,q_auto");
    }
    return videoSource;
  };

  const thumbnailUrl = propThumbnailUrl || getThumbnailUrl(source);

  const hasUserCrop =
    cropMetadata?.hasUserCrop ||
    (cropMetadata &&
      (cropMetadata.scale !== 1 ||
        Math.abs(cropMetadata.translateX || 0) > 0.5 ||
        Math.abs(cropMetadata.translateY || 0) > 0.5));

  const videoTransform = hasUserCrop
    ? [
        { scale: cropMetadata.scale || 1 },
        { translateX: cropMetadata.translateX || 0 },
        { translateY: cropMetadata.translateY || 0 },
      ]
    : [];

  const videoHeight = containerWidth / aspectRatio;

  // Show thumbnail when unloaded
  if (!shouldLoad) {
    return (
      <View style={[styles.container, { width: containerWidth, height: videoHeight }, style]}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={[styles.video, hasUserCrop && { transform: videoTransform }]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.thumbnailFallback} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: videoHeight }, style]}>
      <VideoView
        ref={videoRef}
        player={player}
        style={[styles.video, hasUserCrop && { transform: videoTransform }]}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => {
          setHasFirstFrameRendered(true);
          setIsLoading(false);
        }}
      />

      {/* Thumbnail overlay until first frame renders */}
      {shouldLoad && thumbnailUrl && !hasFirstFrameRendered && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={[styles.thumbnailOverlay, hasUserCrop && { transform: videoTransform }]}
          resizeMode="contain"
        />
      )}

      {/* Tap overlay */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleOverlayPress}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color="#fff" />
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
      </TouchableOpacity>

      {/* Controls */}
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
    zIndex: 1,
  },
  thumbnailFallback: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default memo(VideoPlayer);
