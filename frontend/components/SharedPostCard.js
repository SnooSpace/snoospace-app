import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from "react-native";
import { COLORS } from "../constants/theme";
import { getPostById } from "../api/posts";
import LikeStateManager from "../utils/LikeStateManager";
import PollPostCard from "./posts/PollPostCard";
import ChallengePostCard from "./posts/ChallengePostCard";
import PromptPostCard from "./posts/PromptPostCard";
import QnAPostCard from "./posts/QnAPostCard";
import SnooLoader from "./ui/SnooLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65; // Reduced from 0.75 to 0.65

/**
 * SharedPostCard - Instagram-style shared post preview for chat messages
 * Displays a compact preview card with post thumbnail, author info, and caption.
 * Supports multi-image carousel with dot indicator and stacked-image badge.
 */
const SharedPostCard = ({ metadata, onPress, style }) => {
  const [postData, setPostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
            <SnooLoader size="small" color={COLORS.primary} />
            <Text style={[styles.loadingText, { fontFamily: 'Manrope-Medium' }]}>Loading post...</Text>
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

  // ── Default: render media post ────────────────────────────────────────────

  // Collect all images for carousel support
  const allImageUrls = postData.image_urls ? postData.image_urls.flat() : [];
  const hasMedia = allImageUrls.length > 0;
  const isCarousel = allImageUrls.length > 1;
  const primaryMediaUrl = hasMedia ? allImageUrls[0] : imageUrl || null;

  // Helper: check if a specific index is a video
  const checkIsVideo = (url, idx) =>
    postData.media_types?.[idx] === "video" ||
    (url &&
      (url.includes(".mp4") ||
        url.includes(".mov") ||
        url.includes(".webm")));

  // First item video check (for single-image fallback path)
  const isVideo = checkIsVideo(primaryMediaUrl, 0);

  // Helper function to generate Cloudinary thumbnail from video URL
  const generateCloudinaryThumbnail = (url) => {
    if (!url || typeof url !== "string") return null;
    if (!url.includes("cloudinary.com")) return null;
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

  // Get video thumbnail for single-image path
  const thumbnailUrl = isVideo
    ? parsedVideoThumbnail || generateCloudinaryThumbnail(primaryMediaUrl)
    : primaryMediaUrl;

  // Get the actual aspect ratio from the post data (default to 4:5 if not available)
  const rawAspectRatio = postData.aspect_ratios;
  const actualAspectRatio = Array.isArray(rawAspectRatio)
    ? rawAspectRatio[0] || 4 / 5
    : typeof rawAspectRatio === "number"
      ? rawAspectRatio
      : 4 / 5;

  // Calculate media height based on actual aspect ratio
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

  // Handler for carousel scroll to track active dot
  const handleCarouselScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setActiveIndex(index);
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
          <View style={{ position: "relative" }}>
            {isCarousel ? (
              // ── Carousel (multiple images) ─────────────────────────────────
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleCarouselScroll}
                  scrollEventThrottle={16}
                  style={{ width: CARD_WIDTH }}
                  nestedScrollEnabled
                >
                  {allImageUrls.map((url, idx) => {
                    const itemIsVideo = checkIsVideo(url, idx);
                    const itemThumbnail = itemIsVideo
                      ? generateCloudinaryThumbnail(url)
                      : url;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.mediaContainer,
                          { height: mediaHeight, width: CARD_WIDTH },
                          isWideImage && styles.wideMediaContainer,
                        ]}
                      >
                        {itemIsVideo && !itemThumbnail ? (
                          <View style={styles.videoPlaceholder}>
                            <View style={styles.playIcon}>
                              <Text style={styles.playIconText}>▶</Text>
                            </View>
                          </View>
                        ) : itemThumbnail ? (
                          <>
                            <Image
                              source={{ uri: itemThumbnail }}
                              style={[
                                styles.mediaImage,
                                isWideImage && { resizeMode: "contain" },
                              ]}
                              resizeMode={isWideImage ? "contain" : "cover"}
                            />
                            {itemIsVideo && (
                              <View style={styles.videoIndicator}>
                                <View style={styles.playIcon}>
                                  <Text style={styles.playIconText}>▶</Text>
                                </View>
                              </View>
                            )}
                          </>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Counter badge (top-right) */}
                <View style={styles.carouselBadge}>
                  <Text style={styles.carouselBadgeText}>
                    {activeIndex + 1}/{allImageUrls.length}
                  </Text>
                </View>

                {/* Dot indicator */}
                <View style={styles.dotsContainer}>
                  {allImageUrls.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        idx === activeIndex && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              // ── Single image / video ───────────────────────────────────────
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
  // ── Carousel styles ───────────────────────────────────────────────────────
  carouselBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  carouselBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D1D6",
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#007AFF",
  },
  // ─────────────────────────────────────────────────────────────────────────
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
    fontFamily: "Manrope-SemiBold",
  },
  authorUsername: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "Manrope-Regular",
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: "#000000",
    marginBottom: 0,
    fontFamily: "Manrope-Regular",
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
    fontFamily: "Manrope-Regular",
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
    fontFamily: "Manrope-SemiBold",
  },
  errorSubtext: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    fontFamily: "Manrope-Regular",
  },
});

export default SharedPostCard;
