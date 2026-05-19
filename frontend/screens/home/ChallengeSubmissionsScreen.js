import { useFocusEffect } from "@react-navigation/native";
/**
 * ChallengeSubmissionsScreen
 * Gallery view of all submissions for a challenge
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl, Dimensions, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from "react-native";
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
  Trophy
} from "lucide-react-native";
import { apiGet, apiPost, apiDelete, apiPatch, sharePost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import FullscreenVideoModal from "../../components/FullscreenVideoModal";
import RemovalRequestsModal from "../../components/RemovalRequestsModal";
import EditorialPostCard from "../../components/EditorialPostCard";
import ShareModal from "../../components/ShareModal";
import SubmissionCommentsModal from "../../components/SubmissionCommentsModal";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveAccount } from "../../utils/accountManager";
import SnooLoader from "../../components/ui/SnooLoader";

const { width } = Dimensions.get("window");


const ChallengeSubmissionsScreen = ({ route, navigation }) => {


  const { post } = route.params;
  const typeData = post.type_data || {};

  const [submissions, setSubmissions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("submissions");
  const [filter, setFilter] = useState("approved");
  const [visibilityInfo, setVisibilityInfo] = useState(null);
  const [fullscreenVideo, setFullscreenVideo] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [actionSheet, setActionSheet] = useState(null);
  const [showRemovalRequests, setShowRemovalRequests] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
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
    return {
      id: `sub_${submission.id}`,
      _submissionId: submission.id,
      _submission: submission,
      author_id: submission.participant_id,
      author_type: submission.participant_type,
      author_name: submission.participant_name,
      author_username: submission.participant_name,
      author_photo_url: submission.participant_photo_url,
      content: submission.content || "",
      image_urls: mediaUrls,
      video_url: submission.video_url || null,
      video_thumbnail: submission.video_thumbnail || null,
      like_count: submission.like_count || 0,
      is_liked: submission.has_liked || false,
      comment_count: parseInt(submission.comment_count) || 0,
      public_view_count: submission.view_count || 0,
      view_count: submission.view_count || 0,
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
          setSubmissions(response.submissions || []);
          setVisibilityInfo(response.visibility_info || null);
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

      Alert.alert(
        "Success",
        newStatus === "approved"
          ? "Submission approved and now visible to everyone."
          : "Submission rejected.",
      );
    } catch (error) {
      console.error("Error moderating submission:", error);
      Alert.alert("Error", "Failed to update submission status.");
    }
  };

  const handleFeature = async (submissionId, currentlyFeatured) => {
    try {
      const token = await getAuthToken();
      await apiPatch(
        `/challenge-submissions/${submissionId}/feature`,
        { is_featured: !currentlyFeatured },
        10000,
        token,
      );

      fetchSubmissions(false);
      setActionSheet(null);

      Alert.alert(
        "Success",
        !currentlyFeatured
          ? "Submission featured! ⭐"
          : "Submission unfeatured.",
      );
    } catch (error) {
      console.error("Error featuring submission:", error);
      Alert.alert("Error", "Failed to update featured status.");
    }
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
      fetchSubmissions(false);
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
    Alert.alert(
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
              Alert.alert(
                "Request Sent",
                "Your removal request has been sent to the challenge host. You'll be notified when they respond.",
              );
            } catch (error) {
              const errMsg =
                error?.response?.data?.error ||
                error.message ||
                "Failed to send request";
              Alert.alert("Error", errMsg);
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
      Alert.alert("Sent!", `Your message was sent to ${submission.participant_name}.`);
    } catch (e) {
      setReplyDMState((prev) => ({ ...prev, sending: false }));
      Alert.alert("Error", e?.message || "Failed to send DM");
    }
  }, [replyDMState, post.id]);

  const renderSubmission = ({ item }) => {
    const normalizedPost = normalizeSubmissionToPost(item);
    return (
      <View>
        <EditorialPostCard
          post={normalizedPost}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          showFollowButton={false}
          navigation={navigation}
          isInViewport={true}
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
                {filter === "approved" ? submissions.length : (post.submissions_count || 0)}
              </Text>
            </View>
          </TouchableOpacity>
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
                  { marginRight: 0 } // Reset margin since badge handles spacing
                ]}
              >
                Featured
              </Text>
            </View>
            {/* Show badge for featured only when active since we only know count when filtered */}
            {filter === "featured" && (
              <View style={[styles.innerBadge, styles.innerBadgeActive]}>
                <Text style={[styles.innerBadgeText, styles.innerBadgeTextActive]}>
                  {submissions.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Pending filter pill — visible only to challenge host */}
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
                    { marginRight: 0 }
                  ]}
                >
                  Pending
                </Text>
              </View>
              {filter === "pending" && (
                <View style={[styles.innerBadge, styles.innerBadgeActive]}>
                  <Text style={[styles.innerBadgeText, styles.innerBadgeTextActive]}>
                    {submissions.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
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
              onPress={() => setShowRemovalRequests(true)}
            >
              <Mail size={20} color="#2962FF" />
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
          onViewableItemsChanged={({ viewableItems }) => {
            if (activeTab !== "submissions") return;
            viewableItems.forEach(({ item, isViewable }) => {
              if (isViewable && item?.id) {
                // 2-second dwell before counting as a view
                setTimeout(() => recordSubmissionView(item.id), 2000);
              }
            });
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
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

      {/* Fullscreen Video Modal */}
      {fullscreenVideo && (
        <FullscreenVideoModal
          visible={!!fullscreenVideo}
          source={{ uri: fullscreenVideo.uri }}
          onClose={() => setFullscreenVideo(null)}
          initialMuted={false}
          aspectRatio={9 / 16}
        />
      )}

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
            {challengeEnded && actionSheet?.submission?.is_own_submission && (
              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={() => handleRequestRemoval(actionSheet.submission)}
              >
                <Trash2 size={20} color="#FF3B30" />
                <Text
                  style={[styles.actionSheetButtonText, { color: "#FF3B30" }]}
                >
                  Request Removal
                </Text>
              </TouchableOpacity>
            )}
            {!challengeEnded && actionSheet?.submission?.is_own_submission && (
              <View style={styles.actionSheetInfoRow}>
                <Info
                  size={18}
                  color="#999"
                />
                <Text style={styles.actionSheetInfoText}>
                  Delete the original post to remove this submission while the
                  challenge is active.
                </Text>
              </View>
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
        onRequestReviewed={() => fetchSubmissions(false)}
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

