import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost, apiDelete } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  success: "#00C851",
  border: "#E5E5E5",
};

const PostCard = ({
  post,
  onUserPress,
  onLike,
  onComment,
  currentUserId,
  currentUserType,
}) => {
  // Initialize from post data (backend sends is_liked, only use is_liked field)
  const initialIsLiked = post.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // Sync state when post prop changes (e.g., after navigation and feed reload)
  useEffect(() => {
    const newIsLiked = post.is_liked === true;
    setIsLiked(newIsLiked);
    setLikeCount(post.like_count || 0);
  }, [post.is_liked, post.like_count]);

  const handleLike = async () => {
    if (isLiking) return;

    const prevLiked = isLiked;
    const prevLikeCount = likeCount;
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;
    const nextLikes = Math.max(0, prevLikeCount + delta);

    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    if (onLike) onLike(post.id, nextLiked);

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
      setIsLiked(prevLiked);
      setLikeCount(prevLikeCount);
      if (onLike) onLike(post.id, prevLiked);
      EventBus.emit("post-like-updated", {
        postId: post.id,
        isLiked: prevLiked,
        likeCount: prevLikeCount,
      });
      const errorMessage = error?.message || "";
      if (
        !errorMessage.includes("already liked") &&
        !errorMessage.includes("not liked")
      ) {
        // Alert.alert("Error", "Failed to update like status");
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleUserPress = () => {
    if (onUserPress) {
      const authorId = post.author_id;
      let authorType = post.author_type;

      // Fallback: Try to infer type if missing
      // Communities typically have logo_url in author_photo_url, but this is not reliable
      // The backend should always provide author_type, so this is just a safety check
      if (!authorType) {
        console.warn(
          "[PostCard] author_type is missing for post:",
          post.id,
          "Attempting to infer from post data"
        );
        // We can't reliably infer, so we'll pass undefined and let the handler deal with it
      }

      console.log("[PostCard] handleUserPress:", {
        authorId,
        authorType,
        postId: post.id,
        authorName: post.author_name,
        authorUsername: post.author_username,
        fullPost: {
          id: post.id,
          author_id: post.author_id,
          author_type: post.author_type,
        },
      });
      onUserPress(authorId, authorType);
    }
  };

  const handleCommentPress = () => {
    if (onComment) {
      onComment(post.id);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 2592000)}mo`;
  };

  const renderTaggedEntities = () => {
    if (!post.tagged_entities || post.tagged_entities.length === 0) return null;

    return (
      <View style={styles.taggedContainer}>
        <Text style={styles.taggedText}>Tagged: </Text>
        {post.tagged_entities.map((entity, index) => {
          // Prioritize username, fallback to name
          const displayName = entity.username || entity.name || "user";
          return (
            <TouchableOpacity
              key={`${entity.id}-${entity.type}-${index}`}
              onPress={() => onUserPress && onUserPress(entity.id, entity.type)}
            >
              <Text style={styles.taggedEntity}>
                @{displayName}
                {index < post.tagged_entities.length - 1 ? ", " : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <Image
            source={
              post.author_photo_url
                ? { uri: post.author_photo_url }
                : {
                    uri:
                      "https://via.placeholder.com/40x40/6A0DAD/FFFFFF?text=" +
                      (post.author_name
                        ? post.author_name.charAt(0).toUpperCase()
                        : "U"),
                  }
            }
            style={styles.profileImage}
          />
          <View style={styles.userDetails}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.authorUsername}>@{post.author_username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
      </View>

      {/* Images */}
      {post.image_urls && post.image_urls.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.imageContainer}
        >
          {post.image_urls.flat().map((imageUrl, index) => {
            // Ensure imageUrl is a string and is a valid URL format
            if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
              return null;
            }
            return (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={styles.postImage}
                resizeMode="cover"
              />
            );
          })}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLike}
          disabled={isLiking}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? COLORS.error : COLORS.textDark}
          />
          <Text style={styles.actionText}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCommentPress}
        >
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={COLORS.textDark}
          />
          <Text style={styles.actionText}>{post.comment_count || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>
            <Text style={styles.authorNameInline}>{post.author_name}</Text>{" "}
            {post.caption}
          </Text>
        </View>
      )}

      {/* Tagged Entities */}
      {renderTaggedEntities()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  authorUsername: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  authorNameInline: {
    fontWeight: "600",
    color: COLORS.textDark,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  imageContainer: {
    height: width,
  },
  postImage: {
    width: width,
    height: width,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: "500",
  },
  captionContainer: {
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  taggedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    paddingBottom: 8,
  },
  taggedText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  taggedEntity: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
});

export default PostCard;
