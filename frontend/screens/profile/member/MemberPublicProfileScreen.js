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
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showAllPronouns, setShowAllPronouns] = useState(false);

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
            <View style={styles.nameRowContainer}>
              <View style={styles.nameContainer}>
                <Text style={styles.displayName}>
                  {profile?.full_name || "Member"}
                </Text>
              </View>
              {Array.isArray(profile?.pronouns) &&
              profile.pronouns.length > 0 ? (
                <View style={styles.inlinePronounsRow}>
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
                  // Navigate to Profile tab's stack for FollowersList (it only exists there)
                  const root = navigation.getParent()?.getParent();
                  if (root) {
                    root.navigate('Profile', {
                      screen: 'FollowersList',
                      params: { memberId, title: "Followers" }
                    });
                  } else {
                    // Fallback: try same stack navigation
                    navigation.navigate("FollowersList", {
                      memberId,
                      title: "Followers",
                    });
                  }
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
                  // Navigate to Profile tab's stack for FollowingList (it only exists there)
                  const root = navigation.getParent()?.getParent();
                  if (root) {
                    root.navigate('Profile', {
                      screen: 'FollowingList',
                      params: { memberId, title: "Following" }
                    });
                  } else {
                    // Fallback: try same stack navigation
                    navigation.navigate("FollowingList", {
                      memberId,
                      title: "Following",
                    });
                  }
                }}
              >
                <Text style={styles.countNumLg}>
                  {profile?.following_count || 0}
                </Text>
                <Text style={styles.countLabel}>Following</Text>
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
                    <View
                      key={`i-${idx}`}
                      style={[styles.chip, styles.chipGridItem]}
                    >
                      <Text style={styles.chipText}>{String(i)}</Text>
                    </View>
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
                        styles.chipBlue,
                        styles.chipGridItem,
                      ]}
                    >
                      <Text style={[styles.chipText, styles.chipTextBlue]}>
                        Collapse
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

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
  profileHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
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
  },
  handleText: { fontSize: 14, color: "#8E8E93", marginTop: 4 },
  nameRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 5,
    justifyContent: "center",
    width: "100%",
    position: "relative",
  },
  nameContainer: {
    alignItems: "center",
  },
  inlinePronounsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "absolute",
    left: "50%",
    marginLeft: 60,
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
  },
  bioLeft: {
    fontSize: 16,
    color: "#6A0DAD",
    marginBottom: 20,
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
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
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  chipGridItem: {
    width: (screenWidth - 40 - 8 * 3) / 4,
    alignItems: "center",
  },
  chipFilled: {
    backgroundColor: "#6A0DAD",
    borderColor: "#6A0DAD",
  },
  chipText: { fontSize: 12, color: "#1D1D1F" },
  chipBlue: { borderColor: "#007AFF" },
  chipTextBlue: { color: "#007AFF" },
  chipRed: { borderColor: "#FF3B30" },
  chipTextRed: { color: "#FF3B30" },
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
