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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Users,
  Building2,
  UserPlus,
  UserCheck,
  Clock,
} from "lucide-react-native";
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from "../../../constants/theme";
import { getCreatorFollowers, sendCircleRequest } from "../../../api/members";
import hapticsService from "../../../services/HapticsService";

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

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CreatorFollowersScreen({ route, navigation }) {
  const { creatorId, isOwnProfile = false } = route?.params || {};

  const [notableFollowers, setNotableFollowers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Session-level circle request state per follower
  const [circleStates, setCircleStates] = useState({}); // { [followerId]: 'none' | 'requested' | 'in_circle' }
  const [circleLoading, setCircleLoading] = useState({}); // { [followerId]: boolean }

  const loadingMoreRef = useRef(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadInitial = useCallback(async () => {
    try {
      setError(null);
      const [notableRes, allRes] = await Promise.all([
        getCreatorFollowers(creatorId, { type: "notable", limit: 10 }),
        getCreatorFollowers(creatorId, { page: 1, limit: 20, type: "all" }),
      ]);
      setNotableFollowers(notableRes?.followers || []);
      setFollowers(allRes?.followers || []);
      setTotal(allRes?.total || 0);
      setPage(1);
      setHasMore(!!allRes?.hasMore);
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
      const res = await getCreatorFollowers(creatorId, { page: nextPage, limit: 20, type: "all" });
      setFollowers((prev) => [...prev, ...(res?.followers || [])]);
      setPage(nextPage);
      setHasMore(!!res?.hasMore);
    } catch (e) {
      console.warn("[CreatorFollowers] loadMore error:", e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, page, creatorId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCircleStates({});
    await loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

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

  // ── Navigation helpers ────────────────────────────────────────────────────

  const navigateToProfile = useCallback((follower) => {
    if (follower.follower_type === "member") {
      navigation.navigate("MemberPublicProfile", { memberId: follower.id });
    } else if (follower.follower_type === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: follower.id });
    }
  }, [navigation]);

  // ── Section data ──────────────────────────────────────────────────────────

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

      {/* Content */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#2962FF" />
        </View>
      ) : error ? (
        <View style={styles.loaderCenter}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadInitial}>
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
                  <Text style={styles.emptyTitle}>No followers yet</Text>
                  <Text style={styles.emptyBody}>
                    Share your profile to grow your audience.
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border || "#E5E7EB",
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
