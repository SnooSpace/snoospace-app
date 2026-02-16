import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Dimensions,
  Animated,
  RefreshControl,
  Platform,
  Alert,
  StatusBar,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  Settings,
  MoreVertical,
  X,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  Pencil,
  ArrowLeft,
  Play,
  Star,
  Image as LucideImage,
} from "lucide-react-native";
import DynamicStatusBar from "../../../components/DynamicStatusBar";
import GradientSafeArea from "../../../components/GradientSafeArea";
import HapticsService from "../../../services/HapticsService";

import {
  getPublicCommunity,
  getCommunityPosts,
  followCommunity,
  unfollowCommunity,
} from "../../../api/communities";
import { getCommunityPublicEvents } from "../../../api/events";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import CommentsModal from "../../../components/CommentsModal";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { apiPost, apiDelete, apiGet } from "../../../api/client";
import LikeStateManager from "../../../utils/LikeStateManager";
import {
  getGradientForName,
  getInitials,
} from "../../../utils/AvatarGenerator";
import {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import ThemeChip from "../../../components/ThemeChip";
import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import EditorialPostCard from "../../../components/EditorialPostCard";
import ProfilePostFeed from "../../../components/ProfilePostFeed";

// Normalize Theme Constants
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || String(value);
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BANNER_HEIGHT = screenHeight * 0.28; // 28% of screen height
const AVATAR_SIZE = 120;
const GAP = 2;
const ITEM_SIZE = (screenWidth - GAP * 2) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: "#EFEFF4",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  profileHeader: {
    alignItems: "center",
    gap: 6,
    marginTop: -(AVATAR_SIZE * 0.4),
    marginBottom: 16,
  },
  profileHeaderNoBanner: {
    marginTop: 0,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#E5E5EA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: AVATAR_SIZE / 2,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  usernameText: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#3B82F6",
  },
  communityName: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
    textAlign: "center",
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  bio: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 5,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#6B7280",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  headAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F2F2F7",
  },
  headName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  primaryTag: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  primaryStarGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  headSub: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  emptyText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 0, // Handled by gap/sectionHeader
  },
  sponsorTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    backgroundColor: COLORS.background,
    marginTop: 8,
    position: "relative",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: LIGHT_TEXT_COLOR,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 1,
  },
  postsSection: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  gridItem: {
    backgroundColor: "#F2F2F7",
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridPlaceholder: {
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPostsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyPostsText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});

