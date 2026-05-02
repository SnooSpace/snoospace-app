import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import EditorialPostCard from "./EditorialPostCard";
import CommentsModal from "./CommentsModal";
import ShareModal from "./ShareModal";
import DeletePostModal from "./DeletePostModal";
import { VideoProvider } from "../context/VideoContext";
import { COLORS, SPACING } from "../constants/theme";

// Defined OUTSIDE ProfilePostFeed to prevent recreation on every render.
// If defined inside, React treats it as a new component type each render,
// causing full unmount+remount of each card — resetting carousel position,
// video state, dwell timers, etc.
const MemoizedPostCard = React.memo(EditorialPostCard, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.isVideoPlaying === next.isVideoPlaying &&
    prev.isInViewport === next.isInViewport &&
    prev.post.like_count === next.post.like_count &&
    prev.post.is_liked === next.post.is_liked &&
    prev.post.comment_count === next.post.comment_count &&
    prev.post.public_view_count === next.post.public_view_count &&
    prev.post.save_count === next.post.save_count &&
    prev.post.saves_count === next.post.saves_count &&
    prev.post.is_saved === next.post.is_saved
  );
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ProfilePostFeed = ({
  visible,
  posts,
  initialPostId,
  onClose,
  currentUserId,
  currentUserType,
  onLikeUpdate,
  onComment,
  onShare,
  onSave,
  onFollow,
  onUserPress,
  onDelete,
  onPostUpdate, // New prop
  navigation, // Add navigation prop for CommentsModal
}) => {
  // Initialize with the initial post ID so video starts playing immediately
  // Convert to string to avoid type mismatches
  const [visiblePostId, setVisiblePostId] = useState(initialPostId);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedSharePost, setSelectedSharePost] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const flatListRef = useRef(null);

  // Auto-play viewability configuration - matching HomeFeedScreen for consistency
  const viewabilityConfig = useRef({
    // Using viewAreaCoveragePercentThreshold ensures the video must cover
    // 60% of the viewport area before being considered viewable
    viewAreaCoveragePercentThreshold: 60,
    waitForInteraction: false,
    minimumViewTime: 100, // Small delay to prevent flickering during fast scrolls
  }).current;

  // Track visible items for auto-play
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      // Find the most visible item
      const visibleItem = viewableItems[0];
      if (visibleItem && visibleItem.item && visibleItem.item.id) {
        setVisiblePostId(visibleItem.item.id);
      }
    }
  }, []);

  // Find initial index
  const initialIndex = posts.findIndex((p) => p.id === initialPostId);

  // Handling scroll to index failure if layout isn't ready
  const onScrollToIndexFailed = (info) => {
    const wait = new Promise((resolve) => setTimeout(resolve, 100));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    });
  };

  // Handle comment press - open comments modal within ProfilePostFeed
  const handleCommentPress = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  // Handle comment count change
  const handleCommentCountChange = (postId) => {
    return (newCount) => {
      // Optionally update the parent if onComment exists and needs to update count
      if (onComment) {
        onComment(postId, newCount);
      }
    };
  };

  const handleSharePress = (postId) => {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      setSelectedSharePost(post);
      setShareModalVisible(true);
    }
  };

  const handleRequestDelete = (postId) => {
    setPostToDelete(postId);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    if (postToDelete && onDelete) {
      onDelete(postToDelete);
    }
    setDeleteModalVisible(false);
    setPostToDelete(null);
  };

// MemoizedPostCard is now defined outside this component (above). See top of file.

  const renderItem = useCallback(({ item }) => {
    // Use string comparison to avoid type mismatches
    const shouldPlayVideo = String(item.id) === String(visiblePostId);

    return (
      <MemoizedPostCard
        post={item}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        isVideoPlaying={shouldPlayVideo}
        isInViewport={shouldPlayVideo} // Gate dwell-time view tracking to visible post only
        isScreenFocused={true} // Modal is visible, so screen is focused
        onLike={onLikeUpdate} // Adapting to the signature expected by EditorialPostCard
        onComment={handleCommentPress}
        onShare={handleSharePress}
        onSave={onSave}
        onFollow={onFollow}
        onUserPress={onUserPress}
        onDelete={onDelete}
        onPostUpdate={onPostUpdate}
        onRequestDelete={handleRequestDelete}
        showFollowButton={true} // Allow following if not same user
      />
    );
  }, [visiblePostId, currentUserId, currentUserType, onLikeUpdate, handleCommentPress, handleSharePress, onSave, onFollow, onUserPress, onDelete, onPostUpdate, handleRequestDelete]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <VideoProvider>
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons
                name="arrow-back"
                size={24}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Posts</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Feed */}
          <FlatList
            ref={flatListRef}
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            initialScrollIndex={initialIndex !== -1 ? initialIndex : 0}
            onScrollToIndexFailed={onScrollToIndexFailed}
            getItemLayout={(data, index) => ({
              length: 600, // Estimated height, helps with initial scroll
              offset: 600 * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Video optimization: prevent aggressive unmounting of video components
            removeClippedSubviews={false}
            // Increase window for better video preloading
            // windowSize=8 means 4 screens above and 4 below are kept mounted
            windowSize={8}
            // Controlled render batching for smooth scrolling
            maxToRenderPerBatch={3}
            initialNumToRender={3}
            // Memory efficiency: update items less frequently during fast scroll
            updateCellsBatchingPeriod={50}
          />

          {/* Comments Modal */}
          <CommentsModal
            visible={commentsModalVisible}
            postId={selectedPostId}
            onClose={() => {
              setCommentsModalVisible(false);
              setSelectedPostId(null);
            }}
            onCommentCountChange={
              selectedPostId
                ? handleCommentCountChange(selectedPostId)
                : undefined
            }
            navigation={navigation}
          />

          {/* Share Modal */}
          <ShareModal
            visible={shareModalVisible}
            post={selectedSharePost}
            onClose={() => {
              setShareModalVisible(false);
              setSelectedSharePost(null);
            }}
          />

          {/* Delete Confirmation Modal */}
          <DeletePostModal
            visible={deleteModalVisible}
            onCancel={() => {
              setDeleteModalVisible(false);
              setPostToDelete(null);
            }}
            onDelete={handleConfirmDelete}
          />
        </SafeAreaView>
      </VideoProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
    zIndex: 10,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  listContent: {
    paddingBottom: 40,
  },
});

export default ProfilePostFeed;
