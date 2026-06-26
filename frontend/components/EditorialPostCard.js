/**
 * EditorialPostCard Component
 *
 * Premium, editorial-first post card design inspired by X (Twitter) and YouTube.
 * Text-first hierarchy with calm, neutral UI. Media supports the post, never dominates.
 *
 * Structure:
 * 1. Author Row (profile, name, username, timestamp, follow button)
 * 2. Post Text (editorial typography)
 * 3. Media Container (optional, variable height based on aspect ratio)
 * 4. Engagement Row (like, comment, views, share, bookmark)
 */
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
  Modal,
  Animated,
} from "react-native";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  Pin,
  Trash2,
  Users,
  RefreshCw,
  X,
  ChartBar,
  TriangleAlert,
  CheckCircle2,
  CircleX,
  Info,
  HatGlasses,
} from "lucide-react-native";
import { ScrollView, Gesture, GestureDetector, Pressable as GHPressable } from "react-native-gesture-handler";
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";
import { apiGet, apiPost, apiDelete, savePost, unsavePost } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import MentionTextRenderer from "./MentionTextRenderer";
import VideoPlayer from "./VideoPlayer";
import FullscreenVideoModal from "./FullscreenVideoModal";
import FollowButton from "./FollowButton";
import CustomAlertModal from "./ui/CustomAlertModal";
import { viewQueueService } from "../services/ViewQueueService";
import HapticsService from "../services/HapticsService";

// Import type-specific card components for special post types
import PollPostCard from "./posts/PollPostCard";
import PromptPostCard from "./posts/PromptPostCard";
import QnAPostCard from "./posts/QnAPostCard";
import ChallengePostCard from "./posts/ChallengePostCard";

import {
  COLORS,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
  BORDER_RADIUS,
  SPACING,
  FONTS,
} from "../constants/theme";

const GradientHeart = ({ width = 150, height = 150 }) => (
  <Svg width={width} height={height} viewBox="0 0 48 48">
    <Defs>
      <LinearGradient id="blueGradient" x1="5%" y1="5%" x2="95%" y2="95%">
        <Stop offset="0%" stopColor="#00f2fe" stopOpacity="1" />
        <Stop offset="45%" stopColor="#00c6ff" stopOpacity="1" />
        <Stop offset="100%" stopColor="#0072ff" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Path
      fill="url(#blueGradient)"
      d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"
    />
  </Svg>
);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONTENT_WIDTH = SCREEN_WIDTH - EDITORIAL_SPACING.cardPadding * 2;

// Helper to normalize tagged entities
const normalizeTaggedEntities = (entities) => {
  if (Array.isArray(entities)) return entities;
  if (typeof entities === "string") {
    try {
      const parsed = JSON.parse(entities);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(
        "[EditorialPostCard] Failed to parse tagged_entities:",
        error,
      );
      return [];
    }
  }
  return [];
};

