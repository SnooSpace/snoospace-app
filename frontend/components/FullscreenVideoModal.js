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
import FollowButton from "./FollowButton";
import { COLORS, EDITORIAL_SPACING, FONTS } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Helpers ────────────────────────────────────────────────────────────────

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
  initialPosition = 0,   // seek here once player is ready
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
    }
  );

  // ── Local state ──────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const didSeekRef = useRef(false);   // only seek to initialPosition once

  // ── Toolbar visibility ───────────────────────────────────────────────────
  const toolbarOpacity = useRef(new Animated.Value(1)).current;
  const toolbarVisibleRef = useRef(true);  // track without re-render for tap handler
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
      isPlayingRef.current = nowPlaying;  // always up-to-date
    });
    return () => sub?.remove();
  }, [player]);

  // Status ready → seek to initial position
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay" && !didSeekRef.current && initialPosition > 0) {
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
      isPlayingRef.current = true;  // sync immediately so togglePlayPause is correct
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
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
        Animated.delay(500),
        Animated.timing(heartScale, { toValue: 0, duration: 220, useNativeDriver: true }),
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
    [player, duration]
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
    [seekTo, showToolbar, clearHideTimer, startAutoHide, isPlaying]
  );

  // ── Client-side crop (mirrors VideoPlayer logic) ─────────────────────────
  const cropStyle = useMemo(() => {
    if (!cropMetadata || !cropMetadata.hasUserCrop) return null;
    const { scale = 1, translateX = 0, translateY = 0, displayWidth, displayHeight, aspectRatio: presetAR } = cropMetadata;
    if (!displayWidth || !displayHeight) return null;
    let frameHeight;
    if (Array.isArray(presetAR) && presetAR[0] > 0 && presetAR[1] > 0) {
      frameHeight = displayWidth * (presetAR[1] / presetAR[0]);
    } else {
      frameHeight = displayHeight;
    }
    const mapX = SCREEN_WIDTH / displayWidth;
    const mapY = SCREEN_HEIGHT / frameHeight;
    const videoW = displayWidth * scale * mapX;
    const videoH = displayHeight * scale * mapY;
    const offsetX = (videoW - SCREEN_WIDTH) / 2;
    const offsetY = (videoH - SCREEN_HEIGHT) / 2;
    return {
      width: videoW,
      height: videoH,
      transform: [
        { translateX: -offsetX + translateX * mapX },
        { translateY: -offsetY + translateY * mapY },
      ],
    };
  }, [cropMetadata]);

  const progressRatio = duration > 0 ? Math.min(position / duration, 1) : 0;

  const authorPhotoUri = post?.author_photo_url
    ? { uri: post.author_photo_url }
    : {
        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          post?.author_name || "U"
        )}&background=E5E7EB&color=6B7280&size=88`,
      };

  // The video area sits below the status bar — we push it down by insets.top
  const videoAreaTop = insets.top;
  const videoAreaHeight = SCREEN_HEIGHT - videoAreaTop;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Status bar kept visible but we don't render video behind it */}
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Black strip behind status bar */}
        <View style={[styles.statusBarBg, { height: videoAreaTop }]} />

        {/* Video area — below status bar */}
        <View style={[styles.videoArea, { top: videoAreaTop, height: videoAreaHeight }]}>
          <VideoView
            player={player}
            style={cropStyle ? [styles.videoAbsolute, cropStyle] : styles.videoFill}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />

          {/* ── Overlay (gradients + all UI) — always box-none so taps reach children ── */}
          <Animated.View
            style={[styles.overlay, { opacity: toolbarOpacity }]}
            pointerEvents="box-none"
          >
            {/* Background tap catcher — shows/hides toolbar, double-tap = like */}
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
                {isPlaying
                  ? <Pause size={28} color="#fff" fill="#fff" />
                  : <Play size={28} color="#fff" fill="#fff" />}
              </TouchableOpacity>
            </View>

            {/* Bottom gradient */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.90)"]}
              style={styles.bottomGradient}
              pointerEvents="none"
            />

            {/* Bottom content */}
            <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">

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
                    <Text style={styles.iconLabel}>{formatCount(likeCount)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.iconButton} onPress={onComment}>
                    <MessageCircle size={EDITORIAL_SPACING.iconSize} color="#FFF" strokeWidth={2} />
                    <Text style={styles.iconLabel}>{formatCount(post?.comment_count || 0)}</Text>
                  </TouchableOpacity>

                  <View style={styles.iconButton}>
                    <ChartNoAxesCombined size={EDITORIAL_SPACING.iconSize} color="#FFF" strokeWidth={2} />
                    <Text style={styles.iconLabel}>
                      {formatCount(post?.public_view_count || post?.view_count || 0)}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.iconButton} onPress={onShare}>
                    <Send size={EDITORIAL_SPACING.iconSize} color="#FFF" strokeWidth={2} />
                    <Text style={styles.iconLabel}>{formatCount(post?.share_count || 0)}</Text>
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

              {/* ── Timeline (chat-screen style): [Play/Pause] [track] [time] ── */}
              <View style={styles.timelineRow}>
                {/* Play/Pause button — identical pattern to chat screen */}
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={styles.playPauseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isPlaying
                    ? <Pause size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                    : <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />}
                </TouchableOpacity>

                {/* Scrubber track */}
                <View
                  ref={timelineRef}
                  style={styles.trackOuter}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.trackUnfilled} />
                  <View style={[styles.trackFilled, { width: `${progressRatio * 100}%` }]} />
                  <View style={[styles.thumb, { left: `${progressRatio * 100}%` }]} />
                </View>

                {/* Time labels: elapsed / total */}
                <Text style={styles.timeText}>
                  {formatTime(position)} / {formatTime(duration)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Double-tap heart (outside overlay so it's always above video) */}
          <View style={styles.heartWrapper} pointerEvents="none">
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart size={90} color="rgba(255,255,255,0.92)" fill="rgba(255,255,255,0.92)" />
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  statusBarBg: {
    backgroundColor: "#000",
    width: "100%",
  },
  videoArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  videoFill: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoAbsolute: {
    position: "absolute",
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
    top: 7,       // (28 - 13) / 2 = 7.5 ≈ 7
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
});

export default FullscreenVideoModal;
