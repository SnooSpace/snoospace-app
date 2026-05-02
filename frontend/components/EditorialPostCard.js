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
  ScrollView,
  Alert,
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
  Trash2,
  Users,
  RefreshCw,
  X,
} from "lucide-react-native";
import { apiGet, apiPost, apiDelete, savePost, unsavePost } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import MentionTextRenderer from "./MentionTextRenderer";
import VideoPlayer from "./VideoPlayer";
import FollowButton from "./FollowButton";
import { viewQueueService } from "../services/ViewQueueService";

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
  onRequestDelete, // Optional: function(postId) -> void. If provided, overrides internal Alert.
  onPostUpdate, // New prop
  currentUserId,
  currentUserType,
  isVideoPlaying = false,
  isScreenFocused = true,
  isInViewport = true, // Must be explicitly passed in multi-post feeds (HomeFeed, ProfilePostFeed). Default true for single-post detail screens.
  showFollowButton = true,
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
        currentUserId={currentUserId}
        currentUserType={currentUserType}
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
        currentUserId={currentUserId}
        currentUserType={currentUserType}
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
        currentUserId={currentUserId}
        currentUserType={currentUserType}
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
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
    );
  }

  // Default: Media/text post with editorial design
  const initialIsLiked = post.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [saveCount, setSaveCount] = useState(post.save_count || post.saves_count || 0);
  const [videoViewCounted, setVideoViewCounted] = useState(false);
  const [imageViewCounted, setImageViewCounted] = useState(false);

  // ── View Insights state ────────────────────────────────────────────────────
  const [viewStatsVisible, setViewStatsVisible] = useState(false);
  const [viewStats, setViewStats] = useState(null); // { unique_views, total_views }
  const [viewStatsLoading, setViewStatsLoading] = useState(false);
  const viewSheetAnim = useRef(new Animated.Value(0)).current;

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
  const scrollViewRef = useRef(null);

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
  }, [post.id, videoViewCounted]);

  // Track playback time for 2-second threshold
  const playbackStartTimeRef = React.useRef(null);
  const handleVideoPlaybackChange = useCallback(
    (isPlaying) => {
      if (isPlaying) {
        playbackStartTimeRef.current = Date.now();
        // Check after 2.5 seconds if still playing
        setTimeout(() => {
          if (
            playbackStartTimeRef.current &&
            !videoViewCounted &&
            !viewQueueService.hasViewed(post.id)
          ) {
            const elapsed = Date.now() - playbackStartTimeRef.current;
            if (elapsed >= 2500) {
              setVideoViewCounted(true);
              viewQueueService.addQualifiedView(post.id, {
                postType: "video",
                trigger: "playback",
                dwellTime: elapsed,
              });
            }
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
    if (onComment) {
      onComment(post.id);
    }
  };

  const handleSave = async () => {
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
      // Revert on error
      setIsSaved(!newSaveState);
      setSaveCount(prevSaveCount);
    }
  };

  const handleShare = () => {
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
    Alert.alert(
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
  const firstCropMetadata = post.crop_metadata?.[0] || null; // NEW: Get crop metadata for first media

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

  // ── View Stats handler ─────────────────────────────────────────────────────
  const handleViewPress = useCallback(async () => {
    setViewStatsVisible(true);
    Animated.spring(viewSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (viewStats) return;
    setViewStatsLoading(true);
    try {
      const token = await getAuthToken();
      const data = await apiGet(`/posts/${post.id}/view-stats`, 8000, token);
      setViewStats(data);
    } catch (e) {
      setViewStats({
        unique_views: post.public_view_count || post.view_count || 0,
        total_views: post.public_view_count || post.view_count || 0,
      });
    } finally {
      setViewStatsLoading(false);
    }
  }, [post.id, post.public_view_count, post.view_count, viewStats, viewSheetAnim]);

  const handleCloseViewStats = useCallback(() => {
    Animated.timing(viewSheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setViewStatsVisible(false));
  }, [viewSheetAnim]);

  const sheetTranslateY = viewSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={styles.container}>
      {/* Author Row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          <Image
            source={
              post.author_photo_url
                ? { uri: post.author_photo_url }
                : {
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      post.author_name || "U",
                    )}&background=E5E7EB&color=6B7280&size=88`,
                  }
            }
            style={styles.profileImage}
          />
          <View style={styles.authorTextContainer}>
            <View style={styles.authorNameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {post.author_name || "Unknown"}
              </Text>
              {post.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedIcon}>✓</Text>
                </View>
              )}
            </View>
            <View style={styles.usernameRow}>
              <Text style={styles.username} numberOfLines={1}>
                @{post.author_username || "user"}
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.timestamp}>
                {formatTimeAgo(post.created_at)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Follow Button */}
        {showFollowButton && !isOwnPost && (
          <FollowButton
            userId={post.author_id}
            userType={post.author_type}
            isFollowing={post.is_following}
            onFollowChange={handleFollowChange}
            style={styles.followButton}
            textStyle={styles.followButtonText}
          />
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
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <View
              style={[
                styles.mediaWrapper,
                {
                  width: CONTENT_WIDTH,
                  height: CONTENT_WIDTH / firstAspectRatio,
                },
              ]}
            >
              <VideoPlayer
                source={post.video_hls_url || post.video_url || firstMediaUrl}
                thumbnailUrl={post.video_thumbnail}
                aspectRatio={post.video_aspect_ratio || firstAspectRatio}
                containerWidth={CONTENT_WIDTH}
                cropMetadata={firstCropMetadata}
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
              />
            </View>
          ) : hasMultipleMedia ? (
            // Carousel for multiple images
            <View style={{ width: CONTENT_WIDTH, overflow: 'hidden' }}>
              {/* Counter badge */}
              <View style={styles.carouselBadge} pointerEvents="none">
                <Text style={styles.carouselBadgeText}>
                  {currentMediaIndex + 1}/{imageUrls.length}
                </Text>
              </View>

              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / CONTENT_WIDTH);
                  setCurrentMediaIndex(index);
                }}
                scrollEventThrottle={16}
                style={{ width: CONTENT_WIDTH }}
                decelerationRate="fast"
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
              </ScrollView>

              {/* Pagination Dots */}
              <View style={styles.paginationContainer}>
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
        </View>
      )}

      {/* Engagement Row */}
      <View style={styles.engagementRow}>
        {/* Like */}
        <Pressable
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
        </Pressable>

        {/* Comment */}
        <Pressable style={styles.engagementButton} onPress={handleCommentPress}>
          <MessageCircle
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.comment_count || 0)}
          </Text>
        </Pressable>

        {/* Views */}
        <Pressable style={styles.engagementButton} onPress={handleViewPress}>
          <ChartNoAxesCombined
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.public_view_count || post.view_count || 0)}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.engagementButton} onPress={handleShare}>
          <Send
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.share_count || 0)}
          </Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable style={styles.engagementButton} onPress={handleSave}>
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
        </Pressable>
      </View>

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
                        {formatCount(viewStats?.total_views ?? (post.public_view_count || 0))}
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
