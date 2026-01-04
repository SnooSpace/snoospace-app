/**
 * PromptRepliesScreen
 * View and create replies to a prompt submission (YouTube-style threaded comments)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost, apiPatch } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getActiveAccount } from "../../utils/accountManager";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const PromptRepliesScreen = ({ route, navigation }) => {
  const { submission, post } = route.params;

  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isPostAuthor, setIsPostAuthor] = useState(false);
  const inputRef = useRef(null);

  // Check if current user is the post author
  useEffect(() => {
    const checkIsAuthor = async () => {
      const account = await getActiveAccount();
      if (account) {
        setCurrentUser(account);
        setIsPostAuthor(
          account.id === post.author_id && account.type === post.author_type
        );
      }
    };
    checkIsAuthor();
  }, [post]);

  const fetchReplies = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await apiGet(
        `/submissions/${submission.id}/replies`,
        15000,
        token
      );
      setReplies(response.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [submission.id]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReplies();
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/submissions/${submission.id}/replies`,
        { content: replyText.trim() },
        15000,
        token
      );

      if (response.success && response.reply) {
        setReplies((prev) => [...prev, response.reply]);
        setReplyText("");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleHideReply = async (replyId, currentlyHidden) => {
    try {
      const token = await getAuthToken();
      await apiPatch(`/replies/${replyId}/hide`, {}, 15000, token);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId ? { ...r, is_hidden: !currentlyHidden } : r
        )
      );
    } catch (error) {
      console.error("Error hiding reply:", error);
    }
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

  // Render the parent submission at the top
  const renderParentSubmission = () => (
    <View style={styles.parentSubmission}>
      <TouchableOpacity
        style={styles.submissionHeader}
        onPress={() =>
          handleUserPress(submission.author_id, submission.author_type)
        }
      >
        <Image
          source={
            submission.author_photo_url
              ? { uri: submission.author_photo_url }
              : { uri: "https://via.placeholder.com/40" }
          }
          style={styles.authorImage}
        />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>
            {submission.author_name || "User"}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimeAgo(submission.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.submissionContent}>{submission.content}</Text>
    </View>
  );

  const renderReply = ({ item }) => {
    // If hidden, show placeholder message
    if (item.is_hidden) {
      return (
        <View style={styles.replyCard}>
          <View style={styles.replyConnector} />
          <View style={styles.hiddenReplyContent}>
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.hiddenText}>
              This response has been hidden by the community
            </Text>
          </View>
          {/* Post author can unhide */}
          {isPostAuthor && (
            <TouchableOpacity
              style={styles.unhideButton}
              onPress={() => handleHideReply(item.id, true)}
            >
              <Text style={styles.unhideText}>Unhide</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.replyCard}>
        <View style={styles.replyConnector} />
        <View style={styles.replyContent}>
          <View style={styles.replyHeaderRow}>
            <TouchableOpacity
              style={styles.replyHeader}
              onPress={() => handleUserPress(item.author_id, item.author_type)}
            >
              <Image
                source={
                  item.author_photo_url
                    ? { uri: item.author_photo_url }
                    : { uri: "https://via.placeholder.com/32" }
                }
                style={styles.replyAuthorImage}
              />
              <View style={styles.replyAuthorInfo}>
                <Text style={styles.replyAuthorName}>
                  {item.author_name || "User"}
                </Text>
                <Text style={styles.replyTimestamp}>
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Post author can hide replies */}
            {isPostAuthor && (
              <TouchableOpacity
                style={styles.hideButton}
                onPress={() => handleHideReply(item.id, false)}
              >
                <Ionicons
                  name="eye-off-outline"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.replyText}>{item.content}</Text>
        </View>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Replies</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.contentArea}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={replies}
              renderItem={renderReply}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={renderParentSubmission}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={COLORS.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No replies yet. Be the first!
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Reply Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a reply..."
            placeholderTextColor={COLORS.textSecondary}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!replyText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.s,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  keyboardView: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
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
  // Parent submission styles
  parentSubmission: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.m,
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
  // Reply styles
  replyCard: {
    flexDirection: "row",
    marginLeft: SPACING.m,
    marginBottom: SPACING.s,
  },
  replyConnector: {
    width: 2,
    backgroundColor: COLORS.border,
    marginRight: SPACING.m,
  },
  replyContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    ...SHADOWS.sm,
  },
  replyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginBottom: SPACING.xs,
  },
  replyAuthorImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.xs,
  },
  replyAuthorInfo: {
    flex: 1,
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  replyTimestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  replyText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  hideButton: {
    padding: SPACING.xs,
  },
  // Hidden reply
  hiddenReplyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.xs,
  },
  hiddenText: {
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.textSecondary,
    flex: 1,
  },
  unhideButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  unhideText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  // Empty state
  emptyState: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.s,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.l,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default PromptRepliesScreen;
