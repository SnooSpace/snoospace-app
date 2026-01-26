/**
 * VideoPlayer Component
 * Reusable video player with autoplay, mute toggle, and viewport-aware pausing.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const VideoPlayer = ({
  source,
  style,
  aspectRatio = 1,
  autoplay = true,
  muted = true,
  loop = true,
  showControls = true,
  isVisible = true, // Parent should manage this based on viewport
  onLoad,
  onError,
  onPress, // NEW: Callback when video is tapped (for fullscreen)
  containerWidth = SCREEN_WIDTH,
  cropMetadata, // NEW: Crop metadata for pan/zoom transformations
  // Qualified view tracking callbacks
  onUnmute,
  onPlaybackStart,
  onFullscreen,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(!autoplay);
  const hasNotifiedPlaybackRef = useRef(false);

  // Handle visibility changes (for feed scrolling)
  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && isPlaying) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isVisible, isPlaying]);

  const handlePlaybackStatusUpdate = useCallback(
    (status) => {
      if (status.isLoaded) {
        setIsLoading(false);
        setIsPlaying(status.isPlaying);

        // Notify parent when playback starts (for qualified view tracking)
        if (status.isPlaying && !hasNotifiedPlaybackRef.current) {
          hasNotifiedPlaybackRef.current = true;
          onPlaybackStart?.(true);
        } else if (!status.isPlaying && hasNotifiedPlaybackRef.current) {
          onPlaybackStart?.(false);
        }
      }
    },
    [onPlaybackStart],
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

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
        setShowPlayButton(true);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
        setShowPlayButton(false);
      }
    } catch (error) {
      console.error("[VideoPlayer] Toggle play/pause error:", error);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const newMuted = !isMuted;
      await videoRef.current.setIsMutedAsync(newMuted);
      setIsMuted(newMuted);

      // Notify parent when unmuted (for qualified view tracking)
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

  const videoHeight = containerWidth / aspectRatio;

  // Calculate video transform based on cropMetadata
  const videoTransform = cropMetadata
    ? [
        { scale: cropMetadata.scale || 1 },
        { translateX: cropMetadata.translateX || 0 },
        { translateY: cropMetadata.translateY || 0 },
      ]
    : [];

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
        isLooping={loop}
        isMuted={isMuted}
        shouldPlay={autoplay && isVisible}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoad={handleLoad}
        onError={handleError}
        useNativeControls={false}
      />

      {/* Tap overlay - opens fullscreen if onPress provided, otherwise toggle play/pause */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onPress || togglePlayPause}
      >
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Play button (shown when not playing, for tap-to-play editorial style) */}
        {showPlayButton && !isLoading && (
          <View style={styles.playButtonContainer}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="#fff" />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Controls overlay */}
      {showControls && (
        <View style={styles.controlsContainer}>
          {/* Expand button (for fullscreen, shown when onPress provided) */}
          {onPress && (
            <TouchableOpacity
              style={[styles.muteButton, { marginRight: 8 }]}
              onPress={handleFullscreen}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="expand" size={18} color="#fff" />
            </TouchableOpacity>
          )}
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
    paddingLeft: 4, // Offset play icon for visual centering
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
});

export default VideoPlayer;
