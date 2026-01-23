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
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";

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
    post.submission_status || null,
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(
    typeData.submission_count || 0,
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
        token,
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

  // Format numbers with k/M suffix
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
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

  return (
    <View style={styles.container}>
      {/* Header with Type Indicator & Star */}
      <View style={styles.headerRow}>
        <View style={styles.nudgeBadge}>
          <Text style={styles.nudgeBadgeText}>NUDGE</Text>
        </View>
        <View style={styles.starIconContainer}>
          <Ionicons name="star" size={24} color="#FFB800" />
        </View>
      </View>

      {/* Author Info */}
      <TouchableOpacity style={styles.authorRow} onPress={handleUserPress}>
        <Image
          source={
            post.author_photo_url
              ? { uri: post.author_photo_url }
              : { uri: "https://via.placeholder.com/40" }
          }
          style={styles.profileImage}
        />
        <Text style={styles.authorName}>
          @{post.author_username || post.author_name}
        </Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
      </TouchableOpacity>

      {/* Prompt Text */}
      <Text style={styles.promptText}>{typeData.prompt_text}</Text>

      {/* Submission Area */}
      {hasSubmitted ? (
        <View style={styles.submittedContainer}>
          <Ionicons
            name="lock-closed"
            size={14}
            color="#9CA3AF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.submittedText}>You've already responded</Text>
        </View>
      ) : isExpired ? (
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredText}>This prompt has ended</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.tapToAnswerButton}
          onPress={() => setShowSubmitModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.tapIconContainer}>
            <Ionicons name="pencil" size={16} color="#9CA3AF" />
          </View>
          <Text style={styles.tapToAnswerText}>Tap to answer...</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.responseCount}>
          {formatNumber(submissionCount)} response
          {submissionCount !== 1 ? "s" : ""}
          {totalReplyCount > 0
            ? ` • ${formatNumber(totalReplyCount)} repl${totalReplyCount !== 1 ? "ies" : "y"}`
            : ""}
        </Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate("PromptSubmissions", { post })}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.primary}
            style={{ marginLeft: 4 }}
          />
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
    padding: SPACING.l,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },
  nudgeBadge: {
    backgroundColor: "#FFE8E0", // Soft coral/peach
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nudgeBadgeText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 10,
    color: "#C85A47", // Muted coral-red
    letterSpacing: 0.5,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  authorName: {
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
  timestamp: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
  },
  promptText: {
    fontFamily: FONTS.black || "BasicCommercial-Black",
    fontSize: 28,
    color: "#1D1D1F",
    marginBottom: SPACING.m,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  tapToAnswerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
  },
  tapIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  tapToAnswerText: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  submittedContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: BORDER_RADIUS.m,
    padding: 14,
    marginBottom: SPACING.m,
  },
  submittedText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#9CA3AF",
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
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "600",
  },
  starIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
