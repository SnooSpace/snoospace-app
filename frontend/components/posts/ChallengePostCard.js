/**
 * ChallengePostCard
 * Displays a Challenge post with joining, progress, and submission preview
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { Image } from "expo-image"; // ── PERF: memory-disk cache + off-thread decode
import { GradientHeart } from "../ui/GradientHeart";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  Trophy,
  Play,
  Star,
  Calendar,
  Edit2,
  Trash2,
  Video,
  Camera,
  FileText,
  LogOut,
  ArrowRight,
  User,
  CheckCircle2,
  ChevronRight,
  MoveRight,
  Clock,
  TriangleAlert,
  Pin,
  Pencil,
  UserMinus,
} from "lucide-react-native";
import {
  apiPost,
  apiDelete,
  apiGet,
  savePost,
  unsavePost,
} from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { postService } from "../../services/postService";
import CustomAlertModal from "../ui/CustomAlertModal";
import ChallengeEditModal from "./ChallengeEditModal";
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
  COLORS,
  FONTS,
  SHADOWS,
  SPACING,
  BORDER_RADIUS,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../../constants/theme";
import CountdownTimer from "../CountdownTimer";
import SnooLoader from "../ui/SnooLoader";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";
import HapticsService from "../../services/HapticsService";
import {
  getExtensionBadgeText,
  getTimeRemaining,
} from "../../utils/cardTiming";
import ContentActionsSheet from "../ContentActionsSheet";

const ChallengePostCard = React.memo(({
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
  const [hasJoined, setHasJoined] = useState(post.has_joined || false);
  const [userParticipation, setUserParticipation] = useState(
    post.user_participation || null,
  );
  const [participantCount, setParticipantCount] = useState(
    typeData.participant_count || 0,
  );
  const [isJoining, setIsJoining] = useState(false);
  const [previewSubmission, setPreviewSubmission] = useState(
    post.preview_submission || null,
  );
  const [participantPreviews, setParticipantPreviews] = useState([]);
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
  const challengeType = typeData.challenge_type || "single";
  const submissionType = typeData.submission_type || "image";
  const maxSubmissionsPerUser = typeData.max_submissions_per_user || 1;

  // Track user's active submission count (for blocking re-submission on Single Task)
  const [userSubmissionCount, setUserSubmissionCount] = useState(
    post.user_submission_count || 0,
  );
  const [userSubmissionStatus, setUserSubmissionStatus] = useState(
    post.user_submission_status || null,
  );

  // For Single Task: user has already submitted if they have >= 1 active submission
  const hasSubmittedSingle =
    challengeType === "single" && userSubmissionCount >= maxSubmissionsPerUser;

  // Check if current user owns this post
  const isOwnPost =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  const isAnon = post.is_anonymous === true || post.type_data?.is_anonymous === true;

  // Pulse animation for Live Now badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Sync state with props
  useEffect(() => {
    setHasJoined(post.has_joined || false);
    setUserParticipation(post.user_participation || null);
    setParticipantCount(typeData.participant_count || 0);
    setPreviewSubmission(post.preview_submission || null);
    setUserSubmissionCount(post.user_submission_count || 0);
    setUserSubmissionStatus(post.user_submission_status || null);
  }, [
    post.has_joined,
    post.user_participation,
    typeData.participant_count,
    post.preview_submission,
    post.user_submission_count,
    post.user_submission_status,
  ]);

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
  const [saveCount, setSaveCount] = useState(post.save_count || post.saves_count || 0);

  useEffect(() => {
    setIsLiked(post.is_liked === true);
    setLikeCount(post.like_count || 0);
    setIsSaved(post.is_saved || false);
    setSaveCount(post.save_count || post.saves_count || 0);
  }, [post.is_liked, post.like_count, post.is_saved, post.save_count, post.saves_count]);

  // ── Submission Activity Teaser ────────────────────────────────────────────
  const [submissionStats, setSubmissionStats] = useState(null);

  useEffect(() => {
    const loadSubmissionStats = async () => {
      try {
        const token = await getAuthToken();
        const data = await apiGet(`/posts/${post.id}/submission-stats`, 8000, token);
        console.log("[ChallengePostCard] submission-stats for", post.id, "→", JSON.stringify(data));
        if (data?.success) setSubmissionStats(data);
      } catch (e) {
        console.warn("[ChallengePostCard] submission-stats fetch failed:", e?.message);
      }
    };
    loadSubmissionStats();
  }, [post.id]);

  // ── Live teaser counters — react to like/comment events from submissions screen ──
  useEffect(() => {
    // A comment was added to a submission belonging to this challenge
    const unsubComment = EventBus.on("submission-comment-added", (payload) => {
      if (payload?.postId !== post.id) return;
      setSubmissionStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          total_submission_comments: (prev.total_submission_comments || 0) + 1,
        };
      });
    });

    // A submission was liked/unliked inside this challenge
    const unsubLike = EventBus.on("submission-liked", (payload) => {
      if (payload?.postId !== post.id) return;
      setSubmissionStats((prev) => {
        if (!prev) return prev;
        const delta = payload.liked ? 1 : -1;
        return {
          ...prev,
          total_submission_likes: Math.max(0, (prev.total_submission_likes || 0) + delta),
        };
      });
    });

    return () => {
      if (unsubComment) unsubComment();
      if (unsubLike) unsubLike();
    };
  }, [post.id]);

  // ── View Tracking ──────────────────────────────────────────────────────────
  const [viewCount, setViewCount] = useState(post.public_view_count || post.view_count || 0);
  const dwellTimerRef = useRef(null);

  useEffect(() => {
    const DWELL_THRESHOLD = 2500;
    const alreadyViewed = viewQueueService.hasViewed(post.id);
    if (!alreadyViewed) {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addQualifiedView(post.id, { postType: "challenge", trigger: "dwell" });
      }, DWELL_THRESHOLD);
    } else {
      dwellTimerRef.current = setTimeout(() => {
        viewQueueService.addRepeatView(post.id, "revisit");
      }, DWELL_THRESHOLD);
    }
    return () => { if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current); };
  }, [post.id]);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-view-updated", (payload) => {
      if (payload?.postId === post.id) setViewCount((prev) => prev + 1);
    });
    return () => { if (unsubscribe) unsubscribe(); };
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

  // Fetch participant previews for avatar stack
  useEffect(() => {
    const fetchPreviews = async () => {
      if (participantCount === 0) return;
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/participant-previews`,
          10000,
          token,
        );
        if (response.success && response.previews) {
          setParticipantPreviews(response.previews);
        }
      } catch (error) {
        console.log("Error fetching participant previews:", error);
      }
    };
    fetchPreviews();
  }, [post.id, participantCount]);

  // Animate Live Now badge
  useEffect(() => {
    if (!isExpired) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isExpired, pulseAnim]);

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
        navigation.navigate("ChallengeSubmissions", { post });
        tapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleJoinChallenge = async () => {
    if (isJoining || isExpired) return;

    if (hasJoined) {
      // Warn if user has active submissions — leaving cascades deletes them
      if (userSubmissionCount > 0) {
        showAlert(
          "Leave Challenge?",
          `You have ${userSubmissionCount} submission${userSubmissionCount > 1 ? "s" : ""} in this challenge. Leaving will permanently delete ${userSubmissionCount > 1 ? "them" : "it"} and cannot be undone.`,
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Leave & Delete",
              style: "destructive",
              onPress: () => performLeave(),
            },
          ],
        );
        return;
      }
      performLeave();
      return;
    }

    // Join
    setIsJoining(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/posts/${post.id}/join`,
        {},
        10000,
        token,
      );
      if (response.success) {
        setHasJoined(true);
        setUserParticipation(response.participation);
        setParticipantCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error joining challenge:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const performLeave = async () => {
    setIsJoining(true);
    try {
      const token = await getAuthToken();
      await apiDelete(`/posts/${post.id}/join`, {}, 10000, token);
      setHasJoined(false);
      setUserParticipation(null);
      setUserSubmissionCount(0);
      setParticipantCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error leaving challenge:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
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

  const getChallengeTypeLabel = () => {
    switch (challengeType) {
      case "progress":
        return "Progress Challenge";
      case "community":
        return "Community Challenge";
      default:
        return "Challenge";
    }
  };

  const renderSubmissionTypeIcon = () => {
    const iconProps = { size: 18, color: "#FFFFFF", style: { zIndex: 1 } };
    switch (submissionType) {
      case "video":
        return <Video {...iconProps} />;
      case "image":
        return <Camera {...iconProps} />;
      default:
        return <FileText {...iconProps} />;
    }
  };

  // Render progress bar for progress-based challenges
  const renderProgressBar = () => {
    if (!hasJoined || challengeType !== "progress" || !userParticipation)
      return null;

    const progress = userParticipation.progress || 0;
    const targetCount = typeData.target_count || 1;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressSubtext}>
          {Math.round((progress / 100) * targetCount)} / {targetCount} completed
        </Text>
      </View>
    );
  };

  // Render preview submission
  const renderPreviewSubmission = () => {
    if (!previewSubmission) return null;

    return (
      <TouchableOpacity
        style={styles.previewContainer}
        onPress={() => navigation.navigate("ChallengeSubmissions", { post })}
        activeOpacity={0.7}
      >
        {previewSubmission.media_urls &&
          previewSubmission.media_urls.length > 0 && (
            <Image
              source={{ uri: previewSubmission.media_urls[0] }}
              style={styles.previewImage}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
          )}
        {previewSubmission.video_thumbnail && (
          <View style={styles.previewImageContainer}>
            <Image
              source={{ uri: previewSubmission.video_thumbnail }}
              style={styles.previewImage}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
            <View style={styles.playIconOverlay}>
              <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
        )}
        <View style={styles.previewInfo}>
          <View style={styles.previewMeta}>
            {previewSubmission.participant_photo_url && (
              <Image
                source={{ uri: previewSubmission.participant_photo_url }}
                style={styles.previewAvatar}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            )}
            <Text style={styles.previewAuthorName} numberOfLines={1}>
              {previewSubmission.participant_name || "Participant"}
            </Text>
            {previewSubmission.is_featured && (
              <View style={styles.featuredBadge}>
                <Star size={10} color="#FFD700" fill="#FFD700" />
              </View>
            )}
          </View>
          {previewSubmission.content && (
            <Text style={styles.previewContent} numberOfLines={2}>
              {previewSubmission.content}
            </Text>
          )}

        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View ref={cardRef} style={styles.container}>
        {/* Header Row: Badge & Trophy Icon */}
        <View style={styles.headerRow}>
          <View style={styles.badgesRow}>
            <View style={styles.challengePill}>
              <Text style={styles.challengePillText}>Challenge</Text>
            </View>
            {isExpired && (
              <View style={styles.endedBadge}>
                <Text style={styles.endedBadgeText}>Ended</Text>
              </View>
            )}
            {!isExpired &&
              (() => {
                const remaining = getTimeRemaining(post.expires_at);
                const hours = remaining / (1000 * 60 * 60);

                // Show countdown if < 24h, otherwise "Live Now"
                if (hours < 24 && hours > 0) {
                  return (
                    <Animated.View
                      style={[
                        styles.activeBadge,
                        { transform: [{ scale: pulseAnim }] },
                      ]}
                    >
                      <Text style={styles.urgencyIcon}>⏰</Text>
                      <CountdownTimer
                        expiresAt={post.expires_at}
                        style={styles.activeBadgeText}
                        prefix=""
                      />
                    </Animated.View>
                  );
                }

                return (
                  <Animated.View
                    style={[
                      styles.activeBadge,
                      {
                        transform: [{ scale: pulseAnim }],
                        flexDirection: "row",
                      },
                    ]}
                  >
                    <View style={styles.liveDot} />
                    <Text style={styles.activeBadgeText}>Live Now</Text>
                  </Animated.View>
                );
              })()}
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
                  label="Challenge"
                  iconColor="#5B6B7C"
                  iconSize={20}
                />
              </View>
            )}
            <View style={styles.trophyContainer}>
              <Trophy size={20} color="#EAB308" />
            </View>
          </View>
        </View>

        {/* Deadline Date/Time - on its own line */}
        {post.expires_at && (
          <View style={styles.deadlineRow}>
            <Calendar size={14} color="#5e8d9b" />
            <Text style={styles.deadlineText}>
              {isExpired
                ? `Ended ${new Date(post.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(post.expires_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
                : `Ends ${new Date(post.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(post.expires_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`}
            </Text>
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

        {/* Author Row */}
        <View style={styles.authorHeaderRow}>
          <TouchableOpacity
            style={styles.authorRow}
            onPress={handleUserPress}
            activeOpacity={0.7}
          >
            <Image
              source={
                post.author_photo_url
                  ? { uri: post.author_photo_url }
                  : { uri: "https://via.placeholder.com/32" }
              }
              style={styles.authorAvatar}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
            <Text style={styles.authorName} numberOfLines={1}>
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

        {/* Title & Description */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{typeData.title}</Text>
          {typeData.description && (
            <Text style={styles.description}>{typeData.description}</Text>
          )}

          {/* Extension Badge */}
          {post.extension_count > 0 && (
            <View style={styles.extensionBadge}>
              <Text style={styles.extensionBadgeText}>
                {getExtensionBadgeText(post.extension_count)}
              </Text>
            </View>
          )}
        </View>

        {/* Progress Bar (if joined) */}
        {renderProgressBar()}

        {/* Preview Submission */}
        {renderPreviewSubmission()}

        {/* Join/Submit Button */}
        {!isExpired && (
          hasJoined ? (
            <View style={styles.joinedButtonsRow}>
              {hasSubmittedSingle ? (
                // ── Single Task: already submitted — show dynamic status ────────
                <TouchableOpacity
                  style={styles.submittedBadge}
                  onPress={() => navigation.navigate("ChallengeSubmissions", { post })}
                  activeOpacity={0.8}
                >
                  {userSubmissionStatus === "featured" ? (
                    <Star size={16} color="#FFD700" fill="#FFD700" style={{ marginRight: 6 }} />
                  ) : userSubmissionStatus === "approved" ? (
                    <CheckCircle2 size={16} color="#34C759" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  ) : (
                    <Clock size={16} color="#FF9500" strokeWidth={2} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[
                    styles.submittedBadgeText,
                    userSubmissionStatus === "featured" && { color: "#B8860B" },
                    userSubmissionStatus === "approved" && { color: "#2E7D32" },
                    userSubmissionStatus === "pending" && { color: "#FF9500" },
                  ]}>
                    {userSubmissionStatus === "featured"
                      ? "Submission Featured ⭐"
                      : userSubmissionStatus === "approved"
                        ? "Submitted · Approved"
                        : "Submitted · Pending Review"}
                  </Text>
                </TouchableOpacity>
              ) : (
                // ── Normal submit button ────────────────────────────────────────
                <TouchableOpacity
                  style={styles.submitProofButton}
                  onPress={() => {
                    navigation.navigate("ChallengeSubmit", {
                      post,
                      participation: userParticipation,
                      onSubmitSuccess: () => setUserSubmissionCount((c) => c + 1),
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#34C759", "#2E7D32"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {renderSubmissionTypeIcon()}
                  <Text style={[styles.submitProofButtonText, { zIndex: 1 }]}>
                    Submit Proof
                  </Text>
                </TouchableOpacity>
              )}
              {!hasSubmittedSingle && (
                <TouchableOpacity
                  style={styles.leaveButton}
                  onPress={handleJoinChallenge}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <SnooLoader size="small" color={COLORS.textSecondary} />
                  ) : (
                    <LogOut
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.joinButtonContainer}
              onPress={handleJoinChallenge}
              disabled={isJoining}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={["#448AFF", "#2962FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinButtonGradient}
              >
                {isJoining ? (
                  <SnooLoader size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.joinButtonText}>
                      Join Challenge
                    </Text>
                    <ArrowRight
                      size={18}
                      color="#FFFFFF"
                      style={{ marginLeft: 6 }}
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )
        )}


        {/* Participant Count (below CTA) - Clickable to view all */}
        {participantCount > 0 && (
          <TouchableOpacity
            style={styles.participantCountContainer}
            onPress={() =>
              navigation.navigate("ChallengeSubmissions", { post })
            }
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.participantCountText}>Joined by</Text>
              {(() => {
                const displayCount = Math.min(3, participantPreviews.length > 0 ? participantPreviews.length : participantCount);
                const showBadge = participantCount > 3;
                const totalClusterItems = showBadge ? displayCount + 1 : displayCount;
                
                // Helper to define cluster positions dynamically
                const getAvatarClusterLayout = (total) => {
                  const size = 28;
                  const overlap = 8;
                  const spacing = size - overlap; // 20
                  
                  if (total <= 1) {
                    return {
                      containerStyle: { width: size, height: size },
                      getItemStyle: (index) => ({
                        position: "absolute",
                        top: 0,
                        left: 0,
                      }),
                    };
                  }
                  
                  if (total === 2) {
                    return {
                      containerStyle: { width: size + spacing, height: size },
                      getItemStyle: (index) => ({
                        position: "absolute",
                        top: 0,
                        left: index * spacing,
                      }),
                    };
                  }
                  
                  // 3 or 4 items: triangle/2x2 layout
                  return {
                    containerStyle: { width: size + spacing, height: size + spacing },
                    getItemStyle: (index) => {
                      const isTop = index < 2;
                      const isLeft = index % 2 === 0;
                      return {
                        position: "absolute",
                        top: isTop ? 0 : spacing,
                        left: isLeft ? 0 : spacing,
                      };
                    },
                  };
                };

                const { containerStyle, getItemStyle } = getAvatarClusterLayout(totalClusterItems);

                return (
                  <View style={[containerStyle, { marginLeft: 8 }]}>
                    {participantPreviews.length > 0 ? (
                      <>
                        {participantPreviews.slice(0, 3).map((participant, index) => (
                          <View
                            key={`${participant.participant_id}-${participant.participant_type}`}
                            style={[
                              styles.participantAvatarImage,
                              getItemStyle(index),
                              { zIndex: 10 - index },
                            ]}
                          >
                            {participant.participant_photo_url ? (
                              <Image
                                source={{ uri: participant.participant_photo_url }}
                                style={styles.participantAvatarImg}
                                cachePolicy="memory-disk"
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.participantAvatarPlaceholder}>
                                <User size={12} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                        ))}
                        {showBadge && (
                          <View
                            style={[
                              styles.participantCountBadge,
                              getItemStyle(3),
                              { zIndex: 1 },
                            ]}
                          >
                            <Text style={styles.participantCountBadgeText}>
                              +{participantCount - 3}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      // Fallback to placeholder if no previews loaded yet
                      <>
                        {Array.from({ length: displayCount }).map((_, index) => (
                          <View
                            key={`placeholder-${index}`}
                            style={[
                              styles.participantAvatar,
                              getItemStyle(index),
                              { zIndex: 10 - index },
                            ]}
                          >
                            <User size={10} color="#FFFFFF" />
                          </View>
                        ))}
                        {showBadge && (
                          <View
                            style={[
                              styles.participantCountBadge,
                              getItemStyle(3),
                              { zIndex: 1 },
                            ]}
                          >
                            <Text style={styles.participantCountBadgeText}>
                              +{participantCount - 3}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })()}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.viewAllText}>View all</Text>
              <MoveRight size={16} color={COLORS.primary} strokeWidth={2} style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        )}

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
              size={EDITORIAL_SPACING.iconSize}
              color={isLiked ? COLORS.error : COLORS.editorial.textSecondary}
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
            <MessageCircle size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
            <Text style={styles.engagementCount}>
              {formatCount(post.comment_count || 0)}
            </Text>
          </GHPressable>

          {/* Views */}
          <GHPressable style={styles.engagementButton} onPress={() => HapticsService.triggerView()}>
            <ChartNoAxesCombined size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
            <Text style={styles.engagementCount}>
              {formatCount(viewCount)}
            </Text>
          </GHPressable>

          {/* Share */}
          <GHPressable
            style={styles.engagementButton}
            onPress={handleShare}
          >
            <Send size={EDITORIAL_SPACING.iconSize} color={COLORS.editorial.textSecondary} />
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
              size={EDITORIAL_SPACING.iconSize}
              color={COLORS.editorial.textSecondary}
              fill={isSaved ? COLORS.editorial.textSecondary : "transparent"}
            />
            {saveCount > 0 && (
              <Text style={styles.engagementCount}>
                {formatCount(saveCount)}
              </Text>
            )}
          </GHPressable>
        </View>
        )}

        {/* Submission Activity Teaser — shown as soon as any approved submission exists */}
        {submissionStats && submissionStats.total_submissions > 0 && (
          <TouchableOpacity
            style={styles.submissionTeaser}
            onPress={() =>
              navigation.navigate("ChallengeSubmissions", { post })
            }
            activeOpacity={0.75}
          >
            <Trophy size={13} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.submissionTeaserText}>
              {[
                submissionStats.unique_contributors > 0 &&
                  `${submissionStats.unique_contributors} participant${
                    submissionStats.unique_contributors !== 1 ? "s" : ""
                  }`,
                submissionStats.total_submission_likes > 0 &&
                  `${submissionStats.total_submission_likes} like${
                    submissionStats.total_submission_likes !== 1 ? "s" : ""
                  }`,
                submissionStats.total_submission_comments > 0 &&
                  `${submissionStats.total_submission_comments} comment${
                    submissionStats.total_submission_comments !== 1 ? "s" : ""
                  }`,
              ]
                .filter(Boolean)
                .join(" · ") || `${submissionStats.total_submissions} submission${submissionStats.total_submissions !== 1 ? "s" : ""}`}{" "}
              in submissions
            </Text>
            <ArrowRight size={13} color="#5e8d9b" strokeWidth={2} />
          </TouchableOpacity>
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
      {showEditModal && (
        <ChallengeEditModal
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
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl, // 20px
    padding: SPACING.l,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trophyContainer: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
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
  authorName: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#1D1D1F",
  },
  separator: {
    color: COLORS.textTertiary,
    marginHorizontal: 6,
    fontSize: 13,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  editedLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontStyle: "italic",
  },
  timestampText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#5e8d9b",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  headerColumn: {
    marginBottom: SPACING.m,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#34C759",
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6", // Light gray
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activeBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  urgencyIcon: {
    fontSize: 12,
  },

  challengePill: {
    backgroundColor: "#FFF4E0", // Muted amber/soft gold
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12, // Matching reference chips
  },
  challengePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10.5,
    color: "#A67C52", // Warm brown-gold
    letterSpacing: 0.5,
  },

  contentContainer: {
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    marginBottom: 6,
    lineHeight: 26,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#5e8d9b",
    marginBottom: SPACING.s,
    lineHeight: 20,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.s,
    marginBottom: SPACING.s,
  },
  deadlineText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#5e8d9b",
  },
  extensionBadge: {
    backgroundColor: "#FFF4E0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: SPACING.s,
  },
  extensionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A67C52",
  },
  // Progress Bar
  progressContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#FF9500",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 4,
  },
  progressSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  // Preview
  previewContainer: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.s,
    marginBottom: SPACING.m,
  },
  previewImageContainer: {
    position: "relative",
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.m,
  },
  playIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: BORDER_RADIUS.m,
  },
  previewInfo: {
    flex: 1,
    marginLeft: SPACING.s,
    justifyContent: "center",
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  previewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  previewAuthorName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },
  featuredBadge: {
    backgroundColor: "#FFF8E1",
    padding: 3,
    borderRadius: 10,
  },
  previewContent: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  previewLikes: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  previewLikesText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  // Buttons
  joinButtonContainer: {
    borderRadius: 16, // Matching reference (less than pill)
    overflow: "hidden",
    marginTop: 8,
    ...SHADOWS.primaryGlow, // Add glow
  },
  joinButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.m,
    backgroundColor: "#2979FF", // Fallback
  },
  joinButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  joinedButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  submitProofButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759", // Overridden by gradient
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginRight: SPACING.s,
    overflow: "hidden",
    position: "relative",
  },
  submitProofButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
    marginLeft: SPACING.s,
  },
  submittedBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: BORDER_RADIUS.m,
    paddingVertical: 12,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: "#34C75930",
  },
  submittedBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#22A447",
  },
  leaveButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SPACING.s,
  },
  expiredContainer: {
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
  },
  expiredText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.m,
    paddingTop: SPACING.xs,
  },
  participantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  participantCountText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#5e8d9b",
  },
  viewAllText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
  },
  participantCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 12,
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
  // New avatar stack styles
  participantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#90CAF9",
    alignItems: "center",
    justifyContent: "center",
  },
  participantAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  participantAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  participantAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#90CAF9",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  participantCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1976D2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  participantCountBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: "#FFFFFF",
  },

  // Submission Activity Teaser
  submissionTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 2,
  },
  submissionTeaserText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#5e8d9b",
    lineHeight: 17,
  },
});


export default ChallengePostCard;
