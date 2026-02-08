import React, { useCallback, useEffect, useState, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import {
  getPublicCommunity,
  getCommunityPosts,
  followCommunity,
  unfollowCommunity,
} from "../../../api/communities";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import CommentsModal from "../../../components/CommentsModal";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { apiPost, apiDelete } from "../../../api/client";
import LikeStateManager from "../../../utils/LikeStateManager";
import {
  getGradientForName,
  getInitials,
} from "../../../utils/AvatarGenerator";
import {
  COLORS,
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
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
    overflow: "visible",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: AVATAR_SIZE / 2,
  },
  communityName: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  usernameText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#555555",
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
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
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  headAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F2F2F7",
  },
  headName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  primaryTag: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: "600",
    marginTop: 2,
  },
  headSub: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  emptyText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  postsSection: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  gridItem: {
    backgroundColor: "#E5E5EA",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridPlaceholder: {
    backgroundColor: "#F2F2F7",
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
        // Normalize is_liked field for all posts - ensure it's explicitly true or false
        const normalizedPosts = rawPosts.map((post) => ({
          ...post,
          is_liked: post.is_liked === true,
          isLiked: post.is_liked === true,
        }));

        // Merge with cached like states to fix backend returning stale is_liked data
        const mergedPosts =
          await LikeStateManager.mergeLikeStates(normalizedPosts);

        console.log(
          "[CommunityPublicProfile] loadPosts - Setting posts, first post:",
          mergedPosts[0]
            ? {
                id: mergedPosts[0].id,
                is_liked: mergedPosts[0].is_liked,
                like_count: mergedPosts[0].like_count,
              }
            : "NO POSTS",
        );
        setPosts(mergedPosts);
        const received = (data?.posts || data || []).length;
        const nextOffset = (reset ? 0 : offset) + received;
        setOffset(nextOffset);
        setHasMore(received >= 21);
      } catch (e) {
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
      await Promise.all([loadProfile(), loadPosts(true)]);
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
    const firstImageUrl = Array.isArray(item?.image_urls)
      ? item.image_urls
          .flat()
          .find((u) => typeof u === "string" && u.startsWith("http"))
      : undefined;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openPostModal(item.id)}
        style={[
          styles.gridItem,
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE * 1.35, // Portrait aspect ratio
            marginBottom: 0,
            marginRight: 0, // Handled by gap
            borderRadius: 3, // Subtle radius
            overflow: "hidden", // Ensure image clips to radius
          },
        ]}
      >
        {firstImageUrl ? (
          <Image source={{ uri: firstImageUrl }} style={styles.gridImage} />
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]} />
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
      <StatusBar translucent backgroundColor="transparent" style="dark" />
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[
          styles.backBtn,
          {
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            zIndex: 100,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Banner - only render if banner exists */}
        {profile?.banner_url && (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.bannerImage}
            />
            {/* Blur + Dim Overlay for mood effect */}
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
            {/* Identity Block: Name â†’ Username â†’ Categories â†’ Bio */}
            <Text style={styles.communityName}>
              {profile?.name || "Community"}
            </Text>
            {profile?.username && (
              <Text style={styles.usernameText}>@{profile.username}</Text>
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
                <Text style={styles.statValue}>
                  {(profile.events_scheduled_count || 0) +
                    (profile.events_hosted_count || 0)}
                </Text>
                <Text style={styles.statLabel}>Events</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
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
                <Text style={styles.statValue}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.posts_count || 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Community Heads</Text>
            {profile?.heads && profile.heads.length > 0 ? (
              profile.heads.map((head, idx) => {
                const canNavigate = !!head.member_id;
                return (
                  <TouchableOpacity
                    key={head.id || idx}
                    style={[styles.headRow, !canNavigate && { opacity: 0.85 }]}
                    onPress={() => handleHeadPress(head)}
                    disabled={!canNavigate}
                  >
                    {head.profile_pic_url || head.member_photo_url ? (
                      <Image
                        source={{
                          uri: head.profile_pic_url || head.member_photo_url,
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.headName}>{head.name}</Text>
                      {head.is_primary && (
                        <Text style={styles.primaryTag}>Primary</Text>
                      )}
                      {head.email && (
                        <Text style={styles.headSub}>{head.email}</Text>
                      )}
                      {["community", "sponsor", "venue"].includes(viewerRole) &&
                        head.phone && (
                          <Text style={styles.headSub}>
                            {formatPhoneNumber(head.phone)}
                          </Text>
                        )}
                    </View>
                    {canNavigate && (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#8E8E93"
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No heads listed</Text>
            )}
          </View>

          {profile?.sponsor_types &&
            profile.sponsor_types.length > 0 &&
            viewerRole !== "member" &&
            viewerRole !== "venue" && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Sponsor Types</Text>
                <View style={styles.chipRow}>
                  {profile.sponsor_types.map((type, idx) => (
                    <ThemeChip
                      key={`st-${idx}`}
                      label={String(type)}
                      index={idx + 3}
                    />
                  ))}
                </View>
              </View>
            )}

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              gap: 10,
              width: "100%",
              paddingHorizontal: 20,
              marginBottom: 25,
            }}
          >
            <GradientButton
              title={isFollowing ? "Following" : "Follow"}
              colors={
                isFollowing
                  ? ["#E5E5EA", "#E5E5EA"] // Gray for following
                  : ["#00C6FF", "#0072FF"] // Blue/Cyan Gradient
              }
              textStyle={
                isFollowing
                  ? { color: "#1D1D1F" }
                  : { color: "#FFFFFF", fontWeight: "bold" }
              }
              style={{ flex: 1 }}
              onPress={async () => {
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
              colors={["#1D1D1F", "#1D1D1F"]} // Black
              style={{ flex: 1 }}
              onPress={() => {
                // Navigate to Chat screen via Home stack
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
                } else {
                  // Fallback: try to navigate through parent
                  const parent = navigation.getParent();
                  if (parent) {
                    parent.navigate("Home", {
                      screen: "Chat",
                      params: {
                        recipientId: communityId,
                        recipientType: "community",
                      },
                    });
                  }
                }
              }}
            />
          </View>
        </View>

        <View style={styles.postsSection}>
          {posts.length > 0 ? (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              columnWrapperStyle={{
                justifyContent: "flex-start",
                marginBottom: GAP,
                gap: GAP,
              }}
              renderItem={renderGridItem}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyPostsContainer}>
              <Text style={[styles.emptyPostsText, { fontWeight: "bold" }]}>
                No posts
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts}
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
