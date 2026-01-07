/**
 * ChallengePostCard
 * Displays a Challenge post with joining, progress, and submission preview
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiPost, apiDelete } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const ChallengePostCard = ({
  post,
  onUserPress,
  currentUserId,
  currentUserType,
}) => {
  const navigation = useNavigation();
  const typeData = post.type_data || {};
  const [hasJoined, setHasJoined] = useState(post.has_joined || false);
  const [userParticipation, setUserParticipation] = useState(
    post.user_participation || null
  );
  const [participantCount, setParticipantCount] = useState(
    typeData.participant_count || 0
  );
  const [isJoining, setIsJoining] = useState(false);
  const [previewSubmission, setPreviewSubmission] = useState(
    post.preview_submission || null
  );

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const challengeType = typeData.challenge_type || "single";
  const submissionType = typeData.submission_type || "image";

  // Sync state with props
  useEffect(() => {
    setHasJoined(post.has_joined || false);
    setUserParticipation(post.user_participation || null);
    setParticipantCount(typeData.participant_count || 0);
    setPreviewSubmission(post.preview_submission || null);
  }, [
    post.id,
    post.has_joined,
    typeData.participant_count,
    post.preview_submission,
  ]);

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
          token
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

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 2592000)}mo`;
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
    <View style={styles.container}>
      {/* Header with Type Indicator */}
      <View style={styles.headerRow}>
        <View style={styles.typeIndicator}>
          <MaterialCommunityIcons
            name="trophy-outline"
            size={14}
            color="#FF9500"
          />
          <Text style={styles.typeLabel}>{getChallengeTypeLabel()}</Text>
        </View>
        <View style={styles.headerRightRow}>
          <View style={styles.submissionTypeBadge}>
            <Ionicons
              name={getSubmissionTypeIcon()}
              size={12}
              color={COLORS.textSecondary}
            />
          </View>
          {post.expires_at && (
            <Text
              style={[styles.expiryBadge, isExpired && styles.expiredBadge]}
            >
              {formatExpiryTime(post.expires_at)}
            </Text>
          )}
        </View>
      </View>

      {/* Author Info */}
      <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
        <Image
          source={
            post.author_photo_url
              ? { uri: post.author_photo_url }
              : { uri: "https://via.placeholder.com/40" }
          }
          style={styles.profileImage}
        />
        <View style={styles.userDetails}>
          <Text style={styles.authorName}>{post.author_name}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {/* Challenge Title and Description */}
      <Text style={styles.title}>{typeData.title}</Text>
      {typeData.description && (
        <Text style={styles.description}>{typeData.description}</Text>
      )}

      {/* Progress Bar (for progress challenges) */}
      {renderProgressBar()}

      {/* Preview Submission */}
      {renderPreviewSubmission()}

      {/* Join/Submit Button */}
      {isExpired ? (
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredText}>This challenge has ended</Text>
        </View>
      ) : hasJoined ? (
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
            <Ionicons
              name={getSubmissionTypeIcon()}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.submitProofButtonText}>Submit Proof</Text>
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
          style={styles.joinButton}
          onPress={handleJoinChallenge}
          disabled={isJoining}
          activeOpacity={0.8}
        >
          {isJoining ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="hand-clap"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.joinButtonText}>Join Challenge</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.participantCountText}>
          {participantCount} participant{participantCount !== 1 ? "s" : ""}
          {typeData.completed_count > 0
            ? ` • ${typeData.completed_count} completed`
            : ""}
        </Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate("ChallengeSubmissions", { post })}
        >
          <Text style={styles.viewAllText}>See all →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.sm,
    padding: SPACING.m,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  typeIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FF9500",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  submissionTypeBadge: {
    marginRight: SPACING.xs,
  },
  expiryBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textSecondary,
    backgroundColor: COLORS.screenBackground,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
  },
  expiredBadge: {
    color: COLORS.error,
    backgroundColor: "#FFEBEE",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.s,
  },
  userDetails: {},
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.m,
    lineHeight: 20,
  },
  // Progress Bar
  progressContainer: {
    backgroundColor: COLORS.screenBackground,
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
    backgroundColor: COLORS.screenBackground,
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
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9500",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: SPACING.s,
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
    backgroundColor: "#34C759",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginRight: SPACING.s,
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
    backgroundColor: COLORS.screenBackground,
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
  },
  participantCountText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  viewAllButton: {},
  viewAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
  },
});

export default ChallengePostCard;
