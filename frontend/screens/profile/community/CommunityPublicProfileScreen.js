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
import {
  getPublicCommunity,
  getCommunityPosts,
  followCommunity,
  unfollowCommunity,
} from "../../../api/communities";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import CommentsModal from "../../../components/CommentsModal";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { apiPost, apiDelete } from "../../../api/client";
import LikeStateManager from "../../../utils/LikeStateManager";

const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || String(value);
};

const { width: screenWidth } = Dimensions.get("window");
const GAP = 10;
const ITEM_SIZE = (screenWidth - 40 - GAP * 2) / 3;

export default function CommunityPublicProfileScreen({ route, navigation }) {
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
        const mergedPosts = LikeStateManager.mergeLikeStates(normalizedPosts);
        
        console.log('[CommunityPublicProfile] loadPosts - Setting posts, first post:', mergedPosts[0] ? { id: mergedPosts[0].id, is_liked: mergedPosts[0].is_liked, like_count: mergedPosts[0].like_count } : 'NO POSTS');
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
    [communityId, offset, posts, hasMore, loadingMore]
  );

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile])
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
            token
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
    const handlePostLikeUpdate = (payload) => {
      console.log('[CommunityPublicProfile] EventBus post-like-updated received:', payload);
      if (!payload?.postId) return;
      
      // Cache the like state to persist across component unmounts
      LikeStateManager.setLikeState(payload.postId, payload.isLiked);
      
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
            : post
        );
        console.log('[CommunityPublicProfile] Posts updated via EventBus, updated post:', updatedPosts.find(p => p.id === payload.postId));
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
            : post
        )
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
      handlePostLikeUpdate
    );
    const unsubscribeComment = EventBus.on(
      "post-comment-updated",
      handlePostCommentUpdate
    );
    const unsubscribeDeleted = EventBus.on(
      "post-deleted",
      handlePostDeleted
    );

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
      if (unsubscribeDeleted) unsubscribeDeleted();
    };
  }, [selectedPost]); // Added selectedPost dependency

  const openPostModal = (postId) => {
    console.log('[CommunityPublicProfile] openPostModal called with postId:', postId);
    // Look up the post from current state to ensure we have fresh data
    const post = posts.find(p => p.id === postId);
    console.log('[CommunityPublicProfile] Found post from state:', post ? { id: post.id, is_liked: post.is_liked, like_count: post.like_count } : 'NOT FOUND');
    if (!post) return;
    
    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    console.log('[CommunityPublicProfile] Normalized is_liked:', normalizedIsLiked, 'from post.is_liked:', post.is_liked);
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
            : p
        )
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
            height: ITEM_SIZE,
            marginRight: (index + 1) % 3 === 0 ? 0 : GAP,
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5f27cd" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={{ color: "#FF3B30" }}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          @{profile?.username || profile?.name || "community"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={styles.bannerContainer}>
          {profile?.banner_url ? (
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.bannerImage}
            />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <Text style={styles.bannerPlaceholderText}>
                Banner (1200 x 400 recommended)
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{
                  uri:
                    profile?.logo_url && /^https?:\/\//.test(profile.logo_url)
                      ? profile.logo_url
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          profile?.name || "Community"
                        )}&background=5f27cd&color=FFFFFF&size=120&bold=true`,
                }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.communityName}>
              {profile?.name || "Community"}
            </Text>
            {Array.isArray(profile?.categories) &&
              profile.categories.length > 0 && (
                <View style={styles.categoriesRow}>
                  {profile.categories.map((cat) => (
                    <View key={cat} style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{cat}</Text>
                    </View>
                  ))}
                </View>
              )}

            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{postsCount}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                navigation.navigate("CommunityFollowersList", {
                  communityId,
                  title: "Followers",
                });
              }}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                navigation.navigate("CommunityFollowingList", {
                  communityId,
                  title: "Following",
                });
              }}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
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
                    <Image
                      source={{
                        uri:
                          head.profile_pic_url ||
                          head.member_photo_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            head.name || "Head"
                          )}&background=5f27cd&color=FFFFFF&size=64&bold=true`,
                      }}
                      style={styles.headAvatar}
                    />
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
                    <View key={`st-${idx}`} style={styles.chip}>
                      <Text style={styles.chipText}>{String(type)}</Text>
                    </View>
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
            }}
          >
            <TouchableOpacity
              style={[
                styles.followCta,
                { flex: 1 },
                isFollowing ? styles.followingCta : styles.followPrimary,
              ]}
              onPress={async () => {
                const next = !isFollowing;
                setIsFollowing(next);
                try {
                  if (next) {
                    await followCommunity(communityId);
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followers_count: (prev.followers_count || 0) + 1,
                          }
                        : prev
                    );
                  } else {
                    await unfollowCommunity(communityId);
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followers_count: Math.max(
                              0,
                              (prev.followers_count || 0) - 1
                            ),
                          }
                        : prev
                    );
                  }
                  // Get current user info for EventBus
                  let currentUserId = null;
                  let currentUserType = "community";
                  try {
                    const token = await getAuthToken();
                    const email = await getAuthEmail();
                    if (token && email) {
                      const profileResponse = await apiPost(
                        "/auth/get-user-profile",
                        { email },
                        10000,
                        token
                      );
                      if (profileResponse?.profile?.id) {
                        currentUserId = profileResponse.profile.id;
                        currentUserType = profileResponse.role || "community";
                      }
                    }
                  } catch (e) {
                    console.error("Error getting current user:", e);
                  }

                  EventBus.emit("follow-updated", {
                    communityId,
                    isFollowing: next,
                    followerId: currentUserId,
                    followerType: currentUserType,
                  });
                } catch (e) {
                  setIsFollowing(!next);
                }
              }}
            >
              <Text
                style={[
                  styles.followCtaText,
                  isFollowing
                    ? styles.followingCtaText
                    : styles.followPrimaryText,
                ]}
              >
                {isFollowing ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followCta, { flex: 1 }, styles.messageCta]}
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
            >
              <Text style={styles.messageCtaText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Community Posts</Text>
          {posts.length > 0 ? (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              columnWrapperStyle={{ justifyContent: 'flex-start', marginBottom: GAP }}
              renderItem={renderGridItem}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyPostsContainer}>
              <Text style={styles.emptyPostsText}>No posts yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {selectedPost && (
        <PostModal
          visible={postModalVisible}
          post={selectedPost}
          onClose={closePostModal}
          profile={profile}
          onLikeUpdate={handlePostLike}
          onOpenComments={openCommentsModal}
          onCloseComments={closeCommentsModal}
          navigation={navigation}
          currentUserId={currentUserId}
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
                : p
            )
          );
        }}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

