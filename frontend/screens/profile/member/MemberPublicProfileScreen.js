import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
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
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getPublicMemberProfile,
  getMemberPosts,
  followMember,
  unfollowMember,
} from "../../../api/members";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import { getAuthToken } from "../../../api/auth";
import { apiPost, apiDelete } from "../../../api/client";
import CommentsModal from "../../../components/CommentsModal";
import LikeStateManager from "../../../utils/LikeStateManager";

import ThemeChip from "../../../components/ThemeChip";
import GradientButton from "../../../components/GradientButton";
import HapticsService from "../../../services/HapticsService";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

const { width: screenWidth } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = (screenWidth - GAP * 2) / 3;

// Map legacy constants to new theme for backward compatibility
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";

export default function MemberPublicProfileScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showAllPronouns, setShowAllPronouns] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const pendingPostUpdateRef = useRef(null);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicMemberProfile(memberId);
      // Normalize interests/pronouns fields - backend now returns them as arrays
      const normalized = {
        ...p,
        interests: Array.isArray(p?.interests)
          ? p.interests.filter((i) => i && String(i).trim())
          : typeof p?.interests === "string" && p.interests
          ? (() => {
              try {
                const parsed = JSON.parse(p.interests);
                return Array.isArray(parsed)
                  ? parsed.filter((i) => i && String(i).trim())
                  : [];
              } catch {
                return [];
              }
            })()
          : [],
        pronouns: Array.isArray(p?.pronouns)
          ? p.pronouns.filter((pron) => pron && String(pron).trim())
          : p?.pronouns && String(p.pronouns).trim()
          ? [String(p.pronouns).trim()]
          : [],
      };
      setProfile(normalized);
      setIsFollowing(!!p?.is_following);
    } catch (e) {
      setError(e?.message || "Failed to load profile");
    }
  }, [memberId]);

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
        const data = await getMemberPosts(memberId, {
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

        console.log(
          "[MemberPublicProfile] About to merge like states, posts count:",
          normalizedPosts.length
        );
        if (normalizedPosts.length > 0) {
          normalizedPosts.forEach((post, idx) => {
            console.log(`[MemberPublicProfile] Post ${idx + 1} before merge:`, {
              id: post.id,
              author: post.author_name,
              is_liked: post.is_liked,
            });
          });
        }

        // Merge with cached like states to fix backend returning stale is_liked data
        const mergedPosts = LikeStateManager.mergeLikeStates(normalizedPosts);

        if (mergedPosts.length > 0) {
          mergedPosts.forEach((post, idx) => {
            console.log(`[MemberPublicProfile] Post ${idx + 1} after merge:`, {
              id: post.id,
              author: post.author_name,
              is_liked: post.is_liked,
            });
          });
        }

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
    [memberId, offset, posts, hasMore, loadingMore]
  );

  // Refresh profile when screen gains focus
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
  }, [memberId]);

  // Listen for like updates from other screens (e.g., home feed)
  useEffect(() => {
    const unsubscribe = EventBus.on("post-like-updated", (payload) => {
      if (!payload?.postId) return;

      // Cache the like state to persist across component unmounts
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
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  const openPostModal = (post) => {
    console.log("[MemberPublicProfile] openPostModal called with post:", {
      id: post.id,
      author: post.author_name,
      is_liked: post.is_liked,
    });
    // Find the latest version of this post from the posts array
    const latestPost = posts.find((p) => p.id === post.id) || post;
    console.log("[MemberPublicProfile] Latest post from state:", {
      id: latestPost.id,
      is_liked: latestPost.is_liked,
    });
    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = latestPost.is_liked === true;
    const normalizedPost = {
      ...latestPost,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    console.log("[MemberPublicProfile] Normalized post for modal:", {
      id: normalizedPost.id,
      is_liked: normalizedPost.is_liked,
    });
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  };

  const handlePostLike = (postId, isLiked, likeCount) => {
    pendingPostUpdateRef.current = {
      postId,
      is_liked: isLiked,
      like_count: likeCount,
    };
  };

  const closePostModal = () => {
    // Apply any buffered like updates once when the modal closes
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

  const renderGridItem = ({ item, index }) => {
    const isLastInRow = (index + 1) % 3 === 0;
    const firstImageUrl = Array.isArray(item?.image_urls)
      ? item.image_urls
          .flat()
          .find((u) => typeof u === "string" && u.startsWith("http"))
      : undefined;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE * 1.35, // Increased height for portrait/taller look
          // No borderRadius for edge-to-edge feel, or small radius? User didn't specify, but "starting from edge" usually means square sharp or very small radius.
          // Let's keep small radius or remove it. "edge of the screen" implies full bleed. I will remove radius for a cleaner grid.
          // Actually, let's keep it simple: width/height update.
          // Removing marginRight as 'gap' in columnWrapper handles it.
          marginBottom: 0,
          borderRadius: 3,
          overflow: "hidden",
        }}
        onPress={() => item && openPostModal(item)}
        disabled={!item}
      >
        {item ? (
          <Image
            source={{ uri: firstImageUrl || "https://via.placeholder.com/150" }}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#F2F2F7" }} />
        )}
      </TouchableOpacity>
    );
  };

  // Render bio preserving explicit newlines exactly as typed
  const renderBio = (bioText) => {
    if (!bioText) return null;
    const lines = String(bioText).replace(/\r\n/g, "\n").split("\n");
    return (
      <Text style={styles.bioLeft}>
        {lines.map((line, idx) => (
          <Text key={`bio-${idx}`}>
            {line}
            {idx !== lines.length - 1 ? "\n" : ""}
          </Text>
        ))}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          <SkeletonProfileHeader type="member" />
          <SkeletonPostGrid />
        </ScrollView>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#FF3B30" }}>{error}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={posts}
            keyExtractor={(item, idx) => String(item?.id ?? idx)}
            renderItem={renderGridItem}
            numColumns={3}
            columnWrapperStyle={{
              justifyContent: "flex-start",
              marginBottom: GAP,
              gap: GAP, // Use gap property for cleaner spacing between columns
            }}
            contentContainerStyle={{
              paddingHorizontal: 0, // Padding handled by internal sections
              paddingTop: 0,
              paddingBottom: 120,
              flexGrow: posts.length === 0 ? 1 : 0,
            }}
            onEndReachedThreshold={0.6}
            onEndReached={() => loadPosts(false)}
            ListHeaderComponent={
              <View style={styles.profileSection}>
                <View style={styles.profileImageContainer}>
                  <Image
                    source={{
                      uri:
                        profile?.profile_photo_url ||
                        "https://via.placeholder.com/160",
                    }}
                    style={styles.profileImage}
                  />
                </View>
                <View style={styles.nameAndPronounsContainer}>
                  <Text style={styles.profileName}>
                    {profile?.full_name || "Member"}
                  </Text>
                  {Array.isArray(profile?.pronouns) &&
                  profile.pronouns.length > 0 ? (
                    <View style={styles.pronounsRowCentered}>
                      <View
                        key={`p-0`}
                        style={[styles.chip, styles.pronounChipSmall]}
                      >
                        <Text style={styles.chipText}>
                          {String(profile.pronouns[0]).replace(
                            /^[{\"]+|[}\"]+$/g,
                            ""
                          )}
                        </Text>
                      </View>
                      {profile.pronouns.length > 1 && !showAllPronouns ? (
                        <TouchableOpacity
                          onPress={() => setShowAllPronouns(true)}
                          style={[styles.chip, styles.pronounChipSmall]}
                        >
                          <Text style={styles.chipText}>
                            +{profile.pronouns.length - 1}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {profile.pronouns.length > 1 && showAllPronouns ? (
                        <TouchableOpacity
                          onPress={() => setShowAllPronouns(false)}
                          style={[
                            styles.chip,
                            styles.pronounChipSmall,
                            styles.chipRed,
                          ]}
                        >
                          <Text style={[styles.chipText, styles.chipTextRed]}>
                            -
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {Array.isArray(profile?.pronouns) &&
                profile.pronouns.length > 1 &&
                showAllPronouns ? (
                  <View style={styles.expandedPronounsRow}>
                    {profile.pronouns.slice(1).map((p, idx) => (
                      <View
                        key={`p-expanded-${idx}`}
                        style={[styles.chip, styles.pronounChipSmall]}
                      >
                        <Text style={styles.chipText}>
                          {String(p).replace(/^[{\"]+|[}\"]+$/g, "")}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {!!profile?.bio && renderBio(profile.bio)}

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                      {profile?.posts_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => {
                      navigation.push("FollowersList", {
                        memberId,
                        title: "Followers",
                      });
                    }}
                  >
                    <Text style={styles.statNumber}>
                      {profile?.followers_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => {
                      navigation.push("FollowingList", {
                        memberId,
                        title: "Following",
                      });
                    }}
                  >
                    <Text style={styles.statNumber}>
                      {profile?.following_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
                </View>
                {/* Interests below stats */}
                {Array.isArray(profile?.interests) &&
                profile.interests.length > 0 ? (
                  <View style={styles.metaChipsSection}>
                    <View style={[styles.chipGridRow, { marginTop: 6 }]}>
                      {(showAllInterests
                        ? profile.interests
                        : profile.interests.slice(0, 6)
                      ).map((i, idx) => (
                        <ThemeChip
                          key={`i-${idx}`}
                          label={String(i)}
                          index={idx}
                          style={styles.chipGridItem}
                        />
                      ))}
                      {profile.interests.length > 6 && !showAllInterests ? (
                        <TouchableOpacity
                          onPress={() => setShowAllInterests(true)}
                          style={[
                            styles.chip,
                            styles.chipBlue,
                            styles.chipGridItem,
                          ]}
                        >
                          <Text style={[styles.chipText, styles.chipTextBlue]}>
                            See all
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {profile.interests.length > 6 && showAllInterests ? (
                        <TouchableOpacity
                          onPress={() => setShowAllInterests(false)}
                          style={[
                            styles.chip,
                            styles.chipGridItem,
                            {
                              backgroundColor: "#FF3B30",
                              borderColor: "#FF3B30",
                            },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: "#FFFFFF" }]}>
                            Collapse
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <View
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    gap: 10,
                    width: "100%",
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
                      const next = !isFollowing;
                      setIsFollowing(next);
                      HapticsService.triggerImpactLight();
                      try {
                        if (next) {
                          await followMember(memberId);
                          // Optimistically increment target's followers count
                          setProfile((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  followers_count:
                                    (prev.followers_count || 0) + 1,
                                }
                              : prev
                          );
                        } else {
                          await unfollowMember(memberId);
                          // Optimistically decrement target's followers count (not below 0)
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
                        EventBus.emit("follow-updated", {
                          memberId,
                          isFollowing: next,
                        });
                      } catch (e) {
                        setIsFollowing(!next);
                        // Rollback followers count change on error
                        setProfile((prev) => {
                          if (!prev) return prev;
                          const delta = next ? -1 : 1;
                          return {
                            ...prev,
                            followers_count: Math.max(
                              0,
                              (prev.followers_count || 0) + delta
                            ),
                          };
                        });
                      }
                    }}
                  />
                  <GradientButton
                    title="Message"
                    style={{ flex: 1 }}
                    colors={["#1D1D1F", "#1D1D1F"]} // Black
                    onPress={() => {
                      // Navigate to Chat screen via Home stack
                      const root = navigation
                        .getParent()
                        ?.getParent()
                        ?.getParent();
                      if (root) {
                        root.navigate("MemberHome", {
                          screen: "Home",
                          params: {
                            screen: "Chat",
                            params: { recipientId: memberId },
                          },
                        });
                      } else {
                        // Fallback: try to navigate through parent
                        const parent = navigation.getParent();
                        if (parent) {
                          parent.navigate("Home", {
                            screen: "Chat",
                            params: { recipientId: memberId },
                          });
                        }
                      }
                    }}
                  />
                </View>
              </View>
            }
            ListEmptyComponent={
              !loading && (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 40,
                  }}
                >
                  <Text style={{ color: "#8E8E93", fontWeight: "bold" }}>
                    No posts
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={{ marginVertical: 12 }} />
              ) : null
            }
          />
        </>
      )}

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          visible={postModalVisible}
          post={selectedPost}
          onClose={closePostModal}
          profile={profile}
          navigation={navigation}
          onLikeUpdate={handlePostLike}
        />
      )}
    </SafeAreaView>
  );
}

// PostModal Component
const PostModal = ({
  visible,
  post,
  onClose,
  profile: profileProp,
  navigation,
  onLikeUpdate,
}) => {
  const initialIsLiked = post?.is_liked === true;
  const [likes, setLikes] = useState(post?.like_count || 0);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [commentCount, setCommentCount] = useState(post?.comment_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [localCommentsVisible, setLocalCommentsVisible] = useState(false);
  const justUpdatedRef = React.useRef(false);

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
    post?.isLiked,
    post?.like_count,
    post?.comment_count,
    visible,
  ]);

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
      // Silently handle "already liked" and "not liked" errors
      const errorMessage = error?.message || "";
      if (
        errorMessage.includes("already liked") ||
        errorMessage.includes("not liked")
      ) {
        // These are expected errors when double-clicking, just ignore
        justUpdatedRef.current = false;
        return;
      }
      // Only show alert for unexpected errors
      Alert.alert("Error", error?.message || "Failed to like post");
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

  useEffect(() => {
    if (post?.id) {
      setCurrentImageIndex(0);
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
          {/* Header */}
          <View style={postModalStyles.postModalHeader}>
            <View style={postModalStyles.postModalHeaderTop}>
              <TouchableOpacity
                onPress={onClose}
                style={postModalStyles.postModalBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={postModalStyles.postModalHeaderTitle}>Posts</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={postModalStyles.postModalHeaderUserInfo}>
              <Image
                source={{
                  uri:
                    post.author_photo_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      post.author_name || "User"
                    )}&background=6A0DAD&color=FFFFFF`,
                }}
                style={postModalStyles.postModalHeaderAvatar}
              />
              <View style={postModalStyles.postModalHeaderText}>
                <Text style={postModalStyles.postModalHeaderUsername}>
                  {post.author_username}
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
            {/* Image Carousel */}
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

            {/* Action Buttons */}
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

            {/* Likes Count */}
            {likes > 0 && (
              <View style={postModalStyles.postModalLikesSection}>
                <Text style={postModalStyles.postModalLikesText}>
                  {likes === 1 ? "1 like" : `${likes} likes`}
                </Text>
              </View>
            )}

            {/* Caption */}
            <View style={postModalStyles.postModalCaptionSection}>
              <Text style={postModalStyles.postModalCaption}>
                <Text style={postModalStyles.postModalCaptionUsername}>
                  {post.author_username}
                </Text>
                {post.caption && ` ${post.caption}`}
              </Text>
            </View>

            {/* View Comments Button */}
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
        <CommentsModal
          visible={localCommentsVisible}
          postId={post?.id}
          onClose={() => setLocalCommentsVisible(false)}
          onCommentCountChange={(newCount) => setCommentCount(newCount)}
          isNestedModal={true}
          navigation={navigation}
        />
      </SafeAreaView>
    </Modal>
  );
};

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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  profileHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileImageContainer: {
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    textAlign: "center",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    textAlign: "center",
  },
  handleText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  nameAndPronounsContainer: {
    alignItems: "center",
    marginBottom: 5,
    width: "100%",
  },
  pronounsRowCentered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  expandedPronounsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
    width: "100%",
  },
  pronounChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
  },
  bioLeft: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginBottom: 20,
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
    lineHeight: 22,
  },
  metaChipsSection: {
    width: "100%",
    marginBottom: 16,
    alignItems: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    alignItems: "center",
  },
  chipGridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
  },
  chipGridItem: {
    width: (screenWidth - 40 - 8 * 3) / 4,
    alignItems: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  chipBlue: {
    backgroundColor: "#E1F0FF",
  },
  chipTextBlue: {
    color: "#007AFF",
    fontWeight: "600",
  },
  chipRed: {
    backgroundColor: "#FFE5E5",
  },
  chipTextRed: {
    color: "#FF3B30",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 24,
    marginTop: 14,
  },
  countsRowCenter: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 24,
    marginTop: 14,
  },
  statItem: {
    alignItems: "center",
  },
  countItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  countNumLg: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  countLabel: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  followCta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  followPrimary: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  followPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  followingCta: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E5EA",
  },
  followingCtaText: {
    color: "#1D1D1F",
    fontWeight: "700",
  },
  messageCta: {
    backgroundColor: "#1D1D1F",
    borderColor: "#1D1D1F",
  },
  messageCtaText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
