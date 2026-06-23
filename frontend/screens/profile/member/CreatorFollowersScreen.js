/**
 * CreatorFollowersScreen
 *
 * Displays a creator's followers in two sections:
 *   • Notable Followers — community/page accounts (horizontal card strip)
 *   • All Followers — paginated member list with inline "Add to Circle" CTA
 *
 * Route: CreatorFollowers
 * Params: { creatorId, isOwnProfile }
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  SectionList,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Users,
  Building2,
  UserPlus,
  UserCheck,
  Clock,
  Search,
  X,
  UserMinus,
  TriangleAlert,
} from "lucide-react-native";
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from "../../../constants/theme";
import {
  getCreatorFollowers,
  sendCircleRequest,
  getCircleMembers,
  getPublicCircleMembers,
  removeFromCircle,
} from "../../../api/members";
import hapticsService from "../../../services/HapticsService";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Notable Follower Card ─────────────────────────────────────────────────────
function NotableCard({ follower, onPress }) {
  const initials = (follower.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.78}>
      <View style={cardStyles.avatarContainer}>
        {follower.avatar_url ? (
          <Image source={{ uri: follower.avatar_url }} style={cardStyles.avatar} />
        ) : (
          <View style={[cardStyles.avatar, cardStyles.avatarFallback]}>
            <Text style={cardStyles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={[cardStyles.typeBadge, follower.follower_type === "community" ? cardStyles.communityBadge : cardStyles.pageBadge]}>
          <Building2 size={9} color="#fff" strokeWidth={2.5} />
        </View>
      </View>
      <Text style={cardStyles.name} numberOfLines={2}>
        {follower.name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Follower Row ──────────────────────────────────────────────────────────────
function FollowerRow({ follower, isOwnProfile, circleState, circleLoading, onAddToCircle, onPress }) {
  const initials = (follower.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.78}>
      {/* Avatar */}
      <View style={rowStyles.avatarWrap}>
        {follower.avatar_url ? (
          <Image source={{ uri: follower.avatar_url }} style={rowStyles.avatar} />
        ) : (
          <View style={[rowStyles.avatar, rowStyles.avatarFallback]}>
            <Text style={rowStyles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>

      {/* Name + meta */}
      <View style={rowStyles.body}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {follower.name || "Unknown"}
        </Text>
        {follower.username && (
          <Text style={rowStyles.username} numberOfLines={1}>
            @{follower.username}
          </Text>
        )}
        <Text style={rowStyles.time}>{relativeTime(follower.created_at)}</Text>
      </View>

      {/* Add to Circle CTA — member followers + only on creator's own profile */}
      {isOwnProfile && follower.follower_type === "member" && circleState !== "in_circle" && (
        <TouchableOpacity
          style={[
            rowStyles.ctaBtn,
            circleState === "requested" ? rowStyles.ctaBtnRequested : rowStyles.ctaBtnDefault,
          ]}
          onPress={() => onAddToCircle(follower.id)}
          disabled={circleLoading || circleState === "requested"}
          activeOpacity={0.75}
        >
          {circleLoading ? (
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
          ) : circleState === "requested" ? (
            <>
              <Clock size={13} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={rowStyles.ctaTextRequested}>Requested</Text>
            </>
          ) : (
            <>
              <UserPlus size={13} color="#2962FF" strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={rowStyles.ctaTextDefault}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Circle Row ────────────────────────────────────────────────────────────────
function CircleRow({ member, isOwnProfile, onRemove, onPress }) {
  const initials = (member.name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarUrl = member.profile_photo_url || member.avatar_url;

  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.78}>
      <View style={rowStyles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={rowStyles.avatar} />
        ) : (
          <View style={[rowStyles.avatar, rowStyles.avatarFallback]}>
            <Text style={rowStyles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>

      <View style={rowStyles.body}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {member.name || "Unknown"}
        </Text>
        {member.username && (
          <Text style={rowStyles.username} numberOfLines={1}>
            @{member.username}
          </Text>
        )}
      </View>

      {isOwnProfile && (
        <TouchableOpacity
          style={circleRowStyles.removeBtn}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <UserMinus size={18} color={COLORS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CreatorFollowersScreen({ route, navigation }) {
  const {
    creatorId,
    isOwnProfile = false,
    initialFollowersCount = 0,
    initialCircleCount = 0,
  } = route?.params || {};

  // Tabs State
  const [activeTab, setActiveTab] = useState("followers"); // 'followers' | 'circles'

  // Followers State
  const [notableFollowers, setNotableFollowers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [total, setTotal] = useState(initialFollowersCount);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [followersSearch, setFollowersSearch] = useState("");
  const followersSearchTimer = useRef(null);

  // Circles State
  const [circleMembers, setCircleMembers] = useState([]);
  const [circleTotalCount, setCircleTotalCount] = useState(initialCircleCount);
  const [circlePage, setCirclePage] = useState(1);
  const [hasMoreCircles, setHasMoreCircles] = useState(true);
  const [circlesLoading, setCirclesLoading] = useState(false);
  const [circlesLoadingMore, setCirclesLoadingMore] = useState(false);
  const [circlesRefreshing, setCirclesRefreshing] = useState(false);
  const [circleSearch, setCircleSearch] = useState("");
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const circleSearchTimer = useRef(null);

  // Session-level circle request state per follower
  const [circleStates, setCircleStates] = useState({}); // { [followerId]: 'none' | 'requested' | 'in_circle' }
  const [circleLoading, setCircleLoading] = useState({}); // { [followerId]: boolean }

  const loadingMoreRef = useRef(false);

  // ── Data loading (Followers) ───────────────────────────────────────────────

  const loadInitial = useCallback(async (searchQuery = "") => {
    try {
      setError(null);
      if (searchQuery) {
        setNotableFollowers([]);
        const allRes = await getCreatorFollowers(creatorId, { page: 1, limit: 20, type: "all", search: searchQuery });
        setFollowers(allRes?.followers || []);
        setTotal(allRes?.total || 0);
        setPage(1);
        setHasMore(!!allRes?.hasMore);
      } else {
        const [notableRes, allRes] = await Promise.all([
          getCreatorFollowers(creatorId, { type: "notable", limit: 10 }),
          getCreatorFollowers(creatorId, { page: 1, limit: 20, type: "all" }),
        ]);
        setNotableFollowers(notableRes?.followers || []);
        setFollowers(allRes?.followers || []);
        setTotal(allRes?.total || 0);
        setPage(1);
        setHasMore(!!allRes?.hasMore);
      }
    } catch (e) {
      console.warn("[CreatorFollowers] loadInitial error:", e);
      setError("Couldn't load followers. Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [creatorId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getCreatorFollowers(creatorId, { page: nextPage, limit: 20, type: "all", search: followersSearch });
      setFollowers((prev) => [...prev, ...(res?.followers || [])]);
      setPage(nextPage);
      setHasMore(!!res?.hasMore);
    } catch (e) {
      console.warn("[CreatorFollowers] loadMore error:", e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, page, creatorId, followersSearch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCircleStates({});
    await loadInitial(followersSearch);
  }, [loadInitial, followersSearch]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleFollowersSearchChange = (text) => {
    setFollowersSearch(text);
    clearTimeout(followersSearchTimer.current);
    followersSearchTimer.current = setTimeout(() => {
      loadInitial(text);
    }, 350);
  };

  // ── Load circles ──────────────────────────────────────────────────────────
  const loadCirclesInitial = useCallback(async () => {
    try {
      setCirclesLoading(true);
      setError(null);
      const res = isOwnProfile
        ? await getCircleMembers({ page: 1, limit: 20, search: circleSearch })
        : await getPublicCircleMembers(creatorId, { page: 1, limit: 20, search: circleSearch });
      
      const fetched = res?.members || [];
      setCircleMembers(fetched);
      setCirclePage(1);
      setHasMoreCircles(fetched.length >= 20);

      if (typeof res?.total === "number") {
        setCircleTotalCount(res.total);
      } else if (!circleSearch) {
        setCircleTotalCount(Math.max(fetched.length, initialCircleCount));
      }
    } catch (e) {
      console.warn("[CreatorFollowers] loadCirclesInitial error:", e);
      setError("Couldn't load circle members. Pull to retry.");
    } finally {
      setCirclesLoading(false);
      setCirclesRefreshing(false);
    }
  }, [creatorId, isOwnProfile, circleSearch, initialCircleCount]);

  const loadMoreCircles = useCallback(async () => {
    if (!hasMoreCircles || circlesLoadingMore) return;
    setCirclesLoadingMore(true);
    try {
      const nextPage = circlePage + 1;
      const res = isOwnProfile
        ? await getCircleMembers({ page: nextPage, limit: 20, search: circleSearch })
        : await getPublicCircleMembers(creatorId, { page: nextPage, limit: 20, search: circleSearch });
      
      const fetched = res?.members || [];
      setCircleMembers((prev) => [...prev, ...fetched]);
      setCirclePage(nextPage);
      setHasMoreCircles(fetched.length >= 20);
    } catch (e) {
      console.warn("[CreatorFollowers] loadMoreCircles error:", e);
    } finally {
      setCirclesLoadingMore(false);
    }
  }, [hasMoreCircles, circlePage, creatorId, isOwnProfile, circleSearch, circlesLoadingMore]);

  const onCirclesRefresh = useCallback(async () => {
    setCirclesRefreshing(true);
    await loadCirclesInitial();
  }, [loadCirclesInitial]);

  useEffect(() => {
    if (activeTab === "circles") {
      loadCirclesInitial();
    }
  }, [activeTab]);

  const handleCircleSearchChange = (text) => {
    setCircleSearch(text);
    clearTimeout(circleSearchTimer.current);
    circleSearchTimer.current = setTimeout(() => {
      loadCirclesInitial();
    }, 350);
  };

  // ── Add to Circle handler ─────────────────────────────────────────────────

  const handleAddToCircle = useCallback(async (followerId) => {
    hapticsService.triggerImpactMedium();
    setCircleLoading((prev) => ({ ...prev, [followerId]: true }));
    setCircleStates((prev) => ({ ...prev, [followerId]: "requested" })); // optimistic
    try {
      await sendCircleRequest(followerId);
    } catch (e) {
      console.warn("[CreatorFollowers] sendCircleRequest failed:", e);
      setCircleStates((prev) => ({ ...prev, [followerId]: "none" })); // revert
    } finally {
      setCircleLoading((prev) => ({ ...prev, [followerId]: false }));
    }
  }, []);

  // ── Remove from Circle handler ────────────────────────────────────────────

  const handleRemoveFromCircle = useCallback((member) => {
    hapticsService.triggerImpactLight();
    setAlertConfig({
      visible: true,
      title: "Remove from Circle?",
      message: `${member.name || "This person"} will be removed from your circle. They can still message you and find your profile.`,
      icon: UserMinus,
      iconColor: "#E53935",
      secondaryAction: {
        text: "Cancel",
        onPress: () => setAlertConfig({ visible: false }),
      },
      primaryAction: {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setAlertConfig({ visible: false });
          try {
            await removeFromCircle(member.member_id || member.id);
            setCircleMembers((prev) => prev.filter((m) => (m.member_id || m.id) !== (member.member_id || member.id)));
            setCircleTotalCount((c) => Math.max(0, c - 1));
            hapticsService.triggerImpactLight();
          } catch (err) {
            setAlertConfig({
              visible: true,
              title: "Error",
              message: err?.message || "Failed to remove. Please try again.",
              icon: TriangleAlert,
              iconColor: "#E53935",
              primaryAction: {
                text: "OK",
                onPress: () => setAlertConfig({ visible: false }),
              },
            });
          }
        },
      },
    });
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────

  const navigateToProfile = useCallback((follower) => {
    const memberId = follower.member_id || follower.id;
    if (follower.follower_type === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: memberId });
    } else {
      // Default to member profile
      navigation.navigate("MemberPublicProfile", { memberId });
    }
  }, [navigation]);

  // ── Section data (Followers Tab) ──────────────────────────────────────────

  const sections = [];

  if (notableFollowers.length > 0) {
    sections.push({
      type: "notable",
      title: "Notable Followers",
      data: [{ key: "notable_row" }],
    });
  }

  sections.push({
    type: "all",
    title: `All Followers${total > 0 ? `  ${total.toLocaleString("en-IN")}` : ""}`,
    data: followers.length > 0 ? followers : [{ key: "empty" }],
  });

  const renderCircleEmptyState = () => {
    if (circlesLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Users size={32} color={COLORS.textSecondary} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>
          {circleSearch ? "No results found" : (isOwnProfile ? "Your circle is empty" : "No connections yet")}
        </Text>
        <Text style={styles.emptyBody}>
          {circleSearch
            ? "Try a different name or username."
            : (isOwnProfile
              ? "When you connect with people, they'll appear here."
              : "This member hasn't connected with anyone yet.")}
        </Text>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={tabStyles.tabBar}>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === "followers" && tabStyles.tabActive]}
          onPress={() => {
            hapticsService.triggerImpactLight();
            setActiveTab("followers");
          }}
        >
          <Text style={[tabStyles.tabText, activeTab === "followers" && tabStyles.tabTextActive]}>
            Followers • {total || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === "circles" && tabStyles.tabActive]}
          onPress={() => {
            hapticsService.triggerImpactLight();
            setActiveTab("circles");
          }}
        >
          <Text style={[tabStyles.tabText, activeTab === "circles" && tabStyles.tabTextActive]}>
            Circle • {circleTotalCount || 0}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "followers" ? (
        <View style={{ flex: 1 }}>
          {/* Search bar for Followers */}
          <View style={tabStyles.searchRow}>
            <View style={tabStyles.searchBox}>
              <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
              <TextInput
                style={tabStyles.searchInput}
                placeholder={isOwnProfile ? "Search your followers…" : "Search followers…"}
                placeholderTextColor={COLORS.textSecondary}
                value={followersSearch}
                onChangeText={handleFollowersSearchChange}
                returnKeyType="search"
              />
              {followersSearch.length > 0 && (
                <TouchableOpacity onPress={() => handleFollowersSearchChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={COLORS.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loading && followers.length === 0 ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#2962FF" />
            </View>
          ) : error ? (
            <View style={styles.loaderCenter}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadInitial(followersSearch)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item, idx) => item?.id ? String(item.id) : `${item?.key}-${idx}`}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#2962FF"
                  colors={["#2962FF"]}
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.3}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item, section }) => {
                // Notable section: render horizontal scroll
                if (section.type === "notable") {
                  return (
                    <FlatList
                      horizontal
                      data={notableFollowers}
                      keyExtractor={(f) => String(f.id)}
                      contentContainerStyle={styles.notableList}
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item: follower }) => (
                        <NotableCard
                          follower={follower}
                          onPress={() => navigateToProfile(follower)}
                        />
                      )}
                    />
                  );
                }

                // Empty state
                if (item?.key === "empty") {
                  return (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIcon}>
                        <Users size={32} color={COLORS.textSecondary} strokeWidth={1.5} />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {followersSearch ? "No results found" : "No followers yet"}
                      </Text>
                      <Text style={styles.emptyBody}>
                        {followersSearch
                          ? "Try a different name or username."
                          : "Share your profile to grow your audience."}
                      </Text>
                    </View>
                  );
                }

                // Regular follower row
                return (
                  <FollowerRow
                    follower={item}
                    isOwnProfile={isOwnProfile}
                    circleState={circleStates[item.id] || "none"}
                    circleLoading={!!circleLoading[item.id]}
                    onAddToCircle={handleAddToCircle}
                    onPress={() => navigateToProfile(item)}
                  />
                );
              }}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadMoreIndicator}>
                    <ActivityIndicator size="small" color="#2962FF" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      ) : (
        /* Circles tab */
        <View style={{ flex: 1 }}>
          <View style={tabStyles.searchRow}>
            <View style={tabStyles.searchBox}>
              <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
              <TextInput
                style={tabStyles.searchInput}
                placeholder={isOwnProfile ? "Search your circle…" : "Search circle…"}
                placeholderTextColor={COLORS.textSecondary}
                value={circleSearch}
                onChangeText={handleCircleSearchChange}
                returnKeyType="search"
              />
              {circleSearch.length > 0 && (
                <TouchableOpacity onPress={() => handleCircleSearchChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={COLORS.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {circlesLoading && circleMembers.length === 0 ? (
            <View style={styles.loaderCenter}>
              <ActivityIndicator size="large" color="#2962FF" />
            </View>
          ) : (
            <FlatList
              data={circleMembers}
              keyExtractor={(item) => String(item.member_id || item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <CircleRow
                  member={item}
                  isOwnProfile={isOwnProfile}
                  onRemove={() => handleRemoveFromCircle(item)}
                  onPress={() => navigateToProfile(item)}
                />
              )}
              ListEmptyComponent={renderCircleEmptyState}
              onEndReached={loadMoreCircles}
              onEndReachedThreshold={0.3}
              refreshControl={
                <RefreshControl
                  refreshing={circlesRefreshing}
                  onRefresh={onCirclesRefresh}
                  tintColor="#2962FF"
                  colors={["#2962FF"]}
                />
              }
              ListFooterComponent={
                circlesLoadingMore ? (
                  <View style={styles.loadMoreIndicator}>
                    <ActivityIndicator size="small" color="#2962FF" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}

      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        onClose={() => setAlertConfig({ visible: false })}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  headerTitle: {
    fontFamily: FONTS.bold || FONTS.semiBold,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontFamily: FONTS.bold || FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  notableList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  loaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#2962FF",
    borderRadius: 20,
  },
  retryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadMoreIndicator: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

// Notable card styles
const cardStyles = StyleSheet.create({
  card: {
    width: 80,
    alignItems: "center",
    gap: 6,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  avatarInitials: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#2962FF",
  },
  typeBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  communityBadge: {
    backgroundColor: "#2962FF",
  },
  pageBadge: {
    backgroundColor: "#34C759",
  },
  name: {
    fontFamily: FONTS.medium || FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: "center",
    lineHeight: 14,
  },
});

// Row styles
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border || "#E5E7EB",
    gap: 12,
    backgroundColor: "#fff",
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 98, 255, 0.06)",
  },
  avatarInitials: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#2962FF",
  },
  body: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  username: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  time: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textTertiary || COLORS.textSecondary,
    marginTop: 2,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  ctaBtnDefault: {
    borderColor: "#2962FF",
    backgroundColor: "rgba(41, 98, 255, 0.06)",
  },
  ctaBtnRequested: {
    borderColor: COLORS.border || "#E5E7EB",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  ctaTextDefault: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#2962FF",
  },
  ctaTextRequested: {
    fontFamily: FONTS.medium || FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

const tabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2962FF",
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary || "#6B7280",
  },
  tabTextActive: {
    color: "#2962FF",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary || "#1a2d4a",
    padding: 0,
  },
});

const circleRowStyles = StyleSheet.create({
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
});
