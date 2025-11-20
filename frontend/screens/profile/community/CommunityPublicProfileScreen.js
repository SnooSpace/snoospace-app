import React, { useCallback, useEffect, useState } from "react";
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
import { apiPost } from "../../../api/client";

const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/[^0-9]/g, '');
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
  const viewerRoleParam = route?.params?.viewerRole || 'member';
  const viewerRole = typeof viewerRoleParam === 'string' ? viewerRoleParam.toLowerCase() : 'member';
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

  const postsCount = profile?.posts_count ?? profile?.post_count ?? 0;
  const followersCount = profile?.followers_count ?? profile?.follower_count ?? 0;
  const followingCount = profile?.following_count ?? profile?.following ?? 0;

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicCommunity(communityId);
      const normalizedCategories = Array.isArray(p?.categories)
        ? p.categories
        : (p?.category ? [p.category] : []);
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
        const newPosts = reset
          ? data?.posts || data || []
          : [...posts, ...(data?.posts || data || [])];
        setPosts(newPosts);
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

  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };

  const closePostModal = () => {
    setPostModalVisible(false);
    setSelectedPost(null);
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
        onPress={() => openPostModal(item)}
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
      navigation.navigate('MemberPublicProfile', { memberId: head.member_id });
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
        <Text style={{ color: '#FF3B30' }}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.bannerContainer}>
          {profile?.banner_url ? (
            <Image source={{ uri: profile.banner_url }} style={styles.bannerImage} />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <Text style={styles.bannerPlaceholderText}>Banner (1200 x 400 recommended)</Text>
            </View>
          )}
        </View>

        <View style={styles.profileHeader}>
          <Image
            source={{
              uri:
                profile?.logo_url ||
                "https://via.placeholder.com/160",
            }}
            style={styles.avatarLarge}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.displayName}>
              {profile?.name || "Community"}
            </Text>
            {profile?.username && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}
            {Array.isArray(profile?.categories) && profile.categories.length > 0 && (
              <View style={styles.categoriesRow}>
                {profile.categories.map((cat) => (
                  <View key={cat} style={styles.categoryChip}>
                    <Text style={styles.categoryChipText}>{cat}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!profile?.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
          </View>
        </View>

        <View style={styles.countsRowCenter}>
          <View style={styles.countItem}>
            <Text style={styles.countNumLg}>{postsCount}</Text>
            <Text style={styles.countLabel}>Posts</Text>
          </View>
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => {
              navigation.navigate("CommunityFollowersList", {
                communityId,
                title: "Followers",
              });
            }}
          >
            <Text style={styles.countNumLg}>
              {followersCount}
            </Text>
            <Text style={styles.countLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => {
              navigation.navigate("CommunityFollowingList", {
                communityId,
                title: "Following",
              });
            }}
          >
            <Text style={styles.countNumLg}>
              {followingCount}
            </Text>
            <Text style={styles.countLabel}>Following</Text>
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
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(head.name || 'Head')}&background=5f27cd&color=FFFFFF&size=64&bold=true`,
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
                    {['community', 'sponsor', 'venue'].includes(viewerRole) && head.phone && (
                      <Text style={styles.headSub}>{formatPhoneNumber(head.phone)}</Text>
                    )}
                  </View>
                  {canNavigate && (
                    <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No heads listed</Text>
          )}
        </View>

        {profile?.sponsor_types && profile.sponsor_types.length > 0 && viewerRole !== 'member' && viewerRole !== 'venue' && (
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

        {profile?.location && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationSection}>
              <Ionicons name="location" size={16} color="#8E8E93" />
              <Text style={styles.locationText}>
                {profile.location.address ||
                  [profile.location.city, profile.location.state]
                    .filter(Boolean)
                    .join(", ")}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.followCta,
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
              let currentUserType = 'community';
              try {
                const token = await getAuthToken();
                const email = await getAuthEmail();
                if (token && email) {
                  const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
                  if (profileResponse?.profile?.id) {
                    currentUserId = profileResponse.profile.id;
                    currentUserType = profileResponse.role || 'community';
                  }
                }
              } catch (e) {
                console.error('Error getting current user:', e);
              }
              
              EventBus.emit("follow-updated", {
                communityId,
                isFollowing: next,
                followerId: currentUserId,
                followerType: currentUserType
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

        <Text style={[styles.sectionTitle, { paddingHorizontal: 20, marginTop: 24 }]}>Community Posts</Text>
        <FlatList
          data={posts}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          renderItem={renderGridItem}
          numColumns={3}
          columnWrapperStyle={{
            justifyContent: "flex-start",
            marginBottom: GAP,
          }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40,
            flexGrow: posts.length === 0 ? 1 : 0,
          }}
          onEndReachedThreshold={0.6}
          onEndReached={() => loadPosts(false)}
          scrollEnabled={false}
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
                <Text style={{ color: "#8E8E93" }}>No posts yet</Text>
              </View>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 12 }} />
            ) : null
          }
        />
      </ScrollView>

      {selectedPost && (
        <CommentsModal
          visible={postModalVisible}
          post={selectedPost}
          onClose={closePostModal}
        />
      )}
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPlaceholderText: {
    color: "#8E8E93",
    fontSize: 12,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginTop: -50,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#E5E5EA",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    marginRight: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1D1D1F",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: "#8E8E93",
    marginBottom: 4,
  },
  category: {
    display: 'none',
  },
  bio: {
    fontSize: 14,
    color: "#1D1D1F",
    marginRight: 20,
  },
  countsRowCenter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  countItem: {
    alignItems: "center",
    flex: 1,
  },
  countNumLg: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1D1D1F",
  },
  countLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
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
    gap: 8,
    marginBottom: 12,
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
});