export default function CommunityPublicProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const communityId = route?.params?.communityId;
  const viewerRoleParam = route?.params?.viewerRole || "member";
  const viewerRole =
    typeof viewerRoleParam === "string"
      ? viewerRoleParam.toLowerCase()
      : "member";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
  });
  const pendingPostUpdateRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const postsCount = profile?.posts_count ?? profile?.post_count ?? 0;
  const followersCount =
    profile?.followers_count ?? profile?.follower_count ?? 0;
  const followingCount = profile?.following_count ?? profile?.following ?? 0;

  // Scroll Animation state
  const scrollY = useRef(new Animated.Value(0)).current;

  // Tabs state
  const [activeTab, setActiveTab] = useState("posts");
  const [communityEvents, setCommunityEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [tabLayouts, setTabLayouts] = useState({});
  const tabUnderlineX = useRef(new Animated.Value(0)).current;
  const tabUnderlineScale = useRef(new Animated.Value(0)).current;

  const handleTabLayout = (key, event) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

  useEffect(() => {
    const layout = tabLayouts[activeTab];
    if (layout) {
      Animated.parallel([
        Animated.spring(tabUnderlineX, {
          toValue: layout.x,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
        Animated.spring(tabUnderlineScale, {
          toValue: layout.width,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
      ]).start();
    }
  }, [activeTab, tabLayouts]);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicCommunity(communityId);
      const normalizedCategories = Array.isArray(p?.categories)
        ? p.categories
        : p?.category
          ? [p.category]
          : [];
      setProfile({
        ...p,
        categories: normalizedCategories,
        category: normalizedCategories[0] || p?.category || null,
      });
      setIsFollowing(!!p?.is_following);
    } catch (e) {
      setError(e?.message || "Failed to load profile");
    }
  }, [communityId]);

  const loadEvents = useCallback(async () => {
    console.log(
      "[CommunityPublicProfile] loadEvents called with communityId:",
      communityId,
    );
    try {
      setEventsLoading(true);
      const res = await getCommunityPublicEvents(communityId);
      console.log(
        "[CommunityPublicProfile] getCommunityPublicEvents response:",
        {
          hasEvents: !!res?.events,
          eventsLength: res?.events?.length,
          eventsData: res?.events,
          fullResponse: res,
        },
      );
      const allEvents = Array.isArray(res?.events) ? res.events : [];
      console.log(
        "[CommunityPublicProfile] Setting communityEvents to:",
        allEvents,
      );
      setCommunityEvents(allEvents);
    } catch (err) {
      console.log("[CommunityPublicProfile] Failed to load events:", err);
      setCommunityEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [communityId]);

  const loadPosts = useCallback(
    async (reset = false) => {
      if (loadingMore) return;
      if (!hasMore && !reset) return;
      try {
        if (reset) {
          setOffset(0);
          setHasMore(true);
        }
        setLoadingMore(true);
        const data = await getCommunityPosts(communityId, {
          limit: 21,
          offset: reset ? 0 : offset,
        });
        const rawPosts = reset
          ? data?.posts || data || []
          : [...posts, ...(data?.posts || data || [])];

        // DEBUG: Log raw post data to understand structure
        if (rawPosts.length > 0) {
          console.log(
            "[CommunityPublicProfile] DEBUG - First 3 posts raw data:",
            rawPosts.slice(0, 3).map((p) => ({
              id: p.id,
              post_type: p.post_type,
              type: p.type,
              has_image_urls: !!p.image_urls,
              image_urls_type: typeof p.image_urls,
              image_urls_length: Array.isArray(p.image_urls)
                ? p.image_urls.length
                : "not array",
              image_urls_value: p.image_urls,
              has_video_url: !!p.video_url,
              video_url: p.video_url,
            })),
          );
        }

        // Normalize is_liked field for all posts - ensure it's explicitly true or false
        const normalizedPosts = rawPosts.map((post) => ({
          ...post,
          is_liked: post.is_liked === true,
          isLiked: post.is_liked === true,
        }));

        // Merge with cached like states to fix backend returning stale is_liked data
        const mergedPosts =
          await LikeStateManager.mergeLikeStates(normalizedPosts);

        // DEBUG: Log filter results
        const dbgInteractive = [
          "poll",
          "prompt",
          "qna",
          "challenge",
          "opportunity",
        ];
        const dbgMedia = mergedPosts.filter(
          (p) => !dbgInteractive.includes(p.post_type || p.type),
        );
        console.log("[CommunityPublicProfile] DEBUG - Filter results:", {
          totalPosts: mergedPosts.length,
          mediaPostsCount: dbgMedia.length,
          interactiveCount: mergedPosts.length - dbgMedia.length,
          firstPostFields: mergedPosts[0]
            ? Object.keys(mergedPosts[0]).join(",")
            : "none",
          firstPostType:
            mergedPosts[0]?.post_type || mergedPosts[0]?.type || "undefined",
        });

        setPosts(mergedPosts);
        const received = (data?.posts || data || []).length;
        const nextOffset = (reset ? 0 : offset) + received;
        setOffset(nextOffset);
        setHasMore(received >= 21);
      } catch (e) {
        console.error("[CommunityPublicProfile] loadPosts error:", e);
        setError(e?.message || "Failed to load posts");
      } finally {
        setLoadingMore(false);
      }
    },
    [communityId, offset, posts, hasMore, loadingMore],
  );

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadPosts(true), loadEvents()]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [communityId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email && mounted) {
          const profileResponse = await apiPost(
            "/auth/get-user-profile",
            { email },
            10000,
            token,
          );
          if (profileResponse?.profile?.id && mounted) {
            setCurrentUserId(profileResponse.profile.id);
          }
        }
      } catch (error) {
        console.error("Failed to load current user info:", error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for post like/comment updates to refresh posts immediately
  useEffect(() => {
    const handlePostLikeUpdate = async (payload) => {
      console.log(
        "[CommunityPublicProfile] EventBus post-like-updated received:",
        payload,
      );
      if (!payload?.postId) return;

      // Cache the like state to persist across component unmounts
      await LikeStateManager.setLikeState(payload.postId, payload.isLiked);

      setPosts((prevPosts) => {
        const updatedPosts = prevPosts.map((post) =>
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
            : post,
        );
        console.log(
          "[CommunityPublicProfile] Posts updated via EventBus, updated post:",
          updatedPosts.find((p) => p.id === payload.postId),
        );
        return updatedPosts;
      });
      // Also update selectedPost if it matches
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return {
            ...prevSelected,
            is_liked: payload.isLiked,
            isLiked: payload.isLiked,
            like_count:
              typeof payload.likeCount === "number"
                ? payload.likeCount
                : prevSelected.like_count,
            comment_count:
              typeof payload.commentCount === "number"
                ? payload.commentCount
                : prevSelected.comment_count,
          };
        }
        return prevSelected;
      });
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                comment_count:
                  typeof payload.commentCount === "number"
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post,
        ),
      );
    };

    const handlePostDeleted = ({ postId }) => {
      if (!postId) return;
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
      if (selectedPost?.id === postId) {
        setPostModalVisible(false);
        setSelectedPost(null);
      }
    };

    const unsubscribeLike = EventBus.on(
      "post-like-updated",
      handlePostLikeUpdate,
    );
    const unsubscribeComment = EventBus.on(
      "post-comment-updated",
      handlePostCommentUpdate,
    );
    const unsubscribeDeleted = EventBus.on("post-deleted", handlePostDeleted);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
      if (unsubscribeDeleted) unsubscribeDeleted();
    };
  }, [selectedPost]); // Added selectedPost dependency

  const openPostModal = (postId) => {
    console.log(
      "[CommunityPublicProfile] openPostModal called with postId:",
      postId,
    );
    // Look up the post from current state to ensure we have fresh data
    const post = posts.find((p) => p.id === postId);
    console.log(
      "[CommunityPublicProfile] Found post from state:",
      post
        ? { id: post.id, is_liked: post.is_liked, like_count: post.like_count }
        : "NOT FOUND",
    );
    if (!post) return;

    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    console.log(
      "[CommunityPublicProfile] Normalized is_liked:",
      normalizedIsLiked,
      "from post.is_liked:",
      post.is_liked,
    );
    const normalizedPost = {
      ...post,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  };

  const closePostModal = () => {
    const pending = pendingPostUpdateRef.current;
    if (pending && pending.postId != null) {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === pending.postId
            ? {
                ...p,
                is_liked: pending.is_liked,
                isLiked: pending.is_liked,
                like_count: pending.like_count,
              }
            : p,
        ),
      );
      pendingPostUpdateRef.current = null;
    }
    setPostModalVisible(false);
    setSelectedPost(null);
  };

  const openCommentsModal = useCallback((postId) => {
    if (postId) {
      setCommentsModalState({ visible: true, postId });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null });
  }, []);

  const handlePostLike = (postId, isLiked, likeCount) => {
    pendingPostUpdateRef.current = {
      postId,
      is_liked: isLiked,
      like_count: likeCount,
    };
  };

  const renderGridItem = ({ item, index }) => {
    let firstImageUrl = null;
    if (item?.image_urls) {
      if (Array.isArray(item.image_urls)) {
        const flatUrls = item.image_urls.flat();
        firstImageUrl = flatUrls.find(
          (u) => typeof u === "string" && u.startsWith("http"),
        );
      } else if (
        typeof item.image_urls === "string" &&
        item.image_urls.startsWith("http")
      ) {
        firstImageUrl = item.image_urls;
      }
    }

    // Detect video by: explicit video_url OR URL extension
    const isVideo =
      !!item.video_url ||
      (firstImageUrl &&
        (firstImageUrl.toLowerCase().includes(".mp4") ||
          firstImageUrl.toLowerCase().includes(".mov") ||
          firstImageUrl.toLowerCase().includes(".webm")));

    // Generate thumbnail: use video_thumbnail, or Cloudinary jpg conversion, or original URL
    let mediaUrl = null;
    if (item.video_thumbnail) {
      try {
        if (
          typeof item.video_thumbnail === "string" &&
          item.video_thumbnail.startsWith("[")
        ) {
          const parsed = JSON.parse(item.video_thumbnail);
          mediaUrl = Array.isArray(parsed) ? parsed[0] : item.video_thumbnail;
        } else {
          mediaUrl = item.video_thumbnail;
        }
      } catch (e) {
        mediaUrl = item.video_thumbnail;
      }
    }
    const videoSourceUrl = firstImageUrl || item.video_url;
    if (
      !mediaUrl &&
      isVideo &&
      videoSourceUrl &&
      videoSourceUrl.includes("cloudinary.com")
    ) {
      // Convert Cloudinary video URL to thumbnail with transformation params
      mediaUrl = videoSourceUrl
        .replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_800/")
        .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
    }
    if (!mediaUrl) {
      mediaUrl = videoSourceUrl;
    }
    if (!mediaUrl) {
      mediaUrl = firstImageUrl;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openPostModal(item.id)}
        style={[
          styles.gridItem,
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE * 1.35,
            borderRadius: 3,
            overflow: "hidden",
          },
        ]}
      >
        {mediaUrl ? (
          <>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {isVideo && (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 12,
                  padding: 4,
                }}
              >
                <Play size={16} color="#FFF" fill="#FFF" />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]}>
            <LucideImage size={30} color="#999" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const handleHeadPress = (head) => {
    if (head?.member_id) {
      // Check if it's the current user's own profile
      const isOwnProfile = currentUserId && head.member_id === currentUserId;
      if (isOwnProfile) {
        // Navigate to own profile screen
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate("MemberHome", {
            screen: "Profile",
            params: {
              screen: "MemberProfile",
            },
          });
        } else {
          // Fallback navigation
          navigation.navigate("MemberProfile");
        }
      } else {
        navigation.navigate("MemberPublicProfile", {
          memberId: head.member_id,
        });
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar translucent backgroundColor="transparent" style="dark" />
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          <SkeletonProfileHeader type="community" />
          <SkeletonPostGrid />
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar translucent backgroundColor="transparent" style="dark" />
        <Text style={{ color: "#FF3B30" }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DynamicStatusBar style="light-content" />

      {/* Add gradient overlay only when no banner */}
      {!profile?.banner_url && <GradientSafeArea variant="primary" />}

      {/* Custom Fixed Header (Status Bar Scrim Only) */}
      <View style={[styles.headerContainer, { height: insets.top }]}>
        {/* iOS Blur */}
        {Platform.OS === "ios" && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 20],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Background Fade */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(250, 249, 247, 0.98)",
              opacity: scrollY.interpolate({
                inputRange: [0, 20],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </View>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[
          styles.backBtn,
          {
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            zIndex: 1100,
          },
        ]}
      >
        <ArrowLeft size={24} color="#1D1D1F" />
      </TouchableOpacity>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              HapticsService.triggerImpactLight();
              loadProfile();
              loadPosts(true);
              loadEvents();
            }}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {/* Banner - only render if banner exists */}
        {profile?.banner_url && (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.bannerImage}
            />
            <BlurView intensity={15} tint="dark" style={styles.bannerOverlay} />
          </View>
        )}

        <View
          style={[
            styles.summarySection,
            !profile?.banner_url && { paddingTop: insets.top + 60 },
          ]}
        >
          <View
            style={[
              styles.profileHeader,
              !profile?.banner_url && styles.profileHeaderNoBanner,
            ]}
          >
            <View style={styles.avatarWrapper}>
              {profile?.logo_url && /^https?:\/\//.test(profile.logo_url) ? (
                <Image
                  source={{ uri: profile.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(profile?.name || "Community")}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.avatar,
                    { justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <Text
                    style={{ fontSize: 36, fontWeight: "bold", color: "#fff" }}
                  >
                    {getInitials(profile?.name || "Community")}
                  </Text>
                </LinearGradient>
              )}
            </View>
            {/* Identity Block */}
            <Text style={styles.communityName}>
              {profile?.name || "Community"}
            </Text>
            {profile?.username && (
              <View style={styles.usernameRow}>
                <Text style={styles.usernameText}>@{profile.username}</Text>
              </View>
            )}
            {Array.isArray(profile?.categories) &&
              profile.categories.length > 0 && (
                <View style={styles.categoriesRow}>
                  {profile.categories.map((cat, idx) => (
                    <ThemeChip key={cat} label={cat} index={idx} />
                  ))}
                </View>
              )}

            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("CommunityPublicEventsList", {
                  communityId: profile.id,
                  initialTab: "upcoming",
                })
              }
            >
              <Text style={styles.statNumber}>
                {(profile.events_scheduled_count || 0) +
                  (profile.events_hosted_count || 0)}
              </Text>
              <Text style={styles.statLabel}>Events</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {profile.followers_count || 0}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                navigation.push("CommunityFollowingList", {
                  communityId,
                  title: "Following",
                });
              }}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.posts_count || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              gap: 10,
              width: "100%",
              marginBottom: 25,
            }}
          >
            <GradientButton
              title={isFollowing ? "Following" : "Follow"}
              colors={
                isFollowing
                  ? ["transparent", "transparent"]
                  : ["#448AFF", "#2962FF"] // Match Create Post
              }
              textStyle={
                isFollowing
                  ? { fontFamily: FONTS.medium, color: "#2962FF" }
                  : { fontFamily: FONTS.semiBold, color: "#FFFFFF" }
              }
              style={[
                { flex: 1, borderRadius: 16, overflow: "hidden" },
                isFollowing && {
                  borderWidth: 1,
                  borderColor: "rgba(68, 138, 255, 0.2)",
                  backgroundColor: "rgba(68, 138, 255, 0.12)",
                  shadowColor: "transparent",
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  elevation: 0,
                },
              ]}
              gradientStyle={
                isFollowing ? { borderRadius: 0 } : { borderRadius: 16 }
              }
              onPress={async () => {
                HapticsService.triggerImpactLight();
                if (isFollowing) {
                  // Unfollow logic
                  try {
                    await unfollowCommunity(communityId);
                    setIsFollowing(false);
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followers_count: Math.max(
                              0,
                              (prev.followers_count || 0) - 1,
                            ),
                          }
                        : prev,
                    );
                    EventBus.emit("follow-updated", {
                      communityId,
                      isFollowing: false,
                    });
                  } catch (e) {
                    console.error("Unfollow failed", e);
                  }
                } else {
                  // Follow logic
                  try {
                    await followCommunity(communityId);
                    setIsFollowing(true);
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followers_count: (prev.followers_count || 0) + 1,
                          }
                        : prev,
                    );
                    EventBus.emit("follow-updated", {
                      communityId,
                      isFollowing: true,
                    });
                  } catch (e) {
                    console.error("Follow failed", e);
                  }
                }
              }}
            />
            <GradientButton
              title="Message"
              colors={["#111827", "#111827"]} // Charcoal Black
              style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
              gradientStyle={{ borderRadius: 16 }}
              textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
              onPress={() => {
                HapticsService.triggerImpactLight();
                const root = navigation.getParent()?.getParent()?.getParent();
                if (root) {
                  root.navigate("MemberHome", {
                    screen: "Home",
                    params: {
                      screen: "Chat",
                      params: {
                        recipientId: communityId,
                        recipientType: "community",
                      },
                    },
                  });
                }
              }}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Community Heads</Text>
            </View>
            {profile?.heads && profile.heads.length > 0 ? (
              <View style={{ paddingVertical: 4 }}>
                {profile.heads.map((head, idx) => {
                  const canNavigate = !!head.member_id;
                  return (
                    <TouchableOpacity
                      key={head.id || idx}
                      style={[
                        styles.headRow,
                        !canNavigate && { opacity: 0.85 },
                      ]}
                      onPress={() => handleHeadPress(head)}
                      disabled={!canNavigate}
                    >
                      {head.profile_pic_url ? (
                        <Image
                          source={{
                            uri: head.profile_pic_url,
                          }}
                          style={styles.headAvatar}
                        />
                      ) : (
                        <LinearGradient
                          colors={getGradientForName(head.name || "Head")}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.headAvatar,
                            { justifyContent: "center", alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "bold",
                              color: "#fff",
                            }}
                          >
                            {getInitials(head.name || "H")}
                          </Text>
                        </LinearGradient>
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.headName}>{head.name}</Text>
                        {head.is_primary && (
                          <LinearGradient
                            colors={["#FFF1F2", "#FFE4E6"]}
                            style={styles.primaryStarGradient}
                          >
                            <Star size={14} color="#E11D48" fill="#E11D48" />
                          </LinearGradient>
                        )}
                        {head.email && (
                          <Text style={styles.headSub}>{head.email}</Text>
                        )}
                      </View>
                      {canNavigate && (
                        <ChevronRight size={20} color="#8E8E93" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No heads listed</Text>
            )}
          </View>

          {profile?.sponsor_types &&
            profile.sponsor_types.length > 0 &&
            viewerRole !== "member" &&
            viewerRole !== "venue" && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Looking for Sponsors</Text>
                </View>
                <View style={styles.sponsorTypesList}>
                  {profile.sponsor_types.map((type, idx) => (
                    <ThemeChip
                      key={`st-${idx}`}
                      label={String(type)}
                      index={idx}
                    />
                  ))}
                </View>
              </View>
            )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {["posts", "community", "events"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setActiveTab(tab);
              }}
              onLayout={(e) => handleTabLayout(tab, e)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View
            style={[
              styles.activeTabIndicator,
              {
                transform: [{ translateX: tabUnderlineX }],
                width: tabUnderlineScale, // This should be working if state is correct
              },
            ]}
          />
        </View>

        <View style={styles.postsSection}>
          {/* Posts Tab - Media Only (Images/Videos) */}
          {activeTab === "posts" &&
            (() => {
              const INTERACTIVE_TYPES = [
                "poll",
                "prompt",
                "qna",
                "challenge",
                "opportunity",
              ];
              const mediaPosts = posts.filter((p) => {
                const postType = p.post_type || p.type;
                return !INTERACTIVE_TYPES.includes(postType);
              });

              return mediaPosts.length > 0 ? (
                <FlatList
                  data={mediaPosts}
                  keyExtractor={(item) => item.id.toString()}
                  numColumns={3}
                  columnWrapperStyle={{
                    justifyContent: "flex-start",
                    marginBottom: 2,
                    gap: 2,
                  }}
                  scrollEnabled={false}
                  renderItem={renderGridItem}
                />
              ) : (
                <View style={styles.emptyPostsContainer}>
                  <Text style={[styles.emptyPostsText, { fontWeight: "bold" }]}>
                    No posts
                  </Text>
                </View>
              );
            })()}

          {/* Community Tab - Interactive Posts */}
          {activeTab === "community" &&
            (() => {
              const interactivePosts = posts.filter((p) => {
                const postType = p.post_type || p.type;
                return [
                  "poll",
                  "prompt",
                  "qna",
                  "challenge",
                  "opportunity",
                ].includes(postType);
              });

              return interactivePosts.length > 0 ? (
                <View style={styles.communityPostsList}>
                  {interactivePosts.map((post) => (
                    <View key={post.id} style={styles.communityPostItem}>
                      <EditorialPostCard
                        post={post}
                        onLike={(postId, isLiked, count) => {
                          setPosts((prevPosts) =>
                            prevPosts.map((p) =>
                              p.id === postId
                                ? { ...p, is_liked: isLiked, like_count: count }
                                : p,
                            ),
                          );
                        }}
                        onComment={(postId) => openCommentsModal(postId)}
                        onShare={() => {}}
                        onFollow={() => {}}
                        showFollowButton={false}
                        currentUserId={currentUserId}
                        currentUserType="member" // Viewing as member
                        onUserPress={(userId, userType) => {}}
                        onPostUpdate={(updatedPost) => {
                          setPosts((prevPosts) =>
                            prevPosts.map((p) =>
                              p.id === updatedPost.id ? updatedPost : p,
                            ),
                          );
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPostsContainer}>
                  <Text style={[styles.emptyPostsText, { fontWeight: "bold" }]}>
                    No community posts yet
                  </Text>
                  <Text style={styles.emptyPostsSubtext}>
                    No polls, prompts or challenges shared yet.
                  </Text>
                </View>
              );
            })()}

          {/* Events Tab */}
          {activeTab === "events" &&
            (() => {
              if (communityEvents.length === 0) {
                return (
                  <View style={styles.emptyPostsContainer}>
                    <Text
                      style={[styles.emptyPostsText, { fontWeight: "bold" }]}
                    >
                      No events yet
                    </Text>
                    <Text style={styles.emptyPostsSubtext}>
                      This community hasn't hosted any events yet.
                    </Text>
                  </View>
                );
              }

              const formatEventDate = (dateString) => {
                const date = new Date(dateString);
                const day = date.getDate();
                const months = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                return `${day} ${months[date.getMonth()]}`;
              };
              const formatEventTime = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
              };
              const getLowestPrice = (item) => {
                if (item.ticket_types && item.ticket_types.length > 0) {
                  const prices = item.ticket_types
                    .map((t) => parseFloat(t.base_price) || 0)
                    .filter((p) => p > 0);
                  if (prices.length > 0) return Math.min(...prices);
                }
                if (item.min_price && parseFloat(item.min_price) > 0)
                  return parseFloat(item.min_price);
                if (item.base_price && parseFloat(item.base_price) > 0)
                  return parseFloat(item.base_price);
                return null;
              };
              const monthNames = [
                "JAN",
                "FEB",
                "MAR",
                "APR",
                "MAY",
                "JUN",
                "JUL",
                "AUG",
                "SEP",
                "OCT",
                "NOV",
                "DEC",
              ];

              return (
                <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                  {communityEvents.map((item) => {
                    const displayImage =
                      item.banner_carousel?.[0]?.image_url ||
                      item.banner_url ||
                      item.image_url;
                    const lowestPrice = getLowestPrice(item);
                    const dateObj = new Date(
                      item.event_date || item.start_datetime,
                    );
                    const month = monthNames[dateObj.getMonth()];
                    const day = dateObj.getDate();
                    const isPast = dateObj < new Date();
                    const isCancelled = item.is_cancelled;
                    const locationDisplay =
                      item.event_type === "virtual"
                        ? "Virtual Event"
                        : item.location_name || item.venue_name || "In-person";

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate("EventDetails", {
                            eventId: item.id,
                            eventData: item,
                          })
                        }
                        style={{
                          backgroundColor: COLORS.surface,
                          borderRadius: 20,
                          marginBottom: 24,
                          overflow: "hidden",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.06,
                          shadowRadius: 6,
                          elevation: 4,
                        }}
                      >
                        <View
                          style={{
                            width: "100%",
                            height: 200,
                            position: "relative",
                          }}
                        >
                          {displayImage ? (
                            <Image
                              source={{ uri: displayImage }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <LinearGradient
                              colors={getGradientForName(item.title || "Event")}
                              style={{ width: "100%", height: "100%" }}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            />
                          )}
                          {isPast && (
                            <View
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: "rgba(0,0,0,0.08)",
                              }}
                            />
                          )}
                          <View
                            style={{
                              position: "absolute",
                              top: 12,
                              left: 12,
                              backgroundColor: "rgba(255,255,255,0.95)",
                              paddingHorizontal: 8,
                              paddingVertical: 6,
                              borderRadius: 10,
                              alignItems: "center",
                              minWidth: 44,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: FONTS.semiBold,
                                color: PRIMARY_COLOR,
                                marginBottom: 2,
                              }}
                            >
                              {month}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: FONTS.primary,
                                color: TEXT_COLOR,
                              }}
                            >
                              {day}
                            </Text>
                          </View>
                          {isCancelled && (
                            <View
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: "rgba(0,0,0,0.5)",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontFamily: FONTS.primary,
                                  color: "#FFFFFF",
                                  letterSpacing: 1,
                                }}
                              >
                                CANCELLED
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ padding: 16 }}>
                          <Text
                            style={{
                              fontSize: 18,
                              fontFamily: FONTS.semiBold,
                              color: TEXT_COLOR,
                              marginBottom: 10,
                            }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: FONTS.regular,
                                color: isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR,
                              }}
                            >
                              {formatEventDate(
                                item.event_date || item.start_datetime,
                              )}{" "}
                              •{" "}
                              {formatEventTime(
                                item.event_date || item.start_datetime,
                              )}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <Ionicons
                              name={
                                item.event_type === "virtual"
                                  ? "videocam-outline"
                                  : "location-outline"
                              }
                              size={14}
                              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: FONTS.regular,
                                color: isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR,
                              }}
                              numberOfLines={1}
                            >
                              {locationDisplay}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 12,
                              paddingTop: 12,
                              borderTopWidth: 1,
                              borderTopColor: "#F3F4F6",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#E5E7EB",
                                    zIndex: 3,
                                  }}
                                />
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#D1D5DB",
                                    marginLeft: -8,
                                    zIndex: 2,
                                  }}
                                />
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#9CA3AF",
                                    marginLeft: -8,
                                    zIndex: 1,
                                  }}
                                />
                              </View>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontFamily: FONTS.medium,
                                  color: "#36454F",
                                  marginLeft: 6,
                                }}
                              >
                                +
                                {item.attendee_count ||
                                  item.registration_count ||
                                  0}
                              </Text>
                            </View>
                            <View>
                              {lowestPrice ? (
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontFamily: FONTS.semiBold,
                                    color: "#36454F",
                                  }}
                                >
                                  ₹{lowestPrice}
                                </Text>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontFamily: FONTS.semiBold,
                                    color: "#5fab56",
                                  }}
                                >
                                  Free
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
        </View>
      </Animated.ScrollView>
      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts.filter((p) => {
            // Only show media posts in modal (exclude Community tab content)
            const postType = p.post_type || p.type;
            const isInteractive = [
              "poll",
              "prompt",
              "qna",
              "challenge",
              "opportunity",
            ].includes(postType);
            return !isInteractive;
          })}
          initialPostId={selectedPost?.id}
          onClose={closePostModal}
          currentUserId={currentUserId}
          currentUserType="member"
          navigation={navigation}
          onLikeUpdate={(postId, isLiked, count) => {
            // Update local state
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === postId
                  ? { ...p, is_liked: isLiked, like_count: count }
                  : p,
              ),
            );
            if (selectedPost && selectedPost.id === postId) {
              setSelectedPost((prev) =>
                prev ? { ...prev, is_liked: isLiked, like_count: count } : prev,
              );
            }
          }}
          onComment={(postId) => openCommentsModal(postId)}
          onShare={(postId) => {
            // Share logic
          }}
          onSave={(postId, isSaved) => {
            // Save logic
          }}
          onFollow={() => {}}
          onUserPress={(userId, userType) => {
            // Navigate to user profile
            if (userType === "community") {
              navigation.navigate("CommunityPublicProfile", {
                communityId: userId,
              });
            } else {
              navigation.navigate("MemberPublicProfile", { memberId: userId });
            }
          }}
          onPostUpdate={(updatedPost) => {
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === updatedPost.id ? { ...p, ...updatedPost } : p,
              ),
            );
            if (selectedPost && selectedPost.id === updatedPost.id) {
              setSelectedPost((prev) =>
                prev ? { ...prev, ...updatedPost } : prev,
              );
            }
          }}
        />
      )}

      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        onClose={closeCommentsModal}
        onCommentCountChange={(postId) => {
          // Update comment count in posts
          setPosts((prevPosts) =>
            prevPosts.map((p) =>
              p.id === postId
                ? { ...p, comment_count: (p.comment_count || 0) + 1 }
                : p,
            ),
          );
        }}
        navigation={navigation}
      />
    </View>
  );
}