// Format count for display (e.g., 1234 -> 1.2k)
const formatCount = (count) => {
  if (!count || count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.floor(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
};

const EditorialPostCard = ({
  post,
  onUserPress,
  onLike,
  onComment,
  onFollow,
  onSave,
  onShare,
  onDelete,
  onRequestDelete,
  onPostUpdate,
  onPinToggle,
  currentUserId,
  currentUserType,
  isVideoPlaying = false,
  shouldPreload = false,
  isScreenFocused = true,
  isInViewport = true,
  showFollowButton = true,
  hideSave = false,
  navigation = null,
  showManagementControls = false, // When false (HomeFeed), hides pin button on all card types
}) => {
  // Route to type-specific card components for special post types
  const postType = post.post_type || "media";

  if (postType === "poll") {
    return (
      <PollPostCard
        post={post}
        onUserPress={onUserPress}
        onLike={onLike}
        onComment={onComment}
        onSave={onSave}
        onShare={onShare}
        onDelete={onDelete}
        onPostUpdate={onPostUpdate}
        onPinToggle={onPinToggle}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        showManagementControls={showManagementControls}
      />
    );
  }

  if (postType === "prompt") {
    return (
      <PromptPostCard
        post={post}
        onUserPress={onUserPress}
        onLike={onLike}
        onComment={onComment}
        onSave={onSave}
        onShare={onShare}
        onDelete={onDelete}
        onPostUpdate={onPostUpdate}
        onPinToggle={onPinToggle}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        showManagementControls={showManagementControls}
      />
    );
  }

  if (postType === "qna") {
    return (
      <QnAPostCard
        post={post}
        onUserPress={onUserPress}
        onLike={onLike}
        onComment={onComment}
        onSave={onSave}
        onShare={onShare}
        onDelete={onDelete}
        onPostUpdate={onPostUpdate}
        onPinToggle={onPinToggle}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        showManagementControls={showManagementControls}
      />
    );
  }

  if (postType === "challenge") {
    return (
      <ChallengePostCard
        post={post}
        onUserPress={onUserPress}
        onLike={onLike}
        onComment={onComment}
        onSave={onSave}
        onShare={onShare}
        onDelete={onDelete}
        onPostUpdate={onPostUpdate}
        onPinToggle={onPinToggle}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        showManagementControls={showManagementControls}
      />
    );
  }

  // Default: Media/text post with editorial design
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const videoPositionRef = useRef(0);  // tracks current playback position for modal sync
  const initialIsLiked = post.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [saveCount, setSaveCount] = useState(post.save_count || post.saves_count || 0);
  const [videoViewCounted, setVideoViewCounted] = useState(false);
  const [imageViewCounted, setImageViewCounted] = useState(false);

  // Custom Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });

  const showAlert = (title, message, buttons = null, icon = null, iconColor = null) => {
    if (!buttons || buttons.length === 0) {
      const isSuccess = title.toLowerCase().includes("success") || title.toLowerCase().includes("sent");
      const isError = title.toLowerCase().includes("error") || title.toLowerCase().includes("fail");
      setAlertConfig({
        title,
        message,
        primaryAction: {
          text: "OK",
          onPress: () => setAlertVisible(false),
        },
        secondaryAction: null,
        icon: icon || (isSuccess ? CheckCircle2 : isError ? CircleX : Info),
        iconColor: iconColor || (isSuccess ? "#34C759" : isError ? "#FF3B30" : COLORS.primary),
      });
      setAlertVisible(true);
      return;
    }

    const cancelBtn = buttons.find((b) => b.style === "cancel" || b.text.toLowerCase() === "cancel");
    const actionBtn = buttons.find((b) => b.style !== "cancel" && b.text.toLowerCase() !== "cancel");

    setAlertConfig({
      title,
      message,
      primaryAction: actionBtn
        ? {
            text: actionBtn.text,
            style: actionBtn.style,
            onPress: () => {
              setAlertVisible(false);
              actionBtn.onPress?.();
            },
          }
        : null,
      secondaryAction: cancelBtn
        ? {
            text: cancelBtn.text,
            onPress: () => {
              setAlertVisible(false);
              cancelBtn.onPress?.();
            },
          }
        : null,
      icon: icon || (actionBtn?.style === "destructive" ? TriangleAlert : Info),
      iconColor: iconColor || (actionBtn?.style === "destructive" ? "#FF3B30" : COLORS.primary),
    });
    setAlertVisible(true);
  };

  // ── View Insights state ────────────────────────────────────────────────────
  const [viewStatsVisible, setViewStatsVisible] = useState(false);
  const [viewStats, setViewStats] = useState(null); // { unique_views, total_views }
  const [viewStatsLoading, setViewStatsLoading] = useState(false);
  const viewSheetAnim = useRef(new Animated.Value(0)).current;

  // ── Double Tap to Like state ───────────────────────────────────────────────
  const heartX = useSharedValue(0);
  const heartY = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const heartRotation = useSharedValue(0);

  // ── Normalise image_urls ──────────────────────────────────────────────────
  // The API may return a nested array [["url1","url2"]] when the raw DB value
  // is a JSON string that gets double-parsed somewhere in the pipeline.
  // .flat() guarantees we always work with ["url1", "url2"].
  const imageUrls = Array.isArray(post.image_urls)
    ? post.image_urls.flat()
    : [];

  console.log(
    `[EditorialPostCard] post=${post.id} image_urls raw=`,
    JSON.stringify(post.image_urls),
    `→ normalised count=${imageUrls.length}`,
  );

  const isAnon = post.type_data?.is_anonymous === true || post.is_anonymous === true;

  // Check if post has media and determine type
  const hasMedia = imageUrls.length > 0;
  const firstMediaUrl = hasMedia ? imageUrls[0] : null;

  // Determine if first media is video: check media_types OR fallback to URL extension
  const firstMediaType =
    post.media_types?.[0] ||
    (() => {
      if (firstMediaUrl) {
        const lowerUrl = firstMediaUrl.toLowerCase();
        if (
          lowerUrl.includes(".mp4") ||
          lowerUrl.includes(".mov") ||
          lowerUrl.includes(".webm") ||
          lowerUrl.includes(".avi")
        ) {
          return "video";
        }
      }
      return "image";
    })();
  const isVideo = firstMediaType === "video";
  const isImage = hasMedia && !isVideo;
  const isTextOnly = !hasMedia;
  const hasMultipleMedia = imageUrls.length > 1;

  // Carousel state
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const currentIndexShared = useSharedValue(0);

  const disableSwipe = () => {
    EventBus.emit("disable-tab-swipe");
  };
  const enableSwipe = () => {
    EventBus.emit("enable-tab-swipe");
  };

  const syncActiveIndex = (index) => {
    setCurrentMediaIndex(index);
  };

  const carouselGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-8, 8])
        .onStart(() => {
          "worklet";
          startX.value = translateX.value;
          runOnJS(disableSwipe)();
        })
        .onUpdate((e) => {
          "worklet";
          const proposed = startX.value + e.translationX;
          const minX = -(imageUrls.length - 1) * CONTENT_WIDTH;
          const maxX = 0;
          if (proposed > maxX) {
            translateX.value = maxX;
          } else if (proposed < minX) {
            translateX.value = minX;
          } else {
            translateX.value = proposed;
          }
        })
        .onEnd((e) => {
          "worklet";
          const SWIPE_DISTANCE_THRESHOLD = CONTENT_WIDTH * 0.25;
          const VELOCITY_THRESHOLD = 500;
          const current = currentIndexShared.value;
          let target = current;

          if (
            e.translationX < -SWIPE_DISTANCE_THRESHOLD ||
            e.velocityX < -VELOCITY_THRESHOLD
          ) {
            target = Math.min(current + 1, imageUrls.length - 1);
          } else if (
            e.translationX > SWIPE_DISTANCE_THRESHOLD ||
            e.velocityX > VELOCITY_THRESHOLD
          ) {
            target = Math.max(current - 1, 0);
          }

          translateX.value = withSpring(-target * CONTENT_WIDTH, {
            damping: 25,
            stiffness: 200,
            mass: 0.8,
            velocity: e.velocityX,
          });
          currentIndexShared.value = target;
          runOnJS(syncActiveIndex)(target);
        })
        .onFinalize(() => {
          "worklet";
          runOnJS(enableSwipe)();
        }),
    [imageUrls.length, CONTENT_WIDTH],
  );

  const carouselRowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  // Image/text dwell time tracking - starts timer when component mounts
  const imageDwellStartRef = React.useRef(null);
  const imageDwellTimerRef = React.useRef(null);

  useEffect(() => {
    // Skip video (handled separately) or not in viewport
    if (isVideo || !isInViewport) return;

    const dwellThreshold = 2500; // 2.5s for all post types (image, text)

    const alreadyViewed = viewQueueService.hasViewed(post.id);
    console.log(`[EditorialPostCard] Dwell timer START post=${post.id} alreadyViewed=${alreadyViewed} threshold=${dwellThreshold}ms`);

    if (!alreadyViewed) {
      // ── Fresh view path: qualify and count as unique viewer ──────────────
      imageDwellStartRef.current = Date.now();
      imageDwellTimerRef.current = setTimeout(() => {
        if (!imageViewCounted && !viewQueueService.hasViewed(post.id)) {
          setImageViewCounted(true);
          viewQueueService.addQualifiedView(post.id, {
            postType: isImage ? "image" : "text",
            trigger: "dwell",
            dwellTime: dwellThreshold,
          });
        }
      }, dwellThreshold);
    } else {
      // ── Repeat view path: user is revisiting a post they already counted ──
      // addRepeatView contributes to total_views (impressions) only, not unique.
      imageDwellTimerRef.current = setTimeout(() => {
        viewQueueService.addRepeatView(post.id, "revisit");
      }, dwellThreshold);
    }

    return () => {
      if (imageDwellTimerRef.current) {
        clearTimeout(imageDwellTimerRef.current);
      }
    };
  }, [post.id, isVideo, isImage, imageViewCounted, isInViewport]);

  // Video qualified view tracking callbacks
  const handleVideoUnmute = useCallback(() => {
    if (!videoViewCounted && !viewQueueService.hasViewed(post.id)) {
      setVideoViewCounted(true);
      viewQueueService.addQualifiedView(post.id, {
        postType: "video",
        trigger: "unmute",
      });
    }
  }, [post.id, videoViewCounted]);

  const handleVideoFullscreen = useCallback(() => {
    if (!videoViewCounted && !viewQueueService.hasViewed(post.id)) {
      setVideoViewCounted(true);
      viewQueueService.addQualifiedView(post.id, {
        postType: "video",
        trigger: "fullscreen",
      });
    }
    // Open the immersive fullscreen modal
    setFullscreenVisible(true);
  }, [post.id, videoViewCounted]);

  // Track current video position so the fullscreen modal can seek to the same point
  const handleVideoPositionChange = useCallback((posSeconds) => {
    videoPositionRef.current = posSeconds;
  }, []);

  // Track playback time for 2-second threshold
  const playbackStartTimeRef = React.useRef(null);
  const handleVideoPlaybackChange = useCallback(
    (isPlaying) => {
      if (isPlaying) {
        playbackStartTimeRef.current = Date.now();
        // Check after 2.5 seconds if still playing
        setTimeout(() => {
          if (!playbackStartTimeRef.current) return;
          const elapsed = Date.now() - playbackStartTimeRef.current;
          if (elapsed < 2500) return;

          if (!videoViewCounted && !viewQueueService.hasViewed(post.id)) {
            // ── First-time view: qualify as unique viewer ──
            setVideoViewCounted(true);
            viewQueueService.addQualifiedView(post.id, {
              postType: "video",
              trigger: "playback",
              dwellTime: elapsed,
            });
          } else {
            // ── Repeat view: user already counted, log impression only ──
            viewQueueService.addRepeatView(post.id, "revisit");
          }
        }, 2500);
      } else {
        playbackStartTimeRef.current = null;
      }
    },
    [post.id, videoViewCounted],
  );

  const taggedEntities = useMemo(
    () => normalizeTaggedEntities(post.tagged_entities),
    [post.tagged_entities],
  );

  // Sync state when post prop changes
  useEffect(() => {
    setIsLiked(post.is_liked === true || post.isLiked === true);
    setLikeCount(post.like_count || 0);
    setIsSaved(post.is_saved || false);
    setSaveCount(post.save_count || post.saves_count || 0);
  }, [post.is_liked, post.isLiked, post.like_count, post.is_saved, post.save_count, post.saves_count]);

  // Format timestamp to lowercase relative time
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const handleLike = async () => {
    if (isLiking) return;
    HapticsService.triggerLike();

    const prevLiked = isLiked;
    const prevLikeCount = likeCount;
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;
    const nextLikes = Math.max(0, prevLikeCount + delta);

    // Optimistic update
    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    if (onLike) onLike(post.id, nextLiked, nextLikes);

    setIsLiking(true);
    try {
      const token = await getAuthToken();
      if (nextLiked) {
        await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
      } else {
        await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
      }
      EventBus.emit("post-like-updated", {
        postId: post.id,
        isLiked: nextLiked,
        likeCount: nextLikes,
      });
    } catch (error) {
      console.error("Error liking post:", error);
      // Revert on error
      setIsLiked(prevLiked);
      setLikeCount(prevLikeCount);
      if (onLike) onLike(post.id, prevLiked, prevLikeCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleCommentPress = () => {
    HapticsService.triggerComment();
    if (onComment) {
      onComment(post.id);
    }
  };

  const handleSave = async () => {
    HapticsService.triggerSave();
    const newSaveState = !isSaved;
    const prevSaveCount = saveCount;
    const nextSaveCount = Math.max(0, saveCount + (newSaveState ? 1 : -1));

    // Optimistic update
    setIsSaved(newSaveState);
    setSaveCount(nextSaveCount);

    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await savePost(post.id, token);
      } else {
        await unsavePost(post.id, token);
      }
      // Notify all screens to sync save state
      EventBus.emit("post-save-updated", {
        postId: post.id,
        isSaved: newSaveState,
        saveCount: nextSaveCount,
      });
      if (onSave) onSave(post.id, newSaveState);
    } catch (error) {
      console.error("Failed to save/unsave post:", error);
      // If server says "already saved", our local state was stale — correct it
      if (error?.message?.toLowerCase().includes("already saved")) {
        setIsSaved(true);
        setSaveCount(prevSaveCount);
      } else {
        setIsSaved(!newSaveState);
        setSaveCount(prevSaveCount);
      }
    }
  };

  const handleShare = () => {
    HapticsService.triggerShare();
    if (onShare) onShare(post.id);
  };

  const handleFollowChange = async (userId, userType, shouldFollow) => {
    if (onFollow) {
      await onFollow(userId, userType, shouldFollow);
    }
  };

  const handleDeletePress = () => {
    if (onRequestDelete) {
      // Use custom handler (e.g. for custom modal)
      onRequestDelete(post.id);
      return;
    }

    // Default legacy behavior
    showAlert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (onDelete) onDelete(post.id);
          },
        },
      ],
    );
  };

  // Get additional media info for rendering (firstMediaUrl already defined above)
  // Handle both array format ([1.91]) and single number format (1.91) for aspect_ratios
  const rawAspectRatio = post.aspect_ratios;
  const firstAspectRatio = Array.isArray(rawAspectRatio)
    ? rawAspectRatio[0] || 4 / 5
    : typeof rawAspectRatio === "number"
      ? rawAspectRatio
      : 4 / 5;

  // Instagram-standard aspect ratio capping for video containers.
  // Without a cap, a 9:21 screen recording produces a container taller than
  // the phone screen, and contentFit="cover" shows the ENTIRE video — no framing.
  // Cap: portrait allows down to 9:16 (so user-chosen 9:16 crop displays correctly),
  //      landscape caps at 1.91:1 to prevent extreme wide containers.
  const videoNativeAR = post.video_aspect_ratio || firstAspectRatio;
  const clampedVideoAR = videoNativeAR < 1
    ? Math.max(videoNativeAR, 9 / 16)  // portrait: cap at 9:16 (allows 4:5 and 9:16 crops)
    : Math.min(videoNativeAR, 1.91);    // landscape: cap at 1.91:1

  // Check if author is the current user (to hide follow button)
  // Convert both to strings since author_id from API is string but currentUserId might be number
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  console.log("[EditorialPostCard] isOwnPost check:", {
    postId: post.id,
    authorId: post.author_id,
    authorType: post.author_type,
    currentUserId,
    currentUserType,
    isOwnPost,
    showFollowButton,
    willShowButton: showFollowButton && !isOwnPost,
    isFollowing: post.is_following,
  });

  // [VIDEO INSIGHTS - DEFERRED] handleVideoInsightsPress and navigation to VideoInsights screen removed for v1 launch.
  // Restore this block when re-enabling the feature:
  // const handleVideoInsightsPress = useCallback(async () => {
  //   if (!navigation) return;
  //   const token = await getAuthToken();
  //   navigation.navigate('VideoInsights', {
  //     videoId: post.id,
  //     token,
  //     videoMeta: {
  //       title: post.caption || null,
  //       thumbnail_url: post.video_thumbnail || null,
  //       created_at: post.created_at,
  //       duration_seconds: post.duration_seconds || 0,
  //     },
  //   });
  // }, [navigation, post]);

  // ── View Stats handler ─────────────────────────────────────────────────────
  const handleViewPress = useCallback(async () => {
    HapticsService.triggerView();
    setViewStatsVisible(true);
    Animated.spring(viewSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setViewStatsLoading(true);
    try {
      // Flush any pending view events first so the fetched stats are up-to-date
      await viewQueueService.flushQueue();
      const token = await getAuthToken();
      const data = await apiGet(`/posts/${post.id}/view-stats`, 8000, token);
      setViewStats(data);
    } catch (e) {
      setViewStats({
        unique_views: post.public_view_count || 0,
        total_views: post.view_count || post.public_view_count || 0,
      });
    } finally {
      setViewStatsLoading(false);
    }
  }, [post.id, post.public_view_count, post.view_count, viewSheetAnim]);

  const handleCloseViewStats = useCallback(() => {
    HapticsService.triggerClose();
    Animated.timing(viewSheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setViewStatsVisible(false);
      setViewStats(null); // clear so fresh data is fetched next open
    });
  }, [viewSheetAnim]);

  const sheetTranslateY = viewSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ── Double Tap to Like gesture ─────────────────────────────────────────────
  const onDoubleTap = (e) => {
    // Only like, don't unlike on double tap
    if (!isLiked && !isLiking) {
      handleLike();
    } else {
      HapticsService.triggerImpactLight();
    }

    // trigger animation
    heartX.value = e.x;
    heartY.value = e.y;
    heartScale.value = 0;
    heartRotation.value = Math.random() * 30 - 15; // Randomize rotation slightly (-15 to 15 deg)

    heartScale.value = withSequence(
      withTiming(1.2, { duration: 250 }), // Pop in
      withTiming(0.9, { duration: 150 }), // Jiggle down
      withTiming(1.05, { duration: 150 }), // Jiggle up
      withTiming(1, { duration: 150 }), // Settle
      withTiming(1, { duration: 800 }), // Hold state
      withTiming(0, { duration: 500 }) // Fade out
    );
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onStart((e) => {
      runOnJS(onDoubleTap)(e);
    });

  const heartStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: heartY.value - 75, // Center the 150px heart
    left: heartX.value - 75,
    transform: [
      { scale: heartScale.value },
      { rotate: `${heartRotation.value}deg` }
    ],
    opacity: heartScale.value > 0 ? 1 : 0,
    zIndex: 1000,
  }));

  return (
    <View style={styles.container}>
      {/* Author Row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          {!isAnon && post.author_photo_url ? (
            <Image
              source={{ uri: post.author_photo_url }}
              style={styles.profileImage}
            />
          ) : !isAnon ? (
            <Image
              source={{
                uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  post.author_name || "U",
                )}&background=E5E7EB&color=6B7280&size=88`,
              }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.anonProfileImage}>
              <HatGlasses size={18} color={COLORS.primary} strokeWidth={2} />
            </View>
          )}
          <View style={styles.authorTextContainer}>
            <View style={styles.authorNameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {post.author_name || "Unknown"}
              </Text>
              {post.is_verified && !isAnon && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedIcon}>✓</Text>
                </View>
              )}
            </View>
            <View style={styles.usernameRow}>
              {!isAnon && (
                <>
                  <Text style={styles.username} numberOfLines={1}>
                    @{post.author_username || "user"}
                  </Text>
                  <Text style={styles.separator}>•</Text>
                </>
              )}
              <Text style={styles.timestamp}>
                {formatTimeAgo(post.created_at)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Follow Button */}
        {showFollowButton && !isOwnPost && !isAnon && (
          <FollowButton
            userId={post.author_id}
            userType={post.author_type}
            isFollowing={post.is_following}
            onFollowChange={handleFollowChange}
            style={styles.followButton}
            textStyle={styles.followButtonText}
            currentFollowerId={currentUserId}
            navigationContext={{
              navigationState: { routeName: isVideo ? 'PostView' : 'HomeFeed' },
              lastContentInteraction: {
                type: isVideo ? 'video' : 'post',
                contentId: post.id,
              },
            }}
          />
        )}

        {/* Pin Button — only shown in profile screens (showManagementControls=true) */}
        {showManagementControls && onPinToggle && (
          <TouchableOpacity
            style={[styles.pinButton, post.is_pinned && styles.pinButtonPinned]}
            onPress={() => onPinToggle(post, true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.pinIconWrapper}>
              <Pin
                size={18}
                color={post.is_pinned ? "#10B981" : "#9CA3AF"}
                fill={post.is_pinned ? "#10B981" : "none"}
              />
            </View>
          </TouchableOpacity>
        )}

        {/* Ellipsis Menu for Own Posts */}
        {isOwnPost && onDelete && (
          <TouchableOpacity
            style={styles.ellipsisButton}
            onPress={handleDeletePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ellipsis size={20} color={COLORS.editorial.textSecondary} />
          </TouchableOpacity>
        )}

        {/* [VIDEO INSIGHTS - DEFERRED] ChartBar insights button removed for v1 launch.
          Restore when re-enabling: isOwnPost && isVideo && navigation &&
          <TouchableOpacity style={styles.insightsButton} onPress={handleVideoInsightsPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChartBar size={18} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        */}
      </View>

      {/* Post Text */}
      {post.caption && (
        <View style={styles.textContainer}>
          <MentionTextRenderer
            text={post.caption}
            taggedEntities={taggedEntities}
            textStyle={styles.postText}
            mentionStyle={styles.mentionText}
            onMentionPress={(entity) => {
              if (!entity?.id || !onUserPress) return;
              onUserPress(entity.id, entity.type || "member");
            }}
          />
        </View>
      )}

      {/* Media Container */}
      {hasMedia && firstMediaUrl && (
        <GestureDetector gesture={doubleTap}>
          <View style={styles.mediaContainer}>
          {isVideo ? (
            <View
              style={[
                styles.mediaWrapper,
                {
                  width: CONTENT_WIDTH,
                  height: CONTENT_WIDTH / clampedVideoAR,
                },
              ]}
            >
              <VideoPlayer
                source={post.video_url || firstMediaUrl}
                thumbnailUrl={post.video_thumbnail}
                lqipUrl={post.video_lqip}
                hlsUrl={post.video_hls_url || null}
                durationSeconds={post.duration_seconds || null}
                shouldPreload={shouldPreload}
                aspectRatio={clampedVideoAR}
                containerWidth={CONTENT_WIDTH}
                postId={post.id} // For VideoContext registration
                autoplay={true}
                muted={true}
                loop={true}
                showControls={true}
                isVisible={isVideoPlaying}
                isScreenFocused={isScreenFocused}
                isFullscreen={false} // Feed view - show Watch Again overlay
                onUnmute={handleVideoUnmute}
                onFullscreen={handleVideoFullscreen}
                onPlaybackStart={handleVideoPlaybackChange}
                onPositionChange={handleVideoPositionChange}
                onDoubleTap={onDoubleTap}
                cropMetadata={post.video_crop_transform || null}
                viewerId={currentUserId}
                viewSource="for_you"
              />
            </View>
          ) : hasMultipleMedia ? (
            // Carousel for multiple images
            <GestureDetector gesture={carouselGesture}>
              <View style={{ width: CONTENT_WIDTH, overflow: 'hidden' }}>
                {/* Counter badge */}
                <View style={styles.carouselBadge} pointerEvents="none">
                  <Text style={styles.carouselBadgeText}>
                    {currentMediaIndex + 1}/{imageUrls.length}
                  </Text>
                </View>

                <AnimatedReanimated.View
                  style={[
                    {
                      flexDirection: "row",
                      width: imageUrls.length * CONTENT_WIDTH,
                    },
                    carouselRowStyle,
                  ]}
                >
                  {imageUrls.map((url, index) => {
                    // Handle both array and single number formats for aspect_ratios
                    const aspectRatio = Array.isArray(post.aspect_ratios)
                      ? post.aspect_ratios[index] || firstAspectRatio
                      : firstAspectRatio;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.mediaWrapper,
                          { aspectRatio, width: CONTENT_WIDTH },
                        ]}
                      >
                        <Image
                          source={{ uri: url }}
                          style={styles.mediaImage}
                          resizeMode="cover"
                        />
                      </View>
                    );
                  })}
                </AnimatedReanimated.View>

                {/* Pagination Dots */}
                <View style={styles.paginationContainer} pointerEvents="none">
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentMediaIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </GestureDetector>
          ) : (
            // Single image
            <View
              style={[
                styles.mediaWrapper,
                {
                  width: CONTENT_WIDTH,
                  height: CONTENT_WIDTH / firstAspectRatio,
                },
              ]}
            >
              <Image
                source={{ uri: firstMediaUrl }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Double Tap Heart Overlay */}
          <AnimatedReanimated.View style={heartStyle} pointerEvents="none">
            <GradientHeart />
          </AnimatedReanimated.View>
        </View>
        </GestureDetector>
      )}

      {/* Engagement Row */}
      <View style={styles.engagementRow}>
        {/* Like */}
        <GHPressable
          style={styles.engagementButton}
          onPress={handleLike}
          disabled={isLiking}
        >
          <Heart
            size={EDITORIAL_SPACING.iconSize}
            color={isLiked ? COLORS.error : COLORS.editorial.textSecondary}
            fill={isLiked ? COLORS.error : "transparent"}
          />
          <Text style={[styles.engagementCount, isLiked && styles.likedCount]}>
            {formatCount(likeCount)}
          </Text>
        </GHPressable>

        {/* Comment */}
        <GHPressable style={styles.engagementButton} onPress={handleCommentPress}>
          <MessageCircle
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.comment_count || 0)}
          </Text>
        </GHPressable>

        {/* Views */}
        <GHPressable style={styles.engagementButton} onPress={handleViewPress}>
          <ChartNoAxesCombined
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.public_view_count || post.view_count || 0)}
          </Text>
        </GHPressable>

        {/* Share */}
        <GHPressable style={styles.engagementButton} onPress={handleShare}>
          <Send
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.share_count || 0)}
          </Text>
        </GHPressable>

        {/* Bookmark */}
        {!hideSave && (
          <GHPressable style={styles.engagementButton} onPress={handleSave}>
            <Bookmark
              size={EDITORIAL_SPACING.iconSize}
              color={COLORS.editorial.textSecondary}
              fill={isSaved ? COLORS.editorial.textSecondary : "transparent"}
            />
            {saveCount > 0 && (
              <Text style={styles.engagementCount}>
                {formatCount(saveCount)}
              </Text>
            )}
          </GHPressable>
        )}
      </View>

      {/* Fullscreen Video Modal */}
      {isVideo && fullscreenVisible && (
        <FullscreenVideoModal
          visible={fullscreenVisible}
          source={post.video_url || firstMediaUrl}
          onClose={() => setFullscreenVisible(false)}
          post={post}
          onLike={handleLike}
          onComment={handleCommentPress}
          onShare={handleShare}
          onSave={handleSave}
          onFollow={handleFollowChange}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          cropMetadata={post.video_crop_transform || null}
          initialPosition={videoPositionRef.current}
        />
      )}

      {/* View Insights Bottom Sheet Modal */}
      <Modal
        visible={viewStatsVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseViewStats}
        statusBarTranslucent
      >
        <Pressable style={viewStyles.overlay} onPress={handleCloseViewStats}>
          <Animated.View
            style={[viewStyles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={viewStyles.handle} />
              <View style={viewStyles.header}>
                <View style={viewStyles.headerLeft}>
                  <ChartNoAxesCombined size={18} color="#3565F2" strokeWidth={2} />
                  <Text style={viewStyles.headerTitle}>View Insights</Text>
                </View>
                <Pressable onPress={handleCloseViewStats} hitSlop={12}>
                  <X size={18} color="#8FA1B8" strokeWidth={2} />
                </Pressable>
              </View>
              {viewStatsLoading ? (
                <View style={viewStyles.loadingRow}>
                  <Text style={viewStyles.loadingText}>Loading…</Text>
                </View>
              ) : (
                <>
                  <View style={viewStyles.statRow}>
                    <View style={[viewStyles.statIconBox, { backgroundColor: "rgba(53,101,242,0.10)" }]}>
                      <Users size={18} color="#3565F2" strokeWidth={2} />
                    </View>
                    <View style={viewStyles.statTextCol}>
                      <Text style={viewStyles.statValue}>
                        {formatCount(viewStats?.unique_views ?? (post.public_view_count || 0))}
                      </Text>
                      <Text style={viewStyles.statLabel}>Unique viewers</Text>
                    </View>
                  </View>
                  <View style={viewStyles.statRow}>
                    <View style={[viewStyles.statIconBox, { backgroundColor: "rgba(108,77,246,0.10)" }]}>
                      <RefreshCw size={18} color="#6C4DF6" strokeWidth={2} />
                    </View>
                    <View style={viewStyles.statTextCol}>
                      <Text style={viewStyles.statValue}>
                        {formatCount(viewStats?.total_views ?? (post.view_count || 0))}
                      </Text>
                      <Text style={viewStyles.statLabel}>Total impressions</Text>
                    </View>
                  </View>
                  <View style={viewStyles.explainerBox}>
                    <Text style={viewStyles.explainerText}>
                      Unique viewers are people who saw this post for the first time.
                      Total impressions include everyone who revisited.
                    </Text>
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      <CustomAlertModal
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.editorial.background,
    paddingVertical: EDITORIAL_SPACING.cardPadding,
    marginBottom: SPACING.m,
  },

  // Author Row
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: EDITORIAL_SPACING.sectionGap,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: EDITORIAL_SPACING.profileImageSize,
    height: EDITORIAL_SPACING.profileImageSize,
    borderRadius: EDITORIAL_SPACING.profileImageSize / 2,
    backgroundColor: COLORS.editorial.mediaPlaceholder,
  },
  anonProfileImage: {
    width: EDITORIAL_SPACING.profileImageSize,
    height: EDITORIAL_SPACING.profileImageSize,
    borderRadius: EDITORIAL_SPACING.profileImageSize / 2,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  authorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    ...EDITORIAL_TYPOGRAPHY.displayName,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.editorial.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  verifiedIcon: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  username: {
    ...EDITORIAL_TYPOGRAPHY.username,
  },
  separator: {
    ...EDITORIAL_TYPOGRAPHY.username,
    marginHorizontal: 6,
  },
  timestamp: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 12,
  },
  followButtonText: {
    ...EDITORIAL_TYPOGRAPHY.followButton,
  },
  ellipsisButton: {
    padding: 8,
    marginLeft: 4,
  },
  pinButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  pinButtonPinned: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  pinIconWrapper: {
    transform: [{ rotate: "27deg" }],
    overflow: "visible",
  },
  insightsButton: {
    padding: 8,
    marginLeft: 4,
  },

  // Post Text
  textContainer: {
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: EDITORIAL_SPACING.sectionGap,
  },
  postText: {
    ...EDITORIAL_TYPOGRAPHY.postText,
  },
  mentionText: {
    color: COLORS.editorial.accent,
    fontFamily: FONTS.semiBold,
  },

  // Media Container
  mediaContainer: {
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: 8,
  },
  mediaWrapper: {
    width: CONTENT_WIDTH,
    borderRadius: EDITORIAL_SPACING.mediaCornerRadius,
    overflow: "hidden",
    backgroundColor: COLORS.editorial.mediaPlaceholder,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.editorial.border,
  },
  paginationDotActive: {
    backgroundColor: COLORS.editorial.textPrimary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  carouselBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  carouselBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
  },

  // Engagement Row
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: EDITORIAL_SPACING.cardPadding + 4,
    marginTop: 0,
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    minWidth: 40,
    justifyContent: "center",
  },
  engagementCount: {
    ...EDITORIAL_TYPOGRAPHY.engagementCount,
    marginLeft: EDITORIAL_SPACING.iconCountGap,
  },
  likedCount: {
    color: COLORS.error,
  },
});

// ── View Insights sheet styles ─────────────────────────────────────────────
const viewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 17,
    color: "#1F3A5F",
  },
  loadingRow: {
    paddingVertical: 32,
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#8FA1B8",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F8",
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  statTextCol: {
    flex: 1,
  },
  statValue: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#1F3A5F",
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#8FA1B8",
    marginTop: 2,
  },
  explainerBox: {
    marginTop: 16,
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    padding: 14,
  },
  explainerText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#8FA1B8",
    lineHeight: 18,
  },
});

export default EditorialPostCard;
