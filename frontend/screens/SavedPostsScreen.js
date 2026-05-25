import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Image as LucideImage,
  Play,
  Bookmark,
  ArrowLeft,
  LayoutGrid,
  Layers,
} from "lucide-react-native";
import { getSavedPosts } from "../api/client";
import { getAuthToken, getActiveAccount } from "../api/auth";
import EventBus from "../utils/EventBus";
import ProfilePostFeed from "../components/ProfilePostFeed";
import SnooLoader from "../components/ui/SnooLoader";
import PollPostCard from "../components/posts/PollPostCard";
import PromptPostCard from "../components/posts/PromptPostCard";
import QnAPostCard from "../components/posts/QnAPostCard";
import ChallengePostCard from "../components/posts/ChallengePostCard";
import OpportunityFeedCard from "../components/OpportunityFeedCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const COLORS = {
  background: "#FFFFFF",
  text: "#000000",
  textSecondary: "#8E8E93",
  border: "#E5E5EA",
  primary: "#3565F2",
  primaryLight: "rgba(53,101,242,0.08)",
};

// ── Community post types that render as full cards ────────────────────────────
const COMMUNITY_POST_TYPES = ["poll", "prompt", "qna", "challenge", "opportunity"];

const isCommunityPost = (post) =>
  COMMUNITY_POST_TYPES.includes(post?.post_type);

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: "posts",     label: "Posts",           icon: LayoutGrid },
  { key: "community", label: "Community Posts",  icon: Layers },
];

