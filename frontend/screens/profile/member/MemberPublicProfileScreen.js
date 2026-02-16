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
import { ArrowLeft } from "lucide-react-native";
import {
  getPublicMemberProfile,
  getMemberPosts,
  followMember,
  unfollowMember,
} from "../../../api/members";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
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
  FONTS,
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
import EditorialPostCard from "../../../components/EditorialPostCard";
import ProfilePostFeed from "../../../components/ProfilePostFeed";

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
          ? p.pronouns.filter(
              (pron) =>
                pron && String(pron).trim() && pron !== "Prefer not to say",
            )
          : p?.pronouns &&
              String(p.pronouns).trim() &&
              p.pronouns !== "Prefer not to say"
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
          normalizedPosts.length,
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
        const mergedPosts =
          await LikeStateManager.mergeLikeStates(normalizedPosts);

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
    [memberId, offset, posts, hasMore, loadingMore],
  );

  // Refresh profile when screen gains focus
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
  }, [memberId]);

  // Listen for like updates from other screens (e.g., home feed)
  useEffect(() => {
    const unsubscribe = EventBus.on("post-like-updated", async (payload) => {
      if (!payload?.postId) return;

      // Cache the like state to persist across component unmounts
      await LikeStateManager.setLikeState(payload.postId, payload.isLiked);

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
            : post,
        ),
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
            : p,
        ),
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

    // Detect video by: explicit video_url OR URL extension
    const isVideo =
      !!item.video_url ||
      (firstImageUrl &&
        (firstImageUrl.toLowerCase().includes(".mp4") ||
          firstImageUrl.toLowerCase().includes(".mov") ||
          firstImageUrl.toLowerCase().includes(".webm")));

    // Generate thumbnail: use video_thumbnail, or Cloudinary jpg conversion, or original URL
    // video_thumbnail might be stored as JSON array string '["url"]' in database
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

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE * 1.35, // Increased height for portrait/taller look
          marginBottom: 0,
          borderRadius: 3,
          overflow: "hidden",
        }}
        onPress={() => item && openPostModal(item)}
        disabled={!item}
      >
        {item ? (
          <>
            <Image
              source={{ uri: mediaUrl || "https://via.placeholder.com/150" }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
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
                <Ionicons name="play" size={16} color="#FFF" />
              </View>
            )}
          </>
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
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        {profile?.username && (
          <Text style={styles.headerUsername}>@{profile.username}</Text>
        )}
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
                  profile.pronouns.filter((p) => p !== "Prefer not to say")
                    .length > 0 ? (
                    <View style={styles.pronounsRowCentered}>
                      <View
                        key={`p-0`}
                        style={[styles.chip, styles.pronounChipSmall]}
                      >
                        <Text style={styles.chipText}>
                          {profile.pronouns
                            .filter((p) => p !== "Prefer not to say")
                            .map((p) =>
                              String(p).replace(/^[{\"]+|[}\"]+$/g, ""),
                            )
                            .join(" / ")}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
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
                              : prev,
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
                                    (prev.followers_count || 0) - 1,
                                  ),
                                }
                              : prev,
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
                              (prev.followers_count || 0) + delta,
                            ),
                          };
                        });
                      }
                    }}
                  />
                  <GradientButton
                    title="Message"
                    style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                    gradientStyle={{ borderRadius: 16 }}
                    colors={["#111827", "#111827"]} // Charcoal Black
                    textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
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
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts}
          initialPostId={selectedPost?.id}
          onClose={closePostModal}
          currentUserId={profile?.id}
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
          onComment={(postId) => {
            // Open comments modal logic
          }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },
  headerLeft: {
    // keeping for consistency if needed, but unused in new layout
    flexDirection: "row",
    alignItems: "center",
  },
  headerUsername: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#3B82F6",
    marginTop: 10, // Separate line
    fontWeight: "600",
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
    alignSelf: "flex-start",
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
    width: 125,
    height: 125,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileName: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
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
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: "#1f2937",
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999, // Pill shape
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#F2F2F7",
  },
  chipGridItem: {
    // width removed to prevent truncation
    alignItems: "center",
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#374151",
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
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 5,
  },
  countNumLg: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#6B7280",
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
