import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Modal, Dimensions, TouchableOpacity, Text, Image, FlatList, Pressable, ActivityIndicator } from "react-native";
import { X, Play, Pause, RotateCcw } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// Card dimensions — matches Instagram's chat media viewer
const CARD_W         = SCREEN_W - 40;           // 20px margin each side
const CARD_MAX_H     = SCREEN_H * 0.7;          // cap so it never touches header/footer
const CARD_MIN_H     = SCREEN_H * 0.35;         // minimum for very wide landscape images
const CARD_RADIUS    = 16;

const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ── Dispatcher ─────────────────────────────────────────────────────────────
function MediaItem({ item, isActive, onPress }) {
  if (item.type === "video") {
    return <VideoItem item={item} isActive={isActive} onPress={onPress} />;
  }
  return <ImageItem item={item} onPress={onPress} />;
}

// ── Image item (Instagram-style rounded card) ──────────────────────────────
// Uses pre-computed dimensions from metadata when available for instant sizing.
// Falls back to Image.getSize() for older messages without dimensions.
function ImageItem({ item, onPress }) {
  // Compute initial height from metadata if available
  const initialHeight = (item.width && item.height)
    ? Math.max(CARD_MIN_H, Math.min(CARD_MAX_H, Math.round(CARD_W * (item.height / item.width))))
    : CARD_MAX_H;

  const [cardHeight, setCardHeight] = useState(initialHeight);

  useEffect(() => {
    // Only fetch dimensions if metadata didn't have them
    if (item.width && item.height) return;
    if (!item.uri) return;
    Image.getSize(
      item.uri,
      (w, h) => {
        if (w && h) {
          const ratio = h / w;
          const computed = Math.round(CARD_W * ratio);
          setCardHeight(Math.max(CARD_MIN_H, Math.min(CARD_MAX_H, computed)));
        }
      },
      () => {} // on error, keep default
    );
  }, [item.uri, item.width, item.height]);

  return (
    <View style={styles.mediaContainer}>
      <Pressable
        style={[
          styles.mediaCard,
          { width: CARD_W, height: cardHeight },
        ]}
        onPress={onPress}
      >
        <Image
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Pressable>
    </View>
  );
}

// ── Cloudinary video optimization helpers ──────────────────────────────────
/**
 * Optimizes a Cloudinary video URL for streaming in the fullscreen viewer.
 * - Caps resolution at 720p width (saves bandwidth on 4K source videos)
 * - Uses auto quality (q_auto) — Cloudinary picks the best bitrate
 * - Forces H.264 codec (vc_h264) — hardware-decoded on all devices
 * - Forces MP4 container (f_mp4) — progressive download, no HLS overhead
 * - Strips audio on muted videos (ac_none) to reduce file size
 *
 * A 1080p 30s video at ~8Mbps (~30MB) becomes ~2Mbps (~7.5MB) → 4× faster.
 */
function getOptimizedVideoUrl(rawUrl, muted = false) {
  if (!rawUrl || !rawUrl.includes("cloudinary.com")) return rawUrl;
  const audioFlag = muted ? ",ac_none" : "";
  const transforms = `w_720,q_auto,vc_h264,f_mp4${audioFlag}`;
  return rawUrl.replace("/video/upload/", `/video/upload/${transforms}/`);
}

/**
 * Generates a first-frame JPEG thumbnail from a Cloudinary video URL.
 * Shown as poster behind the VideoView to eliminate perceived loading time.
 */
