/**
 * FullscreenVideoModal Component
 * Instagram-style fullscreen video player with controls and seek functionality.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const formatTime = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return "0:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const FullscreenVideoModal = ({
  visible,
  source,
  onClose,
  initialMuted = false,
  initialPosition = 0,
  aspectRatio = 16 / 9,
  cropMetadata, // NEW: Crop metadata for pan/zoom transformations
}) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(initialPosition);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef(null);

  // Auto-hide controls after 3 seconds
  const startHideControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isSeeking) {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }
    }, 3000);
  }, [isPlaying, isSeeking, controlsOpacity]);

  // Show controls
  const showControlsWithTimeout = useCallback(() => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    startHideControlsTimer();
  }, [controlsOpacity, startHideControlsTimer]);

  // Handle screen tap
  const handlePress = useCallback(() => {
    if (showControls) {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    } else {
      showControlsWithTimeout();
    }
  }, [showControls, controlsOpacity, showControlsWithTimeout]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  // Start auto-hide timer when controls are shown
  useEffect(() => {
    if (showControls && isPlaying && !isSeeking) {
      startHideControlsTimer();
    }
  }, [showControls, isPlaying, isSeeking, startHideControlsTimer]);

  // CRITICAL: Cleanup video on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Set initial position when modal opens, cleanup when it closes
  useEffect(() => {
    if (visible && videoRef.current && initialPosition > 0) {
      videoRef.current.setPositionAsync(initialPosition);
    } else if (!visible && videoRef.current) {
      // Cleanup when modal closes
      videoRef.current.unloadAsync().catch(() => {});
    }
  }, [visible, initialPosition]);

  const handlePlaybackStatusUpdate = useCallback(
    (status) => {
      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
        if (!isSeeking) {
          setPosition(status.positionMillis || 0);
        }
        setIsPlaying(status.isPlaying);
      }
    },
    [isSeeking],
  );

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error("[FullscreenVideo] Toggle play/pause error:", error);
    }
  }, []);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const newMuted = !isMuted;
      await videoRef.current.setIsMutedAsync(newMuted);
      setIsMuted(newMuted);
    } catch (error) {
      console.error("[FullscreenVideo] Toggle mute error:", error);
    }
  }, [isMuted]);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
  }, []);

  const handleSeekComplete = useCallback(
    async (value) => {
      setIsSeeking(false);
      if (!videoRef.current) return;

      try {
        const seekPosition = value * duration;
        await videoRef.current.setPositionAsync(seekPosition);
        setPosition(seekPosition);
        startHideControlsTimer();
      } catch (error) {
        console.error("[FullscreenVideo] Seek error:", error);
      }
    },
    [duration, startHideControlsTimer],
  );

  const handleClose = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    onClose();
  }, [onClose]);

  const progressValue = duration > 0 ? position / duration : 0;

  // Calculate video dimensions to fit screen while maintaining aspect ratio
  const videoWidth = SCREEN_WIDTH;
  const videoHeight = Math.min(SCREEN_WIDTH / aspectRatio, SCREEN_HEIGHT * 0.7);

  // Calculate video transform based on cropMetadata
  const videoTransform = cropMetadata
    ? [
        { scale: cropMetadata.scale || 1 },
        { translateX: cropMetadata.translateX || 0 },
        { translateY: cropMetadata.translateY || 0 },
      ]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Video */}
        <TouchableWithoutFeedback onPress={handlePress}>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={typeof source === "string" ? { uri: source } : source}
              style={[
                styles.video,
                { width: videoWidth, height: videoHeight },
                cropMetadata && { transform: videoTransform },
              ]}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              isMuted={isMuted}
              shouldPlay={visible}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              useNativeControls={false}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Controls Overlay */}
        {showControls && (
          <Animated.View
            style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
            pointerEvents="box-none"
          >
            {/* Header with close button */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Center play/pause button */}
            <TouchableOpacity
              style={styles.centerButton}
              onPress={togglePlayPause}
              activeOpacity={0.8}
            >
              <View style={styles.playButton}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={48}
                  color="#fff"
                  style={!isPlaying && { marginLeft: 6 }}
                />
              </View>
            </TouchableOpacity>

            {/* Footer with progress bar and mute */}
            <View
              style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}
            >
              {/* Time display */}
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  value={progressValue}
                  onSlidingStart={handleSeekStart}
                  onSlidingComplete={handleSeekComplete}
                  minimumValue={0}
                  maximumValue={1}
                  minimumTrackTintColor="#fff"
                  maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                  thumbTintColor="#fff"
                />
              </View>

              {/* Mute button */}
              <TouchableOpacity
                style={styles.muteButton}
                onPress={toggleMute}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isMuted ? "volume-mute" : "volume-high"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    backgroundColor: "#000",
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  centerButton: {
    alignSelf: "center",
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: 16,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  sliderContainer: {
    marginBottom: 12,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  muteButton: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default FullscreenVideoModal;
