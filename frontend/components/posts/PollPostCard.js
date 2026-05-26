/**
 * PollPostCard
 * Displays a poll post with voting functionality
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  Ellipsis,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Pin,
  Pencil,
  Trash2,
} from "lucide-react-native";
import EventBus from "../../utils/EventBus";
import CountdownTimer from "../CountdownTimer";
import { getExtensionBadgeText } from "../../utils/cardTiming";
import SnooLoader from "../ui/SnooLoader";
import { viewQueueService } from "../../services/ViewQueueService";
import { useToast } from "../../context/ToastContext";

const PollPostCard = ({
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
  const { showToast } = useToast();
  const typeData = post.type_data || {};
  const [hasVoted, setHasVoted] = useState(post.has_voted || false);
  const [votedIndexes, setVotedIndexes] = useState(post.voted_indexes || []);
  const [options, setOptions] = useState(typeData.options || []);
  const [totalVotes, setTotalVotes] = useState(typeData.total_votes || 0);
  const [isVoting, setIsVoting] = useState(false);
  const [votingIndex, setVotingIndex] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVotersModal, setShowVotersModal] = useState(false);
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
      icon: icon || (actionBtn?.style === "destructive" ? AlertTriangle : Info),
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

  // ── View Tracking ──────────────────────────────────────────────────────────
  const [viewCount, setViewCount] = useState(post.public_view_count || post.view_count || 0);
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
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
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
      // If server says "already saved", our local state was wrong — correct it
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
        { option_index: optionIndex },
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

  const handleUserPress = () => {
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
              <MaterialCommunityIcons
                name="check-bold"
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
      <View style={styles.container}>
        {/* Header with Type Indicator & Ellipsis Menu */}
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
            <TouchableOpacity
              style={styles.pollIconContainer}
              onPress={() => setShowVotersModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="stats-chart" size={24} color="#3b65e4" />
            </TouchableOpacity>
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

        {/* Poll Options */}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => renderOption(option, index))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
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
            {likeCount > 0 && (
              <Text
                style={[styles.engagementCount, isLiked && styles.likedCount]}
              >
                {formatCount(likeCount)}
              </Text>
            )}
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
            <Text style={styles.engagementCount}>
              {formatCount(viewCount)}
            </Text>
          </View>

          {/* Share */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleShare}
          >
            <Send size={22} color="#5e8d9b" />
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
              size={22}
              color="#5e8d9b"
              fill={isSaved ? "#5e8d9b" : "transparent"}
            />
            {saveCount > 0 && (
              <Text style={styles.engagementCount}>
                {formatCount(saveCount)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {renderModal()}

      {/* Poll Voters Modal */}
      <PollVotersModal
        visible={showVotersModal}
        onClose={() => setShowVotersModal(false)}
        postId={post.id}
        options={options}
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
};

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
    fontFamily: "BasicCommercial-Bold",
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
    fontSize: 14,
    fontWeight: "500",
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
    fontFamily: "BasicCommercial-Bold",
    fontSize: 14,
    color: "#314151",
  },
  optionTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  percentageText: {
    fontSize: 14,
    fontFamily: "BasicCommercial-Bold",
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
    marginTop: SPACING.m,
  },
  voteCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