const SavedPostsScreen = ({ navigation }) => {
  const [allPosts,      setAllPosts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [hasMore,       setHasMore]       = useState(true);
  const [offset,        setOffset]        = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [activeTab,     setActiveTab]     = useState("posts");

  // Post modal state (for photo/video tab)
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedPost,     setSelectedPost]     = useState(null);

  // Tab underline animation
  const tabUnderline = useRef(new Animated.Value(0)).current;

  // Load logged-in user info
  useEffect(() => {
    getActiveAccount().then((account) => {
      if (account?.id)   setCurrentUserId(account.id);
      if (account?.type) setCurrentUserType(account.type);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadSavedPosts(); }, []);

  // Real-time EventBus sync
  useEffect(() => {
    const handleViewUpdate = (payload) => {
      if (!payload?.postId) return;
      setAllPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, public_view_count: (p.public_view_count || 0) + 1 }
            : p,
        ),
      );
    };
    const handleLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      setAllPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, is_liked: payload.isLiked, isLiked: payload.isLiked, like_count: payload.likeCount ?? p.like_count }
            : p,
        ),
      );
    };
    const handleSaveUpdate = (payload) => {
      if (!payload?.postId) return;
      if (!payload.isSaved) {
        setAllPosts((prev) => prev.filter((p) => p.id !== payload.postId));
      } else {
        setAllPosts((prev) =>
          prev.map((p) =>
            p.id === payload.postId
              ? { ...p, is_saved: payload.isSaved, save_count: payload.saveCount }
              : p,
          ),
        );
      }
    };
    const unsubView = EventBus.on("post-view-updated",  handleViewUpdate);
    const unsubLike = EventBus.on("post-like-updated",  handleLikeUpdate);
    const unsubSave = EventBus.on("post-save-updated",  handleSaveUpdate);
    return () => {
      if (unsubView) unsubView();
      if (unsubLike) unsubLike();
      if (unsubSave) unsubSave();
    };
  }, []);

  const loadSavedPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) { setRefreshing(true); setOffset(0); }
      else { setLoading(true); }

      const currentOffset = isRefresh ? 0 : offset;
      const token = await getAuthToken();
      const response = await getSavedPosts(currentOffset, 40, token);

      if (isRefresh) {
        setAllPosts((response.posts || []).map((p) => ({ ...p, is_saved: true })));
      } else {
        setAllPosts((prev) => [...prev, ...(response.posts || []).map((p) => ({ ...p, is_saved: true }))]);
      }

      setHasMore(response.hasMore || false);
      setOffset(currentOffset + (response.posts?.length || 0));
    } catch (error) {
      console.error("Failed to load saved posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Split posts into the two buckets
  const mediaPosts     = allPosts.filter((p) => !isCommunityPost(p));
  const communityPosts = allPosts.filter((p) =>  isCommunityPost(p));

  // ── Tab switch ──────────────────────────────────────────────────────────────
  const switchTab = (tabKey) => {
    const idx = TABS.findIndex((t) => t.key === tabKey);
    Animated.spring(tabUnderline, {
      toValue: idx * (SCREEN_WIDTH / TABS.length),
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    setActiveTab(tabKey);
  };

  // ── Media post grid ─────────────────────────────────────────────────────────
  const getFirstImage = (item) => {
    if (!item.image_urls) return null;
    const urls = Array.isArray(item.image_urls) ? item.image_urls.flat() : [];
    const imageUrl = urls.find((url) => {
      if (typeof url === "string") return url.startsWith("http");
      if (url?.url) return url.url.startsWith("http");
      return false;
    });
    return typeof imageUrl === "string" ? imageUrl : imageUrl?.url;
  };

  const renderMediaPost = ({ item }) => {
    const imageUrl = getFirstImage(item);
    const isVideo  = item.image_urls?.some(
      (url) =>
        (typeof url === "string" ? url : url?.url)?.includes(".mp4") ||
        (typeof url === "object" && url?.type === "video"),
    );

    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => { setSelectedPost(item); setPostModalVisible(true); }}
        activeOpacity={0.9}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.postImage} />
        ) : (
          <View style={[styles.postImage, styles.placeholderImage]}>
            <LucideImage size={40} color={COLORS.textSecondary} />
          </View>
        )}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Play size={24} color="#FFF" fill="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Community post cards ────────────────────────────────────────────────────
  const handleUnsave = (postId) =>
    setAllPosts((prev) => prev.filter((p) => p.id !== postId));

  const handleUserPress = (userId, userType) => {
    const nav = navigation.getParent()?.getParent() || navigation;
    if (userType === "community") {
      nav.navigate("CommunityPublicProfile", { communityId: userId, viewerRole: "member" });
    } else {
      nav.navigate("MemberPublicProfile", { memberId: userId });
    }
  };

  const renderCommunityPost = ({ item }) => {
    const sharedProps = {
      post: item,
      onUserPress: handleUserPress,
      onLike: () => {},
      onComment: () => {},
      onSave: () => handleUnsave(item.id),
      onShare: () => {},
      currentUserId,
      currentUserType,
    };

    switch (item.post_type) {
      case "poll":
        return <PollPostCard {...sharedProps} />;
      case "prompt":
        return <PromptPostCard {...sharedProps} />;
      case "qna":
        return <QnAPostCard {...sharedProps} />;
      case "challenge":
        return <ChallengePostCard {...sharedProps} />;
      case "opportunity":
        return (
          <OpportunityFeedCard
            opportunity={item}
            onPress={(opp) => {
              const nav = navigation.getParent()?.getParent() || navigation;
              nav.navigate("OpportunityView", {
                opportunityId: opp.id,
              });
            }}
            onUserPress={handleUserPress}
            onLike={() => {}}
            onComment={() => {}}
            onSave={() => handleUnsave(item.id)}
            onShare={() => {}}
            currentUserId={currentUserId}
            currentUserType={currentUserType}
          />
        );
      default:
        return null;
    }
  };

  // ── Empty states ────────────────────────────────────────────────────────────
  const renderEmptyMedia = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <LucideImage size={64} color={COLORS.textSecondary} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No saved photos or videos</Text>
        <Text style={styles.emptySubtitle}>
          Save posts from your feed and they'll appear here
        </Text>
      </View>
    );
  };

  const renderEmptyCommunity = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Bookmark size={64} color={COLORS.textSecondary} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No saved community posts</Text>
        <Text style={styles.emptySubtitle}>
          Polls, Q&As, Prompts, Challenges and Opportunities you save will appear here
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || allPosts.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <SnooLoader size="small" color={COLORS.text} />
      </View>
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => loadSavedPosts(true)}
      tintColor={COLORS.primary}
    />
  );

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  const tabWidth = SCREEN_WIDTH / TABS.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved</Text>
        <View style={styles.backButton} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => switchTab(tab.key)}
              activeOpacity={0.8}
            >
              <Icon
                size={18}
                color={isActive ? COLORS.primary : COLORS.textSecondary}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Animated underline */}
        <Animated.View
          style={[
            styles.tabUnderline,
            { width: tabWidth, transform: [{ translateX: tabUnderline }] },
          ]}
        />
      </View>

      {/* Content */}
      {loading && allPosts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : activeTab === "posts" ? (
        <FlatList
          key="media-grid"
          data={mediaPosts}
          renderItem={renderMediaPost}
          keyExtractor={(item) => `media-${item.id}`}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={renderEmptyMedia}
          ListFooterComponent={renderFooter}
          refreshControl={refreshControl}
          onEndReached={() => { if (!loading && hasMore) loadSavedPosts(); }}
          onEndReachedThreshold={0.5}
        />
      ) : (
        <FlatList
          key="community-list"
          data={communityPosts}
          renderItem={renderCommunityPost}
          keyExtractor={(item) => `community-${item.id}`}
          contentContainerStyle={styles.communityContainer}
          ListEmptyComponent={renderEmptyCommunity}
          ListFooterComponent={renderFooter}
          refreshControl={refreshControl}
          onEndReached={() => { if (!loading && hasMore) loadSavedPosts(); }}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Photo/Video Fullscreen Modal */}
      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={mediaPosts}
          initialPostId={selectedPost.id}
          onClose={() => { setPostModalVisible(false); setSelectedPost(null); }}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          onLikeUpdate={(postId, isLiked, likeCount) => {
            setAllPosts((prev) =>
              prev.map((p) =>
                p.id === postId ? { ...p, is_liked: isLiked, like_count: likeCount } : p,
              ),
            );
          }}
          onSave={handleUnsave}
          navigation={navigation}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.text,
  },

  // ── Tab Bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    position: "relative",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    height: 2.5,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // ── Loading ───────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Media Grid ────────────────────────────────────────────────────────────
  gridContainer: {
    paddingHorizontal: 1,
    paddingTop: 1,
    flexGrow: 1,
  },
  postItem: {
    width: "33.33%",
    aspectRatio: 1,
    padding: 1,
  },
  postImage: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.border,
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  // ── Community Posts List ───────────────────────────────────────────────────
  communityContainer: {
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },

  // ── Empty States ──────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.text,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default SavedPostsScreen;
