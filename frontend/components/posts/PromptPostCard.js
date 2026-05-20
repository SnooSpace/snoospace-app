/**
 * PromptPostCard
 * Displays a prompt post with submission functionality
 */

import React, { useState, useEffect, useRef } from "react";
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
  ScrollView,
  Alert,
  Dimensions,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../../constants/theme";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  MoveRight,
  Image as LucideImage,
  Camera,
  Lock,
} from "lucide-react-native";
import { savePost, unsavePost } from "../../api/client";
import { uploadMultipleImages } from "../../api/cloudinary";
import { postService } from "../../services/postService";
import PromptEditModal from "./PromptEditModal";
import EventBus from "../../utils/EventBus";
import SnooLoader from "../ui/SnooLoader";
import HapticsService from "../../services/HapticsService";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";
import CustomImagePicker from "../CustomImagePicker";

const PromptPostCard = ({
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
  const { showToast } = useToast();
  const typeData = post.type_data || {};
  const [hasSubmitted, setHasSubmitted] = useState(post.has_submitted || false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [submissionStatus, setSubmissionStatus] = useState(
    post.submission_status || null,
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const submissionType = typeData.submission_type || "text";
  const [submissionCount, setSubmissionCount] = useState(
    typeData.submission_count || 0,
  );
  const totalReplyCount = typeData.total_reply_count || 0;
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const maxLength = typeData.max_length || 500;

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  // Engagement State
  const initialIsLiked = post.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [saveCount, setSaveCount] = useState(
    post.save_count || post.saves_count || 0,
  );

  useEffect(() => {
    setIsLiked(post.is_liked === true);
    setLikeCount(post.like_count || 0);
    setIsSaved(post.is_saved || false);
    setSaveCount(post.save_count || post.saves_count || 0);
  }, [
    post.is_liked,
    post.like_count,
    post.is_saved,
    post.save_count,
    post.saves_count,
  ]);

  // ── View Tracking ─────────────────────────────────────────────────────────
  const [viewCount, setViewCount] = useState(
    post.public_view_count || post.view_count || 0,
  );
  const dwellTimerRef = useRef(null);

  useEffect(() => {
    const DWELL_THRESHOLD = 2500;
    const alreadyViewed = viewQueueService.hasViewed(post.id);
    if (!alreadyViewed) {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addQualifiedView(post.id, {
          postType: "prompt",
          trigger: "dwell",
        });
      }, DWELL_THRESHOLD);
    } else {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addRepeatView(post.id, "revisit");
      }, DWELL_THRESHOLD);
    }
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [post.id]);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-view-updated", (payload) => {
      if (payload?.postId === post.id) setViewCount((prev) => prev + 1);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [post.id]);

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
    const prevSaveCount = saveCount;
    const nextSaveCount = Math.max(0, saveCount + (newSaveState ? 1 : -1));
    setIsSaved(newSaveState);
    setSaveCount(nextSaveCount);

    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await savePost(post.id, token);
      } else {
        await unsavePost(post.id, token);
      }
      EventBus.emit("post-save-updated", {
        postId: post.id,
        isSaved: newSaveState,
        saveCount: nextSaveCount,
      });
      if (onSave) onSave(post.id, newSaveState);
    } catch (error) {
      console.error("Failed to save/unsave post:", error);
      if (error?.message?.toLowerCase().includes("already saved")) {
        setIsSaved(true);
        setSaveCount(prevSaveCount);
      } else {
        setIsSaved(!newSaveState);
        setSaveCount(prevSaveCount);
      }
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
      showToast("Success", "Post updated successfully");
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

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const pickImage = () => {
    HapticsService.triggerImpactLight();
    setShowCustomPicker(true);
  };

  const handleCustomPickerDone = (assets) => {
    const newUris = assets.map((a) => a.uri);
    setSelectedImages((prev) => [...prev, ...newUris].slice(0, 5));
    setShowCustomPicker(false);
  };

  const takePhoto = async () => {
    HapticsService.triggerImpactLight();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera access to take photos",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (!result.canceled && result.assets?.[0]) {
        setSelectedImages((prev) =>
          [...prev, result.assets[0].uri].slice(0, 5),
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const removeImage = (index) => {
    HapticsService.triggerImpactLight();
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (submissionType === "text") {
      if (!submissionText.trim()) return;
      // Client-side length guard
      if (submissionText.length > maxLength) {
        Alert.alert(
          "Response too long",
          `Please shorten your response to ${maxLength} characters or less.`,
        );
        return;
      }
    } else if (submissionType === "image") {
      if (selectedImages.length === 0) {
        Alert.alert("Required", "Please add at least one image");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();

      let uploadedUrls = [];
      if (submissionType === "image" && selectedImages.length > 0) {
        uploadedUrls = await uploadMultipleImages(selectedImages);
      }

      const body =
        submissionType === "image"
          ? { media_urls: uploadedUrls }
          : { content: submissionText.trim() };

      const response = await apiPost(
        `/posts/${post.id}/submissions`,
        body,
        30000,
        token,
      );

      if (response.success) {
        setHasSubmitted(true);
        setSubmissionStatus(response.submission.status);
        setSubmissionCount((prev) => prev + 1);
        setShowSubmitModal(false);
        setSubmissionText("");
        setSelectedImages([]);
      }
    } catch (error) {
      console.error("Error submitting response:", error);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to submit your response. Please try again.";
      Alert.alert("Submission Failed", message);
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
        <View style={styles.leftHeaderContent}>
          <View style={styles.nudgeBadge}>
            <Text style={styles.nudgeBadgeText}>NUDGE</Text>
          </View>
          {/* Ever green indicator for prompts > 72h old */}
          {(() => {
            const ageHours =
              (new Date() - new Date(post.created_at)) / (1000 * 60 * 60);
            if (ageHours >= 72) {
            }
            return null;
          })()}
        </View>
        <View style={styles.rightHeaderContent}>
          {isOwnPost && (onEdit || onDelete) && (
            <TouchableOpacity
              style={styles.ellipsisButton}
              onPress={(e) => {
                const { pageX, pageY } = e.nativeEvent;
                const screenWidth = Dimensions.get("window").width;
                setMenuPosition({ x: screenWidth - pageX - 10, y: pageY + 12 });
                setShowMenu(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ellipsis size={20} color="#5B6B7C" />
            </TouchableOpacity>
          )}
          <View style={styles.starIconContainer}>
            <Ionicons name="star" size={24} color="#FFB800" />
          </View>
        </View>
      </View>

      {/* Edit/Delete Menu */}
      {showMenu && isOwnPost && (
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowMenu(false)}
          >
            <View
              style={[
                styles.menuContainerModal,
                { top: menuPosition.y, right: menuPosition.x },
              ]}
            >
              {!isExpired && (
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
              )}

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
          </Pressable>
        </Modal>
      )}

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
          {post.author_name || post.author_username}
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

      {/* Prompt Text */}
      <Text style={styles.promptText}>{typeData.prompt_text}</Text>

      {/* Submission Area */}
      {hasSubmitted ? (
        <View style={styles.inputLockedContainer}>
          <Lock size={16} color="#9CA3AF" />
          <Text style={styles.inputLockedText}>You've already responded</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.inputContainerFloating,
            submissionStatus === "rejected" && styles.inputContainerFloatingRetry,
          ]}
          onPress={() => setShowSubmitModal(true)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.questionInputFloatingFake,
              submissionStatus === "rejected" && styles.tapToAnswerTextRetry,
            ]}
          >
            {submissionStatus === "rejected"
              ? "Try again..."
              : "Tap to answer..."}
          </Text>
          <View style={[
            styles.sendButtonFloating,
            submissionStatus === "rejected" && styles.sendButtonFloatingRetry,
          ]}>
            {submissionStatus === "rejected" ? (
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
            ) : submissionType === "image" ? (
              <Camera size={18} color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" style={styles.sendIcon} />
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.responseCount}>
            {formatNumber(submissionCount)} response
            {submissionCount !== 1 ? "s" : ""}
            {totalReplyCount > 0
              ? ` • ${formatNumber(totalReplyCount)} repl${totalReplyCount !== 1 ? "ies" : "y"}`
              : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate("PromptSubmissions", { post })}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <MoveRight
            size={16}
            color={COLORS.primary}
            strokeWidth={2}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>

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
          <Text style={[styles.engagementCount, isLiked && styles.likedCount]}>
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
          <Text style={styles.engagementCount}>{formatCount(viewCount)}</Text>
        </View>

        {/* Share */}
        <TouchableOpacity style={styles.engagementButton} onPress={handleShare}>
          <Send size={22} color="#5e8d9b" />
          <Text style={styles.engagementCount}>
            {formatCount(post.share_count || 0)}
          </Text>
        </TouchableOpacity>

        {/* Bookmark */}
        <TouchableOpacity style={styles.engagementButton} onPress={handleSave}>
          <Bookmark
            size={22}
            color="#5e8d9b"
            fill={isSaved ? "#5e8d9b" : "transparent"}
          />
          {saveCount > 0 && (
            <Text style={styles.engagementCount}>{formatCount(saveCount)}</Text>
          )}
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



            {submissionType === "image" ? (
              /* ── Image Picker ──────────────────────────────────────── */
              <ScrollView
                style={styles.imagePickerScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.imagesGrid}>
                  {selectedImages.map((uri, index) => (
                    <View key={`img-${index}`} style={styles.imageThumbWrapper}>
                      <Image source={{ uri }} style={styles.imageThumb} />
                      <TouchableOpacity
                        style={styles.imageRemoveBtn}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <Text style={styles.imageHelperText}>
                  {selectedImages.length}/5 image
                  {selectedImages.length !== 1 ? "s" : ""} selected
                </Text>
              </ScrollView>
            ) : (
              /* ── Text Input ────────────────────────────────────────── */
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
            )}

            <View style={styles.modalFooter}>
              {submissionType === "image" ? (
                <View style={styles.imageAddRow}>
                  <TouchableOpacity
                    style={[
                      styles.imageAddBtn,
                      selectedImages.length >= 5 && styles.imageAddBtnDisabled,
                    ]}
                    onPress={pickImage}
                    disabled={selectedImages.length >= 5}
                  >
                    <LucideImage
                      size={32}
                      color={selectedImages.length >= 5 ? "#D1D5DB" : "#4B5563"}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.imageAddBtn,
                      selectedImages.length >= 5 && styles.imageAddBtnDisabled,
                    ]}
                    onPress={takePhoto}
                    disabled={selectedImages.length >= 5}
                  >
                    <Camera
                      size={32}
                      color={selectedImages.length >= 5 ? "#D1D5DB" : "#4B5563"}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.charCount}>
                  {submissionText.length}/{maxLength}
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.submitActionButton,
                  (isSubmitting ||
                    (submissionType === "text" && !submissionText.trim()) ||
                    (submissionType === "image" &&
                      selectedImages.length === 0)) &&
                    styles.submitActionButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={
                  isSubmitting ||
                  (submissionType === "text" && !submissionText.trim()) ||
                  (submissionType === "image" && selectedImages.length === 0)
                }
              >
                {isSubmitting ? (
                  <SnooLoader size="small" color="#FFFFFF" />
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

      {/* Custom Image Picker Modal */}
      {showCustomPicker && (
        <CustomImagePicker
          visible={showCustomPicker}
          onClose={() => setShowCustomPicker(false)}
          onDone={handleCustomPickerDone}
          selectionLimit={5 - selectedImages.length}
          allowVideos={false}
        />
      )}

      <PromptEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        post={post}
        onSave={handleSaveEdit}
        isLoading={isUpdating}
      />
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
  leftHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  evergreenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  evergreenIcon: {
    fontSize: 10,
  },
  evergreenText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 9,
    color: "#4CAF50",
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
    fontSize: 16,
    color: "#1D1D1F",
    fontFamily: "BasicCommercial-Bold",
  },
  separator: {
    color: COLORS.textTertiary,
    marginHorizontal: 6,
    fontSize: EDITORIAL_TYPOGRAPHY.timestamp.fontSize,
  },
  timestamp: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
  },
  editedLabel: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
    color: COLORS.textTertiary,
    fontStyle: "italic",
  },
  promptText: {
    fontFamily: FONTS.black || "BasicCommercial-Black",
    fontSize: 28,
    color: "#1D1D1F",
    marginBottom: SPACING.m,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  inputContainerFloating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: SPACING.s,
  },
  inputContainerFloatingRetry: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  questionInputFloatingFake: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
  },
  tapToAnswerTextRetry: {
    color: "#D97706",
  },
  sendButtonFloating: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sendButtonFloatingRetry: {
    backgroundColor: "#D97706",
  },
  sendIcon: {
    marginLeft: -2,
  },
  inputLockedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 30,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
    marginBottom: SPACING.s,
  },
  inputLockedText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
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
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
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
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
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
    fontFamily: FONTS.medium,
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
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  approvalNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.m,
    fontStyle: "italic",
  },

  // Image Picker styles
  imagePickerScroll: {
    maxHeight: 220,
    marginBottom: 4,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageThumbWrapper: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: "hidden",
  },
  imageThumb: {
    width: "100%",
    height: "100%",
  },
  imageRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 11,
  },
  imageAddRow: {
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
  },
  imageAddBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  imageAddBtnDisabled: {
    opacity: 0.4,
  },
  imageHelperText: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 4,
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
    ...EDITORIAL_TYPOGRAPHY.engagementCount,
    marginLeft: 6,
  },
  likedCount: {
    color: COLORS.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainerModal: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    ...SHADOWS.medium,
    zIndex: 10,
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
});

export default PromptPostCard;
