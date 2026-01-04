import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../context/NotificationsContext";
import { apiGet, apiPost } from "../api/client";
import { getAuthToken, getAuthEmail } from "../api/auth";
import { getUnreadCount as getMessageUnreadCount } from "../api/messages";
import { discoverEvents } from "../api/events";
import PostCard from "./PostCard";
import EventCard from "./EventCard";
import CommentsModal from "./CommentsModal";
import EventBus from "../utils/EventBus";
import LikeStateManager from "../utils/LikeStateManager";
import { useMessagePolling } from "../hooks/useMessagePolling";
import { useFeedPolling } from "../hooks/useFeedPolling";
import SkeletonCard from "./SkeletonCard";
import HapticsService from "../services/HapticsService";

import { COLORS } from "../constants/theme";

// Map legacy constants to new theme
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

// Header height for animations
const HEADER_HEIGHT = 50;

export default function HomeFeedScreen({ navigation, role = "member" }) {
  const insets = useSafeAreaInsets();

  // Calculate total header height including status bar
  const totalHeaderHeight = HEADER_HEIGHT + insets.top;

  // Determine header title based on role
  const getHeaderTitle = () => {
    switch (role) {
      case "community":
        return "SnooSpace";
      case "sponsor":
        return "SnooSpace";
      case "venue":
        return "SnooSpace";
      case "member":
      default:
        return "SnooSpace";
    }
  };

  // Determine navigation stack based on current role
  const getNavigationStack = () => {
    switch (role) {
      case "community":
        return "CommunityHome";
      case "sponsor":
        return "SponsorHome";
      case "venue":
        return "VenueHome";
      case "member":
      default:
        return "MemberHome";
    }
  };
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [feedItems, setFeedItems] = useState([]); // Combined posts + events
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const { unread } = useNotifications();
  const [greetingName, setGreetingName] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Refs for collapsible header animation
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // --- INSTAGRAM HEADER ANIMATION LOGIC ---

  // 1. Fix the "Glitch" & Implement Hysteresis:
  // We use useMemo to preserve the diffClamp state across re-renders.
  // We clamp the scrollY input to 0 so that pull-to-refresh (negative scroll)
  // doesn't affect the header position calculation.
  const SCROLL_THRESHOLD = 50; // Distance to scroll up before header appears

  // 1. Sticky Header Logic:
  // The header remains visible at the top (translateY = 0).
  const headerTranslateY = 0;

  // 2. Dynamic Border:
  // Fade in the bottom border only when content scrolls under the header
  // (Moved inside useMemo above)

  // Auto-poll for message count updates (Instagram-like)
  useMessagePolling(
    (count) => {
      setMessageUnread(count);
    },
    {
      baseInterval: 3000,
      enabled: true,
    }
  );

  // Auto-poll for new posts
  const { isPolling: isFeedPolling, initializeTimestamp } = useFeedPolling({
    baseInterval: 30000,
    enabled: !loading,
    onNewPostsLoaded: (newPosts) => {
      console.log("[HomeFeed] Auto-loading new posts from polling");
      const mergedPosts = LikeStateManager.mergeLikeStates(
        newPosts.map((post) => ({
          ...post,
          tagged_entities: (() => {
            if (!post.tagged_entities) return null;
            if (Array.isArray(post.tagged_entities))
              return post.tagged_entities;
            try {
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })(),
        }))
      );
      setPosts(mergedPosts);
      HapticsService.triggerImpactLight();
    },
  });

  // Load events for discovery
  const loadEvents = async () => {
    try {
      const response = await discoverEvents({ limit: 5 });
      if (response?.events) {
        setEvents(response.events);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error loading events:", error.message);
    }
  };

  // Merge posts and events
  useEffect(() => {
    if (posts.length === 0 && events.length === 0) {
      setFeedItems([]);
      return;
    }

    const merged = [];
    let eventIndex = 0;
    const FIRST_EVENT_AT = 2;
    const SUBSEQUENT_INTERVAL = 5;

    if (posts.length > 0) {
      posts.forEach((post, index) => {
        merged.push({ ...post, itemType: "post" });

        const postNumber = index + 1;
        const shouldInsertEvent =
          (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
          (eventIndex > 0 &&
            postNumber > FIRST_EVENT_AT &&
            (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);

        if (shouldInsertEvent && eventIndex < events.length) {
          merged.push({ ...events[eventIndex], itemType: "event" });
          eventIndex++;
        }
      });

      while (eventIndex < events.length) {
        merged.push({ ...events[eventIndex], itemType: "event" });
        eventIndex++;
      }
    } else {
      events.forEach((event) => {
        merged.push({ ...event, itemType: "event" });
      });
    }

    setFeedItems(merged);
  }, [posts, events]);

  useEffect(() => {
    loadFeed();
    loadEvents();
    loadGreetingName();
    loadMessageUnreadCount();
    const off = EventBus.on("follow-updated", () => {
      loadFeed();
    });
    const offMessages = EventBus.on("messages-read", () => {
      loadMessageUnreadCount();
    });
    const offNewMessage = EventBus.on("new-message", () => {
      loadMessageUnreadCount();
    });
    const offPostCreated = EventBus.on("post-created", () => {
      loadFeed();
    });
    const offPinUpdated = EventBus.on("prompt-pin-updated", () => {
      loadFeed();
    });
    return () => {
      off();
      offMessages();
      offNewMessage();
      offPostCreated();
      offPinUpdated();
    };
  }, []);

  useEffect(() => {
    const handlePostLikeUpdate = (payload) => {
      if (!payload?.postId) return;
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
                comment_count:
                  typeof payload.commentCount === "number"
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                comment_count:
                  typeof payload.commentCount === "number"
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const unsubscribeLike = EventBus.on(
      "post-like-updated",
      handlePostLikeUpdate
    );
    const unsubscribeComment = EventBus.on(
      "post-comment-updated",
      handlePostCommentUpdate
    );

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadMessageUnreadCount();
    }, [])
  );

  const { loadInitial: loadNotifications } = useNotifications();
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const loadMessageUnreadCount = async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response.unreadCount || 0);
    } catch (error) {
      console.error("Error loading message unread count:", error);
    }
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found.");

      const response = await apiGet("/posts/feed", 15000, token);
      const posts = (response.posts || []).map((post) => {
        const mappedPost = {
          ...post,
          author_id: post.author_id,
          author_type: post.author_type,
          tagged_entities: (() => {
            if (!post.tagged_entities) return null;
            if (Array.isArray(post.tagged_entities))
              return post.tagged_entities;
            try {
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })(),
        };
        return mappedPost;
      });

      const mergedPosts = LikeStateManager.mergeLikeStates(posts);
      setPosts(mergedPosts);

      if (mergedPosts.length > 0 && mergedPosts[0]?.created_at) {
        initializeTimestamp(mergedPosts[0].created_at);
      }
    } catch (error) {
      console.error("Error loading feed:", error);
      setErrorMsg(error?.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const loadGreetingName = async () => {
    try {
      const token = await getAuthToken();
      const { getActiveAccount } = await import("../api/auth");
      const activeAccount = await getActiveAccount();

      if (!token || !activeAccount?.email) return;

      const email = activeAccount.email;
      const res = await apiPost(
        "/auth/get-user-profile",
        { email },
        12000,
        token
      );
      const prof = res?.profile || {};
      const name = prof.full_name || prof.name || prof.username || "Member";
      setGreetingName(name);
      setCurrentUserId(prof.id);
    } catch (e) {
      console.error("[HomeFeed] Error loading greeting name:", e);
      setGreetingName("Member");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadEvents(), loadMessageUnreadCount()]);
    setRefreshing(false);
  };

  const handleLikeUpdate = (postId, isLiked) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: isLiked,
              isLiked,
              like_count: Math.max(0, (p.like_count || 0) + (isLiked ? 1 : -1)),
            }
          : p
      )
    );
  };

  const handleCommentPress = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleCommentCountChange = (postId) => {
    return (prevCount) => {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId ? { ...p, comment_count: prevCount } : p
        )
      );
    };
  };

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const handleInterestedPress = (event) => {
    // EventCard already handles the API toggle and UI state
    // No additional feedback needed here
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const handleLogoPress = useCallback(() => {
    HapticsService.triggerImpactLight();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setTimeout(() => {
      onRefresh();
    }, 300);
  }, [onRefresh]);

  const renderFeedItem = ({ item }) => {
    if (item.itemType === "event") {
      return (
        <EventCard
          event={item}
          onPress={handleEventPress}
          onInterestedPress={handleInterestedPress}
        />
      );
    }

    return (
      <PostCard
        post={item}
        onLike={handleLikeUpdate}
        onComment={handleCommentPress}
        onUserPress={(userId, userType) => {
          const actualUserType = userType || item?.author_type;
          const actualUserId = userId || item?.author_id;

          if (actualUserType === "community") {
            const isOwnCommunity =
              currentUserId && String(actualUserId) === String(currentUserId);

            if (isOwnCommunity && role === "community") {
              const root = navigation.getParent()?.getParent();
              if (root) {
                root.navigate(getNavigationStack(), {
                  screen: "Profile",
                  params: {
                    screen: "CommunityProfile",
                  },
                });
              }
            } else if (role === "member") {
              navigation.navigate("CommunityPublicProfile", {
                communityId: actualUserId,
                viewerRole: "member",
              });
            } else {
              Alert.alert(
                "Community Profile",
                `Viewing community: ${actualUserId}`
              );
            }
            return;
          }

          if (actualUserType === "member") {
            const isOwnProfile =
              currentUserId && actualUserId === currentUserId;

            if (role === "member" || role === "community") {
              if (!isOwnProfile) {
                navigation.navigate("MemberPublicProfile", {
                  memberId: actualUserId,
                });
              } else {
                const root = navigation.getParent()?.getParent();
                if (root) {
                  root.navigate(getNavigationStack(), {
                    screen: "Profile",
                    params: {
                      screen: "MemberProfile",
                    },
                  });
                }
              }
            } else {
              Alert.alert(
                "Member Profile",
                `Viewing member profile: ${actualUserId}`
              );
            }
            return;
          }
        }}
      />
    );
  };

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
            backgroundColor: "#FFFFFF",
            paddingTop: insets.top,
            height: totalHeaderHeight,
          },
        ]}
      >
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7}>
          <Text style={styles.appTitle}>{getHeaderTitle()}</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              navigation.navigate("Notifications");
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
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
            onPress={() => {
              navigation.navigate("ConversationsList");
            }}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={24}
              color={TEXT_COLOR}
            />
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

      {errorMsg ? (
        <View style={[styles.errorBanner, { marginTop: totalHeaderHeight }]}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => {
              setErrorMsg("");
              loadFeed();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Feed */}
      <Animated.FlatList
        ref={flatListRef}
        data={loading && feedItems.length === 0 ? [1, 2, 3] : feedItems}
        renderItem={
          loading && feedItems.length === 0
            ? () => <SkeletonCard />
            : renderFeedItem
        }
        keyExtractor={(item) =>
          loading && feedItems.length === 0
            ? `skeleton-${item}`
            : `${item.itemType || "post"}-${item.id}`
        }
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingTop: totalHeaderHeight },
        ]}
        // Progress view offset pushes the spinner down so it doesn't hide behind the header
        progressViewOffset={totalHeaderHeight}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // tintColor for iOS spinner color
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>
              Hi {greetingName || "User"}!
            </Text>
            <Text style={styles.greetingSubtext}>
              Discover what's happening
            </Text>
          </View>
        }
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>
                Follow some users to see their posts here
              </Text>
              {errorMsg ? (
                <TouchableOpacity onPress={loadFeed} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null
        }
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
          selectedPostId ? handleCommentCountChange(selectedPostId) : undefined
        }
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    // Removed explicit height here as it is set via style prop based on insets
    // shadow removed to be flat like Instagram
    zIndex: 100,
    backgroundColor: "#FFFFFF", // Ensure background prevents see-through
  },
  // New style for the dynamic border
  headerBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E0E0E0", // Light gray separator
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    // Instagram uses a specific font, but we keep your bold styling
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 15,
  },
  headerButton: {
    padding: 5,
  },
  badge: {
    position: "absolute",
    right: 0,
    top: -2,
    backgroundColor: "#D93025",
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  greeting: {
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 10, // Added margin top for better spacing after refresh
  },
  greetingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  greetingSubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 60,
  },
  postContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    paddingBottom: 15,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  authorUsername: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  moreButton: {
    padding: 5,
  },
  postContent: {
    paddingHorizontal: 20,
  },
  postImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postCaption: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookmarkButton: {
    marginLeft: "auto",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  commentsPreview: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  commentsText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  postTime: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFF2F0",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#D93025",
    flex: 1,
    marginRight: 10,
  },
  retryText: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
