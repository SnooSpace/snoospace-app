/**
 * FullscreenVideoModal Component
 * Instagram-style fullscreen video player with immersive overlay and engagement interactions.
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
  Image,
  SafeAreaView,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons"; // For back arrow
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import FollowButton from "./FollowButton"; // Reusing existing FollowButton
import { COLORS, EDITORIAL_SPACING } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const ICON_SIZE = EDITORIAL_SPACING.iconSize; // 23px to match EditorialPostCard
const ICON_COLOR = "#FFFFFF";

const formatTime = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return "0:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatCount = (count) => {
  if (!count || count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.floor(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
};

const FullscreenVideoModal = ({
  visible,
  source,
  onClose,
  initialMuted = false,
  aspectRatio = 16 / 9,
  cropMetadata,
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  currentUserId,
}) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const lastTap = useRef(null); // For double tap detection

  // Local state for interactions (optimistic updates)
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  // Animation values
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current; // For double-tap heart animation

  // Sync with post interactions
  const isLiked = post?.is_liked;
  const likeCount = post?.like_count || 0;
  const isSaved = post?.is_saved;

  // CRITICAL FIX: Only apply transforms when user actually panned/zoomed
  const hasUserCrop =
    cropMetadata?.hasUserCrop ||
    (cropMetadata &&
      (cropMetadata.scale !== 1 ||
        Math.abs(cropMetadata.translateX || 0) > 0.5 ||
        Math.abs(cropMetadata.translateY || 0) > 0.5));

  // Use CONTAIN for all aspect ratios to maintain gaps (Instagram-style)
  // All videos are centered with black bars where needed
  const resizeMode = ResizeMode.CONTAIN;

  const hideControlsTimer = useRef(null);

  // Auto-hide controls logic
  const startHideControlsTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
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

  const toggleControls = useCallback(() => {
    if (showControls) {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    } else {
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      startHideControlsTimer();
    }
  }, [showControls, controlsOpacity, startHideControlsTimer]);

  // Handle gestures
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap.current && now - lastTap.current < DOUBLE_PRESS_DELAY) {
      handleDoubleTap();
    } else {
      lastTap.current = now;
      // Delay single tap slightly to wait for potential double tap
      setTimeout(() => {
        if (Date.now() - lastTap.current >= DOUBLE_PRESS_DELAY) {
          toggleControls();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const handleDoubleTap = () => {
    // Animate big heart center
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (!isLiked && onLike) {
      onLike();
    }
  };

  // Lifecycle & Cleanup
  useEffect(() => {
    if (visible) startHideControlsTimer();
    return () => {
      if (videoRef.current) videoRef.current.unloadAsync();
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [visible]);

  const handlePlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      if (!isSeeking) setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
    }
  };

  // Only compute transforms when user actually modified crop
  const videoTransform = hasUserCrop
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
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />

        {/* Video Surface */}
        <TouchableWithoutFeedback onPress={handlePress}>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={typeof source === "string" ? { uri: source } : source}
              style={[
                styles.video,
                {
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT,
                  aspectRatio,
                },
                hasUserCrop && { transform: videoTransform },
              ]}
              resizeMode={resizeMode}
              shouldPlay={visible}
              isLooping
              isMuted={isMuted}
              useNativeControls={false}
              progressUpdateIntervalMillis={100}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {/* Double Tap Heart Animation */}
            <View style={styles.centerHeartContainer} pointerEvents="none">
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name="heart"
                  size={100}
                  color="rgba(255,255,255,0.9)"
                />
              </Animated.View>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Overlay Controls */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* Top Gradient for visibility */}
          <LinearGradient
            colors={["rgba(0,0,0,0.6)", "transparent"]}
            style={[styles.topGradient, { height: insets.top + 60 }]}
            pointerEvents="none"
          />

          {/* Header: Back Button */}
          <SafeAreaView style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Bottom Gradient */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Main Engagement UI */}
          <View
            style={[styles.bottomContainer, { paddingBottom: insets.bottom }]}
          >
            <View style={styles.contentRow}>
              {/* Left Side: User Info & Caption */}
              <View style={styles.leftColumn}>
                {/* User Info */}
                <View style={styles.userInfoRow}>
                  <TouchableOpacity
                    style={styles.userProfile}
                    onPress={() => {
                      /* Navigate to profile */
                    }}
                  >
                    <Image
                      source={
                        post?.author_photo_url
                          ? { uri: post.author_photo_url }
                          : { uri: "https://via.placeholder.com/40" }
                      }
                      style={styles.avatar}
                    />
                    <Text style={styles.username}>
                      @{post?.author_username || "user"}
                    </Text>
                  </TouchableOpacity>

                  {/* Follow Button (Pill) */}
                  {currentUserId !== post?.author_id && onFollow && (
                    <FollowButton
                      userId={post?.author_id}
                      userType={post?.author_type}
                      isFollowing={post?.is_following}
                      onFollowChange={onFollow}
                      style={styles.followButton}
                      textStyle={styles.followButtonText}
                    />
                  )}
                </View>

                {/* Caption */}
                {post?.caption && (
                  <View style={styles.captionContainer}>
                    <Text
                      style={styles.captionText}
                      numberOfLines={captionExpanded ? undefined : 2}
                      onPress={() => setCaptionExpanded(!captionExpanded)}
                    >
                      {post.caption}
                    </Text>
                  </View>
                )}
              </View>

              {/* Right Side: Engagement Icons */}
              <View style={styles.rightColumn}>
                {/* Like */}
                <TouchableOpacity style={styles.iconButton} onPress={onLike}>
                  <Heart
                    size={ICON_SIZE}
                    color={isLiked ? COLORS.error : ICON_COLOR}
                    fill={isLiked ? COLORS.error : "transparent"}
                  />
                  <Text style={styles.iconLabel}>{formatCount(likeCount)}</Text>
                </TouchableOpacity>

                {/* Comment */}
                <TouchableOpacity style={styles.iconButton} onPress={onComment}>
                  <MessageCircle size={ICON_SIZE} color={ICON_COLOR} />
                  <Text style={styles.iconLabel}>
                    {formatCount(post?.comment_count)}
                  </Text>
                </TouchableOpacity>

                {/* Views */}
                <View style={styles.iconButton}>
                  <ChartNoAxesCombined size={ICON_SIZE} color={ICON_COLOR} />
                  <Text style={styles.iconLabel}>
                    {formatCount(post?.view_count || post?.public_view_count)}
                  </Text>
                </View>

                {/* Share */}
                <TouchableOpacity style={styles.iconButton} onPress={onShare}>
                  <Send size={ICON_SIZE} color={ICON_COLOR} />
                  <Text style={styles.iconLabel}>
                    {formatCount(post?.share_count)}
                  </Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity style={styles.iconButton} onPress={onSave}>
                  <Bookmark
                    size={ICON_SIZE}
                    color={ICON_COLOR}
                    fill={isSaved ? ICON_COLOR : "transparent"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Slider
                style={styles.slider}
                value={duration > 0 ? position / duration : 0}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor="#FFFFFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="transparent" // Clean look, tap to seek usually
                onSlidingComplete={async (val) => {
                  if (videoRef.current)
                    await videoRef.current.setPositionAsync(val * duration);
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  video: {
    backgroundColor: "#000",
  },
  fullVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  centerHeartContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomContainer: {
    width: "100%",
    paddingBottom: 20,
    justifyContent: "flex-end",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 0,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 10,
    paddingBottom: 4,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userProfile: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FFF",
    marginRight: 8,
  },
  username: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginRight: 10,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  followButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  captionContainer: {
    marginBottom: 4,
  },
  captionText: {
    color: "#FFF",
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rightColumn: {
    alignItems: "center",
    width: 50,
    paddingBottom: 0, // Align with text
  },
  iconButton: {
    alignItems: "center",
    marginTop: 20,
  },
  iconLabel: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressContainer: {
    width: "100%",
    paddingHorizontal: 0,
    marginBottom: -10, // Pull closer to bottom
  },
  slider: {
    width: "100%",
    height: 20,
  },
});

export default FullscreenVideoModal;
