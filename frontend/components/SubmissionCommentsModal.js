/**
 * SubmissionCommentsModal
 *
 * Identical design to CommentsModal but scoped to a single challenge submission.
 * Hits /challenge-submissions/:id/comments instead of /posts/:id/comments,
 * keeping submission-level discussion fully isolated from the parent challenge
 * post's comment count and feed.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  StyleSheet,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { X, Send, CornerUpLeft, Trash2 } from "lucide-react-native";
import { apiGet, apiPost, apiDelete } from "../api/client";
import { getAuthToken, getAuthEmail } from "../api/auth";
import EventBus from "../utils/EventBus";
import KeyboardAwareToolbar from "./KeyboardAwareToolbar";

import { COLORS as GLOBAL_COLORS, FONTS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

const COLORS = {
  ...GLOBAL_COLORS,
  dark: "#FFFFFF",
  darkGray: "#F5F5F5",
  text: GLOBAL_COLORS.textPrimary,
  textSecondary: GLOBAL_COLORS.textSecondary,
  border: GLOBAL_COLORS.border,
  primary: GLOBAL_COLORS.primary,
  error: GLOBAL_COLORS.error,
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffSeconds = Math.floor((now - then) / 1000);
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
  return `${Math.floor(diffSeconds / 86400)}d`;
};

const SubmissionCommentsModal = ({
  visible,
  submissionId,
  submissionAuthorName,
  onClose,
  onCommentCountChange,
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const prevSubmissionIdRef = useRef(null);
  const prevVisibleRef = useRef(false);
  const inputRef = useRef(null);
  const replyAnim = useRef(new Animated.Value(0)).current;

  // ── Animate reply indicator ───────────────────────────────────────────────
  useEffect(() => {
    if (replyingTo) {
      Animated.timing(replyAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      replyAnim.setValue(0);
    }
  }, [replyingTo]);

  // ── Load on open / submission change ─────────────────────────────────────
  useEffect(() => {
    if (visible && submissionId) {
      const isNewlyOpened = !prevVisibleRef.current;
      const isSubChanged = submissionId !== prevSubmissionIdRef.current;

      if (isNewlyOpened || isSubChanged) {
        loadComments();
        loadUserProfile();
      }

      prevSubmissionIdRef.current = submissionId;
      prevVisibleRef.current = true;

      if (isNewlyOpened) {
        setTimeout(() => { inputRef.current?.focus(); }, 300);
      }
    } else if (!visible && prevVisibleRef.current) {
      setComments([]);
      setCommentInput("");
      setReplyingTo(null);
      prevVisibleRef.current = false;
    }
  }, [visible, submissionId]);

  // Focus helpers
  const triggerInputFocus = useCallback(() => {
    inputRef.current?.focus();
    requestAnimationFrame(() => { inputRef.current?.focus(); });
    setTimeout(() => { inputRef.current?.focus(); }, 200);
    setTimeout(() => { inputRef.current?.focus(); }, 500);
  }, []);

  useEffect(() => {
    if (focusTrigger > 0) triggerInputFocus();
  }, [focusTrigger, triggerInputFocus]);

  // ── Load user profile ─────────────────────────────────────────────────────
  const loadUserProfile = async () => {
    try {
      const token = await getAuthToken();
      const email = await getAuthEmail();
      if (!token || !email) return;
      const res = await apiPost("/auth/get-user-profile", { email }, 10000, token);
      if (res?.profile) {
        setUserProfile(res.profile);
        const uid = res.profile.id || res.profile.user_id;
        if (uid) setCurrentUserId(uid);
      }
    } catch (e) {
      console.error("[SubmissionCommentsModal] loadUserProfile:", e);
    }
  };

  // ── Load comments ─────────────────────────────────────────────────────────
  const loadComments = async () => {
    if (!submissionId) return;
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await apiGet(
        `/challenge-submissions/${submissionId}/comments`,
        10000,
        token,
      );
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e) {
      console.error("[SubmissionCommentsModal] loadComments:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Post comment ──────────────────────────────────────────────────────────
  const handlePostComment = async () => {
    const text = commentInput.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const token = await getAuthToken();
      const result = await apiPost(
        `/challenge-submissions/${submissionId}/comments`,
        { commentText: text },
        15000,
        token,
      );
      if (result?.comment) {
        const newComments = [...comments, result.comment];
        setComments(newComments);
        setCommentInput("");
        setReplyingTo(null);
        if (onCommentCountChange) onCommentCountChange(newComments.length);
        EventBus.emit("submission-comment-added", { submissionId, count: newComments.length });
      }
    } catch (e) {
      Alert.alert("Error", "Failed to post comment. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // ── Delete comment ────────────────────────────────────────────────────────
  const handleDeleteComment = (commentId) => {
    Alert.alert("Delete Comment", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getAuthToken();
            await apiDelete(`/challenge-submission-comments/${commentId}`, null, 15000, token);
            const updated = comments.filter((c) => c.id !== commentId);
            setComments(updated);
            if (onCommentCountChange) onCommentCountChange(updated.length);
          } catch (e) {
            Alert.alert("Error", "Failed to delete comment.");
          }
        },
      },
    ]);
  };

  const cancelReply = () => {
    Animated.timing(replyAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setReplyingTo(null);
    });
  };

  // ── Render individual comment ─────────────────────────────────────────────
  const renderComment = ({ item }) => {
    const isOwn = currentUserId && (item.commenter_id === currentUserId || item.author_id === currentUserId);
    const photoUri =
      item.commenter_photo_url || item.author_photo_url
        ? item.commenter_photo_url || item.author_photo_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            item.commenter_name || item.author_name || "User",
          )}&background=6A0DAD&color=FFFFFF`;

    return (
      <View style={styles.commentItem}>
        <Image source={{ uri: photoUri }} style={styles.commentAvatar} />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commenterName}>
              {item.commenter_name || item.author_name || "User"}
            </Text>
            <Text style={styles.commentTime}>
              {formatTimeAgo(item.created_at)}
            </Text>
            {isOwn && (
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id)}
                style={styles.deleteButton}
              >
                <Trash2 size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentText}>{item.comment_text}</Text>
        </View>
      </View>
    );
  };

  // ── User avatar for input ─────────────────────────────────────────────────
  const inputAvatarUri =
    userProfile?.profile_photo_url || userProfile?.logo_url
      ? userProfile.profile_photo_url || userProfile.logo_url
      : userProfile?.name
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=6A0DAD&color=FFFFFF&size=32`
        : `https://ui-avatars.com/api/?name=User&background=6A0DAD&color=FFFFFF&size=32`;

  const headerTitle = submissionAuthorName
    ? `${submissionAuthorName}'s Submission`
    : "Submission Comments";

  const content = (
    <View style={styles.container}>
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#111827" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Comment List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="small" color={COLORS.textSecondary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id?.toString()}
            renderItem={renderComment}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment on this submission</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      {/* Input bar */}
      <KeyboardAwareToolbar style={styles.toolbarContainer}>
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Image source={{ uri: inputAvatarUri }} style={styles.inputAvatar} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Add a comment…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handlePostComment}
              disabled={!commentInput.trim() || posting}
              style={[
                styles.sendButton,
                (!commentInput.trim() || posting) && styles.sendButtonDisabled,
              ]}
            >
              {posting ? (
                <SnooLoader size="small" color="#FFFFFF" />
              ) : (
                <Send size={20} color="#FFFFFF" strokeWidth={2.6} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareToolbar>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "90%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#111827",
    letterSpacing: -0.2,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  commentItem: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  commenterName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#111827",
  },
  commentTime: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  commentText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: "#111827",
    marginBottom: 6,
  },
  emptySubtext: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  // Input area
  toolbarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#111827",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
});

export default SubmissionCommentsModal;
