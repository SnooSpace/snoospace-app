/**
 * PromptPostCard
 * Displays a prompt post with submission functionality
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Pressable,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { Image } from "expo-image"; // ── PERF: memory-disk cache for author avatar
import { GradientHeart } from "../ui/GradientHeart";
import SwipeableModal from "../modals/SwipeableModal";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
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
  TriangleAlert,
  CheckCircle2,
  CircleX,
  Info,
  Pin,
  Pencil,
  Trash2,
  RefreshCw,
  Star,
  Clock,
  X,
  UserMinus,
} from "lucide-react-native";
import { savePost, unsavePost } from "../../api/client";
import { uploadMultipleImages } from "../../api/cloudinary";
import { postService } from "../../services/postService";
import CustomAlertModal from "../ui/CustomAlertModal";
import PromptEditModal from "./PromptEditModal";
import EventBus from "../../utils/EventBus";
import FollowButton from "../FollowButton";
import {
  followMember,
  unfollowMember,
  followCreator,
  unfollowCreator,
  sendCircleRequest,
  cancelCircleRequest,
  getCircleStatus,
  removeFromCircle,
  sendCommunityCircleInvite,
  cancelCommunityCircleInvite,
  getCommunityCircleStatus,
  removeMemberFromCommunityCircle,
} from "../../api/members";
import SnooLoader from "../ui/SnooLoader";
import HapticsService from "../../services/HapticsService";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";
import CustomImagePicker from "../CustomImagePicker";
import ContentActionsSheet from "../ContentActionsSheet";

const PromptPostCard = React.memo(({
  post,
  onUserPress,
  onLike,
  onComment,
  onSave,
  onShare,
  onDelete,
  onEdit,
  onPostUpdate,
  onPinToggle,
  currentUserId,
  currentUserType,
  showManagementControls = false,
  hideEngagement = false,
  showFollowButton = true,
  isSharedPreview = false,
  onPress,
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

  // Custom Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });

  const handleFollowToggle = async () => {
    const isMemberAuthor = post.author_type === "member";
    const isCreator = !!post.author_is_creator;
    const isInCircle = !!post.is_in_circle;
    const isRequested = !!post.is_circle_requested;

    const isAdd = !isInCircle && !isRequested && (
      (currentUserType === "member" && isMemberAuthor && !isCreator) ||
      (currentUserType === "community" && isMemberAuthor)
    );

    const isFollowing = !isInCircle && !isRequested && !isAdd && !!post.is_following;

    if (isInCircle) {
      showAlert(
        "Remove from Circle?",
        `Are you sure you want to remove ${post.author_name || "this user"} from your circle?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                if (currentUserType === "community") {
                  await removeMemberFromCommunityCircle(post.author_id);
                } else if (post.author_type === "community") {
                  await removeMemberFromCommunityCircle(post.author_id);
                } else {
                  await removeFromCircle(post.author_id);
                }
                HapticsService.triggerImpactLight();
                const updates = { is_in_circle: false, is_following: false, is_circle_requested: false };
                if (onPostUpdate) onPostUpdate({ id: post.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: post.author_id, ...updates });
              } catch (error) {
                console.error("Error removing from circle:", error);
              }
            }
          }
        ],
        UserMinus,
        "#FF3B30"
      );
    } else if (isRequested) {
      showAlert(
        "Cancel Request?",
        `Are you sure you want to cancel your circle request to ${post.author_name || "this user"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Cancel Request",
            style: "destructive",
            onPress: async () => {
              try {
                if (currentUserType === "community") {
                  const statusRes = await getCommunityCircleStatus(post.author_id);
                  if (statusRes?.invite_id) {
                    await cancelCommunityCircleInvite(statusRes.invite_id);
                  }
                } else {
                  const statusRes = await getCircleStatus(post.author_id);
                  if (statusRes?.request_id) {
                    await cancelCircleRequest(statusRes.request_id);
                  }
                }
                HapticsService.triggerImpactLight();
                const updates = { is_in_circle: false, is_following: false, is_circle_requested: false };
                if (onPostUpdate) onPostUpdate({ id: post.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: post.author_id, ...updates });
              } catch (error) {
                console.error("Error cancelling request:", error);
              }
            }
          }
        ],
        Clock,
        "#FF9500"
      );
    } else if (isAdd) {
      try {
        let res;
        if (currentUserType === "community") {
          res = await sendCommunityCircleInvite(post.author_id);
        } else {
          res = await sendCircleRequest(post.author_id);
        }
        HapticsService.triggerAddToCircle();
        const isAuto = !!(res?.auto_accepted || res?.status === "in_circle");
        const updates = {
          is_in_circle: isAuto,
          is_circle_requested: !isAuto,
        };
        if (onPostUpdate) onPostUpdate({ id: post.id, ...updates });
        EventBus.emit("post-follow-updated", { authorId: post.author_id, ...updates });
      } catch (error) {
        console.error("Error sending circle request:", error);
      }
    } else if (isFollowing) {
      showAlert(
        "Unfollow?",
        `Stop following ${post.author_name || "this account"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unfollow",
            style: "destructive",
            onPress: async () => {
              try {
                if (isMemberAuthor && isCreator) {
                  await unfollowCreator(post.author_id);
                  EventBus.emit("creator:unfollowed", { creatorId: post.author_id });
                } else {
                  await unfollowMember(post.author_id);
                }
                HapticsService.triggerImpactLight();
                const updates = { is_following: false };
                if (onPostUpdate) onPostUpdate({ id: post.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: post.author_id, ...updates });
              } catch (error) {
                console.error("Error unfollowing:", error);
              }
            }
          }
        ],
        UserMinus,
        "#FF3B30"
      );
    } else {
      try {
        if (isMemberAuthor && isCreator) {
          await followCreator(post.author_id);
          EventBus.emit("creator:followed", { creatorId: post.author_id });
        } else {
          await followMember(post.author_id);
        }
        HapticsService.triggerFollow();
        const updates = { is_following: true };
        if (onPostUpdate) onPostUpdate({ id: post.id, ...updates });
        EventBus.emit("post-follow-updated", { authorId: post.author_id, ...updates });
      } catch (error) {
        console.error("Error following:", error);
      }
    }
  };

  const showAlert = (title, message, buttons = null, icon = null, iconColor = null) => {
    if (!buttons || buttons.length === 0) {
      const isSuccess = title.toLowerCase().includes("success") || title.toLowerCase().includes("sent");
      const isError = title.toLowerCase().includes("error") || title.toLowerCase().includes("fail");
      setAlertConfig({
        title,
        message,
        primaryAction: {
          text: "OK",
          onPress: () => setAlertVisible(false),
        },
        secondaryAction: null,
        icon: icon || (isSuccess ? CheckCircle2 : isError ? CircleX : Info),
        iconColor: iconColor || (isSuccess ? "#34C759" : isError ? "#FF3B30" : COLORS.primary),
      });
      setAlertVisible(true);
      return;
    }

    const cancelBtn = buttons.find((b) => b.style === "cancel" || b.text.toLowerCase() === "cancel");
    const actionBtn = buttons.find((b) => b.style !== "cancel" && b.text.toLowerCase() !== "cancel");

    setAlertConfig({
      title,
      message,
      primaryAction: actionBtn
        ? {
            text: actionBtn.text,
            style: actionBtn.style,
            onPress: () => {
              setAlertVisible(false);
              actionBtn.onPress?.();
            },
          }
        : null,
      secondaryAction: cancelBtn
        ? {
            text: cancelBtn.text,
            onPress: () => {
              setAlertVisible(false);
              cancelBtn.onPress?.();
            },
          }
        : null,
      icon: icon || (actionBtn?.style === "destructive" ? TriangleAlert : Info),
      iconColor: iconColor || (actionBtn?.style === "destructive" ? "#FF3B30" : COLORS.primary),
    });
    setAlertVisible(true);
  };

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const maxLength = typeData.max_length || 500;

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  const isAnon = post.is_anonymous === true || post.type_data?.is_anonymous === true;

  // Cache auth token so handleLike never awaits I/O before the optimistic UI update
  const tokenRef = useRef(null);
  useEffect(() => {
    getAuthToken().then((t) => {
      tokenRef.current = t;
    });
  }, []);

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
    HapticsService.triggerLike();

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
      const token = tokenRef.current || (await getAuthToken());
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
    HapticsService.triggerSave();
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
    HapticsService.triggerComment();
    if (onComment) onComment(post.id);
  };

  const handleShare = () => {
    HapticsService.triggerShare();
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
      showAlert("Error", error.message || "Failed to update post");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    showAlert(
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
              showAlert("Error", "Failed to delete post");
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

  const lastTapRef = useRef(0);
  const cardRef = useRef(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [heartRot, setHeartRot] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  const triggerHeartAnimation = (x, y) => {
    setHeartPos({ x, y });
    setHeartRot(Math.random() * 30 - 15);
    setShowHeart(true);
    heartScale.setValue(0);
    
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  const tapTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const handleDoubleTap = (event) => {
    if (isSharedPreview) {
      if (onPress) onPress();
      return;
    }
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      const { pageX, pageY } = event.nativeEvent;
      cardRef.current?.measure((x, y, width, height, cardPageX, cardPageY) => {
        const relativeX = pageX - cardPageX;
        const relativeY = pageY - cardPageY;
        triggerHeartAnimation(relativeX, relativeY);
      });
      if (!isLiked) {
        handleLike();
      } else {
        HapticsService.triggerImpactLight();
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      tapTimeoutRef.current = setTimeout(() => {
        navigation.navigate("PromptSubmissions", { post });
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
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
        showAlert(
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
      showAlert("Error", "Failed to take photo");
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
        showAlert(
          "Response too long",
          `Please shorten your response to ${maxLength} characters or less.`,
        );
        return;
      }
    } else if (submissionType === "image") {
      if (selectedImages.length === 0) {
        showAlert("Required", "Please add at least one image");
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
      showAlert("Submission Failed", message);
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
      pending: { label: "Pending", color: "#F9A825", icon: Clock },
      approved: {
        label: "Approved",
        color: "#34C759",
        icon: CheckCircle2,
      },
      featured: { label: "Featured", color: "#7B1FA2", icon: Star },
      rejected: {
        label: "Not selected",
        color: "#8E8E93",
        icon: CircleX,
      },
    };

    const config = statusConfig[submissionStatus] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <View
        style={[styles.statusBadge, { backgroundColor: config.color + "20" }]}
      >
        <StatusIcon size={14} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View ref={cardRef} style={styles.container}>
      {/* Header with Type Indicator & Star */}
      <View style={styles.headerRow}>
        <View style={styles.leftHeaderContent}>
          <View style={styles.nudgeBadge}>
            <Text style={styles.nudgeBadgeText}>NUDGE</Text>
          </View>
        </View>
        <View style={styles.rightHeaderContent}>
          {showManagementControls && onPinToggle && (
            <View style={{ overflow: "visible" }}>
              <TouchableOpacity
                style={[
                  styles.pinButton,
                  post.is_pinned && styles.pinButtonPinned,
                ]}
                onPress={() => onPinToggle(post, true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{ transform: [{ rotate: "27deg" }], overflow: "visible" }}>
                  <Pin
                    size={14}
                    color={post.is_pinned ? "#10B981" : "#9CA3AF"}
                    strokeWidth={2}
                    fill={post.is_pinned ? "#10B981" : "none"}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
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
          {!isOwnPost && (
            <View style={styles.ellipsisButton}>
              <ContentActionsSheet
                type="post"
                targetId={post.id}
                targetName={post.author_name || post.author_username}
                label="Nudge"
                iconColor="#5B6B7C"
                iconSize={20}
              />
            </View>
          )}
          <View style={styles.starIconContainer}>
            <Star size={24} color="#FFB800" fill="#FFB800" />
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
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <Pencil size={15} color="#2962FF" strokeWidth={2} />
                  </View>
                  <View style={styles.menuItemTextContainer}>
                    <Text style={styles.menuItemTitle}>Edit Post</Text>
                    <Text style={styles.menuItemSub}>Update details or requirements</Text>
                  </View>
                </TouchableOpacity>
              )}
              {!isExpired && (onDelete || isOwnPost) && <View style={styles.menuDivider} />}
              {(onDelete || isOwnPost) && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    handleDelete();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconWrap, styles.menuIconDestructive]}>
                    <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                  </View>
                  <View style={styles.menuItemTextContainer}>
                    <Text style={[styles.menuItemTitle, styles.menuItemDestructive]}>
                      Delete Post
                    </Text>
                    <Text style={styles.menuItemSub}>This action cannot be undone</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Author Info */}
      <View style={styles.authorHeaderRow}>
        <TouchableOpacity style={styles.authorRow} onPress={handleUserPress}>
          <Image
            source={
              post.author_photo_url
                ? { uri: post.author_photo_url }
                : { uri: "https://via.placeholder.com/40" }
            }
            style={styles.profileImage}
            cachePolicy="memory-disk"
            contentFit="cover"
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
        {showFollowButton && !isOwnPost && !isAnon && (
          <FollowButton
            userId={post.author_id}
            userType={post.author_type}
            isFollowing={post.is_following}
            isInCircle={post.is_in_circle}
            isCircleRequested={post.is_circle_requested}
            isAdd={
              !post.is_in_circle &&
              !post.is_circle_requested &&
              ((currentUserType === "member" && post.author_type === "member" && !post.author_is_creator) ||
               (currentUserType === "community" && post.author_type === "member"))
            }
            onFollowChange={handleFollowToggle}
            style={styles.followButtonInline}
            textStyle={styles.followButtonInlineText}
            currentFollowerId={currentUserId}
          />
        )}
      </View>

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
              <RefreshCw size={18} color="#FFFFFF" />
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
      {!hideEngagement && (
        <View style={styles.engagementRow}>
        {/* Like */}
        <GHPressable
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
        </GHPressable>

        {/* Comment */}
        <GHPressable
          style={styles.engagementButton}
          onPress={handleCommentPress}
        >
          <MessageCircle size={22} color="#5e8d9b" />
          <Text style={styles.engagementCount}>
            {formatCount(post.comment_count || 0)}
          </Text>
        </GHPressable>

        {/* Views */}
        <GHPressable
          style={styles.engagementButton}
          onPress={() => HapticsService.triggerView()}
        >
          <ChartNoAxesCombined size={22} color="#5e8d9b" />
          <Text style={styles.engagementCount}>{formatCount(viewCount)}</Text>
        </GHPressable>

        {/* Share */}
        <GHPressable style={styles.engagementButton} onPress={handleShare}>
          <Send size={22} color="#5e8d9b" />
          <Text style={styles.engagementCount}>
            {formatCount(post.share_count || 0)}
          </Text>
        </GHPressable>

        {/* Bookmark */}
        <GHPressable style={styles.engagementButton} onPress={handleSave}>
          <Bookmark
            size={22}
            color="#5e8d9b"
            fill={isSaved ? "#5e8d9b" : "transparent"}
          />
          {saveCount > 0 && (
            <Text style={styles.engagementCount}>{formatCount(saveCount)}</Text>
          )}
        </GHPressable>
      </View>
      )}

        {showHeart && (
          <Animated.View
            style={{
              position: 'absolute',
              top: heartPos.y - 75,
              left: heartPos.x - 75,
              transform: [
                { scale: heartScale },
                { rotate: `${heartRot}deg` }
              ],
              opacity: heartScale.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
              zIndex: 9999,
            }}
            pointerEvents="none"
          >
            <GradientHeart />
          </Animated.View>
        )}
      {isSharedPreview && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => onPress && onPress()}
        />
      )}
      </View>
    </TouchableWithoutFeedback>

      {/* Submit Modal */}
      <SwipeableModal
        visible={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        sheetStyle={styles.modalContent}
        avoidKeyboard={true}
        header={
          <View collapsable={false} style={{ width: "100%" }}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Response</Text>
              <TouchableOpacity
                onPress={() => setShowSubmitModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        }
      >
        <View style={styles.modalInnerContent}>
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
                      <CircleX
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
      </SwipeableModal>

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

      {showEditModal && (
        <PromptEditModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          post={post}
          onSave={handleSaveEdit}
          isLoading={isUpdating}
        />
      )}
      {alertVisible && (
        <CustomAlertModal
          visible={alertVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          onClose={() => setAlertVisible(false)}
          primaryAction={alertConfig.primaryAction}
          secondaryAction={alertConfig.secondaryAction}
          icon={alertConfig.icon}
          iconColor={alertConfig.iconColor}
        />
      )}
    </>
  );
});

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
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
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
    fontFamily: FONTS.medium,
    fontSize: 12,
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
  pinButton: {
    padding: 6,
    borderRadius: 8,
    overflow: "visible",
  },
  pinButtonPinned: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
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
    paddingVertical: 8,
    gap: 12,
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
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
    fontSize: 9,
    color: "#4CAF50",
    letterSpacing: 0.5,
  },
  authorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  followButtonInline: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    minWidth: 75,
  },
  followButtonInlineText: {
    fontSize: 12,
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
    fontFamily: FONTS.regular || "Manrope-Regular",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
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
    paddingHorizontal: SPACING.l,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 0,
  },
  keyboardAvoidingViewSwipeable: {
    width: "100%",
  },
  modalInnerContent: {
    width: "100%",
    paddingTop: 12,
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
    borderRadius: 16,
    padding: 10,
    width: 270,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDestructive: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  menuItemTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold || "System",
    color: "#1D1D1F",
  },
  menuItemDestructive: {
    color: "#EF4444",
  },
  menuItemSub: {
    fontSize: 11,
    fontFamily: FONTS.regular || "System",
    color: "#6B7280",
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
});

export default PromptPostCard;
