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

const { width: screenWidth } = Dimensions.get("window");
const GAP = 10;
const ITEM_SIZE = (screenWidth - 40 - GAP * 2) / 3;

export default function CommunityPublicProfileScreen({ route, navigation }) {
  const communityId = route?.params?.communityId;
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

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicCommunity(communityId);
      setProfile(p);
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

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#5f27cd" />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#FF3B30" }}>{error}</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollView}>
            <View style={styles.profileHeader}>
              <Image
                source={{
                  uri:
                    profile?.logo_url ||
                    "https://via.placeholder.com/160",
                }}
                style={styles.avatarLarge}
              />
              <Text style={styles.displayName}>
                {profile?.name || "Community"}
              </Text>
              {profile?.username && (
                <Text style={styles.username}>@{profile.username}</Text>
              )}
              {profile?.category && (
                <Text style={styles.category}>{profile.category}</Text>
              )}
              {!!profile?.bio && (
                <Text style={styles.bio}>{profile.bio}</Text>
              )}

              <View style={styles.countsRowCenter}>
                <View style={styles.countItem}>
                  <Text style={styles.countNumLg}>
                    {profile?.posts_count || 0}
                  </Text>
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
                    {profile?.followers_count || 0}
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
                    {profile?.following_count || 0}
                  </Text>
                  <Text style={styles.countLabel}>Following</Text>
                </TouchableOpacity>
              </View>

              {profile?.heads && profile.heads.length > 0 && (
                <View style={styles.headsSection}>
                  <Text style={styles.sectionTitle}>Community Heads</Text>
                  <View style={styles.headsList}>
                    {profile.heads.map((head, idx) => (
                      <View key={head.id || idx} style={styles.headItem}>
                        <Text style={styles.headText}>
                          {head.name}
                          {head.is_primary && (
                            <Text style={styles.primaryBadge}> (Primary)</Text>
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {profile?.sponsor_types && profile.sponsor_types.length > 0 && (
                <View style={styles.sponsorTypesSection}>
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
                <View style={styles.locationSection}>
                  <Ionicons name="location" size={16} color="#8E8E93" />
                  <Text style={styles.locationText}>
                    {profile.location.address ||
                      [profile.location.city, profile.location.state]
                        .filter(Boolean)
                        .join(", ")}
                  </Text>
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
                    EventBus.emit("follow-updated", {
                      communityId,
                      isFollowing: next,
                    });
                  } catch (e) {
                    setIsFollowing(!next);
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
            </View>

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
        </>
      )}

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
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E5E5EA",
    marginBottom: 16,
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
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: "#1D1D1F",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  countsRowCenter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginBottom: 20,
  },
  countItem: {
    alignItems: "center",
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
  sponsorTypesSection: {
    width: "100%",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
    textAlign: "center",
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
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  headsSection: {
    width: "100%",
    marginBottom: 16,
  },
  headsList: {
    gap: 8,
    alignItems: "center",
  },
  headItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  headText: {
    fontSize: 14,
    color: "#1D1D1F",
    fontWeight: "500",
  },
  primaryBadge: {
    fontSize: 12,
    color: "#5f27cd",
    fontWeight: "600",
  },
  followCta: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 120,
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
});