function getVideoThumbnail(rawUrl) {
  if (!rawUrl || !rawUrl.includes("cloudinary.com")) return null;
  return rawUrl
    .replace("/video/upload/", "/video/upload/so_0,w_720,q_auto:good,f_jpg/")
    .replace(/\.[^./?#]+($|\?)/, ".jpg$1");
}

// ── Video item (Instagram-style, optimized) ────────────────────────────────
// Rounded card with play/pause, progress scrubber, elapsed time, buffering,
// and a "Watch Again" overlay when the video ends.
function VideoItem({ item, isActive, onPress }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [videoFinished, setVideoFinished] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progressInterval = useRef(null);
  const bufferTimerRef = useRef(null);
  const scrubberWidth = useRef(0);

  const isMuted = item.muteAudio ?? item.mute_audio ?? false;
  const optimizedUrl = getOptimizedVideoUrl(item.uri, isMuted);
  const thumbnailUrl = getVideoThumbnail(item.uri);

  const player = useVideoPlayer(optimizedUrl, p => {
    p.loop = false;
    p.muted = isMuted;
  });

  // Listen to player events
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        clearTimeout(bufferTimerRef.current);
        setIsBuffering(false);
        setDuration(player.duration || 0);
      }
    });

    const playingSub = player.addListener("playingChange", (nowPlaying) => {
      setIsPlaying(nowPlaying);
      if (nowPlaying) {
        clearTimeout(bufferTimerRef.current);
        setIsBuffering(false);
      }
    });

    const endSub = player.addListener("playToEnd", () => {
      setIsPlaying(false);
      setVideoFinished(true);
      setCurrentTime(duration);
      clearInterval(progressInterval.current);
    });

    return () => {
      statusSub?.remove();
      playingSub?.remove();
      endSub?.remove();
    };
  }, [player, duration]);

  // Auto-play when this slide is active, pause when swiped away
  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.currentTime = 0;
      setCurrentTime(0);
      setVideoFinished(false);
      // Show buffering only if video doesn't start within 800ms
      bufferTimerRef.current = setTimeout(() => {
        if (!hasFirstFrame) setIsBuffering(true);
      }, 800);
      player.play();
    } else {
      player.pause();
      clearInterval(progressInterval.current);
      clearTimeout(bufferTimerRef.current);
      setIsBuffering(false);
    }
    return () => clearTimeout(bufferTimerRef.current);
  }, [isActive, player]);

  // Poll current time while playing (no stall detection — it caused false positives)
  useEffect(() => {
    clearInterval(progressInterval.current);
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        if (player) {
          setCurrentTime(player.currentTime || 0);
        }
      }, 200);
    }
    return () => clearInterval(progressInterval.current);
  }, [isPlaying, player]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(progressInterval.current);
      clearTimeout(bufferTimerRef.current);
    };
  }, []);

  // Replay from buffer — uses player.replay() which seeks within the
  // already-downloaded data instead of re-fetching from the network.
  const handleReplay = useCallback(() => {
    if (!player) return;
    setVideoFinished(false);
    setCurrentTime(0);
    setIsBuffering(false);
    player.replay();
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (videoFinished) {
      handleReplay();
      return;
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, isPlaying, videoFinished, handleReplay]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleScrubberPress = useCallback((evt) => {
    if (!scrubberWidth.current || !player || !duration) return;
    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / scrubberWidth.current));
    const newTime = ratio * duration;
    player.currentTime = newTime;
    setCurrentTime(newTime);
    // If scrubbing after video ended, clear the finished state
    if (videoFinished) {
      setVideoFinished(false);
      player.play();
    }
  }, [player, duration, videoFinished]);

  return (
    <View style={styles.mediaContainer}>
      {/* Video card — dynamic height based on video dimensions */}
      <View style={[styles.mediaCard, { width: CARD_W, height: CARD_MAX_H }]}>
        {/* Thumbnail poster behind video — eliminates perceived load time */}
        {thumbnailUrl && !hasFirstFrame && (
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}

        <VideoView
          player={player}
          style={[styles.videoView, { zIndex: 1 }]}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          nativeControls={false}
          contentFit="cover"
          onFirstFrameRender={() => {
            setHasFirstFrame(true);
            clearTimeout(bufferTimerRef.current);
            setIsBuffering(false);
          }}
        />

        {/* Buffering spinner — only during initial load before first frame */}
        {isBuffering && !videoFinished && (
          <View style={[styles.bufferingOverlay, { zIndex: 2 }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Watch Again overlay — shown when video finishes */}
        {videoFinished && (
          <Pressable style={[styles.watchAgainOverlay, { zIndex: 3 }]} onPress={handleReplay}>
            <View style={styles.watchAgainButton}>
              <RotateCcw size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.watchAgainText}>Watch again</Text>
            </View>
          </Pressable>
        )}

        {/* Tap to toggle overlays (whole card) — hidden when finished */}
        {!videoFinished && (
          <Pressable style={[StyleSheet.absoluteFill, { zIndex: 3 }]} onPress={onPress} />
        )}

        {/* Controls bar at bottom of card */}
        <View style={[styles.videoControls, { zIndex: 4 }]}>
          {/* Play/Pause or Replay */}
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {videoFinished ? (
              <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.5} />
            ) : isPlaying ? (
              <Pause size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
            ) : (
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
            )}
          </TouchableOpacity>

          {/* Scrubber track */}
          <Pressable
            style={styles.scrubberTrackContainer}
            onPress={handleScrubberPress}
            onLayout={(e) => { scrubberWidth.current = e.nativeEvent.layout.width; }}
          >
            <View style={styles.scrubberTrack}>
              <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.scrubberDot, { left: `${progress * 100}%` }]} />
            </View>
          </Pressable>

          {/* Elapsed time */}
          <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MediaViewerTimeline({ timeline, initialIndex, visible, onClose, onEndReached, onReply }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const flatListRef = useRef(null);

  // Animations
  const opacitySV = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible && flatListRef.current) {
      setCurrentIndex(initialIndex);
      setOverlaysVisible(true);
      opacitySV.value = 1;
      translateY.value = 0;
      scale.value = 1;
      bgOpacity.value = 1;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const toggleOverlays = () => {
    const nextState = !overlaysVisible;
    setOverlaysVisible(nextState);
    opacitySV.value = withTiming(nextState ? 1 : 0, { duration: 200 });
  };

  const handleScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_W);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < timeline.length) {
      setCurrentIndex(newIndex);
    }
  };

  const handleMomentumScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_W);
    if (newIndex === timeline.length - 1 && onEndReached) {
      onEndReached();
    }
  };

  const handleClose = useCallback(() => {
    translateY.value = 0;
    bgOpacity.value = 1;
    scale.value = 1;
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      translateY.value = e.translationY;
      const progress = Math.min(Math.abs(e.translationY) / SCREEN_H, 1);
      bgOpacity.value = 1 - progress * 0.8;
      scale.value = 1 - progress * 0.2;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 800) {
        bgOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(Math.sign(e.translationY) * SCREEN_H, { duration: 250 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        bgOpacity.value = withTiming(1);
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 255, 255, ${bgOpacity.value})`,
  }));

  const overlaysAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }));

  if (!visible) return null;

  const currentItem = timeline[currentIndex];

  return (
    <Modal visible={visible} transparent={true} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
              <AnimatedFlatList
                ref={flatListRef}
                data={timeline}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                initialScrollIndex={initialIndex}
                getItemLayout={(data, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                renderItem={({ item, index }) => (
                  <MediaItem item={item} isActive={index === currentIndex} onPress={toggleOverlays} />
                )}
                windowSize={5}
                initialNumToRender={5}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
              />
            </Animated.View>
          </GestureDetector>

          {/* Header */}
          <Animated.View style={[styles.header, { top: insets.top + 10 }, overlaysAnimatedStyle]} pointerEvents={overlaysVisible ? "auto" : "none"}>
            <View style={styles.headerLeft}>
              <Image source={{ uri: currentItem?.avatarUri }} style={styles.headerAvatar} />
              <View>
                <Text style={styles.headerName}>{currentItem?.senderName}</Text>
                <Text style={styles.headerTime}>{formatTime(currentItem?.createdAt)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={24} color="#000000" strokeWidth={2.5} />
            </TouchableOpacity>
          </Animated.View>

          {/* Footer (Reply) */}
          <Animated.View style={[styles.footer, { bottom: insets.bottom + 20 }, overlaysAnimatedStyle]} pointerEvents={overlaysVisible ? "auto" : "none"}>
            <TouchableOpacity style={styles.replyButton} onPress={() => { if (onReply && currentItem) onReply(currentItem); }}>
              <Text style={styles.replyText}>Reply...</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── Shared media container ──
  mediaContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 90,
  },

  // ── Shared media card style (images + videos) ──
  mediaCard: {
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  videoView: {
    ...StyleSheet.absoluteFillObject,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  // ── Video controls bar ──
  videoControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  playPauseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  scrubberTrackContainer: {
    flex: 1,
    height: 28,
    justifyContent: "center",
    marginRight: 10,
  },
  scrubberTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1.5,
    position: "relative",
  },
  scrubberFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
  },
  scrubberDot: {
    position: "absolute",
    top: -5,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#FFFFFF",
    marginLeft: -6.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  timeText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    minWidth: 36,
    textAlign: "right",
  },

  // ── Watch Again overlay ──
  watchAgainOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: CARD_RADIUS,
  },
  watchAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    gap: 8,
  },
  watchAgainText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // ── Header ──
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerName: {
    color: "#000",
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
  },
  headerTime: {
    color: "rgba(0,0,0,0.5)",
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  replyButton: {
    backgroundColor: "rgba(245,245,245,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  replyText: {
    color: "#000",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
});
