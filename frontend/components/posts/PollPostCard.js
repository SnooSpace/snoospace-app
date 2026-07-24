/**
 * PollPostCard
 * Displays a poll post with voting functionality
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions, TouchableWithoutFeedback, Animated, Switch } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { GradientHeart } from "../ui/GradientHeart";
import { LinearGradient } from "expo-linear-gradient";
import HapticsService from "../../services/HapticsService";
import { apiPost, apiDelete, savePost, unsavePost } from "../../api/client";
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
import AnimatedProgressBar from "./AnimatedProgressBar";
import PollEditModal from "./PollEditModal";
import PollVotersModal from "../modals/PollVotersModal";
import CustomAlertModal from "../ui/CustomAlertModal";
import { postService } from "../../services/postService";
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
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  TriangleAlert,
  CheckCircle2,
  CircleX,
  Info,
  Pin,
  Pencil,
  Trash2,
  MoveRight,
  Check,
  BarChart3,
  HatGlasses,
  UserMinus,
  Clock,
} from "lucide-react-native";
import CountdownTimer from "../CountdownTimer";
import { getExtensionBadgeText } from "../../utils/cardTiming";
import SnooLoader from "../ui/SnooLoader";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";
import ContentActionsSheet from "../ContentActionsSheet";
import PromoSourceBanner, { PromoTopRow, PlanPreviewCard } from "./PromoSourceBanner";
import { getOptimizedImageUrl } from "../../utils/imageUtils";
import { useRecyclingState } from "@shopify/flash-list";

const PollPostCard = React.memo(({
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
  authToken = null, // Hoisted from HomeFeedScreen - avoids per-card AsyncStorage read
  hideEngagement = false,
  showFollowButton = true,
  isSharedPreview = false,
  onPress,
}) => {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const typeData    = post.type_data || {};
  const isPromoPost = !!typeData.promo_source_type;
  const promoNavHandler = () => {
    const src = typeData.promo_source_type;
    const id  = typeData.promo_source_id;
    if (!src || !id) return;
    if (src === 'plan')  navigation.navigate('PlanDetail',   { planId:  id });
    if (src === 'event') navigation.navigate('EventDetails', { eventId: id });
  };
  const [hasVoted, setHasVoted] = useRecyclingState(post.has_voted || false, [post.id]);
  const [votedIndexes, setVotedIndexes] = useRecyclingState(post.voted_indexes || [], [post.id]);
  const [options, setOptions] = useRecyclingState(typeData.options || [], [post.id]);
  const [totalVotes, setTotalVotes] = useRecyclingState(typeData.total_votes || 0, [post.id]);
  const [isVoting, setIsVoting] = useRecyclingState(false, [post.id]);
  const [votingIndex, setVotingIndex] = useRecyclingState(null, [post.id]);
  const [showMenu, setShowMenu] = useRecyclingState(false, [post.id]);
  const [menuPosition, setMenuPosition] = useRecyclingState({ x: 0, y: 0 }, [post.id]);
  const [showEditModal, setShowEditModal] = useRecyclingState(false, [post.id]);
  const [showVotersModal, setShowVotersModal] = useRecyclingState(false, [post.id]);
  const [isUpdating, setIsUpdating] = useRecyclingState(false, [post.id]);

  const isAnon = post.type_data?.is_anonymous === true || post.is_anonymous === true;
  const [voteAnonymously, setVoteAnonymously] = useRecyclingState(false, [post.id]);

  // Custom Alert Modal State
  const [alertVisible, setAlertVisible] = useRecyclingState(false, [post.id]);
  const [alertConfig, setAlertConfig] = useRecyclingState({
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  }, [post.id]);

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

  // Sync state with props whenever they change (important for FlatList recycling)
  useEffect(() => {
    setHasVoted(post.has_voted || false);
    setVotedIndexes(post.voted_indexes || []);
    setOptions(typeData.options || []);
    setTotalVotes(typeData.total_votes || 0);
  }, [
    post.id,
    post.has_voted,
    post.voted_indexes,
    typeData.options,
    typeData.total_votes,
  ]);

  // Auth token — use the hoisted prop if available, otherwise fetch lazily
  const tokenRef = useRef(authToken);

  // Engagement State — useRecyclingState resets on post.id change (cell recycle)
  const [isLiked, setIsLiked] = useRecyclingState(post.is_liked === true, [post.id]);
  const [likeCount, setLikeCount] = useRecyclingState(post.like_count || 0, [post.id]);
  const [isLiking, setIsLiking] = useRecyclingState(false, [post.id]);
  const [isSaved, setIsSaved] = useRecyclingState(post.is_saved || false, [post.id]);
  const [saveCount, setSaveCount] = useRecyclingState(post.save_count || post.saves_count || 0, [post.id]);

  // ── View Tracking ──────────────────────────────────────────────────────────
  const [viewCount, setViewCount] = useRecyclingState(post.public_view_count || post.view_count || 0, [post.id]);
  const dwellTimerRef = useRef(null);

  useEffect(() => {
    const DWELL_THRESHOLD = 2500;
    const alreadyViewed = viewQueueService.hasViewed(post.id);

    if (!alreadyViewed) {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addQualifiedView(post.id, { postType: "poll", trigger: "dwell" });
      }, DWELL_THRESHOLD);
    } else {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addRepeatView(post.id, "revisit");
      }, DWELL_THRESHOLD);
    }

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [post.id]);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-view-updated", (payload) => {
      if (payload?.postId === post.id) {
        setViewCount((prev) => prev + 1);
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [post.id]);

  const handleLike = async () => {
    if (isLiking) {
      return;
    }
    HapticsService.triggerLike();

    const prevLiked = isLiked;
    const prevLikeCount = likeCount;
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;
    const nextLikes = Math.max(0, prevLikeCount + delta);

    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    if (onLike) {
      onLike(post.id, nextLiked, nextLikes);
    }

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
      // If server says "already saved", our local state was wrong â€” correct it
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

      // Notify parent to refresh/update local post data
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

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  const handleVote = async (optionIndex) => {
    // Only block if poll is expired or currently voting
    if (isVoting || isExpired) return;

    setIsVoting(true);
    setVotingIndex(optionIndex);
    try {
      const token = await getAuthToken();

      // Always use POST endpoint - backend implements toggle behavior
      // If option is already selected, it will be removed
      // If option is not selected, it will be added
      const response = await apiPost(
        `/posts/${post.id}/vote`,
        { option_index: optionIndex, is_anonymous: voteAnonymously },
        15000,
        token,
      );

      if (response.success) {
        // Use the backend's authoritative voted_indexes response
        const newVotedIndexes = response.voted_indexes || [];
        setVotedIndexes(newVotedIndexes);
        setHasVoted(newVotedIndexes.length > 0);

        // Use updated options and total_votes from response
        if (response.options) {
          setOptions(response.options);
        }
        if (response.total_votes !== undefined) {
          setTotalVotes(response.total_votes);
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setIsVoting(false);
      setVotingIndex(null);
    }
  };

  const lastTapRef = useRef(0);
  const cardRef = useRef(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartPos, setHeartPos] = useRecyclingState({ x: 0, y: 0 }, [post.id]);
  const [heartRot, setHeartRot] = useRecyclingState(0, [post.id]);
  const [showHeart, setShowHeart] = useRecyclingState(false, [post.id]);

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
        if (onComment) {
          onComment(post.id);
        }
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleUserPress = () => {
    if (isAnon) return;
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
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

  const renderOption = (option, index) => {
    const isSelected = votedIndexes.includes(option.index);
    const percentage =
      totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;

    const shouldShowResults =
      hasVoted || isExpired || typeData.show_results_before_vote === true;

    const optionText = option.text || `Option ${index + 1}`;

    if (!shouldShowResults) {
      // Pre-vote state
      return (
        <TouchableOpacity
          key={option.index}
          style={styles.optionButton}
          onPress={() => handleVote(option.index)}
          disabled={isVoting || isExpired}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>{optionText}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={option.index}
        style={styles.optionResult}
        onPress={() => handleVote(option.index)}
        disabled={isVoting || isExpired}
        activeOpacity={0.85}
      >
        {/* Animated Progress fill */}
        <AnimatedProgressBar percentage={percentage} isSelected={isSelected} />

        {/* Content */}
        <View style={styles.optionContent}>
          <View style={styles.optionTextRow}>
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}
              numberOfLines={2}
            >
              {optionText}
            </Text>

            {isSelected && (
              <Check
                size={16}
                color="#ffffff"
              />
            )}
          </View>

          <Text
            style={[
              styles.percentageText,
              percentage === 100 && styles.percentageTextFull,
            ]}
          >
            {percentage}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render modal outside container but inside component
  const renderModal = () => (
    <PollEditModal
      visible={showEditModal}
      onClose={() => setShowEditModal(false)}
      post={post}
      onSave={handleSaveEdit}
      isLoading={isUpdating}
    />
  );

  // Return array or fragment to include modal
  return (
    <>
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View ref={cardRef} style={styles.container}>
        {/* â”€â”€ PROMO: unified author+promo header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {isPromoPost && (
          <View style={styles.promoAuthorRow}>
            <TouchableOpacity style={styles.promoAuthorLeft} onPress={handleUserPress} activeOpacity={0.7}>
              <Image
                source={post.author_photo_url ? { uri: getOptimizedImageUrl(post.author_photo_url, { width: 36 }) } : { uri: 'https://via.placeholder.com/36' }}
                style={styles.promoAvatar}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
              <View style={styles.promoAuthorMeta}>
                <View style={styles.promoAuthorNameRow}>
                  <Text style={styles.promoAuthorName} numberOfLines={1}>
                    {post.author_name || post.author_username}
                  </Text>
                  <Text style={styles.promoSep}>•</Text>
                  <Text style={styles.promoTimestamp}>{formatTimeAgo(post.created_at)}</Text>
                </View>
                <PromoTopRow sourceType={typeData.promo_source_type} />
              </View>
            </TouchableOpacity>
            <View style={styles.promoMenuSlot}>
              {isOwnPost ? (
                <TouchableOpacity
                  style={styles.ellipsisButton}
                  onPress={(e) => {
                    const { pageX, pageY } = e.nativeEvent;
                    const screenWidth = Dimensions.get('window').width;
                    setMenuPosition({ x: screenWidth - pageX - 10, y: pageY + 12 });
                    setShowMenu(true);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ellipsis size={20} color="#5B6B7C" />
                </TouchableOpacity>
              ) : !isAnon ? (
                <View style={styles.ellipsisButton}>
                  <ContentActionsSheet
                    type="post"
                    targetId={post.id}
                    targetName={post.author_name || post.author_username}
                    label="Poll"
                    iconColor="#5B6B7C"
                    iconSize={20}
                  />
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Promo caption */}
        {isPromoPost && !!typeData.promo_text && (
          <Text style={styles.promoCaptionText}>{typeData.promo_text}</Text>
        )}

        {/* Poll badge row for promo mode */}
        {isPromoPost && (
          <View style={[styles.headerRow, { marginTop: 10 }]}>
            <View style={styles.pollBadge}>
              <Text style={styles.pollBadgeText}>POLL</Text>
            </View>
            <TouchableOpacity
              style={styles.pollIconContainer}
              onPress={() => setShowVotersModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <BarChart3 size={24} color="#3b65e4" />
            </TouchableOpacity>
          </View>
        )}

        {/* â”€â”€ NON-PROMO: original Poll badge + menu header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {!isPromoPost && (
        <View style={styles.headerRow}>
          <View style={styles.pollBadge}>
            <Text style={styles.pollBadgeText}>POLL</Text>
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
            {isOwnPost && (
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
            {!isOwnPost && !isAnon && (
              <View style={styles.ellipsisButton}>
                <ContentActionsSheet
                  type="post"
                  targetId={post.id}
                  targetName={post.author_name || post.author_username}
                  label="Poll"
                  iconColor="#5B6B7C"
                  iconSize={20}
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.pollIconContainer}
              onPress={() => setShowVotersModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <BarChart3 size={24} color="#3b65e4" />
            </TouchableOpacity>
          </View>
        </View>
        )}

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

        {/* Author Info â€” only in non-promo layout */}
        {!isPromoPost && (
        <View style={styles.authorHeaderRow}>
          <TouchableOpacity style={styles.authorRow} onPress={handleUserPress} disabled={isAnon}>
            {isAnon ? (
              <View style={styles.anonProfileImage}>
                <HatGlasses size={18} color={COLORS.primary} strokeWidth={2} />
              </View>
            ) : (
              <Image
                source={
                  post.author_photo_url
                    ? { uri: getOptimizedImageUrl(post.author_photo_url, { width: 32 }) }
                    : { uri: "https://via.placeholder.com/40" }
                }
                style={styles.profileImage}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            )}
            <Text style={styles.authorName}>
              {isAnon ? "Anonymous" : (post.author_name || post.author_username)}
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
        )}

        {/* Question */}
        <Text style={styles.question}>{typeData.question}</Text>

        {/* Extension Badge */}
        {post.extension_count > 0 && (
          <View style={styles.extensionBadge}>
            <Text style={styles.extensionBadgeText}>
              {getExtensionBadgeText(post.extension_count)}
            </Text>
          </View>
        )}

        {/* Anonymous Vote Toggle */}
        {!isExpired && !hasVoted && (
          <View style={styles.anonVoteRow}>
            <View style={styles.anonVoteLeft}>
              <HatGlasses size={18} color="#5e8d9b" strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={styles.anonVoteLabel}>Vote Anonymously</Text>
            </View>
            <Switch
              trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
              thumbColor={"#FFFFFF"}
              ios_backgroundColor="#E5E7EB"
              onValueChange={setVoteAnonymously}
              value={voteAnonymously}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>
        )}

        {/* Poll Options */}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => renderOption(option, index))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.voteCount}>
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </Text>
            {post.expires_at &&
              (isExpired ? (
                <>
                  <Text style={styles.separator}>•</Text>
                  <View style={[styles.endedBadge, { marginLeft: 4 }]}>
                    <Text style={styles.endedBadgeText}>Ended</Text>
                  </View>
                </>
              ) : (
                <View style={styles.activeBadge}>
                  <CountdownTimer
                    expiresAt={post.expires_at}
                    style={styles.activeBadgeText}
                  />
                </View>
              ))}
          </View>
          {totalVotes > 0 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => setShowVotersModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View all</Text>
              <MoveRight
                size={16}
                color={COLORS.primary}
                strokeWidth={2}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Engagement Row */}
        {/* Plan / Event preview â€” promo only, BEFORE engagement */}
        {isPromoPost && (
          <PlanPreviewCard typeData={typeData} onPress={promoNavHandler} />
        )}

        {/* Like / Comment / View / Share / Bookmark */}
        {!hideEngagement && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
            }}
            style={styles.engagementRow}
          >
            {/* Like */}
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={handleLike}
              disabled={isLiking}
            >
              <Heart
                size={EDITORIAL_SPACING.iconSize}
                color={isLiked ? COLORS.error : COLORS.editorial.textSecondary}
                fill={isLiked ? COLORS.error : "transparent"}
              />
              <Text
                style={[styles.engagementCount, isLiked && styles.likedCount]}
              >
                {formatCount(likeCount)}
              </Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={handleCommentPress}
            >
              <MessageCircle size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
              <Text style={styles.engagementCount}>
                {formatCount(post.comment_count || 0)}
              </Text>
            </TouchableOpacity>

            {/* Views */}
            <TouchableOpacity style={styles.engagementButton} onPress={() => HapticsService.triggerView()}>
              <ChartNoAxesCombined size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
              <Text style={styles.engagementCount}>
                {formatCount(viewCount)}
              </Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={handleShare}
            >
              <Send size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
              <Text style={styles.engagementCount}>
                {formatCount(post.share_count || 0)}
              </Text>
            </TouchableOpacity>

            {/* Bookmark */}
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={handleSave}
            >
              <Bookmark
                size={EDITORIAL_SPACING.iconSize}
                color={COLORS.editorial.textSecondary}
                fill={isSaved ? COLORS.editorial.textSecondary : "transparent"}
              />
              {saveCount > 0 && (
                <Text style={styles.engagementCount}>
                  {formatCount(saveCount)}
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
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
    {showEditModal && renderModal()}

      {/* Poll Voters Modal */}
      {showVotersModal && (
        <PollVotersModal
          visible={showVotersModal}
          onClose={() => setShowVotersModal(false)}
          postId={post.id}
          options={options}
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
    padding: SPACING.m,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },

  // â”€â”€ Promo unified layout styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  promoAuthorRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  promoAuthorLeft: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    flex:          1,
    gap:           10,
  },
  promoAvatar: {
    width:        36,
    height:       36,
    borderRadius: 18,
  },
  promoAuthorMeta: {
    flex: 1,
    gap:  4,
  },
  promoAuthorNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           4,
  },
  promoAuthorName: {
    fontFamily: FONTS.semiBold,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },
  promoSep: {
    fontFamily: FONTS.regular,
    fontSize:   12,
    color:      COLORS.textSecondary,
  },
  promoTimestamp: {
    fontFamily: FONTS.regular,
    fontSize:   12,
    color:      COLORS.textSecondary,
  },
  promoMenuSlot: {
    marginLeft: 4,
  },
  promoCaptionText: {
    fontFamily:   FONTS.regular,
    fontSize:     14,
    color:        COLORS.textPrimary,
    lineHeight:   21,
    marginBottom: 4,
  },
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  pollIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(59, 101, 228, 0.08)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  pollBadge: {
    backgroundColor: "#E8EDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pollBadgeText: {
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
    fontSize: 10,
    color: "#5B6B7C",
    letterSpacing: 0.5,
  },
  endedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  endedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#DC2626",
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
    borderRadius: 20,
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
  anonProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  anonVoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  anonVoteLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  anonVoteLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#5e8d9b",
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
  question: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 24,
    color: "#1D1D1F",
    marginBottom: SPACING.m,
    lineHeight: 30,
  },
  optionsContainer: {
    gap: SPACING.s,
  },
  optionButton: {
    backgroundColor: "#f9fafc",
    borderRadius: 14,
    padding: 14,
  },
  optionButtonText: {
    fontFamily: FONTS.medium || "Manrope-Medium",
    fontSize: 14,
    color: "#1D1D1F",
  },
  optionResult: {
    backgroundColor: "#f9fafc",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 52,
    position: "relative",
  },
  optionContent: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  optionText: {
    fontFamily: FONTS.medium || "Manrope-Medium",
    fontSize: 14,
    color: "#314151",
  },
  optionTextSelected: {
    color: "#ffffff",
    fontFamily: FONTS.semiBold || "Manrope-SemiBold",
  },
  percentageText: {
    fontSize: 14,
    fontFamily: FONTS.medium || "Manrope-Medium",
    color: "#AFC8EA",
  },
  percentageTextFull: {
    color: "#ffffff",
  },
  extensionBadge: {
    backgroundColor: "#FFF4E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: SPACING.m,
  },
  extensionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A67C52",
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
  voteCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
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
  activeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
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

export default PollPostCard;
