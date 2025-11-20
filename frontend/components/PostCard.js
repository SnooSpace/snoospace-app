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

const PostCard = ({ post, onUserPress, onLike, onComment, currentUserId, currentUserType }) => {
  // Initialize from post data (backend sends is_liked, handle both snake_case and camelCase)
  const initialIsLiked = post.is_liked === true || post.isLiked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // Sync state when post prop changes (e.g., after navigation and feed reload)
  useEffect(() => {
    const newIsLiked = post.is_liked === true || post.isLiked === true;
    setIsLiked(newIsLiked);
    setLikeCount(post.like_count || 0);
  }, [post.is_liked, post.isLiked, post.like_count]);

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const token = await getAuthToken();
      
      if (isLiked) {
        await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
        if (onLike) onLike(post.id, false);
      } else {
        await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
        if (onLike) onLike(post.id, true);
      }
    } catch (error) {
      console.error("Error liking post:", error);
      // Silently handle "Post already liked" and "Post not liked" errors
      const errorMessage = error?.message || '';
      if (errorMessage.includes('already liked') || errorMessage.includes('not liked')) {
        // These are expected errors when double-clicking, just ignore
        return;
      }
      // Only show alert for unexpected errors
      // Alert.alert("Error", "Failed to like post");
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
          const displayName = entity.username || entity.name || 'user';
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
                : { uri: 'https://via.placeholder.com/40x40/6A0DAD/FFFFFF?text=' + (post.author_name ? post.author_name.charAt(0).toUpperCase() : 'U') }
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
            if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
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

        <TouchableOpacity style={styles.actionButton} onPress={handleCommentPress}>
          <Ionicons name="chatbubble-outline" size={24} color={COLORS.textDark} />
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