// PostModal Component
const PostModal = ({
  visible,
  post,
  onClose,
  profile: profileProp,
  onLikeUpdate,
  onOpenComments,
  onCloseComments,
  navigation,
  currentUserId,
}) => {
  const initialIsLiked = post?.is_liked === true;
  const [likes, setLikes] = useState(post?.like_count || 0);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [commentCount, setCommentCount] = useState(post?.comment_count || 0);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [localCommentsVisible, setLocalCommentsVisible] = useState(false);
  const justUpdatedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (justUpdatedRef.current) {
      justUpdatedRef.current = false;
      return;
    }
    const newIsLiked = post?.is_liked === true;
    setIsLiked(newIsLiked);
    setLikes(post?.like_count || 0);
    setCommentCount(post?.comment_count || 0);
  }, [
    post?.is_liked,
    post?.like_count,
    post?.comment_count,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      setShowDeleteMenu(false);
    }
  }, [visible]);

  useEffect(() => {
    console.log('[PostModal] showDeleteMenu state changed:', showDeleteMenu);
  }, [showDeleteMenu]);

  const isOwnPost = () => {
    if (!post) {
      console.log('[PostModal] isOwnPost: No post');
      return false;
    }
    console.log('[PostModal] isOwnPost check:', {
      postAuthorId: post.author_id,
      currentUserId: currentUserId,
      isOwner: currentUserId && String(post.author_id) === String(currentUserId)
    });
    // Check if current logged-in user is the author of this post
    // Use currentUserId which is set from the actual logged-in user's profile
    if (currentUserId) {
      return String(post.author_id) === String(currentUserId);
    }
    return false;
  };

  const handleDeletePost = async () => {
    if (!post?.id) return;
    if (!isOwnPost()) {
      Alert.alert("Error", "You can only delete your own posts");
      setShowDeleteMenu(false);
      return;
    }
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowDeleteMenu(false),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const token = await getAuthToken();
              await apiDelete(`/posts/${post.id}`, null, 15000, token);
              if (onCloseComments) onCloseComments();
              onClose();
              Alert.alert("Success", "Post deleted successfully");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", error?.message || "Failed to delete post");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLikeToggle = async () => {
    if (isLiking) return;
    setIsLiking(true);
    justUpdatedRef.current = true;
    try {
      const token = await getAuthToken();
      if (isLiked) {
        await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
        setLikes((prev) => {
          const newCount = prev - 1;
          if (onLikeUpdate) {
            onLikeUpdate(post.id, false, newCount);
          }
          // Emit event for other screens to update
          EventBus.emit("post-like-updated", {
            postId: post.id,
            isLiked: false,
            likeCount: newCount,
            commentCount: commentCount,
          });
          return newCount;
        });
        setIsLiked(false);
      } else {
        await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
        setLikes((prev) => {
          const newCount = prev + 1;
          if (onLikeUpdate) {
            onLikeUpdate(post.id, true, newCount);
          }
          // Emit event for other screens to update
          EventBus.emit("post-like-updated", {
            postId: post.id,
            isLiked: true,
            likeCount: newCount,
            commentCount: commentCount,
          });
          return newCount;
        });
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Error liking post:", error);
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("already liked") ||
        errorMessage.includes("not liked")
      ) {
        justUpdatedRef.current = false;
        return;
      }
      justUpdatedRef.current = false;
    } finally {
      setIsLiking(false);
      setTimeout(() => {
        justUpdatedRef.current = false;
      }, 100);
    }
  };

  if (!post) return null;
  const images = Array.isArray(post.image_urls)
    ? post.image_urls
        .flat()
        .filter((u) => typeof u === "string" && u.startsWith("http"))
    : [];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentPostId, setCurrentPostId] = useState(post?.id);
  useEffect(() => {
    if (post?.id && post.id !== currentPostId) {
      setCurrentPostId(post.id);
    }
  }, [post?.id]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={postModalStyles.postModalSafeArea}>
        <View style={postModalStyles.postModalContainer}>
          <View style={postModalStyles.postModalHeader}>
            <View style={postModalStyles.postModalHeaderTop}>
              <TouchableOpacity
                onPress={onClose}
                style={postModalStyles.postModalBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={postModalStyles.postModalHeaderTitle}>Posts</Text>
              <View style={postModalStyles.postModalMoreButton}>
                {isOwnPost() && (
                  <TouchableOpacity 
                    onPress={() => {
                      console.log('[PostModal] 3-dot button pressed, setting showDeleteMenu to true');
                      setShowDeleteMenu(true);
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={postModalStyles.postModalHeaderUserInfo}>
              <Image
                source={{
                  uri:
                    post.author_photo_url ||
                    post.author_logo_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      post.author_name || post.author_username || "Community"
                    )}&background=5f27cd&color=FFFFFF`,
                }}
                style={postModalStyles.postModalHeaderAvatar}
              />
              <View style={postModalStyles.postModalHeaderText}>
                <Text style={postModalStyles.postModalHeaderUsername}>
                  {post.author_username || post.author_name || "Community"}
                </Text>
                <Text style={postModalStyles.postModalHeaderDate}>
                  {formatDate(post.created_at)}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={postModalStyles.postModalScrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={postModalStyles.postModalImageWrapper}>
              {images.length > 0 && (
                <>
                  <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(_, idx) => idx.toString()}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(
                        e.nativeEvent.contentOffset.x / screenWidth
                      );
                      setCurrentImageIndex(index);
                    }}
                    renderItem={({ item }) => (
                      <View style={postModalStyles.postModalImageFrame}>
                        <Image
                          source={{ uri: item }}
                          style={postModalStyles.postModalImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                    style={postModalStyles.modalImageCarousel}
                  />
                  {images.length > 1 && (
                    <View style={postModalStyles.postModalImageIndicator}>
                      <Text style={postModalStyles.postModalImageIndicatorText}>
                        {currentImageIndex + 1}/{images.length}
                      </Text>
                    </View>
                  )}
                  {images.length > 1 && (
                    <View style={postModalStyles.postModalImageDots}>
                      {images.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            postModalStyles.postModalDot,
                            idx === currentImageIndex &&
                              postModalStyles.postModalDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={postModalStyles.postModalActionsRow}>
              <TouchableOpacity
                onPress={handleLikeToggle}
                style={postModalStyles.modalActionButton}
                disabled={isLiking}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "#FF3040" : "#000"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setLocalCommentsVisible(true);
                }}
                style={postModalStyles.modalActionButton}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="chatbubble-outline" size={26} color="#000" />
                  {commentCount > 0 && (
                    <Text style={postModalStyles.postModalCommentCount}>
                      {commentCount}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {likes > 0 && (
              <View style={postModalStyles.postModalLikesSection}>
                <Text style={postModalStyles.postModalLikesText}>
                  {likes === 1 ? "1 like" : `${likes} likes`}
                </Text>
              </View>
            )}

            <View style={postModalStyles.postModalCaptionSection}>
              <Text style={postModalStyles.postModalCaption}>
                <Text style={postModalStyles.postModalCaptionUsername}>
                  {post.author_username || post.author_name || "Community"}
                </Text>
                {post.caption && ` ${post.caption}`}
              </Text>
            </View>

            {commentCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setLocalCommentsVisible(true);
                }}
                style={postModalStyles.postModalViewCommentsButton}
              >
                <Text style={postModalStyles.postModalViewCommentsText}>
                  View all {commentCount}{" "}
                  {commentCount === 1 ? "comment" : "comments"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <Modal
          visible={showDeleteMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteMenu(false)}
          onShow={() => console.log('[PostModal] Delete menu modal now showing')}
        >
          <TouchableOpacity
            style={postModalStyles.deleteMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowDeleteMenu(false)}
          >
            <View style={postModalStyles.deleteMenuContainer}>
              <TouchableOpacity
                style={[
                  postModalStyles.deleteMenuOption,
                  deleting && postModalStyles.deleteMenuOptionDisabled,
                ]}
                onPress={handleDeletePost}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FF3B30" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    <Text style={postModalStyles.deleteMenuOptionText}>
                      Delete Post
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={postModalStyles.deleteMenuOption}
                onPress={() => setShowDeleteMenu(false)}
              >
                <Text style={postModalStyles.deleteMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
      <CommentsModal
        visible={localCommentsVisible}
        postId={post?.id}
        onClose={() => setLocalCommentsVisible(false)}
        onCommentCountChange={(newCount) => setCommentCount(newCount)}
        isNestedModal={true}
        navigation={navigation}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#EFEFF4",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    backgroundColor: "#E5E5EA",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerPlaceholderText: {
    color: "#8E8E93",
    fontSize: 12,
  },
  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  profileHeader: {
    alignItems: "center",
    gap: 8,
    marginTop: -50,
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#E5E5EA",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  communityName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  bio: {
    fontSize: 14,
    lineHeight: 22,
    color: "#1D1D1F",
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
    fontSize: 20,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 12,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  headAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F2F2F7",
  },
  headName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  primaryTag: {
    fontSize: 12,
    color: "#5f27cd",
    fontWeight: "600",
    marginTop: 2,
  },
  headSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 12,
    color: "#1D1D1F",
  },
  locationSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  followCta: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  followPrimary: {
    backgroundColor: "#5f27cd",
  },
  followingCta: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  followCtaText: {
    fontSize: 16,
    fontWeight: "600",
  },
  followPrimaryText: {
    color: "#FFFFFF",
  },
  followingCtaText: {
    color: "#1D1D1F",
  },
  messageCta: {
    backgroundColor: "#1D1D1F",
    borderColor: "#1D1D1F",
  },
  messageCtaText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  gridItem: {
    marginBottom: GAP,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  gridPlaceholder: {
    backgroundColor: "#F2F2F7",
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: "#F2F2F7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: "#5f27cd",
    fontWeight: "600",
  },
  postsSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  emptyPostsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyPostsText: {
    color: "#8E8E93",
    fontSize: 14,
  },
});

const postModalStyles = StyleSheet.create({
  postModalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  postModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  postModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  postModalHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  postModalBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  postModalHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  postModalHeaderUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  postModalHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  postModalHeaderText: {
    flex: 1,
  },
  postModalHeaderUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  postModalHeaderDate: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  postModalMoreButton: {
    padding: 8,
    marginLeft: 8,
  },
  postModalScrollView: {
    flex: 1,
  },
  postModalImageWrapper: {
    width: screenWidth,
    height: screenWidth,
    backgroundColor: "#000",
    position: "relative",
  },
  modalImageCarousel: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageFrame: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  postModalImage: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postModalImageIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  postModalImageDots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  postModalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  postModalDotActive: {
    backgroundColor: "#FFFFFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  postModalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalActionButton: {
    padding: 8,
    marginRight: 16,
  },
  postModalCommentCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginLeft: 6,
  },
  postModalLikesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postModalLikesText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  postModalCaptionSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postModalCaption: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  postModalCaptionUsername: {
    fontWeight: "600",
    color: "#000",
  },
  postModalViewCommentsButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postModalViewCommentsText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  deleteMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  deleteMenuContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  deleteMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  deleteMenuOptionDisabled: {
    opacity: 0.5,
  },
  deleteMenuOptionText: {
    fontSize: 18,
    color: "#FF3B30",
    fontWeight: "600",
    marginLeft: 12,
  },
  deleteMenuCancelText: {
    fontSize: 18,
    color: "#000",
    fontWeight: "600",
  },
});
