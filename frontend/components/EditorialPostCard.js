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
} from "react-native";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
} from "lucide-react-native";
import { apiPost, apiDelete } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import MentionTextRenderer from "./MentionTextRenderer";
import VideoPlayer from "./VideoPlayer";
import FullscreenVideoModal from "./FullscreenVideoModal";
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
  currentUserId,
  currentUserType,
  isVideoPlaying = false,
  showFollowButton = true,
}) => {
  // Route to type-specific card components for special post types
  const postType = post.post_type || "media";

  if (postType === "poll") {
    return (
      <PollPostCard
        post={post}
        onUserPress={onUserPress}
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
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [videoViewCounted, setVideoViewCounted] = useState(false);
  const [imageViewCounted, setImageViewCounted] = useState(false);

  // Check if post has media and determine type
  const hasMedia = post.image_urls && post.image_urls.length > 0;
  const firstMediaUrl = hasMedia ? post.image_urls.flat()[0] : null;

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
  const hasMultipleMedia = hasMedia && post.image_urls.length > 1;

  // Carousel state
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const scrollViewRef = useRef(null);

  // Image/text dwell time tracking - starts timer when component mounts
  const imageDwellStartRef = React.useRef(null);
  const imageDwellTimerRef = React.useRef(null);

  useEffect(() => {
    // Skip if video (handled separately) or already counted
    if (isVideo || viewQueueService.hasViewed(post.id)) {
      return;
    }

    const dwellThreshold = isImage ? 1500 : 2000; // 1.5s for images, 2s for text

    // Start dwell timer when component mounts (becomes visible)
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

    return () => {
      if (imageDwellTimerRef.current) {
        clearTimeout(imageDwellTimerRef.current);
      }
    };
  }, [post.id, isVideo, isImage, imageViewCounted]);

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
        // Check after 2 seconds if still playing
        setTimeout(() => {
          if (
            playbackStartTimeRef.current &&
            !videoViewCounted &&
            !viewQueueService.hasViewed(post.id)
          ) {
            const elapsed = Date.now() - playbackStartTimeRef.current;
            if (elapsed >= 2000) {
              setVideoViewCounted(true);
              viewQueueService.addQualifiedView(post.id, {
                postType: "video",
                trigger: "playback",
                dwellTime: elapsed,
              });
            }
          }
        }, 2000);
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
    setIsLiked(post.is_liked === true);
    setLikeCount(post.like_count || 0);
  }, [post.is_liked, post.like_count]);

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

  const handleSave = () => {
    setIsSaved(!isSaved);
    if (onSave) onSave(post.id, !isSaved);
  };

  const handleShare = () => {
    if (onShare) onShare(post.id);
  };

  const handleFollowChange = async (userId, userType, shouldFollow) => {
    if (onFollow) {
      await onFollow(userId, userType, shouldFollow);
    }
  };

  // Get additional media info for rendering (firstMediaUrl already defined above)
  const firstAspectRatio = post.aspect_ratios?.[0] || 4 / 5;
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
              style={[styles.mediaWrapper, { aspectRatio: firstAspectRatio }]}
            >
              <VideoPlayer
                source={firstMediaUrl}
                aspectRatio={firstAspectRatio}
                containerWidth={CONTENT_WIDTH}
                cropMetadata={firstCropMetadata}
                postId={post.id} // NEW: For VideoContext registration
                autoplay={true}
                muted={true}
                loop={true}
                showControls={true}
                isVisible={isVideoPlaying}
                isFullscreen={false} // NEW: Feed view - show Watch Again overlay
                onUnmute={handleVideoUnmute}
                onFullscreen={handleVideoFullscreen}
                onPlaybackStart={handleVideoPlaybackChange}
                onPress={() =>
                  setFullscreenVideo({
                    url: firstMediaUrl,
                    aspectRatio: firstAspectRatio,
                    cropMetadata: firstCropMetadata,
                  })
                }
              />
            </View>
          ) : hasMultipleMedia ? (
            // Carousel for multiple images
            <View>
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / CONTENT_WIDTH);
                  setCurrentMediaIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {post.image_urls.map((url, index) => {
                  const aspectRatio =
                    post.aspect_ratios?.[index] || firstAspectRatio;
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
                {post.image_urls.map((_, index) => (
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
              style={[styles.mediaWrapper, { aspectRatio: firstAspectRatio }]}
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
        <View style={styles.engagementButton}>
          <ChartNoAxesCombined
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
          <Text style={styles.engagementCount}>
            {formatCount(post.public_view_count || post.view_count || 0)}
          </Text>
        </View>

        {/* Share */}
        <Pressable style={styles.engagementButton} onPress={handleShare}>
          <Send
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
          />
        </Pressable>

        {/* Bookmark */}
        <Pressable style={styles.engagementButton} onPress={handleSave}>
          <Bookmark
            size={EDITORIAL_SPACING.iconSize}
            color={COLORS.editorial.textSecondary}
            fill={isSaved ? COLORS.editorial.textSecondary : "transparent"}
          />
        </Pressable>
      </View>

      {/* Fullscreen Video Modal */}
      <FullscreenVideoModal
        visible={!!fullscreenVideo}
        source={fullscreenVideo?.url}
        aspectRatio={fullscreenVideo?.aspectRatio || 16 / 9}
        cropMetadata={fullscreenVideo?.cropMetadata}
        onClose={() => setFullscreenVideo(null)}
        initialMuted={false}
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
    fontWeight: "600",
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

export default EditorialPostCard;
