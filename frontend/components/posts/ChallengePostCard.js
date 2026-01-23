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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
    post.user_participation || null,
  );
  const [participantCount, setParticipantCount] = useState(
    typeData.participant_count || 0,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [previewSubmission, setPreviewSubmission] = useState(
    post.preview_submission || null,
  );

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const challengeType = typeData.challenge_type || "single";
  const submissionType = typeData.submission_type || "image";

  // Pulse animation for Live Now badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    <LinearGradient
      colors={["#C8E9EA", "#E8F7F8"]} // Softer gradient - less white
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Header Row: Badge & Trophy Icon */}
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          {!isExpired && (
            <Animated.View
              style={[styles.liveBadge, { transform: [{ scale: pulseAnim }] }]}
            >
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live Now</Text>
            </Animated.View>
          )}
          <View style={styles.challengePill}>
            <Text style={styles.challengePillText}>Challenge</Text>
          </View>
        </View>
        <View style={styles.trophyContainer}>
          <Ionicons name="trophy" size={24} color="#1976D2" />
        </View>
      </View>

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
        <Text style={styles.authorUsername} numberOfLines={1}>
          @
          {post.author_username ||
            post.author_name?.toLowerCase().replace(/\s+/g, "") ||
            "user"}
        </Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.timestampText}>
          {formatTimeAgo(post.created_at).toUpperCase()}
        </Text>
      </TouchableOpacity>

      {/* Title & Description */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{typeData.title}</Text>
        {typeData.description && (
          <Text style={styles.description}>{typeData.description}</Text>
        )}
      </View>

      {/* Progress Bar (if joined) */}
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

      {/* Participant Count (below CTA) */}
      {participantCount > 0 && (
        <View style={styles.participantCountContainer}>
          <View style={styles.participantAvatars}>
            {/* Generic placeholder avatars - you can enhance with real participant photos */}
            <View style={[styles.participantAvatar, { zIndex: 3 }]}>
              <Ionicons name="person" size={10} color="#FFFFFF" />
            </View>
            <View
              style={[styles.participantAvatar, { zIndex: 2, marginLeft: -8 }]}
            >
              <Ionicons name="person" size={10} color="#FFFFFF" />
            </View>
            <View
              style={[styles.participantAvatar, { zIndex: 1, marginLeft: -8 }]}
            >
              <Ionicons name="person" size={10} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.participantCountText}>
            Joined by{" "}
            {participantCount >= 1000
              ? `${(participantCount / 1000).toFixed(1)}k`
              : participantCount}{" "}
            creators
          </Text>
        </View>
      )}
    </LinearGradient>
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
  authorUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
  },
  separator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    marginHorizontal: 4,
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
  challengePill: {
    backgroundColor: "#64B5F6", // Light Blue background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8, // Matching reference chips
  },
  challengePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF", // White text
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
  viewAllText: {
    fontSize: 13,
    color: "#1976D2",
    fontWeight: "600",
  },
});

export default ChallengePostCard;
