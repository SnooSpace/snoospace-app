/**
 * ChallengePostCard
 * Displays a Challenge post with joining, progress, and submission preview
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
} from "lucide-react-native";
import {
  apiPost,
  apiDelete,
  apiGet,
  savePost,
  unsavePost,
} from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { postService } from "../../services/postService";
import ChallengeEditModal from "./ChallengeEditModal";
import EventBus from "../../utils/EventBus";
import {
  COLORS,
  FONTS,
  SHADOWS,
  SPACING,
  BORDER_RADIUS,
} from "../../constants/theme";
import CountdownTimer from "../CountdownTimer";
import {
  getExtensionBadgeText,
  getTimeRemaining,
} from "../../utils/cardTiming";

const ChallengePostCard = ({
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
  const [hasJoined, setHasJoined] = useState(post.has_joined || false);
  const [userParticipation, setUserParticipation] = useState(
    post.user_participation || null,
  );
  const [participantCount, setParticipantCount] = useState(
    typeData.participant_count || 0,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [previewSubmission, setPreviewSubmission] = useState(
    post.preview_submission || null,
  );
  const [participantPreviews, setParticipantPreviews] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const challengeType = typeData.challenge_type || "single";
  const submissionType = typeData.submission_type || "image";

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  // Pulse animation for Live Now badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Sync state with props
  useEffect(() => {
    setHasJoined(post.has_joined || false);
    setUserParticipation(post.user_participation || null);
    setParticipantCount(typeData.participant_count || 0);
    setPreviewSubmission(post.preview_submission || null);
  }, [
    post.has_joined,
    post.user_participation,
    typeData.participant_count,
    post.preview_submission,
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

  // Fetch participant previews for avatar stack
  useEffect(() => {
    const fetchPreviews = async () => {
      if (participantCount === 0) return;
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/participant-previews`,
          10000,
          token,
        );
        if (response.success && response.previews) {
          setParticipantPreviews(response.previews);
        }
      } catch (error) {
        console.log("Error fetching participant previews:", error);
      }
    };
    fetchPreviews();
  }, [post.id, participantCount]);

  // Animate Live Now badge
  useEffect(() => {
    if (!isExpired) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isExpired, pulseAnim]);

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleJoinChallenge = async () => {
    if (isJoining || isExpired) return;

    setIsJoining(true);
    try {
      const token = await getAuthToken();

      if (hasJoined) {
        // Leave challenge
        await apiDelete(`/posts/${post.id}/join`, {}, 10000, token);
        setHasJoined(false);
        setUserParticipation(null);
        setParticipantCount((prev) => Math.max(0, prev - 1));
      } else {
        // Join challenge
        const response = await apiPost(
          `/posts/${post.id}/join`,
          {},
          10000,
          token,
        );
        if (response.success) {
          setHasJoined(true);
          setUserParticipation(response.participation);
          setParticipantCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Error joining/leaving challenge:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
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

  const formatExpiryTime = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return "Ending soon";
  };

  const getChallengeTypeLabel = () => {
    switch (challengeType) {
      case "progress":
        return "Progress Challenge";
      case "community":
        return "Community Challenge";
      default:
        return "Challenge";
    }
  };

  const getSubmissionTypeIcon = () => {
    switch (submissionType) {
      case "video":
        return "videocam";
      case "image":
        return "camera";
      default:
        return "document-text";
    }
  };

  // Render progress bar for progress-based challenges
  const renderProgressBar = () => {
    if (!hasJoined || challengeType !== "progress" || !userParticipation)
      return null;

    const progress = userParticipation.progress || 0;
    const targetCount = typeData.target_count || 1;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressSubtext}>
          {Math.round((progress / 100) * targetCount)} / {targetCount} completed
        </Text>
      </View>
    );
  };

  // Render preview submission
  const renderPreviewSubmission = () => {
    if (!previewSubmission) return null;

    return (
      <TouchableOpacity
        style={styles.previewContainer}
        onPress={() => navigation.navigate("ChallengeSubmissions", { post })}
        activeOpacity={0.7}
      >
        {previewSubmission.media_urls &&
          previewSubmission.media_urls.length > 0 && (
            <Image
              source={{ uri: previewSubmission.media_urls[0] }}
              style={styles.previewImage}
            />
          )}
        {previewSubmission.video_thumbnail && (
          <View style={styles.previewImageContainer}>
            <Image
              source={{ uri: previewSubmission.video_thumbnail }}
              style={styles.previewImage}
            />
            <View style={styles.playIconOverlay}>
              <Ionicons name="play-circle" size={32} color="#FFFFFF" />
            </View>
          </View>
        )}
        <View style={styles.previewInfo}>
          <View style={styles.previewMeta}>
            {previewSubmission.participant_photo_url && (
              <Image
                source={{ uri: previewSubmission.participant_photo_url }}
                style={styles.previewAvatar}
              />
            )}
            <Text style={styles.previewAuthorName} numberOfLines={1}>
              {previewSubmission.participant_name || "Participant"}
            </Text>
            {previewSubmission.is_featured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="star" size={10} color="#FFD700" />
              </View>
            )}
          </View>
          {previewSubmission.content && (
            <Text style={styles.previewContent} numberOfLines={2}>
              {previewSubmission.content}
            </Text>
          )}
          <View style={styles.previewLikes}>
            <Ionicons name="heart" size={12} color={COLORS.textSecondary} />
            <Text style={styles.previewLikesText}>
              {previewSubmission.like_count || 0}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <LinearGradient
        colors={["#C8E9EA", "#E8F7F8"]} // Softer gradient - less white
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Header Row: Badge & Trophy Icon */}
        <View style={styles.headerRow}>
          <View style={styles.badgesRow}>
            {isExpired && (
              <View style={styles.endedBadge}>
                <Text style={styles.endedBadgeText}>Ended</Text>
              </View>
            )}
            {!isExpired &&
              (() => {
                const remaining = getTimeRemaining(post.expires_at);
                const hours = remaining / (1000 * 60 * 60);

                // Show countdown if < 24h, otherwise "Live Now"
                if (hours < 24 && hours > 0) {
                  return (
                    <Animated.View
                      style={[
                        styles.activeBadge,
                        { transform: [{ scale: pulseAnim }] },
                      ]}
                    >
                      <Text style={styles.urgencyIcon}>⏰</Text>
                      <CountdownTimer
                        expiresAt={post.expires_at}
                        style={styles.activeBadgeText}
                        prefix=""
                      />
                    </Animated.View>
                  );
                }

                return (
                  <Animated.View
                    style={[
                      styles.activeBadge,
                      {
                        transform: [{ scale: pulseAnim }],
                        flexDirection: "row",
                      },
                    ]}
                  >
                    <View style={styles.liveDot} />
                    <Text style={styles.activeBadgeText}>Live Now</Text>
                  </Animated.View>
                );
              })()}
            <View style={styles.challengePill}>
              <Text style={styles.challengePillText}>Challenge</Text>
            </View>
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
            <View style={styles.trophyContainer}>
              <Ionicons name="trophy" size={24} color="#1976D2" />
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
            source={
              post.author_photo_url
                ? { uri: post.author_photo_url }
                : { uri: "https://via.placeholder.com/32" }
            }
            style={styles.authorAvatar}
          />
          <Text style={styles.authorName} numberOfLines={1}>
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

        {/* Title & Description */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{typeData.title}</Text>
          {typeData.description && (
            <Text style={styles.description}>{typeData.description}</Text>
          )}

          {/* Extension Badge */}
          {post.extension_count > 0 && (
            <View style={styles.extensionBadge}>
              <Text style={styles.extensionBadgeText}>
                {getExtensionBadgeText(post.extension_count)}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Bar (if joined) */}
        {renderProgressBar()}

        {/* Preview Submission */}
        {renderPreviewSubmission()}

        {/* Join/Submit Button */}
        {!isExpired && hasJoined ? (
          <View style={styles.joinedButtonsRow}>
            <TouchableOpacity
              style={styles.submitProofButton}
              onPress={() =>
                navigation.navigate("ChallengeSubmit", {
                  post,
                  participation: userParticipation,
                })
              }
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#34C759", "#2E7D32"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons
                name={getSubmissionTypeIcon()}
                size={18}
                color="#FFFFFF"
                style={{ zIndex: 1 }}
              />
              <Text style={[styles.submitProofButtonText, { zIndex: 1 }]}>
                Submit Proof
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleJoinChallenge}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              ) : (
                <Ionicons
                  name="exit-outline"
                  size={18}
                  color={COLORS.textSecondary}
                />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.joinButtonContainer}
            onPress={handleJoinChallenge}
            disabled={isJoining}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#448AFF", "#2962FF"]} // Brighter/deeper blue gradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.joinButtonGradient}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.joinButtonText}>Join Challenge</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 6 }}
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Participant Count (below CTA) - Clickable to view all */}
        {participantCount > 0 && (
          <TouchableOpacity
            style={styles.participantCountContainer}
            onPress={() =>
              navigation.navigate("ChallengeSubmissions", { post })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.participantCountText}>Joined by</Text>
            <View style={[styles.participantAvatars, { marginLeft: 8 }]}>
              {participantPreviews.length > 0 ? (
                <>
                  {participantPreviews.slice(0, 3).map((participant, index) => (
                    <View
                      key={`${participant.participant_id}-${participant.participant_type}`}
                      style={[
                        styles.participantAvatarImage,
                        { zIndex: 3 - index, marginLeft: index > 0 ? -10 : 0 },
                      ]}
                    >
                      {participant.participant_photo_url ? (
                        <Image
                          source={{ uri: participant.participant_photo_url }}
                          style={styles.participantAvatarImg}
                        />
                      ) : (
                        <View style={styles.participantAvatarPlaceholder}>
                          <Ionicons name="person" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  ))}
                  {participantCount > 3 && (
                    <View
                      style={[
                        styles.participantCountBadge,
                        { marginLeft: -10 },
                      ]}
                    >
                      <Text style={styles.participantCountBadgeText}>
                        +{participantCount - 3}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                // Fallback to placeholder if no previews loaded yet
                <>
                  <View style={[styles.participantAvatar, { zIndex: 3 }]}>
                    <Ionicons name="person" size={10} color="#FFFFFF" />
                  </View>
                  <View
                    style={[
                      styles.participantAvatar,
                      { zIndex: 2, marginLeft: -8 },
                    ]}
                  >
                    <Ionicons name="person" size={10} color="#FFFFFF" />
                  </View>
                  {participantCount > 2 && (
                    <View
                      style={[styles.participantCountBadge, { marginLeft: -8 }]}
                    >
                      <Text style={styles.participantCountBadgeText}>
                        +{participantCount - 2}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

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
      </LinearGradient>
      <ChallengeEditModal
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
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl, // 20px
    padding: SPACING.l,
    overflow: "hidden", // For gradient
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trophyContainer: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
  },
  separator: {
    color: COLORS.textTertiary,
    marginHorizontal: 6,
    fontSize: 13,
  },
  timestamp: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  editedLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontStyle: "italic",
  },
  timestampText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#5e8d9b",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  headerColumn: {
    marginBottom: SPACING.m,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#34C759",
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6", // Light gray
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  urgencyIcon: {
    fontSize: 12,
  },

  challengePill: {
    backgroundColor: "#FFF4E0", // Muted amber/soft gold
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12, // Matching reference chips
  },
  challengePillText: {
    fontSize: 10.5,
    fontFamily: "BasicCommercial-Bold",
    color: "#A67C52", // Warm brown-gold
    letterSpacing: 0.5,
  },

  contentContainer: {
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    marginBottom: 6,
    lineHeight: 26,
  },
  description: {
    fontSize: 14,
    color: "#5e8d9b",
    marginBottom: SPACING.s,
    lineHeight: 20,
  },
  extensionBadge: {
    backgroundColor: "#FFF4E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: SPACING.s,
  },
  extensionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A67C52",
  },
  // Progress Bar
  progressContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.6)", // Transparent white on gradient
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF9500",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  // Preview
  previewContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.s,
    marginBottom: SPACING.m,
  },
  previewImageContainer: {
    position: "relative",
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.m,
  },
  playIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: BORDER_RADIUS.m,
  },
  previewInfo: {
    flex: 1,
    marginLeft: SPACING.s,
    justifyContent: "center",
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  previewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  previewAuthorName: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 1,
  },
  featuredBadge: {
    backgroundColor: "#FFF8E1",
    padding: 3,
    borderRadius: 10,
  },
  previewContent: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  previewLikes: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  previewLikesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  // Buttons
  joinButtonContainer: {
    borderRadius: 16, // Matching reference (less than pill)
    overflow: "hidden",
    marginTop: 8,
    ...SHADOWS.primaryGlow, // Add glow
  },
  joinButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.m,
    backgroundColor: "#2979FF", // Fallback
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  joinedButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  submitProofButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759", // Overridden by gradient
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginRight: SPACING.s,
    overflow: "hidden",
    position: "relative",
  },
  submitProofButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: SPACING.s,
  },
  leaveButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expiredContainer: {
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  expiredText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.m,
    paddingTop: SPACING.xs,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantCountText: {
    fontSize: 12,
    color: "#5e8d9b",
    fontWeight: "500",
  },
  participantCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
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
  // New avatar stack styles
  participantAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  participantAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  participantAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#90CAF9",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  participantCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1976D2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  participantCountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default ChallengePostCard;
