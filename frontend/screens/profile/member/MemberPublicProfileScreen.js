import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
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

const { width: screenWidth } = Dimensions.get("window");
const GAP = 10;
const ITEM_SIZE = (screenWidth - 40 - GAP * 2) / 3;

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
  const [interestsExpanded, setInterestsExpanded] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicMemberProfile(memberId);
      setProfile(p);
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
    [memberId, offset, posts, hasMore, loadingMore]
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
          height: ITEM_SIZE,
          borderRadius: 8,
          overflow: "hidden",
          marginRight: isLastInRow ? 0 : GAP,
        }}
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
          @{profile?.username || "member"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#6A0DAD" />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#FF3B30" }}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.profileHeader}>
            <Image
              source={{
                uri:
                  profile?.profile_photo_url ||
                  "https://via.placeholder.com/160",
              }}
              style={styles.avatarLarge}
            />
            <Text style={styles.displayName}>
              {profile?.full_name || "Member"}
            </Text>
            {/* Username subtitle removed for cleaner public profile header */}
            {!!profile?.bio && (
              <Text style={styles.bioCenter}>
                {profile.bio}
              </Text>
            )}
            {(Array.isArray(profile?.pronouns) && profile.pronouns.length > 0) ||
            (Array.isArray(profile?.interests) && profile.interests.length > 0) ? (
              <View style={styles.metaChipsSection}>
                {Array.isArray(profile?.pronouns) && profile.pronouns.length > 0 ? (
                  <View style={styles.chipRow}>
                    {profile.pronouns.map((p, idx) => (
                      <View key={`p-${idx}`} style={[styles.chip, styles.chipFilled]}>
                        <Text style={[styles.chipText, styles.chipTextFilled]}>
                          {String(p).replace(/^[{\"]/g, '').replace(/[}\"]/g, '')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {Array.isArray(profile?.interests) && profile.interests.length > 0 ? (
                  <View style={styles.chipRow}>
                    {(interestsExpanded
                      ? profile.interests
                      : profile.interests.slice(0, 7)
                    ).map((i, idx) => (
                      <View key={`i-${idx}`} style={styles.chip}>
                        <Text style={styles.chipText}>{String(i)}</Text>
                      </View>
                    ))}
                    {profile.interests.length > 7 && !interestsExpanded && (
                      <TouchableOpacity onPress={() => setInterestsExpanded(true)}>
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>View all</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
                {Array.isArray(profile?.interests) && profile.interests.length > 7 && interestsExpanded ? (
                  <TouchableOpacity onPress={() => setInterestsExpanded(false)} style={{ alignSelf: 'center', marginTop: 6 }}>
                    <Text style={{ color: '#6A0DAD', fontWeight: '600' }}>Collapse</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            <View style={styles.countsRowCenter}>
              <View style={styles.countItem}>
                <Text style={styles.countNumLg}>
                  {profile?.posts_count || 0}
                </Text>
                <Text style={styles.countLabel}>Posts</Text>
              </View>
              <TouchableOpacity style={styles.countItem} onPress={() => navigation.navigate('FollowersList', { memberId, title: 'Followers' })}>
                <Text style={styles.countNumLg}>
                  {profile?.followers_count || 0}
                </Text>
                <Text style={styles.countLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.countItem} onPress={() => navigation.navigate('FollowingList', { memberId, title: 'Following' })}>
                <Text style={styles.countNumLg}>
                  {profile?.following_count || 0}
                </Text>
                <Text style={styles.countLabel}>Following</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12 }}>
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
                      await followMember(memberId);
                      // Optimistically increment target's followers count
                      setProfile((prev) =>
                        prev
                          ? {
                              ...prev,
                              followers_count: (prev.followers_count || 0) + 1,
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
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
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
  profileHeader: { alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1D1D1F",
    marginTop: 12,
  },
  handleText: { fontSize: 14, color: "#8E8E93", marginTop: 4 },
  bioCenter: { fontSize: 14, color: "#6A0DAD", marginTop: 8 },
  metaChipsSection: {
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  chipFilled: {
    backgroundColor: "#6A0DAD",
    borderColor: "#6A0DAD",
  },
  chipText: { fontSize: 12, color: "#1D1D1F" },
  chipTextFilled: { color: "#FFFFFF" },
  countsRowCenter: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 14,
  },
  countItem: { alignItems: "center" },
  countNumLg: { fontSize: 18, fontWeight: "700", color: "#1D1D1F" },
  countLabel: { fontSize: 14, color: "#6A0DAD", marginTop: 2 },
  followCta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  followPrimary: { backgroundColor: "#6A0DAD", borderColor: "#6A0DAD" },
  followPrimaryText: { color: "#FFFFFF", fontWeight: "700" },
  followingCta: { backgroundColor: "#FFFFFF", borderColor: "#E5E5EA" },
  followingCtaText: { color: "#1D1D1F", fontWeight: "700" },
});
