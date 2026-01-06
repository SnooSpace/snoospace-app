/**
 * PromptPostCard
 * Displays a prompt post with submission functionality
 */

import React, { useState } from "react";
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
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiPost, apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const PromptPostCard = ({
  post,
  onUserPress,
  currentUserId,
  currentUserType,
}) => {
  const navigation = useNavigation();
  const typeData = post.type_data || {};
  const [hasSubmitted, setHasSubmitted] = useState(post.has_submitted || false);
  const [submissionStatus, setSubmissionStatus] = useState(
    post.submission_status || null
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(
    typeData.submission_count || 0
  );
  const totalReplyCount = typeData.total_reply_count || 0;

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const maxLength = typeData.max_length || 500;

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleSubmit = async () => {
    if (!submissionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/posts/${post.id}/submissions`,
        { content: submissionText.trim() },
        15000,
        token
      );

      if (response.success) {
        setHasSubmitted(true);
        setSubmissionStatus(response.submission.status);
        setSubmissionCount((prev) => prev + 1);
        setShowSubmitModal(false);
        setSubmissionText("");
      }
    } catch (error) {
      console.error("Error submitting response:", error);
      // Show error message to user
    } finally {
      setIsSubmitting(false);
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

  const getStatusBadge = () => {
    if (!hasSubmitted) return null;

    const statusConfig = {
      pending: { label: "Pending", color: "#F9A825", icon: "time-outline" },
      approved: {
        label: "Approved",
        color: "#34C759",
        icon: "checkmark-circle",
      },
      featured: { label: "Featured", color: "#7B1FA2", icon: "star" },
      rejected: {
        label: "Not selected",
        color: "#8E8E93",
        icon: "close-circle",
      },
    };

    const config = statusConfig[submissionStatus] || statusConfig.pending;

    return (
      <View
        style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}
      >
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  // Render preview response
  const renderPreviewResponse = () => {
    const preview = post.preview_submission;
    if (!preview) return null;

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Image
            source={
              preview.author_photo_url
                ? { uri: preview.author_photo_url }
                : { uri: "https://via.placeholder.com/32" }
            }
            style={styles.previewAvatar}
          />
          <Text style={styles.previewAuthorName} numberOfLines={1}>
            {preview.author_name || "Anonymous"}
          </Text>
          {preview.is_pinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={10} color="#FF9500" />
            </View>
          )}
        </View>
        <Text style={styles.previewContent} numberOfLines={2}>
          "{preview.content}"
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Type Indicator and Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.typeIndicator}>
          <MaterialCommunityIcons
            name="chat-question"
            size={14}
            color="#00838F"
          />
          <Text style={styles.typeLabel}>PROMPT</Text>
        </View>
        {getStatusBadge()}
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

      {/* Prompt Text */}
      <Text style={styles.promptText}>{typeData.prompt_text}</Text>

      {/* Preview Response */}
      {renderPreviewResponse()}

      {/* Submission Area */}
      {hasSubmitted ? (
        <View style={styles.submittedContainer}>
          <View style={styles.submittedHeader}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={COLORS.success}
            />
            <Text style={styles.submittedText}>Response submitted</Text>
          </View>
        </View>
      ) : isExpired ? (
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredText}>This prompt has ended</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => setShowSubmitModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.submitButtonText}>Add your response</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.responseCount}>
          {submissionCount} response{submissionCount !== 1 ? "s" : ""}
          {totalReplyCount > 0
            ? ` • ${totalReplyCount} repl${totalReplyCount !== 1 ? "ies" : "y"}`
            : ""}
        </Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate("PromptSubmissions", { post })}
        >
          <Text style={styles.viewAllText}>See all →</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Modal */}
      <Modal
        visible={showSubmitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Response</Text>
              <TouchableOpacity
                onPress={() => setShowSubmitModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPrompt}>{typeData.prompt_text}</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Write your response..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={maxLength}
              value={submissionText}
              onChangeText={setSubmissionText}
              autoFocus
            />

            <View style={styles.modalFooter}>
              <Text style={styles.charCount}>
                {submissionText.length}/{maxLength}
              </Text>
              <TouchableOpacity
                style={[
                  styles.submitActionButton,
                  (!submissionText.trim() || isSubmitting) &&
                    styles.submitActionButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!submissionText.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitActionButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            {typeData.require_approval && (
              <Text style={styles.approvalNote}>
                Your response will be reviewed before being published
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    color: "#00838F",
    marginLeft: 4,
    letterSpacing: 0.5,
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
  promptText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    lineHeight: 22,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
    marginLeft: SPACING.s,
  },
  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E9",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  submittedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  submittedText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.success,
    marginLeft: SPACING.s,
  },
  // Preview response styles
  previewContainer: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  previewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.xs,
  },
  previewAuthorName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  previewContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    lineHeight: 20,
  },
  pinnedBadge: {
    backgroundColor: "#FF950020",
    borderRadius: 10,
    padding: 4,
    marginLeft: SPACING.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.m,
  },
  responseCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  viewAllButton: {},
  viewAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.l,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  modalPrompt: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.m,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.m,
  },
  charCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  submitActionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    minWidth: 80,
    alignItems: "center",
  },
  submitActionButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  submitActionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  approvalNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.m,
    fontStyle: "italic",
  },
});

export default PromptPostCard;
