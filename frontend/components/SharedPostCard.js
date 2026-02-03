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

  // Get video thumbnail if available
  const thumbnailUrl = isVideo ? postData.video_thumbnail : mediaUrl;

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
        {(thumbnailUrl || mediaUrl) && (
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: thumbnailUrl || mediaUrl }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
            {/* Video indicator */}
            {isVideo && (
              <View style={styles.videoIndicator}>
                <View style={styles.playIcon}>
                  <Text style={styles.playIconText}>▶</Text>
                </View>
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
    height: CARD_WIDTH * 0.75, // 4:3 aspect ratio
    backgroundColor: "#F2F2F7",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
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
