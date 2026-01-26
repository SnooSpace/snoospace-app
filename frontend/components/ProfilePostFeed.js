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
}) => {
  const [visiblePostId, setVisiblePostId] = useState(null);
  const flatListRef = useRef(null);

  // Auto-play viewability configuration
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60, // Slightly higher for focus
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

  const renderItem = ({ item }) => {
    return (
      <EditorialPostCard
        post={item}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        isVideoPlaying={item.id === visiblePostId}
        onLike={onLikeUpdate} // Adapting to the signature expected by EditorialPostCard
        onComment={onComment}
        onShare={onShare}
        onSave={onSave}
        onFollow={onFollow}
        onUserPress={onUserPress}
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
        />
      </SafeAreaView>
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
