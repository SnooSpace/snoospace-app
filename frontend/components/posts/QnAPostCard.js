/**
 * QnAPostCard
 * Displays a Q&A post with question submission, upvoting, and top answer preview
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
  Switch,
  Pressable,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { GradientHeart } from "../ui/GradientHeart";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { apiPost, apiGet, apiDelete } from "../../api/client";
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
  Check,
  TriangleAlert,
  CheckCircle2,
  CircleX,
  Info,
  Pin,
  Pencil,
  Trash2,
  MoveRight,
  ArrowUp,
  CircleQuestionMark,
} from "lucide-react-native";
import { savePost, unsavePost } from "../../api/client";
import { postService } from "../../services/postService";
import CustomAlertModal from "../ui/CustomAlertModal";
import QnAEditModal from "./QnAEditModal";
import EventBus from "../../utils/EventBus";
import CountdownTimer from "../CountdownTimer";
import SnooLoader from "../ui/SnooLoader";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";
import HapticsService from "../../services/HapticsService";

const QnAPostCard = React.memo(({
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
}) => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const typeData = post.type_data || {};
  const [userQuestionCount, setUserQuestionCount] = useState(
    post.user_question_count || 0,
  );
  const [questionCount, setQuestionCount] = useState(
    typeData.question_count || 0,
  );
  const [answeredCount, setAnsweredCount] = useState(
    typeData.answered_count || 0,
  );
  const [showAskModal, setShowAskModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(
    post.preview_question || null,
  );
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
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

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  // Format time ago utility
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "";
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

  // Sync with global upvote events
  useEffect(() => {
    const unsubscribe = EventBus.on("question-upvote-updated", (data) => {
      if (previewQuestion && previewQuestion.id === data.questionId) {
        setPreviewQuestion((prev) => {
          if (!prev) return prev;

          const newHasUpvoted = data.hasUpvoted;
          // Only change if it's actually different to avoid unnecessary rerenders
          if (prev.has_upvoted === newHasUpvoted) return prev;

          return {
            ...prev,
            has_upvoted: newHasUpvoted,
            upvote_count: newHasUpvoted
              ? (prev.upvote_count || 0) + 1
              : Math.max(0, (prev.upvote_count || 0) - 1),
          };
        });
      }
    });

    const unsubscribeRefresh = EventBus.on("qna-post-updated", async (data) => {
      if (data.postId === post.id) {
        try {
          const token = await getAuthToken();
          const response = await apiGet(`/posts/${post.id}`, 10000, token);
          if (response.success && response.post) {
            const updatedPost = response.post;
            setUserQuestionCount(updatedPost.user_question_count || 0);
            setQuestionCount(updatedPost.type_data?.question_count || 0);
            setAnsweredCount(updatedPost.type_data?.answered_count || 0);
            setPreviewQuestion(updatedPost.preview_question || null);
            if (onPostUpdate) {
              onPostUpdate(updatedPost);
            }
          }
        } catch (e) {
          console.error("Failed to refresh QnA post", e);
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeRefresh) unsubscribeRefresh();
    };
  }, [previewQuestion?.id, post.id, onPostUpdate]);

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

  // ── View Tracking ──────────────────────────────────────────────────────────
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
          postType: "qna",
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

  const handleDoubleTap = (event) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
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
    }
    lastTapRef.current = now;
  };

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleAddAnswer = () => {
    navigation.navigate("QnAQuestions", { post, autoFocus: true });
  };

  // Get participant data from backend
  const participants = typeData.participants || [];
  const participantCount = typeData.participant_count || participants.length;

  const renderTopAnswer = () => {
    // If we have a preview question (top answer), display it
    if (!previewQuestion) return null;

    const handleUpvoteTopQuestion = async () => {
      try {
        const token = await getAuthToken();
        const hasUpvoted = previewQuestion.has_upvoted;
        const questionId = previewQuestion.id;

        // Optimistic update
        setPreviewQuestion((prev) => ({
          ...prev,
          upvote_count: hasUpvoted
            ? Math.max(0, prev.upvote_count - 1)
            : (prev.upvote_count || 0) + 1,
          has_upvoted: !hasUpvoted,
        }));

        if (hasUpvoted) {
          await apiDelete(`/questions/${questionId}/upvote`, {}, 10000, token);
        } else {
          await apiPost(`/questions/${questionId}/upvote`, {}, 10000, token);
        }

        // Also emit an event so QnAQuestionsScreen updates if the user clicks in
        EventBus.emit("question-upvote-updated", {
          questionId,
          hasUpvoted: !hasUpvoted,
        });
      } catch (error) {
        console.error("Error toggling upvote on top question:", error);
        // We could revert optimistic update here if we kept the previous state
      }
    };

    return (
      <View style={styles.topAnswerContainer}>
        {/* Blue vertical line */}
        <View style={styles.verticalLine} />

        <View style={styles.topAnswerContent}>
          {/* Top Answer Header */}
          <View style={styles.topAnswerHeader}>
            <View style={styles.topAnswerBadge}>
              <Text style={styles.topAnswerBadgeText}>
                {previewQuestion.upvote_count > 0
                  ? "TOP QUESTION 🔥"
                  : "RECENT QUESTION 🕒"}
              </Text>
            </View>

            <View style={styles.topAnswerMeta}>
              <Text style={styles.topAnswerUsername} numberOfLines={1}>
                {previewQuestion.is_anonymous
                  ? "@anonymous"
                  : `@${
                      previewQuestion.author_username ||
                      previewQuestion.author_name
                        ?.toLowerCase()
                        .replace(/\s+/g, "") ||
                      "anonymous"
                    }`}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.upvoteContainer,
                previewQuestion.has_upvoted && { backgroundColor: "#EBF5FF" },
              ]}
              onPress={handleUpvoteTopQuestion}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowUp
                size={14}
                color={previewQuestion.has_upvoted ? "#3B82F6" : "#8E8E93"}
              />
              <Text
                style={[
                  styles.upvoteCount,
                  previewQuestion.has_upvoted && { color: "#3B82F6" },
                ]}
              >
                {previewQuestion.upvote_count || 0}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Answer Content */}
          <Text style={styles.answerText} numberOfLines={4}>
            "{previewQuestion.content}"
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View ref={cardRef} style={styles.container}>
        {/* Header Row: Q&A Badge + Avatar Stack + Question Icon */}
        <View style={styles.headerRow}>
          <View style={styles.leftHeaderContent}>
            <View style={styles.qnaBadge}>
              <Text style={styles.qnaBadgeText}>Q&A</Text>
            </View>
            {/* Resolved Badge (if any question resolved) */}
            {post.has_resolved_questions && (
              <View style={styles.resolvedBadge}>
                <Text style={styles.resolvedBadgeText}>✓ Resolved</Text>
              </View>
            )}
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
                  setMenuPosition({
                    x: screenWidth - pageX - 10,
                    y: pageY + 12,
                  });
                  setShowMenu(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ellipsis size={20} color="#5B6B7C" />
              </TouchableOpacity>
            )}
            <View style={styles.avatarStack}>
              {participants.slice(0, 2).map((participant, index) => (
                <Image
                  key={index}
                  source={{
                    uri:
                      participant.photo_url || "https://via.placeholder.com/24",
                  }}
                  style={[
                    styles.stackAvatar,
                    { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                  ]}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                />
              ))}
              {participantCount > 2 && (
                <View
                  style={[styles.countBadge, { marginLeft: -8, zIndex: 1 }]}
                >
                  <Text style={styles.countText}>+{participantCount - 2}</Text>
                </View>
              )}
            </View>

            <View style={styles.questionIconContainer}>
              <CircleQuestionMark size={28} color="#334456" />
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

        {/* Author Row */}
        <TouchableOpacity
          style={styles.authorRow}
          onPress={handleUserPress}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: post.author_photo_url || "https://via.placeholder.com/24",
            }}
            style={styles.authorAvatar}
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

        {/* Question Text */}
        <Text style={styles.questionText} numberOfLines={4}>
          {typeData.title}
        </Text>

        {typeData.description ? (
          <Text style={styles.descriptionText} numberOfLines={2}>
            {typeData.description}
          </Text>
        ) : null}

        {/* Top Answer Preview Section */}
        {renderTopAnswer()}

        {/* View All CTA */}
        <TouchableOpacity
          style={styles.viewAllCTA}
          onPress={() => navigation.navigate("QnAQuestions", { post })}
        >
          <LinearGradient
            colors={["#448AFF", "#2962FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewAllGradient}
          >
            <Text style={styles.viewAllText}>
              {questionCount === 1
                ? "View 1 question"
                : `View all ${questionCount} questions`}
            </Text>
            <MoveRight
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: 6 }}
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer Row */}
        <View style={styles.footerRow}>
          <View style={styles.footerLeftStatus}>
            {isExpired ? (
              <View style={styles.endedBadge}>
                <Text style={styles.endedBadgeText}>Ended</Text>
              </View>
            ) : post.expires_at ? (
              <View style={styles.activeBadge}>
                <CountdownTimer
                  expiresAt={post.expires_at}
                  style={styles.activeBadgeText}
                />
              </View>
            ) : null}

            {answeredCount > 0 && (
              <Text style={styles.replyCountText}>
                {formatCount(answeredCount)} repl
                {answeredCount != 1 ? "ies" : "y"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.addAnswerCTA}
            onPress={handleAddAnswer}
            disabled={userQuestionCount > 0}
          >
            {userQuestionCount > 0 ? (
              <>
                <Text style={styles.addAnswerText}>Asked </Text>
                <Check size={16} color="#5e8d9b" />
              </>
            ) : (
              <>
                <Text style={styles.addAnswerText}>Ask a question </Text>
                <Pencil
                  size={16}
                  color="#5e8d9b"
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Engagement Row */}
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
            <Text
              style={[styles.engagementCount, isLiked && styles.likedCount]}
            >
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
          <GHPressable
            style={styles.engagementButton}
            onPress={handleShare}
          >
            <Send size={22} color="#5e8d9b" />
            <Text style={styles.engagementCount}>
              {formatCount(post.share_count || 0)}
            </Text>
          </GHPressable>

          {/* Bookmark */}
          <GHPressable
            style={styles.engagementButton}
            onPress={handleSave}
          >
            <Bookmark
              size={22}
              color="#5e8d9b"
              fill={isSaved ? "#5e8d9b" : "transparent"}
            />
            {saveCount > 0 && (
              <Text style={styles.engagementCount}>
                {formatCount(saveCount)}
              </Text>
            )}
          </GHPressable>
        </View>

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
      </View>
    </TouchableWithoutFeedback>
      <QnAEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        post={post}
        onSave={handleSaveEdit}
        isLoading={isUpdating}
      />
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
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.l, // 24px
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  qnaBadge: {
    backgroundColor: "#EAF1FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qnaBadgeText: {
    color: "#3F7CF4",
    fontSize: 10,
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
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
  resolvedBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolvedBadgeText: {
    color: "#059669",
    fontSize: 10,
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
    letterSpacing: 0.5,
  },

  // Right side of header (avatar stack + icon)
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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

  // Avatar Stack
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3B82F6", // Brand blue
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  // Question Icon
  questionIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "#EAF1FF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Author Row
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
    color: "#5e8d9b", // Muted teal
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
  // Original timestamp style, now replaced by the spread operator above
  // timestamp: {
  //   fontSize: 11,
  //   fontWeight: "600",
  //   color: "#5e8d9b",
  //   textTransform: "uppercase",
  // },

  // Question Text
  questionText: {
    fontSize: 20,
    fontFamily: FONTS.primary || "System", // BasicCommercial-Bold
    color: "#1D1D1F",
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  descriptionText: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#5e8d9b", // Muted teal to match authorUsername and answerText
    lineHeight: 22,
    marginBottom: 16,
  },

  // Top Answer Section
  topAnswerContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  verticalLine: {
    width: 4,
    backgroundColor: "#3B82F6", // Blue line
    borderRadius: 2,
    marginRight: 12,
  },
  topAnswerContent: {
    flex: 1,
    backgroundColor: "#F5F7FA", // Light gray
    borderRadius: 12,
    padding: 16,
  },
  topAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    justifyContent: "space-between",
  },
  topAnswerBadge: {
    backgroundColor: "#E8F4FD", // Light blue background
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
  },
  topAnswerBadgeText: {
    fontFamily: FONTS.semiBold,
    color: "#3B82F6", // Blue text
    fontSize: 10,
    letterSpacing: 0.5,
  },
  topAnswerMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  topAnswerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  topAnswerUsername: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#5e8d9b",
    flex: 1,
  },
  upvoteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upvoteCount: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#8E8E93", // Default grey
  },
  answerText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#5e8d9b",
    lineHeight: 22,
    marginTop: 8,
  },

  // View All CTA
  viewAllCTA: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  viewAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.m,
  },
  viewAllText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },

  // Footer Row
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  votesText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontFamily: FONTS.regular || "Manrope-Regular",
  },
  addAnswerCTA: {
    flexDirection: "row",
    alignItems: "center",
  },
  addAnswerText: {
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
    fontSize: 14,
    color: "#5e8d9b", // Muted teal
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
  likedCount: {
    color: COLORS.error,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6", // Light gray
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  footerLeftStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replyCountText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontFamily: FONTS.medium || "Manrope-Medium",
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

export default QnAPostCard;
