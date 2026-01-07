/**
 * ChallengeSubmissionsScreen
 * Gallery view of all submissions for a challenge
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiGet, apiPost, apiDelete } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 2;
const ITEM_WIDTH = (width - SPACING.m * 3) / COLUMN_COUNT;

const ChallengeSubmissionsScreen = ({ route, navigation }) => {
  const { post } = route.params;
  const typeData = post.type_data || {};

  const [submissions, setSubmissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("submissions"); // submissions, participants
  const [filter, setFilter] = useState("approved"); // approved, featured

  const fetchSubmissions = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/challenge-submissions?filter=${filter}`,
          15000,
          token
        );

        if (response.success) {
          setSubmissions(response.submissions || []);
        }
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [post.id, filter]
  );

  const fetchParticipants = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await apiGet(
        `/posts/${post.id}/participants`,
        15000,
        token
      );

      if (response.success) {
        setParticipants(response.participants || []);
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  }, [post.id]);

  useEffect(() => {
    if (activeTab === "submissions") {
      fetchSubmissions();
    } else {
      fetchParticipants();
    }
  }, [activeTab, fetchSubmissions, fetchParticipants]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === "submissions") {
      fetchSubmissions(false);
    } else {
      fetchParticipants();
      setIsRefreshing(false);
    }
  };

  const handleLike = async (submissionId, hasLiked) => {
    try {
      const token = await getAuthToken();

      // Optimistic update
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                like_count: hasLiked ? s.like_count - 1 : s.like_count + 1,
                has_liked: !hasLiked,
              }
            : s
        )
      );

      if (hasLiked) {
        await apiDelete(
          `/challenge-submissions/${submissionId}/like`,
          {},
          10000,
          token
        );
      } else {
        await apiPost(
          `/challenge-submissions/${submissionId}/like`,
          {},
          10000,
          token
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      fetchSubmissions(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#34C759";
      case "in_progress":
        return "#FF9500";
      default:
        return COLORS.textSecondary;
    }
  };

  const renderSubmission = ({ item, index }) => {
    const hasMedia = item.media_urls && item.media_urls.length > 0;
    const hasVideo = item.video_url;

    return (
      <TouchableOpacity
        style={[
          styles.submissionCard,
          {
            marginLeft: index % COLUMN_COUNT === 0 ? SPACING.m : SPACING.s / 2,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          // Could navigate to detail view
        }}
      >
        {/* Media */}
        {hasMedia && (
          <Image
            source={{ uri: item.media_urls[0] }}
            style={styles.submissionImage}
          />
        )}
        {hasVideo && (
          <View style={styles.videoContainer}>
            <Image
              source={{ uri: item.video_thumbnail || item.video_url }}
              style={styles.submissionImage}
            />
            <View style={styles.playOverlay}>
              <Ionicons name="play-circle" size={36} color="#FFFFFF" />
            </View>
          </View>
        )}
        {!hasMedia && !hasVideo && (
          <View style={styles.textSubmissionCard}>
            <Text style={styles.textSubmissionContent} numberOfLines={4}>
              {item.content || "No content"}
            </Text>
          </View>
        )}

        {/* Featured Badge */}
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={10} color="#FFD700" />
          </View>
        )}

        {/* Footer */}
        <View style={styles.submissionFooter}>
          <View style={styles.submissionAuthor}>
            {item.participant_photo_url && (
              <Image
                source={{ uri: item.participant_photo_url }}
                style={styles.authorAvatar}
              />
            )}
            <Text style={styles.authorName} numberOfLines={1}>
              {item.participant_name || "User"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleLike(item.id, item.has_liked)}
          >
            <Ionicons
              name={item.has_liked ? "heart" : "heart-outline"}
              size={16}
              color={item.has_liked ? COLORS.error : COLORS.textSecondary}
            />
            <Text style={styles.likeCount}>{item.like_count || 0}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderParticipant = ({ item }) => {
    return (
      <View style={styles.participantCard}>
        <View style={styles.participantInfo}>
          {item.participant_photo_url ? (
            <Image
              source={{ uri: item.participant_photo_url }}
              style={styles.participantAvatar}
            />
          ) : (
            <View style={styles.participantAvatarPlaceholder}>
              <Ionicons name="person" size={20} color={COLORS.textSecondary} />
            </View>
          )}
          <View style={styles.participantDetails}>
            <Text style={styles.participantName}>
              {item.participant_name || "Participant"}
            </Text>
            <Text style={styles.participantJoined}>
              Joined {formatTimeAgo(item.joined_at)}
            </Text>
          </View>
          {item.is_highlighted && (
            <View style={styles.highlightBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
            </View>
          )}
        </View>

        {/* Progress (for progress challenges) */}
        {typeData.challenge_type === "progress" && (
          <View style={styles.participantProgress}>
            <View style={styles.progressBarSmall}>
              <View
                style={[
                  styles.progressBarFillSmall,
                  { width: `${item.progress || 0}%` },
                ]}
              />
            </View>
            <Text style={styles.progressPercentText}>
              {item.progress || 0}%
            </Text>
          </View>
        )}

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + "20" },
          ]}
        >
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status === "completed"
              ? "Completed"
              : item.status === "in_progress"
              ? "In Progress"
              : "Joined"}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Challenge Info */}
      <View style={styles.challengeInfo}>
        <MaterialCommunityIcons
          name="trophy-outline"
          size={24}
          color="#FF9500"
        />
        <View style={styles.challengeInfoText}>
          <Text style={styles.challengeTitle}>{typeData.title}</Text>
          <Text style={styles.challengeAuthor}>by {post.author_name}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "submissions" && styles.tabActive]}
          onPress={() => setActiveTab("submissions")}
        >
          <Ionicons
            name="images"
            size={18}
            color={
              activeTab === "submissions" ? "#FF9500" : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "submissions" && styles.tabTextActive,
            ]}
          >
            Submissions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "participants" && styles.tabActive]}
          onPress={() => setActiveTab("participants")}
        >
          <Ionicons
            name="people"
            size={18}
            color={
              activeTab === "participants" ? "#FF9500" : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "participants" && styles.tabTextActive,
            ]}
          >
            Participants
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter (for submissions) */}
      {activeTab === "submissions" && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === "approved" && styles.filterPillActive,
            ]}
            onPress={() => setFilter("approved")}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === "approved" && styles.filterPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === "featured" && styles.filterPillActive,
            ]}
            onPress={() => setFilter("featured")}
          >
            <Ionicons
              name="star"
              size={12}
              color={filter === "featured" ? "#FFFFFF" : "#FFD700"}
            />
            <Text
              style={[
                styles.filterPillText,
                filter === "featured" && styles.filterPillTextActive,
              ]}
            >
              Featured
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name={
          activeTab === "submissions" ? "image-off" : "account-group-outline"
        }
        size={48}
        color={COLORS.textSecondary}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === "submissions"
          ? "No submissions yet"
          : "No participants yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "submissions"
          ? "Be the first to submit proof!"
          : "Join the challenge to get started"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>
            {activeTab === "submissions"
              ? submissions.length
              : participants.length}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9500" />
        </View>
      ) : (
        <FlatList
          data={activeTab === "submissions" ? submissions : participants}
          renderItem={
            activeTab === "submissions" ? renderSubmission : renderParticipant
          }
          keyExtractor={(item) => `${activeTab}-${item.id}`}
          numColumns={activeTab === "submissions" ? COLUMN_COUNT : 1}
          key={activeTab} // Force re-render when switching tabs
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF9500"
            />
          }
        />
      )}

      {/* FAB for Submit */}
      {(post.has_joined && !post.expires_at) ||
      (post.expires_at && new Date(post.expires_at) > new Date()) ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("ChallengeSubmit", { post })}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF9500",
    backgroundColor: "#FF950015",
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  // Header Section
  headerContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    marginBottom: SPACING.s,
    ...SHADOWS.sm,
  },
  challengeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  challengeInfoText: {
    marginLeft: SPACING.s,
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  challengeAuthor: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.s,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#FF9500",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  tabTextActive: {
    color: "#FF9500",
  },
  filterRow: {
    flexDirection: "row",
    marginTop: SPACING.xs,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: COLORS.screenBackground,
    marginRight: SPACING.s,
  },
  filterPillActive: {
    backgroundColor: "#FF9500",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  // Submission Card
  submissionCard: {
    width: ITEM_WIDTH,
    marginBottom: SPACING.s,
    marginRight: SPACING.s / 2,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  submissionImage: {
    width: "100%",
    height: ITEM_WIDTH,
  },
  videoContainer: {
    position: "relative",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  textSubmissionCard: {
    width: "100%",
    height: ITEM_WIDTH,
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    justifyContent: "center",
  },
  textSubmissionContent: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  featuredBadge: {
    position: "absolute",
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: "#FFF8E1",
    padding: 4,
    borderRadius: 12,
  },
  submissionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.s,
  },
  submissionAuthor: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  authorName: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 1,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  // Participant Card
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.m,
    marginTop: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    ...SHADOWS.sm,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.s,
  },
  participantAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  participantJoined: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  highlightBadge: {
    backgroundColor: "#FFF8E1",
    padding: 4,
    borderRadius: 12,
    marginLeft: SPACING.xs,
  },
  participantProgress: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.m,
    width: 80,
  },
  progressBarSmall: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 6,
  },
  progressBarFillSmall: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF9500",
  },
  statusBadge: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF9500",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.md,
  },
});

export default ChallengeSubmissionsScreen;
