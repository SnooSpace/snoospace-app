/**
 * CreatorFollowersScreen
 *
 * Two-tab screen opened when a viewer taps the "Followers" stat on a Creator profile.
 *
 *   • Followers tab — people who explicitly followed this creator (creator_follows table)
 *   • Circle tab    — mutual circle members (circles table)
 *
 * Route: CreatorFollowers
 * Params: { creatorId, isOwnProfile, initialFollowersCount, initialCircleCount }
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Clock,
  Search,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../../constants/theme";
import { getCreatorFollowers, getPublicCircleMembers, sendCircleRequest } from "../../../api/members";
import hapticsService from "../../../services/HapticsService";

// ── helpers ──────────────────────────────────────────────────────────────────

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

function Avatar({ uri, name, size = 44 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return uri ? (
    <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

// ── Person Row ────────────────────────────────────────────────────────────────

function PersonRow({ item, isOwnProfile, circleState, circleLoading, onAddToCircle, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.78}>
      <Avatar uri={item.avatar_url} name={item.name} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name || "Unknown"}</Text>
        {item.username ? (
          <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
        ) : null}
        <Text style={styles.rowTime}>{relativeTime(item.created_at)}</Text>
      </View>

      {/* Add to Circle CTA — only on own profile, for member followers, when not in circle */}
      {isOwnProfile && item.follower_type === "member" && circleState !== "in_circle" && (
        <TouchableOpacity
          style={[styles.ctaBtn, circleState === "requested" ? styles.ctaBtnRequested : styles.ctaBtnDefault]}
          onPress={() => onAddToCircle(item.id)}
          disabled={circleLoading || circleState === "requested"}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {circleLoading ? (
            <ActivityIndicator size="small" color={COLORS.textSecondary} style={{ width: 60 }} />
          ) : circleState === "requested" ? (
            <Text style={styles.ctaTextRequested}>Requested</Text>
          ) : (
            <Text style={styles.ctaTextDefault}>Add</Text>
          )}
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

  const [activeTab, setActiveTab] = useState("followers");

  // Followers tab state
  const [followers, setFollowers] = useState([]);
  const [followersTotal, setFollowersTotal] = useState(initialFollowersCount);
  const [followerPage, setFollowerPage] = useState(1);
  const [followerHasMore, setFollowerHasMore] = useState(true);
  const [followerLoading, setFollowerLoading] = useState(true);
  const [followerLoadingMore, setFollowerLoadingMore] = useState(false);
  const [followerSearch, setFollowerSearch] = useState("");

  // Circle tab state
  const [circleMembers, setCircleMembers] = useState([]);
  const [circleTotal, setCircleTotal] = useState(initialCircleCount);
  const [circlePage, setCirclePage] = useState(1);
  const [circleHasMore, setCircleHasMore] = useState(true);
  const [circleLoading, setCircleLoading] = useState(false);
  const [circleLoadingMore, setCircleLoadingMore] = useState(false);
  const [circleSearch, setCircleSearch] = useState("");
  const circleFetchedRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);

  // Per-follower Add-to-Circle state
  const [circleStates, setCircleStates] = useState({});
  const [circleActionLoading, setCircleActionLoading] = useState({});

  const followerLoadingMoreRef = useRef(false);
  const circleLoadingMoreRef = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadFollowers = useCallback(async (page = 1, search = "") => {
    try {
      const res = await getCreatorFollowers(creatorId, { page, limit: 20, type: "all", search });
      const rows = res?.followers || [];
      if (page === 1) {
        setFollowers(rows);
      } else {
        setFollowers((prev) => [...prev, ...rows]);
      }
      setFollowersTotal(res?.total ?? (page === 1 ? rows.length : followersTotal));
      setFollowerPage(page);
      setFollowerHasMore(!!res?.hasMore);
    } catch (e) {
      console.warn("[CreatorFollowers] loadFollowers error:", e);
    }
  }, [creatorId]);

  const loadCircle = useCallback(async (page = 1, search = "") => {
    try {
      // Read-only circle members for a given member (works for own + public profiles)
      const res = await getPublicCircleMembers(creatorId, { page, limit: 20, search });
      const rows = res?.members || [];
      if (page === 1) {
        setCircleMembers(rows);
      } else {
        setCircleMembers((prev) => [...prev, ...rows]);
      }
      // endpoint returns no total — use rows.length for page 1, accumulate for subsequent pages
      if (page === 1) setCircleTotal(rows.length);
      setCirclePage(page);
      // no hasMore from this endpoint — stop after first empty page
      setCircleHasMore(rows.length === 20);
    } catch (e) {
      console.warn("[CreatorFollowers] loadCircle error:", e);
    }
  }, [creatorId]);

  // Initial followers load
  useEffect(() => {
    setFollowerLoading(true);
    loadFollowers(1, "").finally(() => setFollowerLoading(false));
  }, [loadFollowers]);

  // Lazy load circle tab on first open
  const handleTabPress = useCallback((tab) => {
    hapticsService.triggerImpactLight();
    setActiveTab(tab);
    if (tab === "circle" && !circleFetchedRef.current) {
      circleFetchedRef.current = true;
      setCircleLoading(true);
      loadCircle(1, "").finally(() => setCircleLoading(false));
    }
  }, [loadCircle]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCircleStates({});
    const activeSearch = activeTab === "followers" ? followerSearch : circleSearch;
    if (activeTab === "followers") {
      await loadFollowers(1, activeSearch);
    } else {
      await loadCircle(1, activeSearch);
    }
    setRefreshing(false);
  }, [activeTab, followerSearch, circleSearch, loadFollowers, loadCircle]);

  // Load more followers
  const loadMoreFollowers = useCallback(async () => {
    if (!followerHasMore || followerLoadingMoreRef.current) return;
    followerLoadingMoreRef.current = true;
    setFollowerLoadingMore(true);
    await loadFollowers(followerPage + 1, followerSearch);
    followerLoadingMoreRef.current = false;
    setFollowerLoadingMore(false);
  }, [followerHasMore, followerPage, followerSearch, loadFollowers]);

  // Load more circle
  const loadMoreCircle = useCallback(async () => {
    if (!circleHasMore || circleLoadingMoreRef.current) return;
    circleLoadingMoreRef.current = true;
    setCircleLoadingMore(true);
    await loadCircle(circlePage + 1, circleSearch);
    circleLoadingMoreRef.current = false;
    setCircleLoadingMore(false);
  }, [circleHasMore, circlePage, circleSearch, loadCircle]);

  // Search handlers (debounced via useEffect)
  useEffect(() => {
    const t = setTimeout(() => {
      setFollowerLoading(true);
      loadFollowers(1, followerSearch).finally(() => setFollowerLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [followerSearch]); // eslint-disable-line

  useEffect(() => {
    if (!circleFetchedRef.current) return;
    const t = setTimeout(() => {
      setCircleLoading(true);
      loadCircle(1, circleSearch).finally(() => setCircleLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [circleSearch]); // eslint-disable-line

  // ── Add to Circle ─────────────────────────────────────────────────────────

  const handleAddToCircle = useCallback(async (followerId) => {
    hapticsService.triggerImpactMedium();
    setCircleActionLoading((prev) => ({ ...prev, [followerId]: true }));
    setCircleStates((prev) => ({ ...prev, [followerId]: "requested" })); // optimistic
    try {
      await sendCircleRequest(followerId);
    } catch (e) {
      console.warn("[CreatorFollowers] sendCircleRequest failed:", e);
      setCircleStates((prev) => ({ ...prev, [followerId]: "none" })); // revert
    } finally {
      setCircleActionLoading((prev) => ({ ...prev, [followerId]: false }));
    }
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = useCallback((item) => {
    const type = item.follower_type || item.type || "member";
    if (type === "member") {
      navigation.navigate("MemberPublicProfile", { memberId: item.id });
    } else if (type === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: item.id });
    }
  }, [navigation]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderFollowerItem = useCallback(({ item }) => (
    <PersonRow
      item={item}
      isOwnProfile={isOwnProfile}
      circleState={circleStates[item.id] || "none"}
      circleLoading={!!circleActionLoading[item.id]}
      onAddToCircle={handleAddToCircle}
      onPress={() => navigateTo(item)}
    />
  ), [isOwnProfile, circleStates, circleActionLoading, handleAddToCircle, navigateTo]);

  const renderCircleItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate("MemberPublicProfile", { memberId: item.member_id || item.id })}
      activeOpacity={0.78}
    >
      <Avatar uri={item.profile_photo_url || item.avatar_url} name={item.name} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name || item.full_name || "Member"}</Text>
        {(item.username) ? (
          <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const renderEmpty = (label) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Users size={32} color={COLORS.textSecondary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>No {label} yet</Text>
    </View>
  );

  const renderFooter = (loading) =>
    loading ? (
      <View style={styles.loadMoreWrap}>
        <ActivityIndicator size="small" color="#2962FF" />
      </View>
    ) : null;

  const isFollowersTab = activeTab === "followers";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ── Tab Bar ────────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, isFollowersTab && styles.tabActive]}
          onPress={() => handleTabPress("followers")}
        >
          <Text style={[styles.tabText, isFollowersTab && styles.tabTextActive]}>
            Followers{followersTotal > 0 ? ` • ${followersTotal}` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isFollowersTab && styles.tabActive]}
          onPress={() => handleTabPress("circle")}
        >
          <Text style={[styles.tabText, !isFollowersTab && styles.tabTextActive]}>
            Circle{circleTotal > 0 ? ` • ${circleTotal}` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={isFollowersTab ? "Search followers..." : "Search circle..."}
          placeholderTextColor={COLORS.textSecondary}
          value={isFollowersTab ? followerSearch : circleSearch}
          onChangeText={isFollowersTab ? setFollowerSearch : setCircleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isFollowersTab ? (
        followerLoading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#2962FF" />
          </View>
        ) : (
          <FlatList
            data={followers}
            keyExtractor={(item, i) => `f-${item.id ?? i}`}
            renderItem={renderFollowerItem}
            ListHeaderComponent={
              followers.length > 0 ? (
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>
                    All Followers {followersTotal > 0 ? followersTotal : ""}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={renderEmpty("followers")}
            ListFooterComponent={renderFooter(followerLoadingMore)}
            onEndReached={loadMoreFollowers}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2962FF" colors={["#2962FF"]} />
            }
            contentContainerStyle={[styles.listContent, followers.length === 0 && { flex: 1 }]}
          />
        )
      ) : (
        circleLoading ? (
          <View style={styles.loaderCenter}>
            <ActivityIndicator size="large" color="#2962FF" />
          </View>
        ) : (
          <FlatList
            data={circleMembers}
            keyExtractor={(item, i) => `c-${item.id ?? item.member_id ?? i}`}
            renderItem={renderCircleItem}
            ListHeaderComponent={
              circleMembers.length > 0 ? (
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderText}>
                    Circle Members {circleTotal > 0 ? circleTotal : ""}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={renderEmpty("circle members")}
            ListFooterComponent={renderFooter(circleLoadingMore)}
            onEndReached={loadMoreCircle}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2962FF" colors={["#2962FF"]} />
            }
            contentContainerStyle={[styles.listContent, circleMembers.length === 0 && { flex: 1 }]}
          />
        )
      )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border || "#E5E7EB",
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
  // ── Tabs
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || "#E5E7EB",
    backgroundColor: "#fff",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2962FF",
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: "#2962FF",
  },
  // ── Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  // ── List
  listContent: {
    paddingBottom: 40,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  listHeaderText: {
    fontFamily: FONTS.bold || FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  // ── Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border || "#E5E7EB",
    gap: 12,
    backgroundColor: "#fff",
  },
  avatar: {
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 98, 255, 0.06)",
  },
  avatarInitials: {
    fontFamily: FONTS.semiBold,
    color: "#2962FF",
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },
  rowUsername: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  rowTime: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // ── CTA
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 62,
    alignItems: "center",
  },
  ctaBtnDefault: {
    borderColor: "#2962FF",
    backgroundColor: "rgba(41, 98, 255, 0.06)",
  },
  ctaBtnRequested: {
    borderColor: COLORS.border || "#E5E7EB",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  ctaTextDefault: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#2962FF",
  },
  ctaTextRequested: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // ── States
  loaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  loadMoreWrap: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
