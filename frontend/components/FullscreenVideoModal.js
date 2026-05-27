/**
 * FullscreenVideoModal
 *
 * Fixes applied in this version:
 *  1. Entry via tapping the card video (no expand icon needed here — VideoPlayer
 *     calls onFullscreen which sets fullscreenVisible in EditorialPostCard).
 *  2. Play/Pause icon at the START of the timeline bar (matches chat screen).
 *  3. Tap ANYWHERE re-shows toolbar regardless of visibility.
 *  4. Video stays in sync with the card (same source URL + seeks to initialPosition).
 *  5. Video does NOT touch the status bar — starts below insets.top.
 *     ArrowLeft back button always visible when toolbar is showing.
 *
 * Toolbar logic:
 *  • Playing  → toolbar auto-hides after 3 s
 *  • Paused   → toolbar stays permanently visible
 *  • Any tap  → shows toolbar immediately; restarts 3 s timer if playing
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
  StatusBar,
  Image,
  PanResponder,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  ArrowLeft,
  Play,
  Pause,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from "react-native-svg";
import FollowButton from "./FollowButton";
import { COLORS, EDITORIAL_SPACING, FONTS } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Helpers ────────────────────────────────────────────────────────────────

const GradientHeart = ({ width = 150, height = 150 }) => (
  <Svg width={width} height={height} viewBox="0 0 48 48" style={{ filter: 'none' }}>
    <Defs>
      <SvgLinearGradient id="blueGradient" x1="5%" y1="5%" x2="95%" y2="95%">
        <Stop offset="0%" stopColor="#00f2fe" stopOpacity="1" />
        <Stop offset="45%" stopColor="#00c6ff" stopOpacity="1" />
        <Stop offset="100%" stopColor="#0072ff" stopOpacity="1" />
      </SvgLinearGradient>
    </Defs>
    <Path
      fill="url(#blueGradient)"
      d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"
    />
  </Svg>
);

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatCount = (count) => {
  if (!count || count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.floor(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
};

// ── Component ──────────────────────────────────────────────────────────────

const FullscreenVideoModal = ({
  visible,
  source,
  onClose,
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  currentUserId,
  currentUserType,
  cropMetadata = null,
  initialPosition = 0, // seek here once player is ready
}) => {
  const insets = useSafeAreaInsets();

  // ── expo-video player ────────────────────────────────────────────────────
  const player = useVideoPlayer(
    visible && source
      ? typeof source === "string"
        ? { uri: source }
        : source
      : null,
    (p) => {
      p.muted = false;
      p.loop = true;
    },
  );

  // ── Local state ──────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const didSeekRef = useRef(false); // only seek to initialPosition once

  // ── Toolbar visibility ───────────────────────────────────────────────────
  const toolbarOpacity = useRef(new Animated.Value(1)).current;
  const toolbarVisibleRef = useRef(true); // track without re-render for tap handler
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimer = useRef(null);

  // ── isPlaying ref — prevents stale closures in tap handlers ─────────────
  const isPlayingRef = useRef(false);

  // ── Double-tap like ──────────────────────────────────────────────────────
  const lastTapRef = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;

  // ── Derived ──────────────────────────────────────────────────────────────
  const isLiked = post?.is_liked || false;
  const likeCount = post?.like_count || 0;
  const isSaved = post?.is_saved || false;
  const isOwnPost =
    String(post?.author_id) === String(currentUserId) &&
    post?.author_type === currentUserType;

  // ── Toolbar helpers ──────────────────────────────────────────────────────
  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const showToolbar = useCallback(() => {
    clearHideTimer();
    toolbarVisibleRef.current = true;
    setToolbarVisible(true);
    Animated.timing(toolbarOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [toolbarOpacity, clearHideTimer]);

  const startAutoHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      Animated.timing(toolbarOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        toolbarVisibleRef.current = false;
        setToolbarVisible(false);
      });
    }, 3000);
  }, [toolbarOpacity, clearHideTimer]);

  // Auto-hide when playing, keep showing when paused
  useEffect(() => {
    if (isPlaying && !isSeeking) {
      startAutoHide();
    } else {
      clearHideTimer();
      showToolbar();
    }
  }, [isPlaying, isSeeking, startAutoHide, showToolbar, clearHideTimer]);

  // ── Play/pause sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playingChange", (nowPlaying) => {
      setIsPlaying(nowPlaying);
      isPlayingRef.current = nowPlaying; // always up-to-date
    });
    return () => sub?.remove();
  }, [player]);

  // Status ready → seek to initial position
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("statusChange", (status) => {
      if (
        status.status === "readyToPlay" &&
        !didSeekRef.current &&
        initialPosition > 0
      ) {
        didSeekRef.current = true;
        player.currentTime = initialPosition;
      }
      if (status.status === "readyToPlay") {
        setDuration(player.duration || 0);
      }
    });
    return () => sub?.remove();
  }, [player, initialPosition]);

  // Start/stop with modal visibility
  useEffect(() => {
    if (!player) return;
    if (visible) {
      didSeekRef.current = false;
      isPlayingRef.current = true; // sync immediately so togglePlayPause is correct
      player.play();
      setIsPlaying(true);
    } else {
      isPlayingRef.current = false;
      player.pause();
      setIsPlaying(false);
    }
  }, [visible, player]);

  // ── Progress + playing-state polling ─────────────────────────────────────
  // player.playing is the authoritative native property — poll it at 200ms
  // so the icon always reflects the real state without depending on events.
  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      // Sync playing state (drives the icon)
      const nowPlaying = player.playing;
      setIsPlaying((prev) => {
        if (prev !== nowPlaying) {
          isPlayingRef.current = nowPlaying;
          return nowPlaying;
        }
        return prev;
      });
      // Sync position / duration
      if (!isSeeking && player.duration > 0) {
        setDuration(player.duration);
        setPosition(player.currentTime);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [player, isSeeking]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  // ── Toggle play/pause ──────────────────────────────────────────────────────
  // Uses player.playing (the live native property) — never stale, never wrong.
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    showToolbar();
  }, [player, showToolbar]);

  // ── Background tap — toolbar toggle + double-tap like ────────────────────
  // Tapping anywhere OUTSIDE the center bubble hits this handler.
  const handleBgTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_DELAY = 280;
    if (now - lastTapRef.current < DOUBLE_DELAY) {
      // Double-tap → like animation
      // Invalidate the pending single-tap by zeroing lastTapRef
      lastTapRef.current = -Infinity;
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 14,
        }),
        Animated.delay(500),
        Animated.timing(heartScale, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      if (!isLiked && onLike) onLike();
    } else {
      // Single-tap — toggle toolbar; use tapTime to guard against double-tap race
      const tapTime = now;
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== tapTime) return; // was a double-tap, skip
        // Toggle toolbar
        if (!toolbarVisibleRef.current) {
          showToolbar();
          if (isPlayingRef.current) startAutoHide();
        } else {
          // Toolbar is visible → hide it (let user watch unobstructed)
          Animated.timing(toolbarOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            toolbarVisibleRef.current = false;
            setToolbarVisible(false);
          });
        }
      }, DOUBLE_DELAY);
    }
  }, [isLiked, onLike, showToolbar, startAutoHide, toolbarOpacity, heartScale]);

  // ── Timeline PanResponder ────────────────────────────────────────────────
  const timelineRef = useRef(null);

  const seekTo = useCallback(
    (pageX) => {
      if (!player || duration <= 0) return;
      timelineRef.current?.measure((_x, _y, w, _h, px) => {
        const ratio = Math.min(Math.max((pageX - px) / w, 0), 1);
        player.currentTime = ratio * duration;
        setPosition(ratio * duration);
      });
    },
    [player, duration],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setIsSeeking(true);
          showToolbar();
          clearHideTimer();
          seekTo(e.nativeEvent.pageX);
        },
        onPanResponderMove: (e) => seekTo(e.nativeEvent.pageX),
        onPanResponderRelease: () => {
          setIsSeeking(false);
          if (isPlaying) startAutoHide();
        },
        onPanResponderTerminate: () => {
          setIsSeeking(false);
          if (isPlaying) startAutoHide();
        },
      }),
    [seekTo, showToolbar, clearHideTimer, startAutoHide, isPlaying],
  );

  // ── Swipe-to-close PanResponder ──────────────────────────────────────────
  const swipeDownPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only take over if the user is swiping downwards with vertical intent
          const { dx, dy } = gestureState;
          return dy > 15 && Math.abs(dy) > Math.abs(dx) * 2;
        },
        onPanResponderRelease: (_, gestureState) => {
          // Close if swiped down far enough or fast enough
          if (gestureState.dy > 50 || gestureState.vy > 1.2) {
            onClose();
          }
        },
      }),
    [onClose],
  );

  // ── Client-side crop — exact mirror of VideoPlayer.js ────────────────────
  // VideoPlayer: map = containerWidth / displayWidth  (same for X and Y)
  // Modal:       map = SCREEN_WIDTH  / displayWidth  (same formula, larger container)
  // Because our container aspect ratio matches the crop frame AR (see videoHeight),
  // mapX === mapY === map, so scaling is uniform and the visible region is identical.
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

    // frameHeight = visible crop window height in CropView pixel space
    let frameHeight;
    if (Array.isArray(presetAR) && presetAR[0] > 0 && presetAR[1] > 0) {
      frameHeight = displayWidth * (presetAR[1] / presetAR[0]);
    } else {
      frameHeight = displayHeight;
    }

    // Single uniform scale factor — identical to VideoPlayer's mapX (= mapY)
    // since our containerH = frameHeight * map (same AR as crop frame)
    const map = SCREEN_WIDTH / displayWidth;
    const containerH = frameHeight * map; // = modal video container height

    const videoW = displayWidth * scale * map; // = scale * SCREEN_WIDTH
    const videoH = displayHeight * scale * map;

    const tx = translateX * map;
    const ty = translateY * map;

    const offsetX = (videoW - SCREEN_WIDTH) / 2;
    const offsetY = (videoH - containerH) / 2;

    return {
      width: videoW,
      height: videoH,
      transform: [
        { translateX: -offsetX + tx },
        { translateY: -offsetY + ty },
      ],
    };
  }, [cropMetadata]);

  const progressRatio = duration > 0 ? Math.min(position / duration, 1) : 0;

  const authorPhotoUri = post?.author_photo_url
    ? { uri: post.author_photo_url }
    : {
        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          post?.author_name || "U",
        )}&background=E5E7EB&color=6B7280&size=88`,
      };

  // ── Modal video container height ─────────────────────────────────────────
  // CRITICAL: Must use the SAME aspect ratio as the crop frame so the
  // container proportion matches the card. VideoPlayer does:
  //   containerH = containerWidth / aspectRatio  (aspectRatio = presetAR[0]/presetAR[1])
  // We do the same with containerWidth = SCREEN_WIDTH.
  const videoHeight = useMemo(() => {
    const ar = cropMetadata?.aspectRatio;
    if (Array.isArray(ar) && ar[0] > 0 && ar[1] > 0) {
      // same formula as VideoPlayer: height = width / (w/h) = width * h/w
      return Math.round(SCREEN_WIDTH * (ar[1] / ar[0]));
    }
    return Math.round(SCREEN_WIDTH * (16 / 9)); // fallback: 9:16
  }, [cropMetadata]);

  const commentBarTop = insets.top + videoHeight;
  const commentBarHeight = SCREEN_HEIGHT - commentBarTop - insets.bottom;
  const showCommentBar = commentBarHeight > 36;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} {...swipeDownPanResponder.panHandlers}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

        {/* ── White status bar strip ── */}
        <View style={[styles.statusBarBg, { height: insets.top }]} />

        {/* ── 9:16 video container ── */}
        <View style={[styles.videoContainer, { height: videoHeight }]}>

          {/* Video fills the container exactly */}
          <VideoView
            player={player}
            style={cropStyle ? [StyleSheet.absoluteFill, cropStyle] : StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />

          {/* Overlay — gradients + all interactive UI */}
          <Animated.View
            style={[styles.overlay, { opacity: toolbarOpacity }]}
            pointerEvents="box-none"
          >
            {/* Background tap — toolbar toggle + double-tap like */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={handleBgTap}
            />

            {/* Top gradient */}
            <LinearGradient
              colors={["rgba(0,0,0,0.65)", "transparent"]}
              style={styles.topGradient}
              pointerEvents="none"
            />

            {/* Back button row */}
            <View style={styles.header} pointerEvents="box-none">
              <TouchableOpacity
                onPress={onClose}
                style={styles.backButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Centre play/pause — tappable with generous hit area */}
            <View style={styles.centrePlayContainer} pointerEvents="box-none">
              <TouchableOpacity
                onPress={togglePlayPause}
                style={styles.centrePlayBubble}
                activeOpacity={0.85}
                hitSlop={{ top: 36, bottom: 36, left: 36, right: 36 }}
              >
                {isPlaying ? (
                  <Pause size={28} color="#fff" fill="#fff" />
                ) : (
                  <Play size={28} color="#fff" fill="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom gradient */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.92)"]}
              style={styles.bottomGradient}
              pointerEvents="none"
            />

            {/* Bottom content — author, engagement, timeline */}
            <View style={styles.bottomArea} pointerEvents="box-none">

              {/* Author + Caption | Engagement */}
              <View style={styles.contentRow}>

                {/* LEFT: author + caption */}
                <View style={styles.leftColumn}>
                  <TouchableOpacity style={styles.authorRow} activeOpacity={0.8}>
                    <Image source={authorPhotoUri} style={styles.avatar} />
                    <View style={styles.authorTextContainer}>
                      <View style={styles.authorNameRow}>
                        <Text style={styles.displayName} numberOfLines={1}>
                          {post?.author_name || "Unknown"}
                        </Text>
                        {post?.is_verified && (
                          <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedIcon}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.username} numberOfLines={1}>
                        @{post?.author_username || "user"}
                      </Text>
                    </View>
                    {!isOwnPost && onFollow && (
                      <FollowButton
                        userId={post?.author_id}
                        userType={post?.author_type}
                        isFollowing={post?.is_following}
                        onFollowChange={onFollow}
                        style={styles.followButton}
                        textStyle={styles.followButtonText}
                        currentFollowerId={currentUserId}
                        navigationContext={{
                          navigationState: { routeName: 'PostView' },
                          lastContentInteraction: {
                            type: 'video',
                            contentId: post?.id,
                          },
                        }}
                      />
                    )}
                  </TouchableOpacity>

                  {post?.caption ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setCaptionExpanded((v) => !v)}
                      style={styles.captionContainer}
                    >
                      <Text
                        style={styles.captionText}
                        numberOfLines={captionExpanded ? undefined : 2}
                      >
                        {post.caption}
                      </Text>
                      {!captionExpanded && post.caption.length > 80 && (
                        <Text style={styles.captionMore}>more</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* RIGHT: engagement icons */}
                <View style={styles.rightColumn}>
                  <TouchableOpacity style={styles.iconButton} onPress={onLike}>
                    <Heart
                      size={EDITORIAL_SPACING.iconSize}
                      color={isLiked ? COLORS.error : "#FFF"}
                      fill={isLiked ? COLORS.error : "transparent"}
                      strokeWidth={2}
                    />
                    <Text style={styles.iconLabel}>
                      {formatCount(likeCount)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.iconButton} onPress={onComment}>
                    <MessageCircle
                      size={EDITORIAL_SPACING.iconSize}
                      color="#FFF"
                      strokeWidth={2}
                    />
                    <Text style={styles.iconLabel}>
                      {formatCount(post?.comment_count || 0)}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.iconButton}>
                    <ChartNoAxesCombined
                      size={EDITORIAL_SPACING.iconSize}
                      color="#FFF"
                      strokeWidth={2}
                    />
                    <Text style={styles.iconLabel}>
                      {formatCount(
                        post?.public_view_count || post?.view_count || 0,
                      )}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.iconButton} onPress={onShare}>
                    <Send
                      size={EDITORIAL_SPACING.iconSize}
                      color="#FFF"
                      strokeWidth={2}
                    />
                    <Text style={styles.iconLabel}>
                      {formatCount(post?.share_count || 0)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.iconButton} onPress={onSave}>
                    <Bookmark
                      size={EDITORIAL_SPACING.iconSize}
                      color="#FFF"
                      fill={isSaved ? "#FFF" : "transparent"}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Timeline row: [▶] [scrubber] [time] */}
              <View style={styles.timelineRow}>
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={styles.playPauseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isPlaying ? (
                    <Pause size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                  ) : (
                    <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                  )}
                </TouchableOpacity>

                <View
                  ref={timelineRef}
                  style={styles.trackOuter}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.trackUnfilled} />
                  <View
                    style={[
                      styles.trackFilled,
                      { width: `${progressRatio * 100}%` },
                    ]}
                  />
                  <View
                    style={[styles.thumb, { left: `${progressRatio * 100}%` }]}
                  />
                </View>

                <Text style={styles.timeText}>
                  {formatTime(position)} / {formatTime(duration)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Double-tap heart — always above overlay */}
          <View style={styles.heartWrapper} pointerEvents="none">
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <GradientHeart width={100} height={100} />
            </Animated.View>
          </View>
        </View>

        {/* ── Comment bar — fills the space below 9:16 video ── */}
        {showCommentBar && (
          <View style={[styles.commentBarContainer, { height: commentBarHeight + insets.bottom, paddingBottom: insets.bottom }]}>
            <TouchableOpacity
              style={styles.commentInputPill}
              activeOpacity={0.85}
              onPress={onComment}
            >
              <Text style={styles.commentBarText}>Add a comment...</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  statusBarBg: {
    backgroundColor: "#FFF",
    width: "100%",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    zIndex: 10,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Centre play bubble ──
  centrePlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  centrePlayBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },

  // ── Bottom area ──
  bottomArea: {
    width: "100%",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  // ── Left column ──
  leftColumn: {
    flex: 1,
    paddingRight: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: EDITORIAL_SPACING.profileImageSize,
    height: EDITORIAL_SPACING.profileImageSize,
    borderRadius: EDITORIAL_SPACING.profileImageSize / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "#333",
  },
  authorTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: "#FFF",
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: COLORS.editorial.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  verifiedIcon: { color: "#FFF", fontSize: 9, fontWeight: "700" },
  username: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    marginLeft: 10,
  },
  followButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#FFF",
  },
  captionContainer: { marginBottom: 4 },
  captionText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.92)",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  captionMore: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },

  // ── Right column ──
  rightColumn: {
    alignItems: "center",
    width: 52,
    paddingBottom: 2,
  },
  iconButton: {
    alignItems: "center",
    marginBottom: 18,
  },
  iconLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#FFF",
    marginTop: 4,
  },

  // ── Timeline row (chat-screen pattern) ──
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 10,
  },
  playPauseBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  trackOuter: {
    flex: 1,
    height: 28,
    justifyContent: "center",
    position: "relative",
  },
  trackUnfilled: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  trackFilled: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  thumb: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#FFFFFF",
    marginLeft: -6.5,
    top: 7, // (28 - 13) / 2 = 7.5 ≈ 7
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },
  timeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.80)",
    minWidth: 72,
    textAlign: "right",
  },

  // ── Heart ──
  heartWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },

  // ── Comment bar (below 9:16 video) ──
  commentBarContainer: {
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  commentInputPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6", // very light gray
    borderRadius: 24,
    width: "100%",
    paddingHorizontal: 20,
    height: 48,
  },
  commentBarText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "rgba(0,0,0,0.45)",
  },
});

export default FullscreenVideoModal;
