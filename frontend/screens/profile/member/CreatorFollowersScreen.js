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
import { useFocusEffect } from "@react-navigation/native";
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
  UserMinus,
  Clock,
  Search,
  X,
  TriangleAlert,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../../constants/theme";
import {
  getCreatorFollowers,
  getPublicCircleMembers,
  sendCircleRequest,
  removeCreatorFollower,
  removeFromCircle,
} from "../../../api/members";
import {
  followCommunity,
  unfollowCommunity,
  getFollowStatusForCommunity,
} from "../../../api/communities";
import hapticsService from "../../../services/HapticsService";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import EventBus from "../../../utils/EventBus";

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

function PersonRow({ item, isOwnProfile, circleState, circleLoading, onAddToCircle, onRemoveFromCircle, onRemoveFollower, onPress, followBackState, followBackLoading: fbLoading, onFollowBack }) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        onPress={onPress}
        activeOpacity={0.78}
      >
        <Avatar uri={item.avatar_url} name={item.name} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || "Unknown"}</Text>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
          ) : null}
          <Text style={styles.rowTime}>{relativeTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Follow Back action — only for community followers on own profile */}
        {isOwnProfile && item.follower_type === "community" && (
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              followBackState === true
                ? { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                : { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
            ]}
            onPress={() => onFollowBack && onFollowBack(item)}
            disabled={fbLoading || followBackState === null}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {fbLoading ? (
              <ActivityIndicator size="small" color={followBackState === true ? '#2962FF' : '#fff'} style={{ width: 60 }} />
            ) : (
              <Text style={[
                styles.ctaTextDefault,
                followBackState === true && { color: '#2962FF' },
              ]}>
                {followBackState === true ? 'Following' : 'Follow Back'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Add/Remove Circle CTA — only on own profile, for member followers */}
        {isOwnProfile && item.follower_type === "member" && (
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              circleState === "in_circle"
                ? styles.ctaBtnRemove
                : circleState === "requested"
                ? styles.ctaBtnRequested
                : styles.ctaBtnDefault
            ]}
            onPress={() => {
              if (circleState === "in_circle") {
                onRemoveFromCircle(item);
              } else {
                onAddToCircle(item.id);
              }
            }}
            disabled={circleLoading || circleState === "requested"}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {circleLoading ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} style={{ width: 60 }} />
            ) : circleState === "in_circle" ? (
              <Text style={styles.ctaTextRemove}>Remove</Text>
            ) : circleState === "requested" ? (
              <Text style={styles.ctaTextRequested}>Requested</Text>
            ) : (
              <Text style={styles.ctaTextDefault}>Add</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Remove follower button — only on own profile */}
        {isOwnProfile && item.follower_type === "member" && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onRemoveFollower(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <X size={15} color={COLORS.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
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

  // Per-follower Follow Back state (for community-type followers)
  const [followBackStates, setFollowBackStates] = useState({});
  const [followBackLoadingMap, setFollowBackLoadingMap] = useState({});

  // Alert modal state
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const showAlert = useCallback((cfg) => setAlertConfig({ ...cfg, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  // Optimistic hide sets for removed items
  const [hiddenFollowerIds, setHiddenFollowerIds] = useState(new Set());
  const [hiddenCircleMemberIds, setHiddenCircleMemberIds] = useState(new Set());

  const followerLoadingMoreRef = useRef(false);
  const circleLoadingMoreRef = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadFollowers = useCallback(async (page = 1, search = "", circleIdSet = null) => {
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

      // Pre-seed circleStates for followers already in circle
      if (circleIdSet) {
        const preSeeded = {};
        rows.forEach((f) => {
          if (f.follower_type === 'member' && circleIdSet.has(String(f.id))) {
            preSeeded[f.id] = 'in_circle';
          }
        });
        if (Object.keys(preSeeded).length > 0) {
          setCircleStates((prev) => ({ ...prev, ...preSeeded }));
        }
      }

      // Pre-seed Follow Back states for community-type followers
      const communityRows = rows.filter((f) => f.follower_type === 'community');
      if (communityRows.length > 0 && page === 1) {
        const checks = await Promise.allSettled(
          communityRows.map(async (f) => {
            const status = await getFollowStatusForCommunity(f.id);
            return { id: f.id, isFollowing: !!status?.isFollowing };
          })
        );
        const states = {};
        checks.forEach((r) => {
          if (r.status === 'fulfilled') {
            states[r.value.id] = r.value.isFollowing;
          }
        });
        if (Object.keys(states).length > 0) {
          setFollowBackStates((prev) => ({ ...prev, ...states }));
        }
      }
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

  // Initial load: fetch followers + circle members in parallel (on own profile)
  // so we can pre-seed circleStates for followers already in circle
  useEffect(() => {
    setFollowerLoading(true);
    if (isOwnProfile) {
      // Fetch up to 200 circle member IDs to cross-reference against followers
      getPublicCircleMembers(creatorId, { page: 1, limit: 200 })
        .then((circleRes) => {
          const members = circleRes?.members || [];
          const idSet = new Set(members.map((m) => String(m.member_id || m.id)));
          return loadFollowers(1, "", idSet);
        })
        .catch(() => loadFollowers(1, "", null))
        .finally(() => setFollowerLoading(false));
    } else {
      loadFollowers(1, "").finally(() => setFollowerLoading(false));
    }
  }, [loadFollowers]);

  // Reload on screen re-focus (e.g. returning from PublicProfile after follow/unfollow)
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return; // skip initial mount — already handled by the useEffect above
      }
      // Clear stale hidden sets so removed items that were re-followed appear again
      setHiddenFollowerIds(new Set());
      setHiddenCircleMemberIds(new Set());
      setCircleStates({});
      // Reload current tab page 1
      setFollowerLoading(true);
      if (isOwnProfile) {
        getPublicCircleMembers(creatorId, { page: 1, limit: 200 })
          .then((circleRes) => {
            const members = circleRes?.members || [];
            const idSet = new Set(members.map((m) => String(m.member_id || m.id)));
            return loadFollowers(1, followerSearch, idSet);
          })
          .catch(() => loadFollowers(1, followerSearch, null))
          .finally(() => setFollowerLoading(false));
      } else {
        loadFollowers(1, followerSearch).finally(() => setFollowerLoading(false));
      }
      // Reload circle tab if it was ever opened
      if (circleFetchedRef.current) {
        loadCircle(1, circleSearch);
      }
    }, [loadFollowers, loadCircle, followerSearch, circleSearch, isOwnProfile, creatorId])
  );

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

  // Pull-to-refresh — re-fetch circle IDs on own profile to re-seed states
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCircleStates({});
    const activeSearch = activeTab === "followers" ? followerSearch : circleSearch;
    if (activeTab === "followers") {
      if (isOwnProfile) {
        try {
          const circleRes = await getPublicCircleMembers(creatorId, { page: 1, limit: 200 });
          const members = circleRes?.members || [];
          const idSet = new Set(members.map((m) => String(m.member_id || m.id)));
          await loadFollowers(1, activeSearch, idSet);
        } catch {
          await loadFollowers(1, activeSearch, null);
        }
      } else {
        await loadFollowers(1, activeSearch);
      }
    } else {
      await loadCircle(1, activeSearch);
    }
    setRefreshing(false);
  }, [activeTab, followerSearch, circleSearch, loadFollowers, loadCircle, isOwnProfile, creatorId]);

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

  // ── Remove Follower ────────────────────────────────────────────────────────
  const handleRemoveFollower = useCallback((item) => {
    hapticsService.triggerImpactLight();
    showAlert({
      title: 'Remove Follower?',
      message: `${item.name || 'This person'} will be removed from your followers. They can follow you again anytime.`,
      icon: UserMinus,
      iconColor: '#E53935',
      secondaryAction: { text: 'Cancel', onPress: hideAlert },
      primaryAction: {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          // Optimistic hide
          setHiddenFollowerIds((prev) => new Set([...prev, String(item.id)]));
          hapticsService.triggerImpactLight();
          try {
            await removeCreatorFollower(item.id);
            EventBus.emit('creator:follower-removed', { creatorId, followerId: String(item.id) });
          } catch (e) {
            console.warn('[CreatorFollowers] removeCreatorFollower failed:', e);
            // Revert on failure
            setHiddenFollowerIds((prev) => {
              const s = new Set(prev); s.delete(String(item.id)); return s;
            });
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  // ── Remove Circle Member ───────────────────────────────────────────────────
  const handleRemoveCircleMember = useCallback((item) => {
    hapticsService.triggerImpactLight();
    const memberId = String(item.member_id || item.id);
    showAlert({
      title: 'Remove from Circle?',
      message: `${item.name || 'This person'} will be removed from your circle.`,
      icon: UserMinus,
      iconColor: '#E53935',
      secondaryAction: { text: 'Cancel', onPress: hideAlert },
      primaryAction: {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setHiddenCircleMemberIds((prev) => {
            const next = new Set(prev);
            next.add(memberId);
            return next;
          });
          setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
          setCircleTotal((t) => Math.max(0, t - 1));
          hapticsService.triggerImpactLight();
          try {
            await removeFromCircle(memberId, false); // follow restored
            EventBus.emit('circle:member-removed', { creatorId, memberId, alsoUnfollow: false });
            // Follow is restored — add member to Followers tab and update count
            setFollowersTotal((t) => t + 1);
            setFollowers((prev) => {
              // Avoid duplicate
              if (prev.some((f) => String(f.id) === memberId)) return prev;
              return [
                {
                  id: item.member_id || item.id,
                  name: item.name,
                  username: item.username,
                  avatar_url: item.profile_photo_url || item.avatar_url,
                  follower_type: 'member',
                  created_at: new Date().toISOString(),
                },
                ...prev,
              ];
            });
          } catch (e) {
            console.warn('[CreatorFollowers] removeFromCircle failed:', e);
            setHiddenCircleMemberIds((prev) => {
              const s = new Set(prev); s.delete(memberId); return s;
            });
            setCircleStates((prev) => ({ ...prev, [memberId]: "in_circle" }));
            setCircleTotal((t) => t + 1);
          }
        },
      },
      tertiaryAction: {
        text: 'Remove from Circle & as Follower',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setHiddenCircleMemberIds((prev) => {
            const next = new Set(prev);
            next.add(memberId);
            return next;
          });
          setHiddenFollowerIds((prev) => {
            const next = new Set(prev);
            next.add(memberId);
            return next;
          });
          setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
          setCircleTotal((t) => Math.max(0, t - 1));
          setFollowersTotal((t) => Math.max(0, t - 1));
          hapticsService.triggerImpactLight();
          try {
            await removeFromCircle(memberId, true); // also delete follow
            EventBus.emit('circle:member-removed', { creatorId, memberId, alsoUnfollow: true });
          } catch (e) {
            console.warn('[CreatorFollowers] removeFromCircle (also_unfollow) failed:', e);
            setHiddenCircleMemberIds((prev) => {
              const s = new Set(prev); s.delete(memberId); return s;
            });
            setHiddenFollowerIds((prev) => {
              const s = new Set(prev); s.delete(memberId); return s;
            });
            setCircleStates((prev) => ({ ...prev, [memberId]: "in_circle" }));
            setCircleTotal((t) => t + 1);
            setFollowersTotal((t) => t + 1);
          }
        },
      },
    });
  }, [showAlert, hideAlert]);


  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = useCallback((item) => {
    const type = item.follower_type || item.type || "member";
    if (type === "member") {
      navigation.navigate("MemberPublicProfile", { memberId: item.id });
    } else if (type === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: item.id });
    }
  }, [navigation]);

  // ── Follow Back (community followers) ────────────────────────────────────

  const handleFollowBack = useCallback(async (item) => {
    const communityId = item.id;
    const isFollowing = followBackStates[communityId];
    hapticsService.triggerImpactMedium();
    setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: true }));
    // Optimistic update
    setFollowBackStates((prev) => ({ ...prev, [communityId]: !isFollowing }));
    try {
      if (isFollowing) {
        await unfollowCommunity(communityId);
      } else {
        await followCommunity(communityId);
      }
    } catch (e) {
      console.warn('[CreatorFollowers] handleFollowBack error:', e);
      // Revert on failure
      setFollowBackStates((prev) => ({ ...prev, [communityId]: isFollowing }));
    } finally {
      setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: false }));
    }
  }, [followBackStates]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderFollowerItem = useCallback(({ item }) => {
    if (hiddenFollowerIds.has(String(item.id))) return null;
    return (
      <PersonRow
        item={item}
        isOwnProfile={isOwnProfile}
        circleState={circleStates[item.id] || "none"}
        circleLoading={!!circleActionLoading[item.id]}
        onAddToCircle={handleAddToCircle}
        onRemoveFromCircle={handleRemoveCircleMember}
        onRemoveFollower={handleRemoveFollower}
        onPress={() => navigateTo(item)}
        followBackState={followBackStates[item.id]}
        followBackLoading={!!followBackLoadingMap[item.id]}
        onFollowBack={handleFollowBack}
      />
    );
  }, [isOwnProfile, circleStates, circleActionLoading, handleAddToCircle, handleRemoveCircleMember, handleRemoveFollower, navigateTo, hiddenFollowerIds, followBackStates, followBackLoadingMap, handleFollowBack]);

  const renderCircleItem = useCallback(({ item }) => {
    const memberId = String(item.member_id || item.id);
    if (hiddenCircleMemberIds.has(memberId)) return null;
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          onPress={() => navigation.navigate("MemberPublicProfile", { memberId })}
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
        {/* Remove from Circle button — only on own profile */}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveCircleMember(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <UserMinus size={16} color={COLORS.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [navigation, isOwnProfile, handleRemoveCircleMember, hiddenCircleMemberIds]);

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
    <>
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
    <CustomAlertModal onClose={hideAlert} {...alertConfig} />
    </>
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
  ctaBtnRemove: {
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.04)",
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
  ctaTextRemove: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#FF3B30",
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
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
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
