/**
 * QnAPostCard
 * Displays a Q&A post with question submission, upvoting, and top answer preview
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiPost, apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../../constants/theme";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  Check,
} from "lucide-react-native";
import { savePost, unsavePost } from "../../api/client";
import { postService } from "../../services/postService";
import QnAEditModal from "./QnAEditModal";
import EventBus from "../../utils/EventBus";

const QnAPostCard = ({
  post,
  onUserPress,
  onLike,
  onComment,
  onSave,
  onShare,
  onDelete, // Now optionally used for callback
  onEdit, // Now optionally used for callback
  onPostUpdate, // New prop
  currentUserId,
  currentUserType,
}) => {
  const navigation = useNavigation();
  const typeData = post.type_data || {};
  const [userQuestionCount, setUserQuestionCount] = useState(
    post.user_question_count || 0,
  );
  const [questionCount, setQuestionCount] = useState(
    typeData.question_count || 0,
  );
  const [answeredCount, setAnsweredCount] = useState(
    typeData.answered_count || 0,
  );
  const [showAskModal, setShowAskModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(
    post.preview_question || null,
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  // Format time ago utility
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "JUST NOW";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}M AGO`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}H AGO`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}D AGO`;
    return `${Math.floor(diffInSeconds / 2592000)}MO AGO`;
  };

  // Sync state with props
  useEffect(() => {
    setUserQuestionCount(post.user_question_count || 0);
    setQuestionCount(typeData.question_count || 0);
    setAnsweredCount(typeData.answered_count || 0);
    setPreviewQuestion(post.preview_question || null);
  }, [
    post.id,
    post.user_question_count,
    typeData.question_count,
    typeData.answered_count,
    post.preview_question,
  ]);

  // Engagement State
  const initialIsLiked = post.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);

  useEffect(() => {
    setIsLiked(post.is_liked === true);
    setLikeCount(post.like_count || 0);
    setIsSaved(post.is_saved || false);
  }, [post.is_liked, post.like_count, post.is_saved]);

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

  const handleSave = async () => {
    const newSaveState = !isSaved;
    setIsSaved(newSaveState);

    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await savePost(post.id, token);
      } else {
        await unsavePost(post.id, token);
      }
      if (onSave) onSave(post.id, newSaveState);
    } catch (error) {
      console.error("Failed to save/unsave post:", error);
      // Revert on error
      setIsSaved(!newSaveState);
    }
  };

  const handleCommentPress = () => {
    if (onComment) onComment(post.id);
  };

  const handleShare = () => {
    if (onShare) onShare(post.id);
  };

  const handleSaveEdit = async (updates) => {
    try {
      setIsUpdating(true);
      const response = await postService.updatePost(post.id, updates);

      if (onPostUpdate) {
        onPostUpdate(response.post);
      }

      setShowEditModal(false);
      Alert.alert("Success", "Post updated successfully");
    } catch (error) {
      console.error("Failed to update post:", error);
      Alert.alert("Error", error.message || "Failed to update post");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await postService.deletePost(post.id);
              if (onDelete) onDelete(post.id);
            } catch (error) {
              Alert.alert("Error", "Failed to delete post");
            }
          },
        },
      ],
    );
  };

  // Format count for display
  const formatCount = (count) => {
    if (!count || count === 0) return "0";
    if (count < 1000) return count.toString();
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    if (count < 1000000) return `${Math.floor(count / 1000)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleAddAnswer = () => {
    navigation.navigate("QnAQuestions", { post, autoFocus: true });
  };

  // Get participant data from backend
  const participants = typeData.participants || [];
  const participantCount = typeData.participant_count || participants.length;

  const renderTopAnswer = () => {
    // If we have a preview question (top answer), display it
    if (!previewQuestion) return null;

    return (
      <View style={styles.topAnswerContainer}>
        {/* Blue vertical line */}
        <View style={styles.verticalLine} />

        <View style={styles.topAnswerContent}>
          {/* Top Answer Header */}
          <View style={styles.topAnswerHeader}>
            <View style={styles.topAnswerBadge}>
              <Text style={styles.topAnswerBadgeText}>TOP QUESTION</Text>
            </View>

            <View style={styles.topAnswerMeta}>
              <Text style={styles.topAnswerUsername} numberOfLines={1}>
                @
                {previewQuestion.author_username ||
                  previewQuestion.author_name
                    ?.toLowerCase()
                    .replace(/\s+/g, "") ||
                  "anonymous"}
              </Text>
            </View>

            <View style={styles.upvoteContainer}>
              <Ionicons name="arrow-up" size={14} color={COLORS.primary} />
              <Text style={styles.upvoteCount}>
                {previewQuestion.upvote_count || 0}
              </Text>
            </View>
          </View>

          {/* Answer Content */}
          <Text style={styles.answerText} numberOfLines={4}>
            "{previewQuestion.content}"
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={styles.container}>
        {/* Header Row: Q&A Badge + Avatar Stack + Question Icon */}
        <View style={styles.headerRow}>
          <View style={styles.leftHeaderContent}>
            <View style={styles.qnaBadge}>
              <Text style={styles.qnaBadgeText}>Q&A</Text>
            </View>
            {/* Resolved Badge (if any question resolved) */}
            {post.has_resolved_questions && (
              <View style={styles.resolvedBadge}>
                <Text style={styles.resolvedBadgeText}>✓ Resolved</Text>
              </View>
            )}
          </View>

          <View style={styles.rightHeaderContent}>
            {isOwnPost && (onEdit || onDelete) && (
              <TouchableOpacity
                style={styles.ellipsisButton}
                onPress={() => setShowMenu(!showMenu)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ellipsis size={20} color="#5B6B7C" />
              </TouchableOpacity>
            )}
            <View style={styles.avatarStack}>
              {participants.slice(0, 2).map((participant, index) => (
                <Image
                  key={index}
                  source={{
                    uri:
                      participant.photo_url || "https://via.placeholder.com/24",
                  }}
                  style={[
                    styles.stackAvatar,
                    { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                  ]}
                />
              ))}
              {participantCount > 2 && (
                <View
                  style={[styles.countBadge, { marginLeft: -8, zIndex: 1 }]}
                >
                  <Text style={styles.countText}>+{participantCount - 2}</Text>
                </View>
              )}
            </View>

            <View style={styles.questionIconContainer}>
              <Ionicons name="help-circle" size={28} color="#334456" />
            </View>
          </View>
        </View>

        {/* Edit/Delete Menu */}
        {showMenu && isOwnPost && (
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowEditModal(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color="#1D1D1F" />
              <Text style={styles.menuItemText}>Edit Post</Text>
            </TouchableOpacity>
            {(onDelete || isOwnPost) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: "#DC2626" }]}>
                  Delete Post
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Author Row */}
        <TouchableOpacity
          style={styles.authorRow}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: post.author_photo_url || "https://via.placeholder.com/24",
            }}
            style={styles.authorAvatar}
          />
          <Text style={styles.authorName}>
            @{post.author_username || post.author_name}
          </Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
          {post.edited_at && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.editedLabel}>Edited</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Question Text */}
        <Text style={styles.questionText} numberOfLines={4}>
          {typeData.title}
        </Text>

        {/* Top Answer Preview Section */}
        {renderTopAnswer()}

        {/* View All CTA */}
        <TouchableOpacity
          style={styles.viewAllCTA}
          onPress={() => navigation.navigate("QnAQuestions", { post })}
        >
          <LinearGradient
            colors={["#448AFF", "#2962FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewAllGradient}
          >
            <Text style={styles.viewAllText}>
              {questionCount === 1
                ? "View 1 question"
                : `View all ${questionCount} questions`}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: 6 }}
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer Row */}
        <View style={styles.footerRow}>
          {isExpired ? (
            <View style={styles.endedBadge}>
              <Text style={styles.endedBadgeText}>Ended</Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={styles.addAnswerCTA}
            onPress={handleAddAnswer}
            disabled={userQuestionCount > 0}
          >
            {userQuestionCount > 0 ? (
              <>
                <Text style={styles.addAnswerText}>Asked </Text>
                <Check size={16} color="#5e8d9b" />
              </>
            ) : (
              <>
                <Text style={styles.addAnswerText}>Ask a question </Text>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color="#5e8d9b"
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Engagement Row */}
        <View style={styles.engagementRow}>
          {/* Like */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart
              size={22}
              color={isLiked ? COLORS.error : "#5e8d9b"}
              fill={isLiked ? COLORS.error : "transparent"}
            />
            <Text
              style={[styles.engagementCount, isLiked && styles.likedCount]}
            >
              {formatCount(likeCount)}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleCommentPress}
          >
            <MessageCircle size={22} color="#5e8d9b" />
            <Text style={styles.engagementCount}>
              {formatCount(post.comment_count || 0)}
            </Text>
          </TouchableOpacity>

          {/* Views */}
          <View style={styles.engagementButton}>
            <ChartNoAxesCombined size={22} color="#5e8d9b" />
            <Text style={styles.engagementCount}>
              {formatCount(post.public_view_count || post.view_count || 0)}
            </Text>
          </View>

          {/* Share */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
          >
            <Send size={22} color="#5e8d9b" />
            {(post.share_count || 0) > 0 && (
              <Text style={styles.engagementCount}>
                {formatCount(post.share_count)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Bookmark */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleSave}
          >
            <Bookmark
              size={22}
              color="#5e8d9b"
              fill={isSaved ? "#5e8d9b" : "transparent"}
            />
          </TouchableOpacity>
        </View>
      </View>
      <QnAEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        post={post}
        onSave={handleSaveEdit}
        isLoading={isUpdating}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.l, // 24px
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  qnaBadge: {
    backgroundColor: "#EAF1FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qnaBadgeText: {
    color: "#3F7CF4",
    fontSize: 10,
    fontFamily: "BasicCommercial-Bold",
    letterSpacing: 0.5,
  },
  endedBadge: {
    backgroundColor: "#FEE2E2", // Light red background
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  endedBadgeText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 10,
    color: "#DC2626", // Red text
    letterSpacing: 0.5,
  },
  leftHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resolvedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolvedBadgeText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Right side of header (avatar stack + icon)
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ellipsisButton: {
    padding: 8,
  },
  menuContainer: {
    position: "absolute",
    top: 48,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    ...SHADOWS.medium,
    zIndex: 10,
    minWidth: 150,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1D1D1F",
  },

  // Avatar Stack
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3B82F6", // Brand blue
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  // Question Icon
  questionIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "#EAF1FF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Author Row
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b", // Muted teal
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b", // Muted teal
  },
  separator: {
    color: COLORS.textTertiary,
    marginHorizontal: 6,
    fontSize: EDITORIAL_TYPOGRAPHY.timestamp.fontSize,
  },
  timestamp: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
  },
  editedLabel: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
    color: COLORS.textTertiary,
    fontStyle: "italic",
  },
  // Original timestamp style, now replaced by the spread operator above
  // timestamp: {
  //   fontSize: 11,
  //   fontWeight: "600",
  //   color: "#5e8d9b",
  //   textTransform: "uppercase",
  // },

  // Question Text
  questionText: {
    fontSize: 20,
    fontFamily: FONTS.primary || "System", // BasicCommercial-Bold
    color: "#1D1D1F",
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Top Answer Section
  topAnswerContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  verticalLine: {
    width: 4,
    backgroundColor: "#3B82F6", // Blue line
    borderRadius: 2,
    marginRight: 12,
  },
  topAnswerContent: {
    flex: 1,
    backgroundColor: "#F5F7FA", // Light gray
    borderRadius: 12,
    padding: 16,
  },
  topAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    justifyContent: "space-between",
  },
  topAnswerBadge: {
    backgroundColor: "#E8F4FD", // Light blue background
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
  },
  topAnswerBadgeText: {
    color: "#3B82F6", // Blue text
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topAnswerMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  topAnswerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  topAnswerUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    flex: 1,
  },
  upvoteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upvoteCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  answerText: {
    fontSize: 14,
    color: "#5e8d9b",
    lineHeight: 22,
    marginTop: 8,
  },

  // View All CTA
  viewAllCTA: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  viewAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.m,
  },
  viewAllText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Footer Row
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  votesText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontWeight: "400",
  },
  addAnswerCTA: {
    flexDirection: "row",
    alignItems: "center",
  },
  addAnswerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5e8d9b", // Muted teal
  },

  // Engagement Row
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    minWidth: 40,
    justifyContent: "center",
  },
  engagementCount: {
    fontSize: 13,
    fontWeight: "500",
    color: "#5e8d9b",
    marginLeft: 6,
  },
  likedCount: {
    color: COLORS.error,
  },
});

export default QnAPostCard;
