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
import { VideoProvider } from "../context/VideoContext";
import { COLORS, SPACING } from "../constants/theme";

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
  navigation, // Add navigation prop for CommentsModal
}) => {
  const [visiblePostId, setVisiblePostId] = useState(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedSharePost, setSelectedSharePost] = useState(null);
  const flatListRef = useRef(null);

  // Auto-play viewability configuration
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 25, // Lower threshold for faster autoplay on tall videos
    waitForInteraction: false,
    minimumViewTime: 100,
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

  const renderItem = ({ item }) => {
    return (
      <EditorialPostCard
        post={item}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        isVideoPlaying={item.id === visiblePostId}
        onLike={onLikeUpdate} // Adapting to the signature expected by EditorialPostCard
        onComment={handleCommentPress}
        onShare={handleSharePress}
        onSave={onSave}
        onFollow={onFollow}
        onUserPress={onUserPress}
        onDelete={onDelete}
        showFollowButton={true} // Allow following if not same user
      />
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
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
      </SafeAreaView>

      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentCountChange={
          selectedPostId ? handleCommentCountChange(selectedPostId) : undefined
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
