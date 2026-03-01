/**
 * PromptSubmissionsScreen
 * View and moderate submissions for a prompt post
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getActiveAccount } from "../../utils/accountManager";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import EventBus from "../../utils/EventBus";
import SnooLoader from "../../components/ui/SnooLoader";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
];

const PromptSubmissionsScreen = ({ route, navigation }) => {
  const { post } = route.params;
  const typeData = post?.type_data || {};

  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [isAuthor, setIsAuthor] = useState(false);
  const [moderatingId, setModeratingId] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Check if current user is the post author
  useEffect(() => {
    const checkIsAuthor = async () => {
      const account = await getActiveAccount();
      if (account) {
        const isPostAuthor =
          account.id === post.author_id && account.type === post.author_type;
        setIsAuthor(isPostAuthor);
        // Non-authors should default to approved tab
        if (!isPostAuthor) {
          setActiveTab("approved");
        }
      } else {
        // Not logged in, show approved only
        setActiveTab("approved");
      }
    };
    checkIsAuthor();
  }, [post]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const status = activeTab === "all" ? "all" : activeTab;
      const response = await apiGet(
        `/posts/${post.id}/submissions?status=${status}`,
        15000,
        token
      );
      setSubmissions(response.submissions || []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [post.id, activeTab]);

  useEffect(() => {
    setIsLoading(true);
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Refresh submissions when screen comes into focus (e.g., returning from PromptRepliesScreen)
  useFocusEffect(
    useCallback(() => {
      // Only fetch if not already loading to avoid duplicate requests on initial mount
      if (!isLoading) {
        fetchSubmissions();
      }
    }, [fetchSubmissions, isLoading])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSubmissions();
  };

  const handleModerate = async (submissionId, newStatus) => {
    setModeratingId(submissionId);
    try {
      const token = await getAuthToken();
      await apiPatch(
        `/submissions/${submissionId}/status`,
        { status: newStatus },
        15000,
        token
      );
      // Remove from current list after moderation
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      // Show success feedback
      Alert.alert(
        "Success",
        `Submission ${newStatus === "approved" ? "approved" : "rejected"}`
      );
    } catch (error) {
      console.error("Error moderating submission:", error);
      Alert.alert("Error", "Failed to moderate submission");
    } finally {
      setModeratingId(null);
    }
  };

  const handlePin = async (submissionId, currentlyPinned) => {
    setPinningId(submissionId);
    setOptionsModalVisible(false);
    try {
      const token = await getAuthToken();
      await apiPatch(`/submissions/${submissionId}/pin`, {}, 15000, token);
      // Update the local state and re-sort (pinned items first)
      setSubmissions((prev) => {
        const updated = prev.map((s) => ({
          ...s,
          is_pinned: s.id === submissionId ? !currentlyPinned : false,
        }));
        // Sort: pinned first, then by created_at descending
        return updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
      });
      // Notify HomeFeed to refresh the preview
      EventBus.emit("prompt-pin-updated", { postId: post.id });
      Alert.alert(
        "Success",
        currentlyPinned ? "Submission unpinned" : "Submission pinned"
      );
    } catch (error) {
      console.error("Error pinning submission:", error);
      Alert.alert("Error", "Failed to pin submission");
    } finally {
      setPinningId(null);
    }
  };

  const openOptionsModal = (submission) => {
    setSelectedSubmission(submission);
    setOptionsModalVisible(true);
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const handleUserPress = (userId, userType) => {
    if (userType === "member") {
      navigation.navigate("MemberPublicProfile", { userId });
    } else if (userType === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: userId });
    }
  };

  const renderSubmission = ({ item }) => (
    <View style={styles.submissionCard}>
      {/* Pinned indicator */}
      {item.is_pinned && (
        <View style={styles.pinnedBadge}>
          <Ionicons name="pin" size={12} color="#FF9500" />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}

      {/* Options menu - positioned at top right of card */}
      {isAuthor && activeTab === "approved" && (
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => openOptionsModal(item)}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      )}

      <View style={styles.submissionHeaderRow}>
        <TouchableOpacity
          style={styles.submissionHeader}
          onPress={() => handleUserPress(item.author_id, item.author_type)}
        >
          <Image
            source={
              item.author_photo_url
                ? { uri: item.author_photo_url }
                : { uri: "https://via.placeholder.com/40" }
            }
            style={styles.authorImage}
          />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.author_name || "User"}</Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.submissionContent}>{item.content}</Text>

      {/* Reply count - navigate to replies (show for approved submissions) */}
      {(activeTab === "approved" || item.status === "approved") && (
        <TouchableOpacity
          style={styles.repliesButton}
          onPress={() =>
            navigation.navigate("PromptReplies", { submission: item, post })
          }
        >
          <Text style={styles.repliesText}>
            {(item.total_reply_count || item.reply_count) > 0
              ? `${item.total_reply_count || item.reply_count} replies`
              : "Reply"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* Author moderation controls for pending submissions */}
      {isAuthor && activeTab === "pending" && (
        <View style={styles.moderationButtons}>
          <TouchableOpacity
            style={[styles.modButton, styles.approveButton]}
            onPress={() => handleModerate(item.id, "approved")}
            disabled={moderatingId === item.id}
          >
            {moderatingId === item.id ? (
              <SnooLoader size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={[styles.modButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Approve</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modButton, styles.rejectButton]}
            onPress={() => handleModerate(item.id, "rejected")}
            disabled={moderatingId === item.id}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
            <Text style={styles.modButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="text-box-remove-outline"
        size={64}
        color={COLORS.textSecondary}
      />
      <Text style={styles.emptyTitle}>No {activeTab} submissions</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "pending"
          ? "All submissions have been reviewed"
          : `No ${activeTab} submissions yet`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Responses</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {typeData.prompt_text}
          </Text>
        </View>
      </View>

      {/* Tabs - only show for post author */}
      {isAuthor && (
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Submissions List */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={submissions}
            renderItem={renderSubmission}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </View>

      {/* Options Modal for Pin */}
      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() =>
                handlePin(selectedSubmission?.id, selectedSubmission?.is_pinned)
              }
              disabled={pinningId === selectedSubmission?.id}
            >
              {pinningId === selectedSubmission?.id ? (
                <SnooLoader size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons
                    name={selectedSubmission?.is_pinned ? "pin-outline" : "pin"}
                    size={22}
                    color={"#FF9500"}
                  />
                  <Text style={[styles.optionText, { fontFamily: 'Manrope-Medium' }]}>
                    {selectedSubmission?.is_pinned
                      ? "Unpin response"
                      : "Pin response"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  contentArea: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.s,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.s,
    alignItems: "center",
  },
  activeTab: {
    // No underline, just text color change
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: SPACING.m,
    flexGrow: 1,
  },
  submissionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    position: "relative",
    ...SHADOWS.sm,
  },
  submissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.s,
  },
  authorImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.s,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  submissionContent: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  moderationButtons: {
    flexDirection: "row",
    marginTop: SPACING.m,
    gap: SPACING.s,
  },
  modButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    gap: 4,
  },
  approveButton: {
    backgroundColor: "#34C759",
  },
  featureButton: {
    backgroundColor: "#7B1FA2",
  },
  rejectButton: {
    backgroundColor: "#8E8E93",
  },
  modButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: SPACING.m,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
    gap: 4,
  },
  approvedBadge: {
    backgroundColor: "#34C75920",
  },
  featuredBadge: {
    backgroundColor: "#7B1FA220",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  // New styles for pin/replies
  submissionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF950020",
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
    marginBottom: SPACING.s,
    alignSelf: "flex-start",
    gap: 4,
  },
  pinnedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF9500",
  },
  optionsButton: {
    position: "absolute",
    top: SPACING.s,
    right: SPACING.s,
    padding: SPACING.xs,
    zIndex: 1,
  },
  repliesButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.m,
  },
  repliesText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsModal: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.s,
    minWidth: 200,
    ...SHADOWS.md,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.m,
    gap: SPACING.m,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
});

export default PromptSubmissionsScreen;
