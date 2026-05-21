import { useFocusEffect, useIsFocused } from "@react-navigation/native";
/**
 * ChallengeSubmissionsScreen
 * Gallery view of all submissions for a challenge
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import {
  ArrowLeft,
  Image as ImageIcon,
  Users,
  Star,
  Clock,
  EyeOff,
  ImageOff,
  Plus,
  X,
  PlayCircle,
  Heart,
  MessageCircle,
  Send,
  ChartNoAxesCombined,
  CheckCircle2,
  XCircle,
  User,
  Info,
  Mail,
  Trophy,
  MoreHorizontal,
  MinusCircle,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react-native";
import { apiGet, apiPost, apiDelete, apiPatch, sharePost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import FullscreenVideoModal from "../../components/FullscreenVideoModal";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import RemovalRequestsModal from "../../components/RemovalRequestsModal";
import EditorialPostCard from "../../components/EditorialPostCard";
import ShareModal from "../../components/ShareModal";
import SubmissionCommentsModal from "../../components/SubmissionCommentsModal";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveAccount } from "../../utils/accountManager";
import SnooLoader from "../../components/ui/SnooLoader";
import EventBus from "../../utils/EventBus";

const { width } = Dimensions.get("window");


const ChallengeSubmissionsScreen = ({ route, navigation }) => {


  const { post } = route.params;
  const typeData = post.type_data || {};

  const isFocused = useIsFocused();

  const [submissions, setSubmissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("submissions");
  const [filter, setFilter] = useState("approved");
  const [visibilityInfo, setVisibilityInfo] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [actionSheet, setActionSheet] = useState(null);
  const [showRemovalRequests, setShowRemovalRequests] = useState(false);
  const [pendingRemovalCount, setPendingRemovalCount] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  // Pre-fetched counts for each filter tab — shown immediately on all pills
  const [filterCounts, setFilterCounts] = useState({ approved: null, featured: null, pending: null });
  // Share modal
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedShareSubmission, setSelectedShareSubmission] = useState(null);
  // Submission comments modal — uses SubmissionCommentsModal (isolated from challenge post)
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedSubmissionAuthorName, setSelectedSubmissionAuthorName] = useState(null);
  // Reply in DMs sheet
  const [replyDMState, setReplyDMState] = useState({
    visible: false, submission: null, message: "", sending: false,
  });
  const lastTapRef = useRef({});

  // ── Video viewport tracking (mirrors HomeFeedScreen) ──────────────────────
  // Tracks the normalized post ID of whichever submission card is ≥60% in view.
  const [visiblePostId, setVisiblePostId] = useState(null);
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const lastVisiblePostIdRef = useRef(null);

  // Pause videos when screen loses focus, restore on return (same as HomeFeed)
  useEffect(() => {
    if (!isFocused) {
      if (visiblePostId) {
        lastVisiblePostIdRef.current = visiblePostId;
        setVisiblePostId(null);
      }
    } else if (isFocused && lastVisiblePostIdRef.current && !visiblePostId) {
      setVisiblePostId(lastVisiblePostIdRef.current);
      lastVisiblePostIdRef.current = null;
    }
  }, [isFocused, visiblePostId]);

  // 60% viewport coverage threshold — same as HomeFeedScreen
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
    waitForInteraction: false,
    minimumViewTime: 100,
  }).current;

  // Stable ref for recordSubmissionView so onViewableItemsChanged stays stable
  // (same ref-wrapper pattern used by HomeFeedScreen for handleDeleteRef).
  const recordSubmissionViewRef = useRef(null);

  // Empty dep array keeps this callback stable — it only touches state setters
  // (always-stable) and the ref above (not a reactive dep).
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (!viewableItems || viewableItems.length === 0) {
      setVisiblePostId(null);
      setVisibleIndex(-1);
      return;
    }

    // Record dwell views via the stable ref (fire-and-forget)
    viewableItems.forEach(({ item, isViewable }) => {
      if (isViewable && item?.id) {
        setTimeout(() => recordSubmissionViewRef.current?.(item.id), 2000);
      }
    });

    // Video autoplay — prefer video submissions, fall back to any visible item
    const videoItems = viewableItems.filter(
      (vi) => vi.isViewable && vi.item?.video_url,
    );
    const target = videoItems.length > 0
      ? videoItems[0]
      : viewableItems.find((vi) => vi.isViewable);

    if (target?.item) {
      setVisiblePostId(`sub_${target.item.id}`);
      setVisibleIndex(target.index);
    } else {
      setVisiblePostId(null);
      setVisibleIndex(-1);
    }
  }, []);

  // Preload the card immediately adjacent to the currently-playing one
  const shouldPreloadItem = useCallback((itemIndex) => {
    if (visibleIndex < 0) return false;
    return Math.abs(itemIndex - visibleIndex) === 1; // preload ±1
  }, [visibleIndex]);

  // Custom Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#2962FF",
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
        icon: icon || (isSuccess ? CheckCircle2 : isError ? XCircle : Info),
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
      icon: icon || (actionBtn?.style === "destructive" ? Trash2 : Info),
      iconColor: iconColor || (actionBtn?.style === "destructive" ? "#FF3B30" : COLORS.primary),
    });
    setAlertVisible(true);
  };

  const challengeEnded =
    post.expires_at && new Date(post.expires_at) <= new Date();


  // Check if current user is the challenge host
  useEffect(() => {
    const checkHost = async () => {
      try {
        const account = await getActiveAccount();
        if (account) {
          const match =
            account.id === post.author_id && account.type === post.author_type;
          console.log("[ChallengeSubmissions] checkHost:", {
            accountId: account.id,
            accountType: account.type,
            authorId: post.author_id,
            authorType: post.author_type,
            match,
          });
          setIsHost(match);
        }
      } catch (e) {
        console.error("[ChallengeSubmissions] checkHost error:", e);
      }
    };
    checkHost();
  }, [post.author_id, post.author_type]);

  // Load current user for card interactions
  useEffect(() => {
    getActiveAccount().then((account) => {
      if (account) {
        setCurrentUserId(account.id);
        setCurrentUserType(account.type);
      }
    }).catch(() => {});
  }, []);

  // Normalize a submission into an EditorialPostCard-compatible post shape
  const normalizeSubmissionToPost = useCallback((submission) => {
    const mediaUrls = Array.isArray(submission.media_urls) ? submission.media_urls : [];

    // When there's only a video and no photo attachments, populate image_urls with
    // the video URI so EditorialPostCard's `hasMedia` guard passes and the VideoPlayer
    // branch renders. The card reads `post.video_url` for the actual source, so this
    // just satisfies the hasMedia check without duplicating the payload.
    const imageUrlsForCard =
      mediaUrls.length === 0 && submission.video_url
        ? [submission.video_url]
        : mediaUrls;

    return {
      id: `sub_${submission.id}`,
      _submissionId: submission.id,
      _submission: submission,
      author_id: submission.participant_id,
      author_type: submission.participant_type,
      author_name: submission.participant_name,
      author_username: submission.participant_name,
      author_photo_url: submission.participant_photo_url,
      // EditorialPostCard renders post.caption for the description text
      caption: submission.content || "",
      content: submission.content || "",
      image_urls: imageUrlsForCard,
      // Explicitly tag the media type so EditorialPostCard's video branch fires
      // even for CDN URLs that don't have a file extension in the path.
      media_types: imageUrlsForCard.length > 0 && submission.video_url && mediaUrls.length === 0
        ? ["video"]
        : undefined,
      video_url: submission.video_url || null,
      video_thumbnail: submission.video_thumbnail || null,
      like_count: submission.like_count || 0,
      is_liked: submission.has_liked || false,
      comment_count: parseInt(submission.comment_count) || 0,
      public_view_count: submission.unique_view_count || 0, // Unique viewers
      view_count: submission.view_count || 0, // Total impressions
      share_count: parseInt(submission.share_count) || 0,
      is_saved: false,
      created_at: submission.created_at,
      post_type: "media",
    };
  }, []);



  const fetchSubmissions = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/challenge-submissions?filter=${filter}`,
          15000,
          token,
        );

        if (response.success) {
          const list = response.submissions || [];
          setSubmissions(list);
          setVisibilityInfo(response.visibility_info || null);
          // Keep the active filter's count in sync with real data
          setFilterCounts((prev) => ({ ...prev, [filter]: list.length }));
        }
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [post.id, filter],
  );

  // Pre-fetch counts for all three filters in parallel on mount
  useEffect(() => {
    const fetchAllFilterCounts = async () => {
      try {
        const token = await getAuthToken();
        const [approvedRes, featuredRes, pendingRes] = await Promise.allSettled([
          apiGet(`/posts/${post.id}/challenge-submissions?filter=approved`, 10000, token),
          apiGet(`/posts/${post.id}/challenge-submissions?filter=featured`, 10000, token),
          apiGet(`/posts/${post.id}/challenge-submissions?filter=pending`, 10000, token),
        ]);
        setFilterCounts({
          approved: approvedRes.status === "fulfilled" && approvedRes.value?.success
            ? (approvedRes.value.submissions || []).length : null,
          featured: featuredRes.status === "fulfilled" && featuredRes.value?.success
            ? (featuredRes.value.submissions || []).length : null,
          pending: pendingRes.status === "fulfilled" && pendingRes.value?.success
            ? (pendingRes.value.submissions || []).length : null,
        });
      } catch (e) {
        // Non-critical — pills will fall back gracefully
      }
    };
    fetchAllFilterCounts();
  }, [post.id]);

  // Fetch pending removal request count for the mail badge (host only)
  useEffect(() => {
    if (!isHost || !challengeEnded) return;
    const fetchRemovalCount = async () => {
      try {
        const token = await getAuthToken();
        const res = await apiGet(`/posts/${post.id}/removal-requests`, 10000, token);
        if (res.success) {
          setPendingRemovalCount((res.requests || []).length);
        }
      } catch (e) {
        // non-critical
      }
    };
    fetchRemovalCount();
  }, [isHost, challengeEnded, post.id]);

  const fetchParticipants = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await apiGet(
        `/posts/${post.id}/participants`,
        15000,
        token,
      );

      if (response.success) {
        setParticipants(response.participants || []);
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  }, [post.id]);

  useEffect(() => {
    if (activeTab === "submissions") {
      fetchSubmissions();
    } else {
      fetchParticipants();
    }
  }, [activeTab, fetchSubmissions, fetchParticipants]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === "submissions") {
      fetchSubmissions(false);
    } else {
      fetchParticipants();
      setIsRefreshing(false);
    }
  };

  const handleModerate = async (submissionId, newStatus) => {
    try {
      const token = await getAuthToken();
      await apiPatch(
        `/challenge-submissions/${submissionId}/status`,
        { status: newStatus },
        10000,
        token,
      );

      // Refresh the list
      fetchSubmissions(false);

      showAlert(
        "Success",
        newStatus === "approved"
          ? "Submission approved and now visible to everyone."
          : "Submission rejected.",
      );
    } catch (error) {
      console.error("Error moderating submission:", error);
      showAlert("Error", "Failed to update submission status.");
    }
  };

  const handleFeature = async (submissionId, currentlyFeatured) => {
    // Optimistic update — instantly reflect the change in the pill badge and submission list
    setFilterCounts((prev) => ({
      ...prev,
      featured: Math.max(0, (prev.featured ?? 0) + (currentlyFeatured ? -1 : 1)),
    }));
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId ? { ...s, is_featured: !currentlyFeatured } : s
      )
    );
    setActionSheet(null);

    try {
      const token = await getAuthToken();
      await apiPatch(
        `/challenge-submissions/${submissionId}/feature`,
        { is_featured: !currentlyFeatured },
        10000,
        token,
      );

      showAlert(
        "Success",
        !currentlyFeatured
          ? "Submission featured! ⭐"
          : "Submission unfeatured.",
      );
    } catch (error) {
      console.error("Error featuring submission:", error);
      // Revert optimistic updates on failure
      setFilterCounts((prev) => ({
        ...prev,
        featured: Math.max(0, (prev.featured ?? 0) + (currentlyFeatured ? 1 : -1)),
      }));
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, is_featured: currentlyFeatured } : s
        )
      );
      showAlert("Error", "Failed to update featured status.");
    }
  };

  // Withdraw own submission (while challenge is still active)
  const handleWithdraw = (submission, deleteSourcePost = false) => {
    const isLinked = !!submission.source_post_id;
    const title = deleteSourcePost
      ? "Withdraw & Delete Post"
      : "Withdraw Submission";
    const message = deleteSourcePost
      ? "Your submission will be removed from this challenge and your post will be deleted from your profile. You can re-submit before the challenge ends."
      : isLinked
        ? "Your submission will be removed from this challenge. Your post will stay on your profile — you can delete it there anytime. You can re-submit before the challenge ends."
        : "Your submission will be removed from this challenge. You can re-submit before the challenge ends.";

    showAlert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          // Optimistic: remove from list immediately
          setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
          setFilterCounts((prev) => ({
            ...prev,
            approved: Math.max(0, (prev.approved ?? 1) - 1),
          }));
          setActionSheet(null);

          try {
            const token = await getAuthToken();
            await apiPatch(
              `/challenge-submissions/${submission.id}/withdraw`,
              { delete_source_post: deleteSourcePost },
              10000,
              token,
            );
            showToast(
              "Submission withdrawn",
              deleteSourcePost
                ? "Your submission and post have been removed."
                : "Your submission has been removed. You can re-submit before the challenge ends.",
              "success",
            );
          } catch (error) {
            console.error("Error withdrawing submission:", error);
            // Revert optimistic removal
            fetchSubmissions(false);
            showAlert("Error", error?.message || "Failed to withdraw submission.");
          }
        },
      },
    ]);
  };

  const handleLike = async (submissionId, hasLiked) => {
    try {
      const token = await getAuthToken();

      // Optimistic update
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                like_count: hasLiked ? Math.max(0, s.like_count - 1) : s.like_count + 1,
                has_liked: !hasLiked,
              }
            : s,
        ),
      );
      
      setFullscreenImage((prev) => {
        if (prev && prev.id === submissionId) {
          return {
            ...prev,
            like_count: hasLiked ? Math.max(0, prev.like_count - 1) : prev.like_count + 1,
            has_liked: !hasLiked,
          };
        }
        return prev;
      });

      // Notify the challenge card teaser row instantly
      EventBus.emit("submission-liked", { postId: post.id, liked: !hasLiked });

      if (hasLiked) {
        await apiDelete(
          `/challenge-submissions/${submissionId}/like`,
          {},
          10000,
          token,
        );
      } else {
        await apiPost(
          `/challenge-submissions/${submissionId}/like`,
          {},
          10000,
          token,
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic updates on error
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                like_count: hasLiked ? s.like_count + 1 : Math.max(0, s.like_count - 1),
                has_liked: hasLiked,
              }
            : s,
        ),
      );
      EventBus.emit("submission-liked", { postId: post.id, liked: hasLiked });
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#34C759";
      case "in_progress":
        return "#2962FF";
      default:
        return COLORS.textSecondary;
    }
  };

  const handleRequestRemoval = async (submission) => {
    setActionSheet(null);
    showAlert(
      "Request Removal",
      "Since this challenge has ended, your submission can only be removed by the challenge host. Would you like to send a removal request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Removal",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              await apiPost(
                `/challenge-submissions/${submission.id}/request-removal`,
                { reason: "User requested removal" },
                15000,
                token,
              );
              showAlert(
                "Request Sent",
                "Your removal request has been sent to the challenge host. You'll be notified when they respond.",
              );
            } catch (error) {
              const errMsg =
                error?.response?.data?.error ||
                error.message ||
                "Failed to send request";
              showAlert("Error", errMsg);
            }
          },
        },
      ],
    );
  };


  // ── Submission-level comments — opens SubmissionCommentsModal ─────────────
  const openSubmissionComments = useCallback((submission) => {
    setSelectedSubmissionId(submission.id);
    setSelectedSubmissionAuthorName(submission.participant_name || null);
    setCommentsModalVisible(true);
  }, []);

  // ── Per-submission share tracking ────────────────────────────────
  const handleShareSubmission = useCallback(async (submission) => {
    setSelectedShareSubmission(submission);
    setShareModalVisible(true);
    // Fire-and-forget: increment submission-level share count (no ux block needed)
    try {
      const token = await getAuthToken();
      await apiPost(`/challenge-submissions/${submission.id}/share`, {}, 10000, token);
    } catch (e) {
      // Non-critical — don't surface errors to user
      console.warn("[ChallengeSubmissions] Failed to increment share count:", e);
    }
  }, []);

  // ── Per-submission view tracking ───────────────────────────────
  const viewedSubmissionsRef = useRef(new Set());
  const recordSubmissionView = useCallback(async (submissionId) => {
    if (viewedSubmissionsRef.current.has(submissionId)) return; // deduplicate
    viewedSubmissionsRef.current.add(submissionId);
    try {
      const token = await getAuthToken();
      await apiPost(`/challenge-submissions/${submissionId}/view`, {}, 10000, token);
    } catch (e) {
      console.warn("[ChallengeSubmissions] Failed to record view:", e);
    }
  }, []);

  // Keep ref in sync with the latest stable instance of recordSubmissionView
  recordSubmissionViewRef.current = recordSubmissionView;

  // ── Reply in DMs ──────────────────────────────────────────────────────────
  const sendReplyDM = useCallback(async () => {
    const { submission, message } = replyDMState;
    if (!submission) return;
    setReplyDMState((prev) => ({ ...prev, sending: true }));
    try {
      const token = await getAuthToken();
      await sharePost(
        post.id,
        [{ id: submission.participant_id, type: submission.participant_type }],
        "internal",
        message.trim() || null,
        token
      );
      setReplyDMState({ visible: false, submission: null, message: "", sending: false });
      showAlert("Sent!", `Your message was sent to ${submission.participant_name}.`);
    } catch (e) {
      setReplyDMState((prev) => ({ ...prev, sending: false }));
      showAlert("Error", e?.message || "Failed to send DM");
    }
  }, [replyDMState, post.id]);

  const renderSubmission = ({ item, index }) => {
    const normalizedPost = normalizeSubmissionToPost(item);
    return (
      <View style={{ position: "relative" }}>
        <EditorialPostCard
          post={normalizedPost}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          showFollowButton={false}
          navigation={navigation}
          // ── Video playback props — mirrors HomeFeedScreen ──
          isVideoPlaying={normalizedPost.id === visiblePostId}
          shouldPreload={shouldPreloadItem(index)}
          isInViewport={isFocused}
          isScreenFocused={isFocused}
          onUserPress={() => {
            if (item.participant_type === "community") {
              navigation.push("CommunityPublicProfile", { communityId: item.participant_id });
            } else {
              navigation.push("MemberPublicProfile", { memberId: item.participant_id });
            }
          }}
          onLike={() => handleLike(item.id, item.has_liked)}
          onComment={() => openSubmissionComments(item)}
          onShare={() => handleShareSubmission(item)}
          hideSave
          onSave={null}
          onDelete={null}
        />

        {/* ⋯ Options button — host sees it on all submissions; owners see it on their own */}
        {(isHost || item.is_own_submission) && (
          <TouchableOpacity
            style={styles.submissionOptionsBtn}
            onPress={() => setActionSheet({ submission: item })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.submissionOptionsBtnInner}>
              <MoreHorizontal size={18} color="#5B6B7C" />
            </View>
          </TouchableOpacity>
        )}

        {/* Gap 3: source_post_deleted — warn own submitter their post was deleted */}
        {item.is_own_submission && item.source_post_deleted && (
          <View style={styles.sourceDeletedBanner}>
            <Info size={14} color="#92400E" />
            <Text style={styles.sourceDeletedBannerText}>
              Your linked post was deleted, so this submission was also removed from the challenge.
            </Text>
          </View>
        )}

        {/* Status badges */}
        {(item.is_featured || (item.is_own_submission && item.status !== "approved")) && (
          <View style={styles.submissionBadgeRow}>
            {item.is_featured && (
              <View style={styles.featuredBadgeInline}>
                <Star size={11} color="#FFD700" fill="#FFD700" />
                <Text style={styles.featuredBadgeInlineText}>Featured</Text>
              </View>
            )}
            {item.is_own_submission && item.status === "pending" && (
              <View style={styles.pendingBadgeInline}>
                <Clock size={11} color={COLORS.primary} />
                <Text style={styles.pendingBadgeInlineText}>Pending approval</Text>
              </View>
            )}
            {item.is_own_submission && item.status === "rejected" && (
              <View style={styles.rejectedBadgeInline}>
                <XCircle size={11} color={COLORS.error} />
                <Text style={styles.rejectedBadgeInlineText}>Rejected</Text>
              </View>
            )}
          </View>
        )}
        {/* Host moderation row */}
        {isHost && filter === "pending" && item.status === "pending" && (
          <View style={styles.moderateRow}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleModerate(item.id, "approved")}
            >
              <CheckCircle2 size={16} color="#FFFFFF" />
              <Text style={styles.moderateButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleModerate(item.id, "rejected")}
            >
              <XCircle size={16} color="#FFFFFF" />
              <Text style={styles.moderateButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderParticipant = ({ item }) => {

    return (
      <View style={styles.participantCard}>
        <View style={styles.participantInfo}>
          {item.participant_photo_url ? (
            <Image
              source={{ uri: item.participant_photo_url }}
              style={styles.participantAvatar}
            />
          ) : (
            <View style={styles.participantAvatarPlaceholder}>
              <User size={20} color={COLORS.textSecondary} />
            </View>
          )}
          <View style={styles.participantDetails}>
            <Text style={styles.participantName}>
              {item.participant_name || "Participant"}
            </Text>
            <Text style={styles.participantJoined}>
              Joined {formatTimeAgo(item.joined_at)}
            </Text>
          </View>
          {item.is_highlighted && (
            <View style={styles.highlightBadge}>
              <Star size={12} color="#FFD700" fill="#FFD700" />
            </View>
          )}
        </View>

        {/* Progress (for progress challenges) */}
        {typeData.challenge_type === "progress" && (
          <View style={styles.participantProgress}>
            <View style={styles.progressBarSmall}>
              <View
                style={[
                  styles.progressBarFillSmall,
                  { width: `${item.progress || 0}%` },
                ]}
              />
            </View>
            <Text style={styles.progressPercentText}>
              {item.progress || 0}%
            </Text>
          </View>
        )}

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + "20" },
          ]}
        >
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status === "completed"
              ? "Completed"
              : item.status === "in_progress"
                ? "In Progress"
                : "Joined"}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "submissions" && styles.tabActive]}
          onPress={() => setActiveTab("submissions")}
        >
          <ImageIcon
            size={18}
            color={
              activeTab === "submissions" ? "#2962FF" : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "submissions" && styles.tabTextActive,
            ]}
          >
            Submissions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "participants" && styles.tabActive]}
          onPress={() => setActiveTab("participants")}
        >
          <Users
            size={18}
            color={
              activeTab === "participants" ? "#2962FF" : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "participants" && styles.tabTextActive,
            ]}
          >
            Participants
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter (for submissions) */}
      {activeTab === "submissions" && (
        <View style={styles.filterRow}>
          {/* All */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === "approved" && styles.filterPillActive,
            ]}
            onPress={() => setFilter("approved")}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === "approved" && styles.filterPillTextActive,
              ]}
            >
              All
            </Text>
            <View style={[
              styles.innerBadge,
              filter === "approved" && styles.innerBadgeActive
            ]}>
              <Text style={[
                styles.innerBadgeText,
                filter === "approved" && styles.innerBadgeTextActive
              ]}>
                {filter === "approved"
                  ? submissions.length
                  : (filterCounts.approved ?? (post.submissions_count || 0))}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Featured */}
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === "featured" && styles.filterPillActive,
            ]}
            onPress={() => setFilter("featured")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
              <Star
                size={12}
                color={filter === "featured" ? "#FFFFFF" : "#1D1D1F"}
                fill={filter === "featured" ? "#FFFFFF" : "transparent"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  filter === "featured" && styles.filterPillTextActive,
                  { marginRight: 0 },
                ]}
              >
                Featured
              </Text>
            </View>
            {filterCounts.featured !== null && (
              <View style={[styles.innerBadge, filter === "featured" && styles.innerBadgeActive]}>
                <Text style={[styles.innerBadgeText, filter === "featured" && styles.innerBadgeTextActive]}>
                  {filter === "featured" ? submissions.length : filterCounts.featured}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Pending — visible only to challenge host */}
          {isHost && (
            <TouchableOpacity
              style={[
                styles.filterPill,
                filter === "pending" && styles.filterPillActive,
              ]}
              onPress={() => setFilter("pending")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
                <Clock
                  size={12}
                  color={filter === "pending" ? "#FFFFFF" : "#1D1D1F"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    filter === "pending" && styles.filterPillTextActive,
                    { marginRight: 0 },
                  ]}
                >
                  Pending
                </Text>
              </View>
              {filterCounts.pending !== null && (
                <View style={[styles.innerBadge, filter === "pending" && styles.innerBadgeActive]}>
                  <Text style={[styles.innerBadgeText, filter === "pending" && styles.innerBadgeTextActive]}>
                    {filter === "pending" ? submissions.length : filterCounts.pending}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Gap 2: My Submission pinned status banner ── */}
      {activeTab === "submissions" && (() => {
        const mySubmission = submissions.find((s) => s.is_own_submission);
        if (!mySubmission) return null;
        const statusConfig = {
          featured:  { icon: "star",    color: "#B8860B", bg: "#FFF8E1", border: "#FFD700", label: "Your submission is Featured ⭐" },
          approved:  { icon: "check",   color: "#2E7D32", bg: "#F0FFF4", border: "#34C759", label: "Your submission is Approved" },
          pending:   { icon: "clock",   color: "#B45309", bg: "#FFFBEB", border: "#FF9500", label: "Your submission is Pending review" },
          withdrawn: { icon: "minus",   color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", label: "Your submission was Withdrawn" },
          rejected:  { icon: "x",       color: "#DC2626", bg: "#FFF0F0", border: "#FF3B30", label: "Your submission was Not approved" },
        };
        const cfg = statusConfig[mySubmission.status] || statusConfig.pending;
        return (
          <TouchableOpacity
            style={[styles.mySubmissionBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
            onPress={() => {
              // Scroll to or highlight their submission — for now navigate to it
            }}
            activeOpacity={0.85}
          >
            {mySubmission.status === "featured" ? (
              <Star size={16} color={cfg.color} fill={cfg.color} />
            ) : mySubmission.status === "approved" ? (
              <CheckCircle2 size={16} color={cfg.color} />
            ) : mySubmission.status === "rejected" ? (
              <XCircle size={16} color={cfg.color} />
            ) : mySubmission.status === "withdrawn" ? (
              <MinusCircle size={16} color={cfg.color} />
            ) : (
              <Clock size={16} color={cfg.color} />
            )}
            <Text style={[styles.mySubmissionBannerText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })()}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      {/* Show visibility info message when proofs are hidden */}
      {activeTab === "submissions" &&
        visibilityInfo &&
        !visibilityInfo.proofs_visible && (
          <View style={styles.visibilityInfoContainer}>
            <EyeOff size={32} color="#2962FF" />
            <Text style={styles.visibilityInfoTitle}>
              Proofs are currently hidden
            </Text>
            <Text style={styles.visibilityInfoText}>
              {visibilityInfo.reason ||
                "Proofs will be visible after the challenge ends"}
            </Text>
            {visibilityInfo.expires_at && (
              <Text style={styles.visibilityInfoSubtext}>
                Ends: {new Date(visibilityInfo.expires_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      {(activeTab !== "submissions" ||
        !visibilityInfo ||
        visibilityInfo.proofs_visible) && (
        <>
          {activeTab === "submissions" ? (
            <ImageOff size={48} color={COLORS.textSecondary} strokeWidth={1.5} />
          ) : (
            <Users size={48} color={COLORS.textSecondary} strokeWidth={1.5} />
          )}
          <Text style={styles.emptyTitle}>
            {activeTab === "submissions"
              ? "No submissions yet"
              : "No participants yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "submissions"
              ? "Be the first to submit proof!"
              : "Join the challenge to get started"}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Challenge</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {typeData.title} • by {post.author_name}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isHost && challengeEnded && (
            <TouchableOpacity
              style={styles.removalRequestsButton}
              onPress={() => {
                setShowRemovalRequests(true);
                setPendingRemovalCount(0); // clear badge when opened
              }}
            >
              <Mail size={20} color={pendingRemovalCount > 0 ? "#FF3B30" : "#2962FF"} />
              {pendingRemovalCount > 0 && (
                <View style={styles.mailBadge}>
                  <Text style={styles.mailBadgeText}>
                    {pendingRemovalCount > 9 ? "9+" : pendingRemovalCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {activeTab === "participants" && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {participants.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color="#2962FF" />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: COLORS.screenBackground }}
          data={activeTab === "submissions" ? submissions : participants}
          renderItem={
            activeTab === "submissions" ? renderSubmission : renderParticipant
          }
          keyExtractor={(item) => `${activeTab}-${item.id}`}
          key={activeTab}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            activeTab === "participants" && { paddingHorizontal: 0 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#2962FF"
            />
          }
          // ── Video optimisation — mirrors HomeFeedScreen ──────────────────
          removeClippedSubviews={false}
          windowSize={8}
          maxToRenderPerBatch={3}
          initialNumToRender={3}
          updateCellsBatchingPeriod={50}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

      )}


      {/* FAB for Submit */}
      {(post.has_joined && !post.expires_at) ||
      (post.expires_at && new Date(post.expires_at) > new Date()) ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("ChallengeSubmit", { post })}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      {/* FullscreenVideoModal is rendered inside EditorialPostCard itself —
           tapping the fullscreen button on any video card opens it automatically.
           No screen-level modal is needed here. */}

      {/* Fullscreen Image Modal (Rich Detail View) */}
      <Modal
        visible={!!fullscreenImage}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <SafeAreaView style={styles.detailModalContainer} edges={["top", "bottom"]}>
          {fullscreenImage && (
            <>
              {/* Header */}
              <View style={styles.detailHeader}>
                <TouchableOpacity 
                  style={styles.detailAuthorInfo} 
                  onPress={() => {
                    setFullscreenImage(null);
                    if (fullscreenImage.participant_type === "community") {
                      navigation.push("CommunityPublicProfile", {
                        communityId: fullscreenImage.participant_id,
                      });
                    } else {
                      navigation.push("MemberPublicProfile", {
                        memberId: fullscreenImage.participant_id,
                      });
                    }
                  }}
                >
                  {fullscreenImage.participant_photo_url ? (
                    <Image
                      source={{ uri: fullscreenImage.participant_photo_url }}
                      style={styles.detailAvatar}
                    />
                  ) : (
                    <View style={styles.detailAvatarPlaceholder}>
                      <User size={16} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <View>
                    <Text style={styles.detailAuthorName}>
                      {fullscreenImage.participant_name || "User"}
                    </Text>
                    <Text style={styles.detailTimeAgo}>
                      {formatTimeAgo(fullscreenImage.created_at)}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailCloseBtn}
                  onPress={() => setFullscreenImage(null)}
                >
                  <X size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Media */}
                <View style={styles.detailMediaContainer}>
                  <Image
                    source={{ uri: fullscreenImage.media_urls?.[0] }}
                    style={styles.detailImage}
                    resizeMode="contain"
                  />
                </View>

                {/* Action Bar */}
                <View style={styles.detailActionBar}>
                  <View style={styles.detailActionGroup}>
                    <TouchableOpacity 
                      style={styles.detailActionBtn}
                      onPress={() => handleLike(fullscreenImage.id, fullscreenImage.has_liked)}
                    >
                      <Heart
                        size={24}
                        color={fullscreenImage.has_liked ? COLORS.error : COLORS.textPrimary}
                        fill={fullscreenImage.has_liked ? COLORS.error : "transparent"}
                      />
                      {fullscreenImage.like_count > 0 && (
                        <Text style={styles.detailActionText}>
                          {fullscreenImage.like_count}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.detailActionBtn}>
                      <MessageCircle size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.detailActionBtn}>
                      <ChartNoAxesCombined size={24} color={COLORS.textPrimary} />
                      <Text style={styles.detailActionText}>
                        {fullscreenImage.view_count || fullscreenImage.views || 0}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.detailActionBtn}>
                      <Send size={24} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Caption */}
                {fullscreenImage.content ? (
                  <View style={styles.detailCaptionContainer}>
                    <Text style={styles.detailCaptionText}>
                      <Text style={styles.detailCaptionName}>
                        {fullscreenImage.participant_name}
                      </Text>
                      {" "}{fullscreenImage.content}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Reply Bar */}
              <View style={styles.detailReplyBar}>
                <View style={styles.detailReplyAvatarPlaceholder}>
                  <User size={16} color={COLORS.textSecondary} />
                </View>
                <TouchableOpacity style={styles.detailReplyInput}>
                  <Text style={styles.detailReplyPlaceholder}>
                    Reply to {fullscreenImage?.participant_name || "User"} in DM's
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Action Sheet Modal */}
      <Modal
        visible={!!actionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheet(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheet(null)}
        >
          <View style={styles.actionSheetContainer}>
            <Text style={styles.actionSheetTitle}>Submission Options</Text>
            {/* Feature/Unfeature option for host on approved submissions */}
            {isHost && actionSheet?.submission?.status === "approved" && (
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() =>
                  handleFeature(
                    actionSheet.submission.id,
                    actionSheet.submission.is_featured,
                  )
                }
              >
                <Star
                  size={20}
                  color="#FFD700"
                  fill={actionSheet.submission.is_featured ? "transparent" : "#FFD700"}
                />
                <Text style={styles.actionSheetButtonText}>
                  {actionSheet.submission.is_featured
                    ? "Unfeature Submission"
                    : "Feature Submission ⭐"}
                </Text>
              </TouchableOpacity>
            )}
            {/* ── ENDED CHALLENGE: Request Removal ── */}
            {challengeEnded && actionSheet?.submission?.is_own_submission && (
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => handleRequestRemoval(actionSheet.submission)}
              >
                <Trash2 size={20} color="#FF3B30" />
                <Text style={[styles.actionSheetButtonText, { color: "#FF3B30" }]}>
                  Request Removal
                </Text>
              </TouchableOpacity>
            )}

            {/* ── ACTIVE CHALLENGE: Edit & Resubmit for rejected ── */}
            {!challengeEnded &&
              actionSheet?.submission?.is_own_submission &&
              actionSheet?.submission?.status === "rejected" && (
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => {
                  setActionSheet(null);
                  navigation.navigate("ChallengeSubmit", {
                    post,
                    participation: null,
                    prefillContent: actionSheet.submission.content || "",
                    prefillMediaUrls: actionSheet.submission.media_urls || [],
                    onSubmitSuccess: () => fetchSubmissions(false),
                  });
                }}
              >
                <Edit2 size={20} color="#2962FF" />
                <Text style={[styles.actionSheetButtonText, { color: "#2962FF" }]}>
                  Edit & Resubmit
                </Text>
              </TouchableOpacity>
            )}

            {/* ── ACTIVE CHALLENGE: Withdraw options ── */}
            {!challengeEnded && actionSheet?.submission?.is_own_submission && (
              <>
                {/* Divider */}
                <View style={styles.actionSheetDivider} />

                {/* Withdraw Submission — always visible for own submission */}
                <TouchableOpacity
                  style={styles.actionSheetButton}
                  onPress={() => handleWithdraw(actionSheet.submission, false)}
                >
                  <MinusCircle size={20} color="#FF9500" />
                  <Text style={[styles.actionSheetButtonText, { color: "#FF9500" }]}>
                    Withdraw Submission
                  </Text>
                </TouchableOpacity>

                {/* Withdraw & Delete Post — only for linked (Method 2) submissions */}
                {actionSheet?.submission?.source_post_id && (
                  <TouchableOpacity
                    style={styles.actionSheetButton}
                    onPress={() => handleWithdraw(actionSheet.submission, true)}
                  >
                    <Trash2 size={20} color="#FF3B30" />
                    <Text style={[styles.actionSheetButtonText, { color: "#FF3B30" }]}>
                      Withdraw & Delete Post
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Hint for linked submissions: post stays unless explicitly deleted */}
                {actionSheet?.submission?.source_post_id && (
                  <View style={styles.actionSheetInfoRow}>
                    <Info size={15} color="#9CA3AF" />
                    <Text style={styles.actionSheetInfoText}>
                      "Withdraw" removes from this challenge only. Your post stays on your profile until you delete it.
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.actionSheetButton, styles.actionSheetCancel]}
              onPress={() => setActionSheet(null)}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Removal Requests Modal (for challenge host) */}
      <RemovalRequestsModal
        visible={showRemovalRequests}
        onClose={() => setShowRemovalRequests(false)}
        postId={post.id}
        onRequestReviewed={() => {
          fetchSubmissions(false);
          setPendingRemovalCount((c) => Math.max(0, c - 1));
        }}
        onContactUser={(submissionLike) => {
          // Open the existing DM sheet with the requester as recipient
          setReplyDMState({
            visible: true,
            submission: submissionLike,
            message: "",
            sending: false,
          });
        }}
      />

      {/* Share Modal — passes the submission's parent post for share context */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => {
          setShareModalVisible(false);
          setSelectedShareSubmission(null);
        }}
        post={selectedShareSubmission ? { ...post, id: post.id } : post}
      />

      {/* Submission Comments Modal — isolated from challenge post's comment count */}
      <SubmissionCommentsModal
        visible={commentsModalVisible}
        submissionId={selectedSubmissionId}
        submissionAuthorName={selectedSubmissionAuthorName}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedSubmissionId(null);
          setSelectedSubmissionAuthorName(null);
        }}
        onCommentCountChange={(count) => {
          // Update the local submission's comment_count so the card refreshes
          setSubmissions((prev) =>
            prev.map((s) =>
              s.id === selectedSubmissionId ? { ...s, comment_count: count } : s
            )
          );
          // Notify challenge card teaser row so it updates instantly
          EventBus.emit("submission-comment-added", { postId: post.id, submissionId: selectedSubmissionId, count });
        }}
      />

      {/* Reply in DMs Sheet */}
      <Modal
        visible={replyDMState.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyDMState((p) => ({ ...p, visible: false }))}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.commentsOverlay}
            activeOpacity={1}
            onPress={() => setReplyDMState((p) => ({ ...p, visible: false }))}
          />
          <View style={styles.commentsSheet}>
            <View style={styles.commentsHandle} />
            <View style={styles.dmHeader}>
              {replyDMState.submission?.participant_photo_url ? (
                <Image source={{ uri: replyDMState.submission.participant_photo_url }} style={styles.dmAvatar} />
              ) : (
                <View style={styles.dmAvatarFallback}><User size={16} color={COLORS.textSecondary} /></View>
              )}
              <View>
                <Text style={styles.dmTitle}>Reply in DMs</Text>
                <Text style={styles.dmSubtitle}>{replyDMState.submission?.participant_name}</Text>
              </View>
            </View>
            <View style={styles.commentsInputRow}>
              <TextInput
                style={[styles.commentsInput, { flex: 1 }]}
                placeholder="Add a message (optional)…"
                placeholderTextColor={COLORS.textSecondary}
                value={replyDMState.message}
                onChangeText={(t) => setReplyDMState((p) => ({ ...p, message: t }))}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.commentsSendBtn, replyDMState.sending && styles.commentsSendBtnDisabled]}
                onPress={sendReplyDM}
                disabled={replyDMState.sending}
              >
                <Send size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: SPACING.s,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: FONTS.black,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  removalRequestsButton: {
    padding: 4,
    position: "relative",
  },
  mailBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  mailBadgeText: {
    fontSize: 9,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
    lineHeight: 11,
  },
  countBadge: {
    backgroundColor: "#2962FF15",
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.m,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#2962FF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  // Header Section
  headerContainer: {
    backgroundColor: COLORS.surface,
    paddingTop: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.m,
    marginBottom: SPACING.m,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: SPACING.xs,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.s,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2962FF",
  },
  tabText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  tabTextActive: {
    color: "#2962FF",
  },
  filterRow: {
    flexDirection: "row",
    marginTop: SPACING.m,
    marginBottom: SPACING.m,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6, // Smaller padding on the right to hug the badge tightly
    paddingVertical: 6,
    borderRadius: 24, // High border radius to contain the circular badge perfectly
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: SPACING.s,
    height: 36, // Fixed height ensures perfect alignment
  },
  filterPillActive: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#1D1D1F",
    marginRight: 8, // Space between text and badge
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  innerBadge: {
    backgroundColor: "#F3F4F6", // Soft grey for inactive state
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  innerBadgeActive: {
    backgroundColor: "#333333", // Deep grey inside black pill
  },
  innerBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: "#4B5563",
  },
  innerBadgeTextActive: {
    color: "#FFFFFF",
  },
  // submissionCard is no longer used — replaced by EditorialPostCard

  submissionImage: {
    width: "100%",
    height: "100%",
  },
  videoContainer: {
    flex: 1,
    position: "relative",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  textSubmissionCard: {
    flex: 1,
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    justifyContent: "center",
  },
  textSubmissionContent: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  featuredBadge: {
    position: "absolute",
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: "#FFF8E1",
    padding: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    position: "absolute",
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: "rgba(255,149,0,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rejectedBadge: {
    position: "absolute",
    top: SPACING.xs,
    left: SPACING.xs,
    backgroundColor: "rgba(255,59,48,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rejectedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submissionFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: SPACING.s,
    paddingTop: 40, // Height for gradient transition
  },
  submissionAuthor: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: SPACING.xs,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  authorName: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: SPACING.xs,
  },
  likeCount: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    marginLeft: 4,
  },
  // Moderation buttons (host-only, pending submissions)
  moderateRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.xs,
    gap: 6,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759",
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.s,
    gap: 4,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.s,
    gap: 4,
  },
  moderateButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Participant Card
  participantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.m,
    paddingVertical: 12,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.s,
  },
  participantAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  participantJoined: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  highlightBadge: {
    backgroundColor: "#FFF8E1",
    padding: 4,
    borderRadius: 12,
    marginLeft: SPACING.xs,
  },
  participantProgress: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.m,
    width: 80,
  },
  progressBarSmall: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 6,
  },
  progressBarFillSmall: {
    height: "100%",
    backgroundColor: "#2962FF",
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2962FF",
  },
  statusBadge: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  // Visibility info styles
  visibilityInfoContainer: {
    alignItems: "center",
    padding: SPACING.l,
    backgroundColor: "#FFF8E1",
    borderRadius: BORDER_RADIUS.l,
    marginHorizontal: SPACING.m,
  },
  visibilityInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2962FF",
    marginTop: SPACING.s,
    textAlign: "center",
  },
  visibilityInfoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  visibilityInfoSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2962FF",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.md,
  },
  // Detail Modal Styles
  detailModalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailAuthorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.s,
  },
  detailAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
  },
  detailAuthorName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  detailTimeAgo: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailCloseBtn: {
    padding: 4,
  },
  detailMediaContainer: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.screenBackground,
  },
  detailImage: {
    width: "100%",
    height: "100%",
  },
  detailActionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
  },
  detailActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.l,
  },
  detailActionBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailActionText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginLeft: 6,
  },
  detailCaptionContainer: {
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.m,
  },
  detailCaptionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  detailCaptionName: {
    fontFamily: FONTS.bold,
  },
  detailReplyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailReplyAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
  },
  detailReplyInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.screenBackground,
    borderRadius: 20,
    paddingHorizontal: SPACING.m,
    justifyContent: "center",
  },
  detailReplyPlaceholder: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  // Deleted post indicator
  deletedOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  deletedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#999",
  },
  // Action Sheet
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  actionSheetContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: "center",
  },
  actionSheetButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    backgroundColor: "#F8F8F8",
  },
  actionSheetButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  actionSheetInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  actionSheetInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#999",
    lineHeight: 18,
  },
  actionSheetCancel: {
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 6,
  },

  // ── My Submission banner (Gap 2) ───────────────────────────────────────────────
  mySubmissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mySubmissionBannerText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    flex: 1,
  },

  // ── Source post deleted banner (Gap 3) ───────────────────────────────────────
  sourceDeletedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#FFF8ED",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  sourceDeletedBannerText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#92400E",
    flex: 1,
    lineHeight: 17,
  },

  // ── New inline badge styles ─────────────────────────────────────────────
  submissionBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: SPACING.m,
    paddingTop: 6,
    paddingBottom: 10,
  },
  featuredBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF8E1",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  submissionOptionsBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  submissionOptionsBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  featuredBadgeInlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B8860B",
  },
  pendingBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  pendingBadgeInlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3730A3",
  },
  rejectedBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectedBadgeInlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
  },

  // ── Comments & DM Sheet ──────────────────────────────────────────────────
  commentsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  commentsSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.m,
    paddingBottom: 24,
    maxHeight: "80%",
    minHeight: 300,
  },
  commentsHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  commentsList: {
    maxHeight: 320,
  },
  commentsEmpty: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: 14,
    paddingVertical: 24,
  },
  commentsLoading: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
  },
  commentAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  commentBubble: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  commentDelete: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  commentsInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commentsInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#F5F5F7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  commentsSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2962FF",
    justifyContent: "center",
    alignItems: "center",
  },
  commentsSendBtnDisabled: {
    opacity: 0.4,
  },
  // DM sheet
  dmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  dmAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  dmAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  dmTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  dmSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});

export default ChallengeSubmissionsScreen;

