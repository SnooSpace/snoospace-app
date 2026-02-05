import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../constants/theme";
import { getPostById } from "../api/posts";
import LikeStateManager from "../utils/LikeStateManager";
import PollPostCard from "./posts/PollPostCard";
import ChallengePostCard from "./posts/ChallengePostCard";
import PromptPostCard from "./posts/PromptPostCard";
import QnAPostCard from "./posts/QnAPostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65; // Reduced from 0.75 to 0.65

/**
 * SharedPostCard - Instagram-style shared post preview for chat messages
 * Displays a compact preview card with post thumbnail, author info, and caption
 */
const SharedPostCard = ({ metadata, onPress, style }) => {
  const [postData, setPostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Extract metadata from message
  const { postId, authorId, authorType, imageUrl, caption } = metadata || {};

  useEffect(() => {
    const fetchPostDetails = async () => {
      if (!postId) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getPostById(postId);
        const post = response.post || response;

        // Merge with LikeStateManager to get correct like state
        const [mergedPost] = await LikeStateManager.mergeLikeStates([post]);
        setPostData(mergedPost);
        setError(false);
      } catch (err) {
        console.error("Failed to fetch post details:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPostDetails();
  }, [postId]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.card}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading post...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Error state (deleted post or failed to load)
  if (error || !postData) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.card, styles.errorCard]}>
          <Text style={styles.errorIcon}>📭</Text>
          <Text style={styles.errorText}>Post unavailable</Text>
          <Text style={styles.errorSubtext}>
            This post may have been deleted
          </Text>
        </View>
      </View>
    );
  }

  // Detect post type and render appropriate card
  const postType = postData.post_type || "media";

  // For non-media post types, render the full card component in compact mode
  if (postType === "poll") {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => onPress && onPress(postId, postData)}
        activeOpacity={0.8}
      >
        <PollPostCard
          post={postData}
          onUserPress={() => {}} // Disable individual user press
          onLike={() => {}}
          onComment={() => {}}
          onSave={() => {}}
          onShare={() => {}}
          currentUserId={null}
          currentUserType={null}
        />
      </TouchableOpacity>
    );
  }

  if (postType === "challenge") {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => onPress && onPress(postId, postData)}
        activeOpacity={0.8}
      >
        <ChallengePostCard
          post={postData}
          onUserPress={() => {}} // Disable individual user press
          onLike={() => {}}
          onComment={() => {}}
          onSave={() => {}}
          onShare={() => {}}
          currentUserId={null}
          currentUserType={null}
        />
      </TouchableOpacity>
    );
  }

  if (postType === "prompt") {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => onPress && onPress(postId, postData)}
        activeOpacity={0.8}
      >
        <PromptPostCard
          post={postData}
          onUserPress={() => {}} // Disable individual user press
          onLike={() => {}}
          onComment={() => {}}
          onSave={() => {}}
          onShare={() => {}}
          currentUserId={null}
          currentUserType={null}
        />
      </TouchableOpacity>
    );
  }

  if (postType === "qna") {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => onPress && onPress(postId, postData)}
        activeOpacity={0.8}
      >
        <QnAPostCard
          post={postData}
          onUserPress={() => {}} // Disable individual user press
          onLike={() => {}}
          onComment={() => {}}
          onSave={() => {}}
          onShare={() => {}}
          currentUserId={null}
          currentUserType={null}
        />
      </TouchableOpacity>
    );
  }

  // Default: render media post (existing logic)

  // Get post media
  const hasMedia = postData.image_urls && postData.image_urls.length > 0;
  const mediaUrl = hasMedia ? postData.image_urls.flat()[0] : imageUrl || null;

  // Check if media is video
  const isVideo =
    postData.media_types?.[0] === "video" ||
    (mediaUrl &&
      (mediaUrl.includes(".mp4") ||
        mediaUrl.includes(".mov") ||
        mediaUrl.includes(".webm")));

  // Helper function to generate Cloudinary thumbnail from video URL
  const generateCloudinaryThumbnail = (url) => {
    if (!url || typeof url !== "string") return null;
    if (!url.includes("cloudinary.com")) return null;
    // so_0: Start offset 0 (first frame), f_jpg: JPEG format, q_auto: Auto quality, w_800: Width
    return url
      .replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_800/")
      .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
  };

  // Parse video_thumbnail - might be stored as JSON array string '["url"]' in database
  let parsedVideoThumbnail = null;
  if (postData.video_thumbnail) {
    try {
      if (
        typeof postData.video_thumbnail === "string" &&
        postData.video_thumbnail.startsWith("[")
      ) {
        const parsed = JSON.parse(postData.video_thumbnail);
        parsedVideoThumbnail = Array.isArray(parsed)
          ? parsed[0]
          : postData.video_thumbnail;
      } else {
        parsedVideoThumbnail = postData.video_thumbnail;
      }
    } catch (e) {
      parsedVideoThumbnail = postData.video_thumbnail;
    }
  }

  // Get video thumbnail - prefer stored thumbnail, fallback to generating from Cloudinary URL
  const thumbnailUrl = isVideo
    ? parsedVideoThumbnail || generateCloudinaryThumbnail(mediaUrl)
    : mediaUrl;

  // Get the actual aspect ratio from the post data (default to 4:5 if not available)
  // Handle both array format ([1.91]) and single number format (1.91)
  const rawAspectRatio = postData.aspect_ratios;
  const actualAspectRatio = Array.isArray(rawAspectRatio)
    ? rawAspectRatio[0] || 4 / 5
    : typeof rawAspectRatio === "number"
      ? rawAspectRatio
      : 4 / 5;

  // Calculate media height based on actual aspect ratio
  // For wide images (1.91:1), this will be shorter; for tall images (4:5), this will be taller
  const mediaHeight = CARD_WIDTH / actualAspectRatio;

  // Use 'contain' for wide images to show full content, 'cover' for tall/square images
  const isWideImage = actualAspectRatio > 1;

  // Truncate caption to 2 lines (approximately 80 characters)
  const displayCaption = postData.caption || caption || "";
  const truncatedCaption =
    displayCaption.length > 80
      ? displayCaption.substring(0, 80) + "..."
      : displayCaption;

  const handleCardPress = () => {
    if (onPress) {
      onPress(postId, postData);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleCardPress}
      activeOpacity={0.8}
    >
      <View style={styles.card}>
        {/* Post Media */}
        {hasMedia && (
          <View
            style={[
              styles.mediaContainer,
              { height: mediaHeight },
              isWideImage && styles.wideMediaContainer,
            ]}
          >
            {/* For videos without thumbnail, show placeholder */}
            {isVideo && !thumbnailUrl ? (
              <View style={styles.videoPlaceholder}>
                <View style={styles.playIcon}>
                  <Text style={styles.playIconText}>▶</Text>
                </View>
              </View>
            ) : thumbnailUrl ? (
              <>
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={[
                    styles.mediaImage,
                    isWideImage && { resizeMode: "contain" },
                  ]}
                  resizeMode={isWideImage ? "contain" : "cover"}
                />
                {/* Video indicator overlay for videos with thumbnails */}
                {isVideo && (
                  <View style={styles.videoIndicator}>
                    <View style={styles.playIcon}>
                      <Text style={styles.playIconText}>▶</Text>
                    </View>
                  </View>
                )}
              </>
            ) : null}
          </View>
        )}

        {/* Post Content */}
        <View style={styles.contentContainer}>
          {/* Author Info */}
          <View style={styles.authorRow}>
            <Image
              source={
                postData.author_photo_url
                  ? { uri: postData.author_photo_url }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        postData.author_name || "U",
                      )}&background=E5E7EB&color=6B7280&size=60`,
                    }
              }
              style={styles.authorAvatar}
            />
            <View style={styles.authorTextContainer}>
              <Text style={styles.authorName} numberOfLines={1}>
                {postData.author_name || "Unknown"}
              </Text>
              <Text style={styles.authorUsername} numberOfLines={1}>
                @{postData.author_username || "user"}
              </Text>
            </View>
          </View>

          {/* Caption */}
          {displayCaption ? (
            <Text style={styles.caption} numberOfLines={2}>
              {truncatedCaption}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mediaContainer: {
    width: "100%",
    // Height is applied dynamically based on actual aspect ratio
    backgroundColor: "#F2F2F7",
    position: "relative",
  },
  wideMediaContainer: {
    // For wide images using contain mode, center the image
    justifyContent: "center",
    alignItems: "center",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  playIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIconText: {
    fontSize: 20,
    color: "#000000",
    marginLeft: 4,
  },
  contentContainer: {
    padding: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E5EA",
    marginRight: 8,
  },
  authorTextContainer: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  authorUsername: {
    fontSize: 12,
    color: "#8E8E93",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: "#000000",
    marginBottom: 0, // Removed bottom margin since CTA is gone
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#8E8E93",
  },
  errorCard: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9F9F9",
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
  },
});

export default SharedPostCard;
