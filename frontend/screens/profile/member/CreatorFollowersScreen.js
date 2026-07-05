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
  getFollowStatusForMember,
  getCircleStatus,
  followMember,
  unfollowMember,
  getMemberCommunityCircleStatus,
  getCommunityCircleStatus,
  removeMemberFromCommunityCircle,
} from "../../../api/members";
import {
  followCommunity,
  unfollowCommunity,
  getFollowStatusForCommunity,
} from "../../../api/communities";
import { getActiveAccount } from "../../../api/auth";
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

function PersonRow({
  item,
  isOwnProfile,
  viewerType,
  myId,
  circleState,
  circleLoading,
  onAddToCircle,
  onRemoveFromCircle,
  onRemoveFollower,
  onPress,
  followBackState,
  followBackLoading: fbLoading,
  onFollowBack,
  memberToMemberCircleState,
  onMemberCircleRequest,
}) {
  const itemType = item.type || item.follower_type || "member";
  const isMemberRow = itemType === "member";

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
        {/* 1. VIEWING OWN CREATOR PROFILE */}
        {isOwnProfile && (
          <>
            {/* Follow Back action — only for community followers on own profile who are not in the circle */}
            {itemType === "community" && circleState !== "in_circle" && (
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
                    followBackState === true ? { color: '#2962FF' } : { color: '#fff' },
                  ]}>
                    {followBackState === true ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Add/Remove Circle CTA — only on own profile, for member/community circle connections */}
            {(isMemberRow || circleState === "in_circle") && (
              <>
                {circleState === "in_circle" ? (
                  <TouchableOpacity
                    style={styles.circleRemoveBtn}
                    onPress={() => onRemoveFromCircle(item)}
                    disabled={circleLoading}
                    activeOpacity={0.75}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {circleLoading ? (
                      <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    ) : (
                      <UserMinus size={18} color={COLORS.textSecondary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.ctaBtn,
                      circleState === "requested"
                        ? styles.ctaBtnRequested
                        : styles.ctaBtnDefault
                    ]}
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
              </>
            )}

            {/* Remove follower button — only on own profile and when not in circle */}
            {isMemberRow && onRemoveFollower && circleState !== "in_circle" && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemoveFollower(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={15} color={COLORS.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* 2. VIEWING PUBLIC PROFILE */}
        {!isOwnProfile && String(item.id) !== String(myId) && (
          <>
            {/* If member viewer, check circle/follow statuses */}
            {viewerType === "member" && (
              <>
                {/* 2a. Circle relations (takes precedence) */}
                {memberToMemberCircleState === "in_circle" ? (
                  <View style={[styles.ctaBtn, { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}>
                    <Text style={[styles.ctaTextInCircle, { color: '#2962FF' }]}>In Circle</Text>
                  </View>
                ) : memberToMemberCircleState === "pending_outgoing" ? (
                  <View style={[styles.ctaBtn, { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}>
                    <Text style={[styles.ctaTextRequested, { color: '#FF9500' }]}>Requested</Text>
                  </View>
                ) : (
                  <>
                    {/* 2b. Creators or Communities show follow/following */}
                    {itemType === "community" || item.isCreator || item.is_creator || item.is_creator_mode_enabled ? (
                      <TouchableOpacity
                        style={[
                          styles.ctaBtn,
                          followBackState === true
                            ? { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                            : { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                        ]}
                        onPress={() => onFollowBack && onFollowBack(item)}
                        disabled={fbLoading || followBackState === null}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {fbLoading ? (
                          <ActivityIndicator size="small" color={followBackState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                        ) : (
                          <Text style={[
                            styles.ctaTextDefault,
                            followBackState === true ? { color: "#2962FF" } : { color: "#fff" },
                          ]}>
                            {followBackState === true ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      /* 2c. Regular members show Add button */
                      <TouchableOpacity
                        style={[styles.ctaBtn, { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}
                        onPress={() => onMemberCircleRequest(item.id)}
                        disabled={circleLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {circleLoading ? (
                          <ActivityIndicator size="small" color="#fff" style={{ width: 60 }} />
                        ) : (
                          <Text style={[styles.ctaTextDefault, { color: '#fff' }]}>Add</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            )}

            {/* If community viewer, check community circle relation */}
            {viewerType === "community" && (
              <>
                {(isOwnProfile ? circleState === "in_circle" : memberToMemberCircleState === "in_circle") ? (
                  <View style={[styles.ctaBtn, { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}>
                    <Text style={[styles.ctaTextInCircle, { color: '#2962FF' }]}>In Circle</Text>
                  </View>
                ) : (isOwnProfile ? circleState === "requested" : memberToMemberCircleState === "pending_outgoing") ? (
                  <View style={[styles.ctaBtn, { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}>
                    <Text style={[styles.ctaTextRequested, { color: '#FF9500' }]}>Requested</Text>
                  </View>
                ) : (
                  <>
                    {/* Creators/communities show follow/following */}
                    {itemType === "community" || item.isCreator || item.is_creator || item.is_creator_mode_enabled ? (
                      <TouchableOpacity
                        style={[
                          styles.ctaBtn,
                          followBackState === true
                            ? { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                            : { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                        ]}
                        onPress={() => onFollowBack && onFollowBack(item)}
                        disabled={fbLoading || followBackState === null}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {fbLoading ? (
                          <ActivityIndicator size="small" color={followBackState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                        ) : (
                          <Text style={[
                            styles.ctaTextDefault,
                            followBackState === true ? { color: "#2962FF" } : { color: "#fff" },
                          ]}>
                            {followBackState === true ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      /* Regular members show Add button */
                      <TouchableOpacity
                        style={[styles.ctaBtn, { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }]}
                        onPress={() => onMemberCircleRequest(item.id)}
                        disabled={circleLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {circleLoading ? (
                          <ActivityIndicator size="small" color="#fff" style={{ width: 60 }} />
                        ) : (
                          <Text style={[styles.ctaTextDefault, { color: '#fff' }]}>Add</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            )}
          </>
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

  // Current viewer details and public profile relationship states
  const [viewerType, setViewerType] = useState(null);
  const [myId, setMyId] = useState(null);
  const [memberCircleStates, setMemberCircleStates] = useState({});
  const [memberCircleLoadingMap, setMemberCircleLoadingMap] = useState({});

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

  const loadFollowers = useCallback(async (page = 1, search = "", circleIdSet = null, vt = viewerType, mid = myId) => {
    try {
      const res = await getCreatorFollowers(creatorId, { page, limit: 20, type: "all", search });
      const rows = res?.followers || [];
      const normalizedRows = rows.map((f) => ({
        id: f.id,
        name: f.name || "Unknown",
        username: f.username,
        avatar_url: f.avatar_url,
        type: f.follower_type || "member",
        created_at: f.created_at,
        isCreator: !!f.is_creator,
        is_creator: !!f.is_creator,
        is_creator_mode_enabled: !!f.is_creator,
      }));

      if (page === 1) {
        setFollowers(normalizedRows);
      } else {
        setFollowers((prev) => [...prev, ...normalizedRows]);
      }
      setFollowersTotal(res?.total ?? (page === 1 ? normalizedRows.length : followersTotal));
      setFollowerPage(page);
      setFollowerHasMore(!!res?.hasMore);

      // Pre-seed circleStates for followers already in circle
      const preSeededCircle = {};
      if (circleIdSet) {
        normalizedRows.forEach((f) => {
          if (f.type === 'member' && circleIdSet.has(String(f.id))) {
            preSeededCircle[f.id] = 'in_circle';
          }
        });
      }

      if (isOwnProfile) {
        // Pre-seed Follow Back states for community-type followers on own profile
        const communityRows = normalizedRows.filter((f) => f.type === 'community');
        const preSeededFollowBack = {};
        if (communityRows.length > 0) {
          const checks = await Promise.allSettled(
            communityRows.map(async (f) => {
              const status = await getFollowStatusForCommunity(f.id);
              return { id: f.id, isFollowing: !!status?.isFollowing };
            })
          );
          checks.forEach((r) => {
            if (r.status === 'fulfilled') {
              preSeededFollowBack[r.value.id] = r.value.isFollowing;
            }
          });
        }
        
        if (Object.keys(preSeededCircle).length > 0) {
          setCircleStates((prev) => ({ ...prev, ...preSeededCircle }));
        }
        if (Object.keys(preSeededFollowBack).length > 0) {
          setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
        }
      } else {
        // Viewing public profile
        if (Object.keys(preSeededCircle).length > 0) {
          setCircleStates((prev) => ({ ...prev, ...preSeededCircle }));
        }

        const preSeededFollowBack = {};
        const preSeededMemberCircle = {};

        await Promise.all(
          normalizedRows.map(async (row) => {
            const isCreator = row.isCreator || row.is_creator || row.is_creator_mode_enabled;
            
            // 1. Circle Status Check
            if (row.type === "community") {
              if (vt === "member") {
                const status = await getMemberCommunityCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              }
            } else if (row.type === "member") {
              if (vt === "member" && String(row.id) !== String(mid)) {
                const status = await getCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              } else if (vt === "community") {
                const status = await getCommunityCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              }
            }

            // 2. Follow Status Check
            if (row.type === "community") {
              const status = await getFollowStatusForCommunity(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            } else if (row.type === "member" && isCreator) {
              const status = await getFollowStatusForMember(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            }
          })
        );

        if (Object.keys(preSeededFollowBack).length > 0) {
          setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
        }
        if (Object.keys(preSeededMemberCircle).length > 0) {
          setMemberCircleStates((prev) => ({ ...prev, ...preSeededMemberCircle }));
        }
      }
    } catch (e) {
      console.warn("[CreatorFollowers] loadFollowers error:", e);
    }
  }, [creatorId, isOwnProfile, viewerType, myId, followersTotal]);

  const loadCircle = useCallback(async (page = 1, search = "", vt = viewerType, mid = myId) => {
    try {
      // Read-only circle members for a given member (works for own + public profiles)
      const res = await getPublicCircleMembers(creatorId, { page, limit: 20, search });
      const rows = res?.members || [];
      const normalizedRows = rows.map((r) => ({
        id: r.member_id || r.id,
        name: r.name,
        username: r.username,
        avatar_url: r.profile_photo_url || r.avatar_url,
        type: r.is_community ? "community" : "member",
        created_at: r.connected_since,
        isCreator: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
        is_creator: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
        is_creator_mode_enabled: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
      }));

      if (page === 1) {
        setCircleMembers(normalizedRows);
      } else {
        setCircleMembers((prev) => [...prev, ...normalizedRows]);
      }
      if (page === 1) setCircleTotal(normalizedRows.length);
      setCirclePage(page);
      setCircleHasMore(normalizedRows.length === 20);

      // Pre-seed follow states for creators and circle status for regular members in circle tab
      if (!isOwnProfile) {
        const preSeededFollowBack = {};
        const preSeededMemberCircle = {};

        await Promise.all(
          normalizedRows.map(async (row) => {
            const isCreator = row.isCreator || row.is_creator || row.is_creator_mode_enabled;
            
            // 1. Circle Status Check
            if (row.type === "community") {
              if (vt === "member") {
                const status = await getMemberCommunityCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              }
            } else if (row.type === "member") {
              if (vt === "member" && String(row.id) !== String(mid)) {
                const status = await getCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              } else if (vt === "community") {
                const status = await getCommunityCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededMemberCircle[row.id] = status.status;
                }
              }
            }

            // 2. Follow Status Check
            if (row.type === "community") {
              const status = await getFollowStatusForCommunity(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            } else if (row.type === "member" && isCreator) {
              const status = await getFollowStatusForMember(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            }
          })
        );

        if (Object.keys(preSeededFollowBack).length > 0) {
          setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
        }
        if (Object.keys(preSeededMemberCircle).length > 0) {
          setMemberCircleStates((prev) => ({ ...prev, ...preSeededMemberCircle }));
        }
      }
    } catch (e) {
      console.warn("[CreatorFollowers] loadCircle error:", e);
    }
  }, [creatorId, isOwnProfile, viewerType, myId]);

  // Initial load: resolve viewer, then fetch followers + circle members in parallel (on own profile)
  // so we can pre-seed circleStates for followers already in circle
  useEffect(() => {
    (async () => {
      let resolvedViewerType = null;
      let resolvedMyId = null;
      try {
        const { getActiveAccount } = await import("../../../api/auth");
        const acc = await getActiveAccount();
        if (acc) {
          resolvedViewerType = acc.type?.toLowerCase();
          resolvedMyId = acc.id;
          setViewerType(resolvedViewerType);
          setMyId(resolvedMyId);
        }
      } catch (_) {}

      setFollowerLoading(true);
      if (isOwnProfile) {
        // Fetch up to 200 circle member IDs to cross-reference against followers
        try {
          const circleRes = await getPublicCircleMembers(creatorId, { page: 1, limit: 200 });
          const members = circleRes?.members || [];
          const idSet = new Set(members.map((m) => String(m.member_id || m.id)));
          await loadFollowers(1, "", idSet, resolvedViewerType, resolvedMyId);
        } catch (_) {
          await loadFollowers(1, "", null, resolvedViewerType, resolvedMyId);
        } finally {
          setFollowerLoading(false);
        }
      } else {
        await loadFollowers(1, "", null, resolvedViewerType, resolvedMyId).finally(() => setFollowerLoading(false));
      }
    })();
  }, [loadFollowers, creatorId, isOwnProfile]);

  // Sync relationship status instantly across screens using EventBus
  useEffect(() => {
    const handleFollow = ({ id, isFollowing }) => {
      if (id) {
        setFollowBackStates((prev) => ({ ...prev, [id]: isFollowing }));
      }
    };

    const handleCircleMemberRemoved = ({ memberId }) => {
      if (!memberId) return;
      const targetId = String(memberId);
      setCircleStates((prev) => ({ ...prev, [targetId]: "none" }));
      setCircleMembers((prev) => prev.filter((m) => String(m.id || m.member_id) !== targetId));
      setCircleTotal((t) => Math.max(0, t - 1));
    };

    const handleCircleRequestResponded = ({ action, memberId, memberName, memberUsername, memberAvatar }) => {
      if (action === "accepted" && memberId) {
        const targetId = String(memberId);
        setCircleStates((prev) => ({ ...prev, [targetId]: "in_circle" }));
        setCircleTotal((t) => t + 1);
        setCircleMembers((prev) => {
          if (prev.some((m) => String(m.id || m.member_id) === targetId)) return prev;
          return [
            {
              id: memberId,
              name: memberName,
              username: memberUsername,
              avatar_url: memberAvatar,
              type: "member",
              created_at: new Date().toISOString(),
            },
            ...prev,
          ];
        });
      }
    };

    EventBus.on("follow-updated", handleFollow);
    EventBus.on("my:circle-member-removed", handleCircleMemberRemoved);
    EventBus.on("circle-request-responded", handleCircleRequestResponded);

    return () => {
      EventBus.off("follow-updated", handleFollow);
      EventBus.off("my:circle-member-removed", handleCircleMemberRemoved);
      EventBus.off("circle-request-responded", handleCircleRequestResponded);
    };
  }, []);

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
            return loadFollowers(1, followerSearch, idSet, viewerType, myId);
          })
          .catch(() => loadFollowers(1, followerSearch, null, viewerType, myId))
          .finally(() => setFollowerLoading(false));
      } else {
        loadFollowers(1, followerSearch, null, viewerType, myId).finally(() => setFollowerLoading(false));
      }
      // Reload circle tab if it was ever opened
      if (circleFetchedRef.current) {
        loadCircle(1, circleSearch, viewerType, myId);
      }
    }, [loadFollowers, loadCircle, followerSearch, circleSearch, isOwnProfile, creatorId, viewerType, myId])
  );

  // Lazy load circle tab on first open
  const handleTabPress = useCallback((tab) => {
    hapticsService.triggerImpactLight();
    setActiveTab(tab);
    if (tab === "circle" && !circleFetchedRef.current) {
      circleFetchedRef.current = true;
      setCircleLoading(true);
      loadCircle(1, "", viewerType, myId).finally(() => setCircleLoading(false));
    }
  }, [loadCircle, viewerType, myId]);

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
          await loadFollowers(1, activeSearch, idSet, viewerType, myId);
        } catch {
          await loadFollowers(1, activeSearch, null, viewerType, myId);
        }
      } else {
        await loadFollowers(1, activeSearch, null, viewerType, myId);
      }
    } else {
      await loadCircle(1, activeSearch, viewerType, myId);
    }
    setRefreshing(false);
  }, [activeTab, followerSearch, circleSearch, loadFollowers, loadCircle, isOwnProfile, creatorId, viewerType, myId]);

  // Load more followers
  const loadMoreFollowers = useCallback(async () => {
    if (!followerHasMore || followerLoadingMoreRef.current) return;
    followerLoadingMoreRef.current = true;
    setFollowerLoadingMore(true);
    await loadFollowers(followerPage + 1, followerSearch, null, viewerType, myId);
    followerLoadingMoreRef.current = false;
    setFollowerLoadingMore(false);
  }, [followerHasMore, followerPage, followerSearch, loadFollowers, viewerType, myId]);

  // Load more circle
  const loadMoreCircle = useCallback(async () => {
    if (!circleHasMore || circleLoadingMoreRef.current) return;
    circleLoadingMoreRef.current = true;
    setCircleLoadingMore(true);
    await loadCircle(circlePage + 1, circleSearch, viewerType, myId);
    circleLoadingMoreRef.current = false;
    setCircleLoadingMore(false);
  }, [circleHasMore, circlePage, circleSearch, loadCircle, viewerType, myId]);

  // Search handlers (debounced via useEffect)
  useEffect(() => {
    const t = setTimeout(() => {
      setFollowerLoading(true);
      loadFollowers(1, followerSearch, null, viewerType, myId).finally(() => setFollowerLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [followerSearch, viewerType, myId]); // eslint-disable-line

  useEffect(() => {
    if (!circleFetchedRef.current) return;
    const t = setTimeout(() => {
      setCircleLoading(true);
      loadCircle(1, circleSearch, viewerType, myId).finally(() => setCircleLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [circleSearch, viewerType, myId]); // eslint-disable-line

  // ── Add to Circle ─────────────────────────────────────────────────────────

  const handleAddToCircle = useCallback(async (followerId) => {
    hapticsService.triggerImpactMedium();
    setCircleActionLoading((prev) => ({ ...prev, [followerId]: true }));
    setCircleStates((prev) => ({ ...prev, [followerId]: "requested" })); // optimistic
    try {
      const res = await sendCircleRequest(followerId);
      const isAuto = !!(res?.auto_accepted || res?.status === "in_circle");
      setCircleStates((prev) => ({ ...prev, [followerId]: isAuto ? "in_circle" : "requested" }));
      if (isAuto) {
        setCircleTotal((t) => t + 1);
        setCircleMembers((prevList) => {
          const followerItem = followers.find((f) => String(f.id) === String(followerId));
          if (followerItem && !prevList.some((m) => String(m.id) === String(followerId))) {
            return [
              {
                ...followerItem,
                circleState: "in_circle",
              },
              ...prevList,
            ];
          }
          return prevList;
        });
      }
    } catch (e) {
      console.warn("[CreatorFollowers] sendCircleRequest failed:", e);
      setCircleStates((prev) => ({ ...prev, [followerId]: "none" })); // revert
    } finally {
      setCircleActionLoading((prev) => ({ ...prev, [followerId]: false }));
    }
  }, [followers]);

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
          // Optimistic hide and count update
          setHiddenFollowerIds((prev) => new Set([...prev, String(item.id)]));
          setFollowersTotal((t) => Math.max(0, t - 1));
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
            setFollowersTotal((t) => t + 1);
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  // ── Remove Circle Member ───────────────────────────────────────────────────
  const handleRemoveCircleMember = useCallback((item) => {
    hapticsService.triggerImpactLight();
    const memberId = String(item.member_id || item.id);
    const itemType = item.follower_type || item.type || "member";
    const isCommunity = itemType === "community";

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
            if (isCommunity) {
              await removeMemberFromCommunityCircle(memberId, false);
            } else {
              await removeFromCircle(memberId, false); // follow restored
            }
            EventBus.emit('circle:member-removed', { creatorId, memberId, alsoUnfollow: false });
            EventBus.emit('my:circle-member-removed', { memberId, alsoUnfollow: false });
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
                  follower_type: itemType,
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
            if (isCommunity) {
              await removeMemberFromCommunityCircle(memberId, true);
            } else {
              await removeFromCircle(memberId, true); // also delete follow
            }
            EventBus.emit('circle:member-removed', { creatorId, memberId, alsoUnfollow: true });
            EventBus.emit('my:circle-member-removed', { memberId, alsoUnfollow: true });
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
      navigation.push("MemberPublicProfile", { memberId: item.id });
    } else if (type === "community") {
      navigation.push("CommunityPublicProfile", { communityId: item.id });
    }
  }, [navigation]);

  // ── Follow Back (community followers) ────────────────────────────────────

  const handleFollowBack = useCallback(async (item) => {
    const communityId = item.id;
    const isFollowing = followBackStates[communityId];
    if (isFollowing) {
      hapticsService.triggerImpactLight();
      showAlert({
        title: 'Unfollow?',
        message: `Are you sure you want to unfollow ${item.name || 'this community'}?`,
        icon: UserMinus,
        iconColor: COLORS.error || '#E53935',
        secondaryAction: { text: 'Cancel', onPress: hideAlert },
        primaryAction: {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            hideAlert();
            hapticsService.triggerImpactMedium();
            setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: true }));
            setFollowBackStates((prev) => ({ ...prev, [communityId]: false }));
            try {
              await unfollowCommunity(communityId);
            } catch (e) {
              console.warn('[CreatorFollowers] handleFollowBack error:', e);
              setFollowBackStates((prev) => ({ ...prev, [communityId]: true }));
            } finally {
              setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: false }));
            }
          },
        },
      });
    } else {
      hapticsService.triggerImpactMedium();
      setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: true }));
      setFollowBackStates((prev) => ({ ...prev, [communityId]: true }));
      try {
        await followCommunity(communityId);
      } catch (e) {
        console.warn('[CreatorFollowers] handleFollowBack error:', e);
        setFollowBackStates((prev) => ({ ...prev, [communityId]: false }));
      } finally {
        setFollowBackLoadingMap((prev) => ({ ...prev, [communityId]: false }));
      }
    }
  }, [followBackStates, showAlert, hideAlert]);

  // Member-to-Member circle connection from public view
  const handleMemberCircleRequest = useCallback(async (targetId) => {
    hapticsService.triggerImpactMedium();
    setMemberCircleLoadingMap((prev) => ({ ...prev, [targetId]: true }));
    setMemberCircleStates((prev) => ({ ...prev, [targetId]: "pending_outgoing" }));
    try {
      const res = await sendCircleRequest(targetId);
      const isAuto = !!(res?.auto_accepted || res?.status === "in_circle");
      setMemberCircleStates((prev) => ({ ...prev, [targetId]: isAuto ? "in_circle" : "pending_outgoing" }));
    } catch (e) {
      console.warn('[CreatorFollowers] sendCircleRequest failed:', e);
      setMemberCircleStates((prev) => ({ ...prev, [targetId]: "none" }));
    } finally {
      setMemberCircleLoadingMap((prev) => ({ ...prev, [targetId]: false }));
    }
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderFollowerItem = useCallback(({ item }) => {
    if (hiddenFollowerIds.has(String(item.id))) return null;
    const circleLoading = !!circleActionLoading[item.id] || !!memberCircleLoadingMap[item.id];
    return (
      <PersonRow
        item={item}
        isOwnProfile={isOwnProfile}
        viewerType={viewerType}
        myId={myId}
        circleState={circleStates[item.id] || "none"}
        circleLoading={circleLoading}
        onAddToCircle={handleAddToCircle}
        onRemoveFromCircle={handleRemoveCircleMember}
        onRemoveFollower={handleRemoveFollower}
        onPress={() => navigateTo(item)}
        followBackState={followBackStates[item.id]}
        followBackLoading={!!followBackLoadingMap[item.id]}
        onFollowBack={handleFollowBack}
        memberToMemberCircleState={memberCircleStates[item.id] || "none"}
        onMemberCircleRequest={handleMemberCircleRequest}
      />
    );
  }, [isOwnProfile, viewerType, myId, circleStates, circleActionLoading, memberCircleLoadingMap, handleAddToCircle, handleRemoveCircleMember, handleRemoveFollower, navigateTo, hiddenFollowerIds, followBackStates, followBackLoadingMap, handleFollowBack, memberCircleStates, handleMemberCircleRequest]);

  const renderCircleItem = useCallback(({ item }) => {
    const memberId = String(item.member_id || item.id);
    if (hiddenCircleMemberIds.has(memberId)) return null;
    const circleLoading = !!circleActionLoading[item.id] || !!memberCircleLoadingMap[item.id];
    return (
      <PersonRow
        item={item}
        isOwnProfile={isOwnProfile}
        viewerType={viewerType}
        myId={myId}
        circleState={isOwnProfile ? "in_circle" : (circleStates[item.id] || "none")}
        circleLoading={circleLoading}
        onRemoveFromCircle={handleRemoveCircleMember}
        onPress={() => navigateTo(item)}
        followBackState={followBackStates[item.id]}
        followBackLoading={!!followBackLoadingMap[item.id]}
        onFollowBack={handleFollowBack}
        memberToMemberCircleState={memberCircleStates[item.id] || "none"}
        onMemberCircleRequest={handleMemberCircleRequest}
      />
    );
  }, [isOwnProfile, viewerType, myId, circleStates, circleActionLoading, memberCircleLoadingMap, handleRemoveCircleMember, navigateTo, hiddenCircleMemberIds, followBackStates, followBackLoadingMap, handleFollowBack, memberCircleStates, handleMemberCircleRequest]);

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

  const displayedFollowersTotal = followerSearch.trim() !== ""
    ? followers.length
    : followersTotal;

  const displayedCircleTotal = circleSearch.trim() !== ""
    ? circleMembers.length
    : circleTotal;

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
            Followers • {displayedFollowersTotal}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isFollowersTab && styles.tabActive]}
          onPress={() => handleTabPress("circle")}
        >
          <Text style={[styles.tabText, !isFollowersTab && styles.tabTextActive]}>
            Circle • {displayedCircleTotal}
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
    borderBottomWidth: 0,
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
  circleRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
});
