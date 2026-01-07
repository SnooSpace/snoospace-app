/**
 * QnAPostCard
 * Displays a Q&A post with question submission, upvoting, and preview
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiPost, apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const QnAPostCard = ({ post, onUserPress, currentUserId, currentUserType }) => {
  const navigation = useNavigation();
  const typeData = post.type_data || {};
  const [userQuestionCount, setUserQuestionCount] = useState(
    post.user_question_count || 0
  );
  const [questionCount, setQuestionCount] = useState(
    typeData.question_count || 0
  );
  const [answeredCount, setAnsweredCount] = useState(
    typeData.answered_count || 0
  );
  const [showAskModal, setShowAskModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(
    post.preview_question || null
  );

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const maxQuestions = typeData.max_questions_per_user || 1;

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

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!questionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/posts/${post.id}/questions`,
        {
          content: questionText.trim(),
          is_anonymous: isAnonymous && typeData.allow_anonymous,
        },
        15000,
        token
      );

      if (response.success) {
        setUserQuestionCount((prev) => prev + 1);
        setQuestionCount((prev) => prev + 1);
        setShowAskModal(false);
        setQuestionText("");
        setIsAnonymous(false);
        // Update preview if this is the first question
        if (!previewQuestion) {
          setPreviewQuestion(response.question);
        }
      }
    } catch (error) {
      console.error("Error submitting question:", error);
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

  // Render preview question
  const renderPreviewQuestion = () => {
    if (!previewQuestion) return null;

    return (
      <TouchableOpacity
        style={styles.previewContainer}
        onPress={() => navigation.navigate("QnAQuestions", { post })}
        activeOpacity={0.7}
      >
        <View style={styles.previewHeader}>
          <View style={styles.upvotePreview}>
            <Ionicons name="arrow-up" size={14} color={COLORS.primary} />
            <Text style={styles.upvoteCount}>
              {previewQuestion.upvote_count || 0}
            </Text>
          </View>
          <View style={styles.previewMeta}>
            {previewQuestion.author_photo_url && (
              <Image
                source={{ uri: previewQuestion.author_photo_url }}
                style={styles.previewAvatar}
              />
            )}
            <Text style={styles.previewAuthorName} numberOfLines={1}>
              {previewQuestion.author_name || "Anonymous"}
            </Text>
            {previewQuestion.is_answered && (
              <View style={styles.answeredBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#34C759" />
                <Text style={styles.answeredBadgeText}>Answered</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.previewContent} numberOfLines={2}>
          {previewQuestion.content}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Type Indicator */}
      <View style={styles.headerRow}>
        <View style={styles.typeIndicator}>
          <MaterialCommunityIcons
            name="frequently-asked-questions"
            size={14}
            color="#5856D6"
          />
          <Text style={styles.typeLabel}>Q&A</Text>
        </View>
        {post.expires_at && (
          <Text style={[styles.expiryBadge, isExpired && styles.expiredBadge]}>
            {formatExpiryTime(post.expires_at)}
          </Text>
        )}
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

      {/* Q&A Title and Description */}
      <Text style={styles.title}>{typeData.title}</Text>
      {typeData.description && (
        <Text style={styles.description}>{typeData.description}</Text>
      )}

      {/* Preview Question */}
      {renderPreviewQuestion()}

      {/* Ask Question Button */}
      {userQuestionCount >= maxQuestions ? (
        <View style={styles.askedContainer}>
          <View style={styles.askedHeader}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={COLORS.success}
            />
            <Text style={styles.askedText}>
              {maxQuestions === 1
                ? "Question submitted"
                : `${userQuestionCount}/${maxQuestions} questions asked`}
            </Text>
          </View>
        </View>
      ) : isExpired ? (
        <View style={styles.expiredContainer}>
          <Text style={styles.expiredText}>This Q&A session has ended</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.askButton}
          onPress={() => setShowAskModal(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="hand-wave" size={20} color="#5856D6" />
          <Text style={styles.askButtonText}>
            {userQuestionCount > 0
              ? `Ask another question (${userQuestionCount}/${maxQuestions})`
              : "Ask a question"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.questionCountText}>
          {questionCount} question{questionCount !== 1 ? "s" : ""}
          {answeredCount > 0 ? ` • ${answeredCount} answered` : ""}
        </Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate("QnAQuestions", { post })}
        >
          <Text style={styles.viewAllText}>See all →</Text>
        </TouchableOpacity>
      </View>

      {/* Ask Question Modal */}
      <Modal
        visible={showAskModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAskModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask a Question</Text>
              <TouchableOpacity
                onPress={() => setShowAskModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPrompt}>{typeData.title}</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Type your question..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={500}
              value={questionText}
              onChangeText={setQuestionText}
              autoFocus
            />

            <View style={styles.modalFooter}>
              <Text style={styles.charCount}>{questionText.length}/500</Text>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!questionText.trim() || isSubmitting) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitQuestion}
                disabled={!questionText.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            {typeData.allow_anonymous ? (
              <View style={styles.anonymousRow}>
                <View style={styles.anonymousToggle}>
                  <Ionicons
                    name={isAnonymous ? "eye-off" : "eye-off-outline"}
                    size={16}
                    color={isAnonymous ? "#5856D6" : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.anonymousLabel,
                      isAnonymous && styles.anonymousLabelActive,
                    ]}
                  >
                    Ask anonymously
                  </Text>
                  <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{ false: COLORS.border, true: "#5856D650" }}
                    thumbColor={isAnonymous ? "#5856D6" : COLORS.textSecondary}
                    style={styles.anonymousSwitch}
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.visibilityNote}>
                Your name will be visible with your question
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
    color: "#5856D6",
    marginLeft: 4,
    letterSpacing: 0.5,
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
  // Preview Question Styles
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
  upvotePreview: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.m,
  },
  upvoteCount: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
    marginLeft: 2,
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
  answeredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
    marginLeft: SPACING.xs,
  },
  answeredBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
    marginLeft: 2,
  },
  previewContent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: "italic",
  },
  // Ask Button
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5856D610",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: "#5856D630",
    borderStyle: "dashed",
  },
  askButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5856D6",
    marginLeft: SPACING.s,
  },
  askedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  askedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  askedText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.success,
    marginLeft: SPACING.s,
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
  questionCountText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  viewAllButton: {},
  viewAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
  },
  // Modal Styles
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
    minHeight: 100,
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
  submitButton: {
    backgroundColor: "#5856D6",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.m,
    minWidth: 80,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Anonymous toggle styles
  anonymousRow: {
    marginTop: SPACING.m,
  },
  anonymousToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  anonymousLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.s,
    flex: 1,
  },
  anonymousLabelActive: {
    color: "#5856D6",
    fontWeight: "500",
  },
  anonymousSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  visibilityNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.m,
    fontStyle: "italic",
  },
});

export default QnAPostCard;
