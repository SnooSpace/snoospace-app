import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Dimensions,
  Animated as RNAnimated,
  ScrollView,
} from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { GradientHeart } from "./ui/GradientHeart";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  cancelAnimation,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { getAuthToken, getActiveAccount } from "../api/auth";
import {
  COLORS,
  FONTS,
  BORDER_RADIUS,
  SPACING,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../constants/theme";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  MoreHorizontal,
  Briefcase,
  Globe,
  Coins,
  ArrowRight,
  Clock,
  Pin,
  Pencil,
  Trash2,
  Users,
  UserMinus,
  TriangleAlert,
  CheckCircle2,
  CircleX,
  Info,
} from "lucide-react-native";
import { apiPost, apiDelete } from "../api/client";
import { closeOpportunity } from "../api/opportunities";
import CountdownTimer from "./CountdownTimer";
import CommentsModal from "./CommentsModal";
import EventBus from "../utils/EventBus";
import HapticsService from "../services/HapticsService";
import ContentActionsSheet from "./ContentActionsSheet";
import CustomAlertModal from "./ui/CustomAlertModal";
import FollowButton from "./FollowButton";
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
} from "../api/members";

// Static Helper Functions (Extracted outside the component scope)
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatCount = (count) => {
  if (!count || count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.floor(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}m`;
};

// ── Horizontal Scrollable Chips Row Component ───────────────────
const ChipsRow = React.memo(({ chips, chipType, styles }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsRow}
      contentContainerStyle={styles.chipsContent}
      focusable={false}
    >
      {chips.map((item, index) => (
        <View
          key={`${chipType}-${index}`}
          style={chipType === "role" ? styles.roleChip : styles.skillChip}
        >
          <Text
            style={chipType === "role" ? styles.roleChipText : styles.skillChipText}
          >
            {item}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
});

const OpportunityFeedCard = React.memo(({
  opportunity,
  onPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onDelete,                  // (opportunityId) => void — called after successful delete
  onUserPress,               // (userId, userType) => void — navigate to profile
  onPinToggle,               // Optional: shown only for owner view
  onPostUpdate,              // Optional: called when post is updated
  showManagementControls = false, // When true, shows pin + 3-dot menu for owners (Profile screens only)
  showFollowButton = true,
}) => {
  const navigation = useNavigation();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);

  // ── 3-dot menu state ───────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // ── Comments modal state ─────────────────────────────────────────────────────
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentCount, setCommentCount] = useState(opportunity.comment_count || 0);

  const openMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

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

  const showAlert = useCallback((title, message, buttons = null, icon = null, iconColor = null) => {
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
  }, []);

  const handleFollowToggle = useCallback(async () => {
    const isMemberAuthor = opportunity.creator_type === "member";
    const isCreatorMode = !!opportunity.author_is_creator;
    const isInCircle = !!opportunity.is_in_circle;
    const isRequested = !!opportunity.is_circle_requested;

    const isAdd = !isInCircle && !isRequested && (
      (currentUserType === "member" && isMemberAuthor && !isCreatorMode) ||
      (currentUserType === "community" && isMemberAuthor)
    );

    const isFollowing = !isInCircle && !isRequested && !isAdd && !!opportunity.is_following;

    if (isInCircle) {
      showAlert(
        "Remove from Circle?",
        `Are you sure you want to remove ${opportunity.creator_name || "this user"} from your circle?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                if (currentUserType === "community") {
                  await removeMemberFromCommunityCircle(opportunity.creator_id);
                } else if (opportunity.creator_type === "community") {
                  await removeMemberFromCommunityCircle(opportunity.creator_id);
                } else {
                  await removeFromCircle(opportunity.creator_id);
                }
                HapticsService.triggerImpactLight();
                const updates = { is_in_circle: false, is_following: false, is_circle_requested: false };
                if (onPostUpdate) onPostUpdate({ id: opportunity.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: opportunity.creator_id, ...updates });
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
        `Are you sure you want to cancel your circle request to ${opportunity.creator_name || "this user"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Cancel Request",
            style: "destructive",
            onPress: async () => {
              try {
                if (currentUserType === "community") {
                  const statusRes = await getCommunityCircleStatus(opportunity.creator_id);
                  if (statusRes?.invite_id) {
                    await cancelCommunityCircleInvite(statusRes.invite_id);
                  }
                } else {
                  const statusRes = await getCircleStatus(opportunity.creator_id);
                  if (statusRes?.request_id) {
                    await cancelCircleRequest(statusRes.request_id);
                  }
                }
                HapticsService.triggerImpactLight();
                const updates = { is_in_circle: false, is_following: false, is_circle_requested: false };
                if (onPostUpdate) onPostUpdate({ id: opportunity.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: opportunity.creator_id, ...updates });
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
          res = await sendCommunityCircleInvite(opportunity.creator_id);
        } else {
          res = await sendCircleRequest(opportunity.creator_id);
        }
        HapticsService.triggerAddToCircle();
        const isAuto = !!(res?.auto_accepted || res?.status === "in_circle");
        const updates = {
          is_in_circle: isAuto,
          is_circle_requested: !isAuto,
        };
        if (onPostUpdate) onPostUpdate({ id: opportunity.id, ...updates });
        EventBus.emit("post-follow-updated", { authorId: opportunity.creator_id, ...updates });
      } catch (error) {
        console.error("Error sending circle request:", error);
      }
    } else if (isFollowing) {
      showAlert(
        "Unfollow?",
        `Stop following ${opportunity.creator_name || "this account"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unfollow",
            style: "destructive",
            onPress: async () => {
              try {
                if (isMemberAuthor && isCreatorMode) {
                  await unfollowCreator(opportunity.creator_id);
                  EventBus.emit("creator:unfollowed", { creatorId: opportunity.creator_id });
                } else {
                  await unfollowMember(opportunity.creator_id);
                }
                HapticsService.triggerImpactLight();
                const updates = { is_following: false };
                if (onPostUpdate) onPostUpdate({ id: opportunity.id, ...updates });
                EventBus.emit("post-follow-updated", { authorId: opportunity.creator_id, ...updates });
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
        if (isMemberAuthor && isCreatorMode) {
          await followCreator(opportunity.creator_id);
          EventBus.emit("creator:followed", { creatorId: opportunity.creator_id });
        } else {
          await followMember(opportunity.creator_id);
        }
        HapticsService.triggerFollow();
        const updates = { is_following: true };
        if (onPostUpdate) onPostUpdate({ id: opportunity.id, ...updates });
        EventBus.emit("post-follow-updated", { authorId: opportunity.creator_id, ...updates });
      } catch (error) {
        console.error("Error following:", error);
      }
    }
  }, [opportunity.creator_type, opportunity.author_is_creator, opportunity.is_in_circle, opportunity.is_circle_requested, opportunity.is_following, opportunity.creator_id, opportunity.creator_name, opportunity.id, currentUserType, onPostUpdate, showAlert]);

  // ── Current user detection ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      const account = await getActiveAccount();
      if (account?.id) {
        setCurrentUserId(account.id);
        setCurrentUserType(account.type || "member");
      }
    };
    fetchUser();
  }, [opportunity.creator_id]);

  const isCreator = currentUserId && opportunity.creator_id == currentUserId;

  // ── Work mode / type / compensation helpers (Memoized) ───────────────────────
  const workModeText = useMemo(() => {
    if (opportunity.work_mode === "hybrid") return "Hybrid";
    if (opportunity.work_mode === "remote") return "Remote";
    if (opportunity.work_mode === "on_site") return "On-site";
    return opportunity.work_mode || "Remote";
  }, [opportunity.work_mode]);

  const workTypeText = useMemo(() => {
    const type = opportunity.work_type === "one_time" ? "One-time" : "Ongoing";
    return opportunity.availability ? `${type} (${opportunity.availability})` : type;
  }, [opportunity.work_type, opportunity.availability]);

  const compensationText = useMemo(() => {
    if (opportunity.payment_nature === "exposure") return "Exposure";
    if (opportunity.payment_nature === "revenue_share") {
      return opportunity.budget_range
        ? `Rev Share · ${opportunity.budget_range}`
        : "Rev Share";
    }
    if (opportunity.payment_nature === "trial") {
      const trialPrefix =
        opportunity.trial_type === "free_trial" ? "Free Trial" : "Paid Trial";
      return opportunity.budget_range
        ? `${trialPrefix} (${opportunity.budget_range})`
        : trialPrefix;
    }
    if (opportunity.payment_nature === "paid") {
      const payType = opportunity.payment_type
        ? ` (${
            opportunity.payment_type === "per_deliverable"
              ? "Task"
              : opportunity.payment_type === "monthly"
              ? "Mo"
              : "Fixed"
          })`
        : "";
      return opportunity.budget_range
        ? `${opportunity.budget_range}${payType}`
        : `Paid${payType}`;
    }
    return opportunity.budget_range || opportunity.payment_nature || "Negotiable";
  }, [opportunity.payment_nature, opportunity.trial_type, opportunity.budget_range, opportunity.payment_type]);

  // ── Chip helpers — separated roles vs skills (Memoized) ─────────────────────
  const roleChips = useMemo(() => {
    const roles = opportunity.opportunity_types || opportunity.roles || [];
    return Array.isArray(roles) ? roles.slice(0, 3) : [];
  }, [opportunity.opportunity_types, opportunity.roles]);

  const skillChips = useMemo(() => {
    const tools = [];
    if (opportunity.skill_groups && Array.isArray(opportunity.skill_groups)) {
      opportunity.skill_groups.forEach((group) => {
        let groupTools = group.tools;
        if (!groupTools) return;
        if (typeof groupTools === "string") {
          try { groupTools = JSON.parse(groupTools); } catch { groupTools = [groupTools]; }
        }
        if (Array.isArray(groupTools)) {
          groupTools.forEach((tool) => {
            if (tool && !tools.includes(tool)) tools.push(tool);
          });
        }
      });
    }
    return tools.slice(0, 8);
  }, [opportunity.skill_groups]);

  // Cache auth token so handleLike never awaits I/O before the optimistic UI update
  const tokenRef = useRef(null);
  useEffect(() => {
    getAuthToken().then((t) => {
      tokenRef.current = t;
    });
  }, []);

  // ── Engagement state ───────────────────────────────────────────────────────
  const initialIsLiked = opportunity.is_liked === true || opportunity.isLiked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(opportunity.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(opportunity.is_saved || false);
  const [saveCount, setSaveCount] = useState(opportunity.save_count || 0);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when the opportunity prop changes
  useEffect(() => {
    setIsLiked(opportunity.is_liked === true || opportunity.isLiked === true);
    setLikeCount(opportunity.like_count || 0);
    setIsSaved(opportunity.is_saved || false);
    setSaveCount(opportunity.save_count || 0);
    setCommentCount(opportunity.comment_count || 0);
  }, [opportunity.is_liked, opportunity.isLiked, opportunity.like_count, opportunity.is_saved, opportunity.save_count, opportunity.comment_count]);

  // ── View Tracking (opportunity-specific endpoint) ─────────────────────────
  const [viewCount, setViewCount] = useState(
    opportunity.view_count || opportunity.public_view_count || 0,
  );
  const dwellTimerRef = useRef(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    hasTrackedView.current = false;
    const DWELL_THRESHOLD = 2500;
    dwellTimerRef.current = setTimeout(async () => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      try {
        const token = await getAuthToken();
        const res = await apiPost(
          `/opportunities/${opportunity.id}/view`,
          {},
          10000,
          token,
        );
        if (res?.is_new) {
          setViewCount((prev) => prev + 1);
        }
      } catch (_e) {
        // non-fatal
      }
    }, DWELL_THRESHOLD);
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [opportunity.id]);

  // ── Like handler (opportunity-specific endpoint) ──────────────────────────
  const handleLike = useCallback(async () => {
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
    if (onLike) onLike(opportunity.id, nextLiked, nextLikes);

    setIsLiking(true);
    try {
      const token = tokenRef.current || (await getAuthToken());
      if (nextLiked) {
        await apiPost(`/opportunities/${opportunity.id}/like`, {}, 15000, token);
      } else {
        await apiDelete(`/opportunities/${opportunity.id}/like`, null, 15000, token);
      }
      EventBus.emit("post-like-updated", {
        postId: opportunity.id,
        isLiked: nextLiked,
        likeCount: nextLikes,
      });
    } catch (error) {
      console.error("Error liking opportunity:", error);
      if (error?.message?.toLowerCase().includes("already liked")) {
        setIsLiked(true);
        setLikeCount(prevLikeCount);
      } else {
        setIsLiked(prevLiked);
        setLikeCount(prevLikeCount);
        if (onLike) onLike(opportunity.id, prevLiked, prevLikeCount);
      }
    } finally {
      setIsLiking(false);
    }
  }, [isLiked, likeCount, isLiking, opportunity.id, onLike]);

  // ── Save handler (opportunity-specific endpoint) ──────────────────────────
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    HapticsService.triggerSave();

    const newSaveState = !isSaved;
    const nextSaveCount = Math.max(0, saveCount + (newSaveState ? 1 : -1));

    setIsSaved(newSaveState);
    setSaveCount(nextSaveCount);
    setIsSaving(true);

    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await apiPost(`/opportunities/${opportunity.id}/save`, {}, 15000, token);
      } else {
        await apiDelete(`/opportunities/${opportunity.id}/save`, null, 15000, token);
      }
      EventBus.emit("post-save-updated", {
        postId: opportunity.id,
        isSaved: newSaveState,
        saveCount: nextSaveCount,
      });
      if (onSave) onSave(opportunity.id, newSaveState);
    } catch (error) {
      console.error("Failed to save/unsave opportunity:", error);
      if (error?.message?.toLowerCase().includes("already saved")) {
        setIsSaved(true);
      } else {
        setIsSaved(!newSaveState);
        setSaveCount(saveCount);
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaved, saveCount, isSaving, opportunity.id, onSave]);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    closeMenu();
    setIsDeleting(true);
    try {
      await closeOpportunity(opportunity.id, "delete");
      EventBus.emit("opportunityDeleted", opportunity.id);
      if (onDelete) onDelete(opportunity.id);
    } catch (error) {
      console.error("Error deleting opportunity:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [opportunity.id, onDelete, closeMenu]);

  // ── Author press handler ───────────────────────────────────────────────────
  const handleAuthorPress = useCallback(() => {
    if (onUserPress) {
      onUserPress(opportunity.creator_id, opportunity.creator_type || "community");
      return;
    }
    const creatorType = opportunity.creator_type || "community";
    if (creatorType === "community") {
      navigation.navigate("CommunityPublicProfile", {
        communityId: opportunity.creator_id,
        viewerRole: "member",
      });
    } else {
      navigation.navigate("MemberPublicProfile", {
        memberId: opportunity.creator_id,
      });
    }
  }, [onUserPress, opportunity.creator_id, opportunity.creator_type, navigation]);

  const handleComment = useCallback(() => {
    HapticsService.triggerComment();
    if (onComment) {
      onComment(opportunity.id);
    } else {
      setCommentsVisible(true);
    }
  }, [onComment, opportunity.id]);

  const handleShare = useCallback(() => {
    HapticsService.triggerShare();
    if (onShare) onShare(opportunity.id);
  }, [onShare, opportunity.id]);

  const lastTapRef = useRef(0);
  const timerRef = useRef(null);
  const cardRef = useRef(null);

  const heartScale = useRef(new RNAnimated.Value(0)).current;
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [heartRot, setHeartRot] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  const triggerHeartAnimation = useCallback((x, y) => {
    setHeartPos({ x, y });
    setHeartRot(Math.random() * 30 - 15);
    setShowHeart(true);
    heartScale.setValue(0);
    
    RNAnimated.sequence([
      RNAnimated.timing(heartScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      RNAnimated.timing(heartScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.timing(heartScale, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.delay(800),
      RNAnimated.timing(heartScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  }, [heartScale]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCardPress = useCallback((event) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
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
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onPress?.(opportunity);
      }, 250);
    }
    lastTapRef.current = now;
  }, [onPress, opportunity, isLiked, handleLike, triggerHeartAnimation]);

  const handlePinPress = useCallback(() => {
    onPinToggle?.(opportunity, true);
  }, [onPinToggle, opportunity]);

  const handleMenuPress = useCallback((e) => {
    const { pageX, pageY } = e.nativeEvent;
    const screenWidth = Dimensions.get("window").width;
    setMenuPosition({
      x: screenWidth - pageX - 10,
      y: pageY + 12,
    });
    openMenu();
  }, [openMenu]);

  const handleEditPress = useCallback(() => {
    closeMenu();
    navigation.navigate("CreateOpportunityScreen", {
      opportunityToEdit: opportunity,
    });
  }, [closeMenu, navigation, opportunity]);

  const handleApplyPress = useCallback(() => {
    onPress?.(opportunity);
  }, [onPress, opportunity]);

  const isClosed = useMemo(() => {
    return opportunity.closed_at ||
      (opportunity.expires_at && new Date(opportunity.expires_at) < new Date());
  }, [opportunity.closed_at, opportunity.expires_at]);

  return (
    <>
      <LinearGradient
        colors={["#C8E9EA", "#E8F7F8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* ── Header Row: Badge & Icons ──────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>OPPORTUNITY</Text>
          </View>
 
          <View style={styles.rightHeaderContent}>
            {/* Pin button — only shown in profile screens with management enabled */}
            {showManagementControls && onPinToggle && (
              <TouchableOpacity
                style={[
                  styles.pinButton,
                  opportunity.is_pinned && styles.pinButtonActive,
                ]}
                onPress={handlePinPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.pinIconWrapper}>
                  <Pin
                    size={18}
                    color={opportunity.is_pinned ? "#10B981" : "#5B6B7C"}
                    fill={opportunity.is_pinned ? "#10B981" : "none"}
                    strokeWidth={2}
                  />
                </View>
              </TouchableOpacity>
            )}
 
            {/* 3-dot menu — shown only to creator */}
            {isCreator && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={handleMenuPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MoreHorizontal size={20} color="#5B6B7C" strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Report ⋯ — shown only to non-creators */}
            {!isCreator && (
              <View style={styles.menuButton}>
                <ContentActionsSheet
                  type="post"
                  targetId={opportunity.id}
                  targetName={opportunity.creator_name || opportunity.title}
                  label="Opportunity"
                  iconColor="#5B6B7C"
                  iconSize={20}
                />
              </View>
            )}
 
            <View style={styles.iconContainer}>
              <Briefcase size={20} color="#2962FF" strokeWidth={2} />
            </View>
          </View>
        </View>
 
        {/* ── Author Row (tappable → profile) ───────────────────────────── */}
        <View style={styles.authorHeaderRow}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={handleAuthorPress}
            activeOpacity={0.7}
          >
            <Image
              source={
                opportunity.creator_photo
                  ? { uri: opportunity.creator_photo }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        opportunity.creator_name || "U",
                      )}&background=E5E7EB&color=6B7280&size=88`,
                    }
              }
              style={styles.authorAvatar}
            />
            <Text style={styles.authorUsername} numberOfLines={1}>
              {opportunity.creator_name || "Anonymous"}
            </Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(opportunity.created_at)}
            </Text>
          </TouchableOpacity>
          {showFollowButton && !isCreator && (
            <FollowButton
              userId={opportunity.creator_id}
              userType={opportunity.creator_type}
              isFollowing={opportunity.is_following}
              isInCircle={opportunity.is_in_circle}
              isCircleRequested={opportunity.is_circle_requested}
              isAdd={
                !opportunity.is_in_circle &&
                !opportunity.is_circle_requested &&
                ((currentUserType === "member" && opportunity.creator_type === "member" && !opportunity.author_is_creator) ||
                 (currentUserType === "community" && opportunity.creator_type === "member"))
              }
              onFollowChange={handleFollowToggle}
              style={styles.followButtonInline}
              textStyle={styles.followButtonInlineText}
              currentFollowerId={currentUserId}
            />
          )}
        </View>
 
        {/* ── Tappable Middle Content (navigates to details) ──────────────── */}
        <TouchableOpacity ref={cardRef} onPress={handleCardPress} activeOpacity={0.95}>
          {/* ── Title ─────────────────────────────────────────────────────── */}
          <Text style={styles.title} numberOfLines={2}>
            {opportunity.title}
          </Text>
 
          {/* ── Role Chips (scrollable, no heading) ─────────────────── */}
          {roleChips.length > 0 && (
            <ChipsRow chips={roleChips} chipType="role" styles={styles} />
          )}
 
          {/* ── Skill Chips (scrollable, no heading) ─────────────────── */}
          {skillChips.length > 0 && (
            <ChipsRow chips={skillChips} chipType="skill" styles={styles} />
          )}
 
          {/* ── Details Row ───────────────────────────────────────────────── */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Globe size={15} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{workModeText}</Text>
            </View>
 
            <Text style={styles.detailSeparator}>•</Text>
 
            <View style={styles.detailItem}>
              <Clock size={15} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{workTypeText}</Text>
            </View>
 
            <Text style={styles.detailSeparator}>•</Text>
 
            <View style={styles.detailItem}>
              <Coins size={15} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{compensationText}</Text>
            </View>
          </View>

          {showHeart && (
            <RNAnimated.View
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
            </RNAnimated.View>
          )}
        </TouchableOpacity>
 
        {/* ── Footer Row ────────────────────────────────────────────────── */}
        <View style={styles.footerRow}>
          {/* Applicants + Timer/Ended */}
          <View style={styles.footerLeft}>
            <View style={styles.applicantStack}>
              {opportunity.applicants && opportunity.applicants.length > 0 ? (
                <>
                  {opportunity.applicants.slice(0, 3).map((applicant, index) => (
                    <Image
                      key={index}
                      source={{ uri: applicant.photo_url }}
                      style={[
                        styles.applicantAvatar,
                        { marginLeft: index > 0 ? -10 : 0 },
                      ]}
                    />
                  ))}
                  {opportunity.applicant_count > 3 && (
                    <Text style={styles.applicantCount}>
                      +{opportunity.applicant_count - 3}
                    </Text>
                  )}
                </>
              ) : opportunity.applicant_count > 0 ? (
                <Text style={styles.applicantCountText}>
                  {opportunity.applicant_count} applicants
                </Text>
              ) : (
                <Text style={styles.applicantCountText}>Be the first</Text>
              )}
            </View>
 
            {(opportunity.expires_at || opportunity.closed_at) && (
              <>
                <Text style={styles.footerSeparator}>•</Text>
                {isClosed ? (
                  <View style={styles.endedBadge}>
                    <Text style={styles.endedBadgeText}>Ended</Text>
                  </View>
                ) : (
                  <View style={styles.activeBadge}>
                    <CountdownTimer
                      expiresAt={opportunity.expires_at}
                      style={styles.activeBadgeText}
                    />
                  </View>
                )}
              </>
            )}
          </View>
 
          {/* CTA Button — owner sees Submissions, others see View Details */}
          {isCreator ? (
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                navigation.navigate("ApplicantsList", {
                  opportunityId: opportunity.id,
                  opportunityTitle: opportunity.title,
                });
              }}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>View Submissions</Text>
                <ArrowRight
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 6 }}
                  strokeWidth={2.5}
                />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.applyButton, isClosed && styles.applyButtonDisabled]}
              onPress={() => {
                if (!isClosed) onPress?.(opportunity);
              }}
              disabled={isClosed}
            >
              <LinearGradient
                colors={isClosed ? ["#9CA3AF", "#6B7280"] : ["#448AFF", "#2962FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>
                  {isClosed ? "Closed" : "View Details"}
                </Text>
                {!isClosed && (
                  <ArrowRight
                    size={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 6 }}
                    strokeWidth={2.5}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
 
        {/* ── Engagement Row ────────────────────────────────────────────── */}
        <View style={styles.engagementRow}>
          {/* Like */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart
              size={20}
              color={isLiked ? COLORS.error : "#5e8d9b"}
              fill={isLiked ? COLORS.error : "transparent"}
              strokeWidth={2}
            />
            <Text style={[styles.engagementCount, isLiked && styles.likedCount]}>
              {formatCount(likeCount)}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.engagementButton} onPress={handleComment}>
            <MessageCircle size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>
              {formatCount(commentCount)}
            </Text>
          </TouchableOpacity>

          {/* Views */}
          <TouchableOpacity style={styles.engagementButton} onPress={() => { HapticsService.triggerView(); }}>
            <ChartNoAxesCombined size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>{formatCount(viewCount)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.engagementButton} onPress={handleShare}>
            <Send size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>
              {formatCount(opportunity.share_count || 0)}
            </Text>
          </TouchableOpacity>

          {/* Bookmark */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Bookmark
              size={20}
              color="#5e8d9b"
              fill={isSaved ? "#5e8d9b" : "transparent"}
              strokeWidth={2}
            />
            <Text style={styles.engagementCount}>
              {formatCount(saveCount)}
            </Text>
          </TouchableOpacity>
        </View>

      {/* ── 3-dot Menu Modal ──────────────────────────────────────────────── */}
      {menuVisible && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="none"
          onRequestClose={closeMenu}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeMenu}>
            <View
              style={[
                styles.menuContainerModal,
                {
                  top: menuPosition.y,
                  right: menuPosition.x,
                },
              ]}
            >
              {/* View Submissions */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeMenu();
                  navigation.navigate("ApplicantsList", {
                    opportunityId: opportunity.id,
                    opportunityTitle: opportunity.title,
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                  <Users size={15} color="#10B981" strokeWidth={2} />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>View Submissions</Text>
                  <Text style={styles.menuItemSub}>See all applicants & requests</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Edit */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeMenu();
                  navigation.navigate("CreateOpportunityScreen", {
                    opportunityToEdit: opportunity,
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.menuIconWrap}>
                  <Pencil size={15} color="#2962FF" strokeWidth={2} />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>Edit Opportunity</Text>
                  <Text style={styles.menuItemSub}>Update details or requirements</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Delete */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDelete}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                <View style={[styles.menuIconWrap, styles.menuIconDestructive]}>
                  <Trash2 size={15} color="#EF4444" strokeWidth={2} />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={[styles.menuItemTitle, styles.menuItemDestructive]}>
                    {isDeleting ? "Deleting…" : "Delete Opportunity"}
                  </Text>
                  <Text style={styles.menuItemSub}>This action cannot be undone</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
      </LinearGradient>

    {/* ── Opportunity Comments Modal ──────────────────────────────────────── */}
    {commentsVisible && (
      <CommentsModal
        visible={commentsVisible}
        postId={opportunity.id}
        onClose={() => setCommentsVisible(false)}
        onCommentCountChange={(newCount) => setCommentCount(newCount)}
        baseRoute="/opportunities"
        replyBaseRoute="/opportunity-comments"
        navigation={navigation}
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
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: 20,
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#4A5568",
    letterSpacing: 0.5,
  },
  iconContainer: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pinButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  pinButtonActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  pinIconWrapper: {
    transform: [{ rotate: "27deg" }],
    overflow: "visible",
  },

  // ── Author ────────────────────────────────────────────────────────────────
  authorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
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
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 15,
    color: "#1D1D1F",
    fontFamily: FONTS.semiBold,
    maxWidth: 160,
  },
  separator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    marginHorizontal: 4,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#5e8d9b",
  },

  // ── Title ─────────────────────────────────────────────────────────────────
  title: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#1D1D1F",
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 30,
  },

  // ── Chips ─────────────────────────────────────────────────────────────────
  chipsRow: {
    marginBottom: 8,
    maxHeight: 34,
  },
  chipsContent: {
    paddingRight: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  // Role chip — solid blue tinted, slightly bolder
  roleChip: {
    backgroundColor: "rgba(41, 98, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.22)",
  },
  roleChipText: {
    fontSize: 12,
    color: "#2962FF",
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.1,
  },
  // Skill chip — lighter, outlined style
  skillChip: {
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(94, 141, 155, 0.35)",
  },
  skillChipText: {
    fontSize: 12,
    color: "#3D6B7A",
    fontFamily: FONTS.medium,
  },

  // ── Details ───────────────────────────────────────────────────────────────
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 20,
    marginTop: 4,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#1D1D1F",
    fontFamily: FONTS.medium,
  },
  detailSeparator: {
    fontSize: 13,
    color: "#5e8d9b",
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerSeparator: {
    color: COLORS.textTertiary,
    marginHorizontal: 8,
    fontSize: EDITORIAL_TYPOGRAPHY.timestamp.fontSize,
  },
  applicantStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  applicantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  applicantCount: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#3B82F6",
    marginLeft: 6,
  },
  applicantCountText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontFamily: FONTS.medium,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  endedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  endedBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#DC2626",
  },
  applyButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonDisabled: {
    shadowColor: "#6B7280",
    opacity: 0.7,
  },
  applyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },

  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.07)",
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    minHeight: 36,
    minWidth: 40,
    justifyContent: "center",
  },
  engagementCount: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#5e8d9b",
  },
  likedCount: {
    color: COLORS.error,
  },

  // ── 3-dot Menu Popover ──────────────────────────────────────────────────
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
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
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
    fontFamily: FONTS.semiBold,
    color: "#1D1D1F",
  },
  menuItemDestructive: {
    color: "#EF4444",
  },
  menuItemSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
});

export default OpportunityFeedCard;
