import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import PostCard from "../../../components/PostCard";
import { mockData } from "../../../data/mockData";
import { apiGet } from "../../../api/client";
import { getAuthToken, getActiveAccount } from "../../../api/auth";
import { useNotifications } from "../../../context/NotificationsContext";
import { getUnreadCount as getMessageUnreadCount } from "../../../api/messages";
import EventBus from "../../../utils/EventBus";
import CommentsModal from "../../../components/CommentsModal";
import LikeStateManager from "../../../utils/LikeStateManager";
import HapticsService from "../../../services/HapticsService";
import SnooSpaceLogo from "../../../components/SnooSpaceLogo";

const PRIMARY_COLOR = "#6A0DAD";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";
const HEADER_HEIGHT = 50;

export default function CommunityHomeFeedScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageUnread, setMessageUnread] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const { unread, loadInitial: refreshNotifications } = useNotifications();
  const [user, setUser] = useState(null);

  // Refs for collapsible header animation
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await apiGet("/posts/feed", 15000, token);
      const apiPosts = Array.isArray(response.posts) ? response.posts : [];
      console.log(
        "[CommunityHomeFeed] Received posts from API:",
        apiPosts.length,
      );

      // Ensure image_urls is an array (backend sends array; guard for strings)
      const normalized = apiPosts.map((p) => ({
        ...p,
        image_urls: Array.isArray(p.image_urls)
          ? p.image_urls
          : typeof p.image_urls === "string"
            ? (() => {
                try {
                  return JSON.parse(p.image_urls);
                } catch {
                  return [];
                }
              })()
            : [],
      }));

      console.log(
        "[CommunityHomeFeed] About to merge like states, posts count:",
        normalized.length,
      );
      if (normalized.length > 0) {
        // Log ALL posts to see like states
        normalized.forEach((post, idx) => {
          console.log(`[CommunityHomeFeed] Post ${idx + 1} before merge:`, {
            id: post.id,
            author: post.author_name,
            is_liked: post.is_liked,
            like_count: post.like_count,
          });
        });
      }

      // Apply cached like states from LikeStateManager
      const mergedPosts = LikeStateManager.mergeLikeStates(normalized);

      if (mergedPosts.length > 0) {
        // Log ALL posts after merge
        mergedPosts.forEach((post, idx) => {
          console.log(`[CommunityHomeFeed] Post ${idx + 1} after merge:`, {
            id: post.id,
            author: post.author_name,
            is_liked: post.is_liked,
            like_count: post.like_count,
          });
        });
      }

      setPosts(mergedPosts);
    } catch (error) {
      console.error("Error loading feed:", error);
      console.log("Falling back to mock data");
      // Fallback to mock data if API fails, adapt fields to UI shape
      const adapted = (mockData.posts || []).map((p) => ({
        ...p,
        author_photo_url: p.author_photo_url || p.author_photo || undefined,
      }));
      setPosts(adapted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    loadMessageUnreadCount();
  }, [loadFeed]);

  useEffect(() => {
    const loadUser = async () => {
      const account = await getActiveAccount();
      if (account) setUser(account);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-like-updated", (payload) => {
      console.log(
        "[CommunityHomeFeed] EventBus post-like-updated received:",
        payload,
      );
      if (!payload?.postId) return;

      // Cache the like state to persist across screens
      LikeStateManager.setLikeState(payload.postId, payload.isLiked);

      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                is_liked: payload.isLiked,
                isLiked: payload.isLiked,
                like_count:
                  typeof payload.likeCount === "number"
                    ? payload.likeCount
                    : post.like_count,
              }
            : post,
        ),
      );
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-created", () => {
      loadFeed();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadFeed]);

  useFocusEffect(
    useCallback(() => {
      loadMessageUnreadCount();
      refreshNotifications?.();
    }, [refreshNotifications]),
  );

  // Listen for refresh triggers from create post screen
  useEffect(() => {
    if (route?.params?.refresh) {
      console.log("Refreshing feed due to new post");
      loadFeed();
      navigation.setParams({ refresh: null });
    }
  }, [route?.params?.refresh, loadFeed, navigation]);

  const loadMessageUnreadCount = useCallback(async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response?.unreadCount || 0);
    } catch (error) {
      console.error("Error loading message unread count:", error);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  // Scroll handler for collapsible header animation
  // 1. Sticky Header Logic:
  // The header remains visible at the top (translateY = 0).
  const headerTranslateY = 0;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  // Handle logo press - scroll to top and refresh
  const handleLogoPress = useCallback(() => {
    HapticsService.triggerImpactLight();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    // Trigger refresh after scroll animation
    setTimeout(() => {
      handleRefresh();
    }, 300);
  }, [handleRefresh]);

  const handleLike = (postId, nextLiked) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              is_liked: nextLiked,
              isLiked: nextLiked,
              like_count: Math.max(
                0,
                (post.like_count || 0) + (nextLiked ? 1 : -1),
              ),
            }
          : post,
      ),
    );
  };

  const handleComment = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleFollow = async (entityId, entityType) => {
    try {
      // In real app, this would be API call
      console.log("Follow entity:", entityId, entityType);
    } catch (error) {
      console.error("Error following entity:", error);
    }
  };

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onFollow={handleFollow}
      onUserPress={(userId, userType) => {
        if (userType === "member" || !userType) {
          // Navigate to member profile within Community's Home stack
          navigation.navigate("MemberPublicProfile", { memberId: userId });
        } else if (userType === "community") {
          navigation.navigate("Profile", {
            screen: "CommunityPublicProfile",
            params: { communityId: userId },
          });
        } else if (userType === "sponsor") {
          Alert.alert(
            "Sponsor Profile",
            "Sponsor profile navigation will be implemented soon",
          );
        } else if (userType === "venue") {
          Alert.alert(
            "Venue Profile",
            "Venue profile navigation will be implemented soon",
          );
        }
      }}
    />
  );

  // Greeting component (scrolls with content, only visible at top)
  const renderGreeting = () => (
    <View style={styles.greeting}>
      <Text style={styles.greetingTitle}>
        Hi, {user?.name || user?.username || "there"} 👋
      </Text>
      <Text style={styles.headerSubtitle}>Ready to create today?</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptyText}>
        Follow some communities and members to see their posts here
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate("Search")}
      >
        <Text style={styles.exploreButtonText}>Explore Communities</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {/* Animated Collapsible Header */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerTranslateY }],
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: COLORS.background, // Off-white
            paddingTop: insets.top,
            height: HEADER_HEIGHT + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleLogoPress}
          activeOpacity={0.7}
          style={{ marginLeft: -12 }}
        >
          <SnooSpaceLogo width={128} height={32} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons
              name="notifications"
              size={26} // Slightly larger for filled
              color={TEXT_COLOR}
            />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 9 ? "9+" : String(unread)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("ConversationsList")}
          >
            <Ionicons name="chatbubble" size={24} color={TEXT_COLOR} />
            {messageUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {messageUnread > 9 ? "9+" : String(messageUnread)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderGreeting}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
        contentContainerStyle={[
          styles.listContainer,
          { paddingTop: HEADER_HEIGHT + insets.top },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentCountChange={(newCount) => {
          if (selectedPostId) {
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === selectedPostId ? { ...p, comment_count: newCount } : p,
              ),
            );
          }
        }}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
  listContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: HEADER_HEIGHT,
    zIndex: 100,
    backgroundColor: COLORS.background,
  },
  headerBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: { padding: 4 },
  badge: {
    position: "absolute",
    right: -2,
    top: -4,
    backgroundColor: "#D93025",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  greeting: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  exploreButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
