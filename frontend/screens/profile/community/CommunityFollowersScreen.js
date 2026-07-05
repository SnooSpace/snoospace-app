/**
 * CommunityFollowersScreen
 *
 * Two-tab screen opened when a viewer taps the "Followers" stat on a Community profile.
 *
 *   • Followers tab — people who follow this community (getCommunityFollowers)
 *   • Circle tab    — members in this community's circle (getCommunityCircleMembers)
 *
 * Route: CommunityFollowers
 * Params: { communityId, isOwnProfile, initialFollowersCount, initialCircleCount }
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  UserCheck,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../../constants/theme";
import {
  getCommunityFollowers,
  getFollowStatusForCommunity,
  removeCommunityFollower,
} from "../../../api/communities";
import {
  getCommunityCircleMembers,
  sendCommunityCircleInvite,
  cancelCommunityCircleInvite,
  removeMemberFromCommunityCircle,
  getCommunityCircleStatus,
  getMemberCommunityCircleStatus,
  followMember,
  unfollowMember,
  getFollowStatusForMember,
  sendCircleRequest,
  getCircleStatus,
} from "../../../api/members";
import hapticsService from "../../../services/HapticsService";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import EventBus from "../../../utils/EventBus";

// Helper to calculate relative time
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

// Avatar helper
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

// Person Row Component
function PersonRow({
  item,
  isOwnProfile,
  viewerType,
  myId,
  circleState, // 'none' | 'pending_outgoing' | 'in_circle'
  circleLoading,
  onAddToCircle,
  onCancelCircleInvite,
  onRemoveFromCircle,
  onRemoveFollower,
  onPress,
  followBackState, // boolean
  followBackLoading,
  onFollowBack,
  memberToMemberCircleState, // 'none' | 'pending_outgoing' | 'pending_incoming' | 'in_circle' | 'self'
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
        <Avatar uri={item.avatar_url || item.avatarUrl || item.profile_photo_url} name={item.name} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || "Unknown"}</Text>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
          ) : null}
          {item.created_at && (
            <Text style={styles.rowTime}>{relativeTime(item.created_at)}</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* 1. VIEWING OWN COMMUNITY PROFILE */}
        {isOwnProfile && (
          <>
            {/* For Member Followers: Add to Community Circle / Invited / In Circle */}
            {isMemberRow && (
              <TouchableOpacity
                style={[
                  styles.ctaBtn,
                  circleState === "in_circle"
                    ? styles.ctaBtnInCircle
                    : circleState === "pending_outgoing"
                    ? styles.ctaBtnRequested
                    : styles.ctaBtnDefault
                ]}
                onPress={() => {
                  if (circleState === "in_circle") {
                    onRemoveFromCircle(item);
                  } else if (circleState === "pending_outgoing") {
                    onCancelCircleInvite(item);
                  } else {
                    onAddToCircle(item.id);
                  }
                }}
                disabled={circleLoading}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {circleLoading ? (
                  <ActivityIndicator size="small" color={circleState === "in_circle" ? "#2962FF" : circleState === "pending_outgoing" ? "#FF9500" : "#fff"} style={{ width: 60 }} />
                ) : circleState === "in_circle" ? (
                  <Text style={styles.ctaTextInCircle}>In Circle</Text>
                ) : circleState === "pending_outgoing" ? (
                  <Text style={styles.ctaTextRequested}>Invited</Text>
                ) : (
                  <Text style={styles.ctaTextDefault}>Add</Text>
                )}
              </TouchableOpacity>
            )}

            {/* For Community Followers: Follow Back / Following */}
            {itemType === "community" && (
              <TouchableOpacity
                style={[
                  styles.ctaBtn,
                  followBackState === true
                    ? styles.ctaBtnInCircle
                    : styles.ctaBtnDefault
                ]}
                onPress={() => onFollowBack && onFollowBack(item)}
                disabled={followBackLoading || followBackState === null}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {followBackLoading ? (
                  <ActivityIndicator size="small" color={followBackState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                ) : (
                  <Text style={[
                    styles.ctaTextDefault,
                    followBackState === true && { color: "#2962FF" },
                  ]}>
                    {followBackState === true ? 'Following' : 'Follow Back'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Remove follower button — only on own profile and when not in circle */}
            {onRemoveFollower && circleState !== "in_circle" && (
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
                  <View style={[styles.ctaBtn, styles.ctaBtnInCircle]}>
                    <Text style={styles.ctaTextInCircle}>In Circle</Text>
                  </View>
                ) : memberToMemberCircleState === "pending_outgoing" ? (
                  <View style={[styles.ctaBtn, styles.ctaBtnRequested]}>
                    <Text style={styles.ctaTextRequested}>Requested</Text>
                  </View>
                ) : (
                  <>
                    {/* 2b. Creators or Communities show follow/following */}
                    {itemType === "community" || item.isCreator || item.is_creator || item.is_creator_mode_enabled ? (
                      <TouchableOpacity
                        style={[
                          styles.ctaBtn,
                          followBackState === true ? styles.ctaBtnInCircle : styles.ctaBtnDefault
                        ]}
                        onPress={() => onFollowBack && onFollowBack(item)}
                        disabled={followBackLoading || followBackState === null}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {followBackLoading ? (
                          <ActivityIndicator size="small" color={followBackState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                        ) : (
                          <Text style={[
                            styles.ctaTextDefault,
                            followBackState === true && { color: "#2962FF" },
                          ]}>
                            {followBackState === true ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      /* 2c. Regular members show Add button */
                      <TouchableOpacity
                        style={[styles.ctaBtn, styles.ctaBtnDefault]}
                        onPress={() => onMemberCircleRequest(item.id)}
                        disabled={circleLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {circleLoading ? (
                          <ActivityIndicator size="small" color="#fff" style={{ width: 60 }} />
                        ) : (
                          <Text style={styles.ctaTextDefault}>Add</Text>
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
                  <View style={[styles.ctaBtn, styles.ctaBtnInCircle]}>
                    <Text style={styles.ctaTextInCircle}>In Circle</Text>
                  </View>
                ) : (isOwnProfile ? circleState === "requested" : memberToMemberCircleState === "pending_outgoing") ? (
                  <View style={[styles.ctaBtn, styles.ctaBtnRequested]}>
                    <Text style={styles.ctaTextRequested}>Requested</Text>
                  </View>
                ) : (
                  <>
                    {/* Creators/communities show follow/following */}
                    {itemType === "community" || item.isCreator || item.is_creator || item.is_creator_mode_enabled ? (
                      <TouchableOpacity
                        style={[
                          styles.ctaBtn,
                          followBackState === true ? styles.ctaBtnInCircle : styles.ctaBtnDefault
                        ]}
                        onPress={() => onFollowBack && onFollowBack(item)}
                        disabled={followBackLoading || followBackState === null}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {followBackLoading ? (
                          <ActivityIndicator size="small" color={followBackState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                        ) : (
                          <Text style={[
                            styles.ctaTextDefault,
                            followBackState === true && { color: "#2962FF" },
                          ]}>
                            {followBackState === true ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      /* Regular members show Add button */
                      <TouchableOpacity
                        style={[styles.ctaBtn, styles.ctaBtnDefault]}
                        onPress={() => onMemberCircleRequest(item.id)}
                        disabled={circleLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {circleLoading ? (
                          <ActivityIndicator size="small" color="#fff" style={{ width: 60 }} />
                        ) : (
                          <Text style={styles.ctaTextDefault}>Add</Text>
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

export default function CommunityFollowersScreen({ route, navigation }) {
  const {
    communityId,
    isOwnProfile = false,
    initialFollowersCount = 0,
    initialCircleCount = 0,
  } = route?.params || {};

  const [activeTab, setActiveTab] = useState("followers");
  const [viewerType, setViewerType] = useState(null);
  const [myId, setMyId] = useState(null);

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

  // Community circle status map (for community viewer inviting members)
  const [circleStates, setCircleStates] = useState({}); // id -> 'none' | 'pending_outgoing' | 'in_circle'
  const [circleActionLoading, setCircleActionLoading] = useState({});

  // Follow back status map (for community viewer following other communities)
  const [followBackStates, setFollowBackStates] = useState({});
  const [followBackLoadingMap, setFollowBackLoadingMap] = useState({});

  // Member-to-Member circle status map (for member viewer connecting with member rows)
  const [memberCircleStates, setMemberCircleStates] = useState({});
  const [memberCircleLoadingMap, setMemberCircleLoadingMap] = useState({});

  const [hiddenFollowerIds, setHiddenFollowerIds] = useState(new Set());

  // Alert modal state
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const showAlert = useCallback((cfg) => setAlertConfig({ ...cfg, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const followerLoadingMoreRef = useRef(false);
  const circleLoadingMoreRef = useRef(false);

  // Detect viewer account, load ID, and perform initial followers load
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

      // Pre-fetch community circle member IDs to seed circleStates
      let circleMemberIdSet = new Set();
      try {
        const circleRes = await getCommunityCircleMembers(communityId, { page: 1, limit: 200 });
        const members = circleRes?.members || [];
        members.forEach((m) => {
          circleMemberIdSet.add(String(m.member_id || m.id));
        });
        setCircleTotal(members.length);
      } catch (e) {
        console.warn("[CommunityFollowers] failed to pre-fetch circle members:", e);
      }

      setFollowerLoading(true);
      loadFollowers(1, "", resolvedViewerType, resolvedMyId, circleMemberIdSet).finally(() => setFollowerLoading(false));
    })();
  }, [loadFollowers, communityId]);

  // Fetch Followers Page
  const loadFollowers = useCallback(async (page = 1, search = "", vt = viewerType, mid = myId, circleIdSet = null) => {
    try {
      const res = await getCommunityFollowers(communityId, { page, limit: 20, search });
      const rows = res?.followers || res?.results || res || [];
      const normalizedRows = rows.map((r) => ({
        id: r.follower_id || r.id,
        name: r.follower_name || r.name || r.full_name,
        username: r.follower_username || r.username,
        avatar_url: r.follower_photo_url || r.profile_photo_url,
        type: r.follower_type || "member",
        created_at: r.created_at,
        is_creator: !!r.is_creator || !!r.is_creator_mode_enabled || !!r.isCreator,
        isCreator: !!r.is_creator || !!r.is_creator_mode_enabled || !!r.isCreator,
        is_creator_mode_enabled: !!r.is_creator || !!r.is_creator_mode_enabled || !!r.isCreator,
      }));

      if (page === 1) {
        setFollowers(normalizedRows);
      } else {
        setFollowers((prev) => [...prev, ...normalizedRows]);
      }
      setFollowersTotal(res?.total ?? (page === 1 ? normalizedRows.length : followersTotal));
      setFollowerPage(page);
      setFollowerHasMore(normalizedRows.length === 20);

      // Pre-seed circle states from pre-fetched circleIdSet (both own and public profiles)
      const preSeededCircle = {};
      if (circleIdSet) {
        normalizedRows.forEach((row) => {
          if (row.type === "member" && circleIdSet.has(String(row.id))) {
            preSeededCircle[row.id] = "in_circle";
          }
        });
      }

      // Pre-seed community circle states / follow backs if viewing own profile
      if (isOwnProfile) {
        const preSeededFollowBack = {};

        await Promise.all(
          normalizedRows.map(async (row) => {
            if (row.type === "member") {
              // Only query if not already marked 'in_circle'
              if (preSeededCircle[row.id] !== "in_circle") {
                const status = await getCommunityCircleStatus(row.id).catch(() => null);
                if (status?.status) {
                  preSeededCircle[row.id] = status.status;
                  // If invite exists, track its invite_id in list status helper if needed
                  if (status.invite_id) {
                    row.invite_id = status.invite_id;
                  }
                }
              }
            } else if (row.type === "community") {
              const status = await getFollowStatusForMember(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            }
          })
        );

        setCircleStates((prev) => ({ ...prev, ...preSeededCircle }));
        setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
      } else {
        // Viewing public profile
        if (Object.keys(preSeededCircle).length > 0) {
          setCircleStates((prev) => ({ ...prev, ...preSeededCircle }));
        }

        // Fetch follow status for creators/communities and circle status for member rows
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

        setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
        if (Object.keys(preSeededMemberCircle).length > 0) {
          setMemberCircleStates((prev) => ({ ...prev, ...preSeededMemberCircle }));
        }
      }
    } catch (e) {
      console.warn("[CommunityFollowers] loadFollowers error:", e);
    }
  }, [communityId, isOwnProfile, viewerType, myId, followersTotal]);

  // Fetch Circle Members Page
  const loadCircle = useCallback(async (page = 1, search = "", vt = viewerType, mid = myId) => {
    try {
      const res = await getCommunityCircleMembers(communityId, { page, limit: 20, search });
      const rows = res?.members || [];
      const normalizedRows = rows.map((r) => ({
        id: r.member_id || r.id,
        name: r.name,
        username: r.username,
        avatar_url: r.avatar_url || r.profile_photo_url,
        type: "member",
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

      // Pre-seed follow states for creators and circle status for regular members
      if (!isOwnProfile) {
        const preSeededFollowBack = {};
        const preSeededMemberCircle = {};

        await Promise.all(
          normalizedRows.map(async (row) => {
            const isCreator = row.isCreator || row.is_creator || row.is_creator_mode_enabled;
            
            // 1. Circle Status Check
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

            // 2. Follow Status Check
            if (isCreator) {
              const status = await getFollowStatusForMember(row.id).catch(() => null);
              preSeededFollowBack[row.id] = !!status?.isFollowing;
            }
          })
        );

        setFollowBackStates((prev) => ({ ...prev, ...preSeededFollowBack }));
        if (Object.keys(preSeededMemberCircle).length > 0) {
          setMemberCircleStates((prev) => ({ ...prev, ...preSeededMemberCircle }));
        }
      }
    } catch (e) {
      console.warn("[CommunityFollowers] loadCircle error:", e);
    }
  }, [communityId, isOwnProfile, viewerType, myId]);

  // Reload on focus
  const hasMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      setHiddenFollowerIds(new Set());
      setFollowerLoading(true);
      (async () => {
        let circleMemberIdSet = new Set();
        try {
          const circleRes = await getCommunityCircleMembers(communityId, { page: 1, limit: 200 });
          const members = circleRes?.members || [];
          members.forEach((m) => {
            circleMemberIdSet.add(String(m.member_id || m.id));
          });
          setCircleTotal(members.length);
        } catch (_) {}

        await loadFollowers(1, followerSearch, viewerType, myId, circleMemberIdSet);
        if (circleFetchedRef.current) {
          await loadCircle(1, circleSearch);
        }
      })().finally(() => setFollowerLoading(false));
    }, [loadFollowers, loadCircle, followerSearch, circleSearch, communityId, viewerType, myId])
  );

  // Tab press handler
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
    if (activeTab === "followers") {
      let circleMemberIdSet = new Set();
      try {
        const circleRes = await getCommunityCircleMembers(communityId, { page: 1, limit: 200 });
        const members = circleRes?.members || [];
        members.forEach((m) => {
          circleMemberIdSet.add(String(m.member_id || m.id));
        });
      } catch (_) {}
      await loadFollowers(1, followerSearch, viewerType, myId, circleMemberIdSet);
    } else {
      await loadCircle(1, circleSearch);
    }
    setRefreshing(false);
  }, [activeTab, followerSearch, circleSearch, loadFollowers, loadCircle, communityId, viewerType, myId]);

  // Infinite scroll
  const loadMoreFollowers = useCallback(async () => {
    if (!followerHasMore || followerLoadingMoreRef.current) return;
    followerLoadingMoreRef.current = true;
    setFollowerLoadingMore(true);
    await loadFollowers(followerPage + 1, followerSearch);
    followerLoadingMoreRef.current = false;
    setFollowerLoadingMore(false);
  }, [followerHasMore, followerPage, followerSearch, loadFollowers]);

  const loadMoreCircle = useCallback(async () => {
    if (!circleHasMore || circleLoadingMoreRef.current) return;
    circleLoadingMoreRef.current = true;
    setCircleLoadingMore(true);
    await loadCircle(circlePage + 1, circleSearch);
    circleLoadingMoreRef.current = false;
    setCircleLoadingMore(false);
  }, [circleHasMore, circlePage, circleSearch, loadCircle]);

  // Debounced search
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

  // ── Actions ──

  // Add Member to Community Circle
  const handleAddToCircle = useCallback(async (memberId) => {
    hapticsService.triggerImpactMedium();
    setCircleActionLoading((prev) => ({ ...prev, [memberId]: true }));
    setCircleStates((prev) => ({ ...prev, [memberId]: "pending_outgoing" }));
    try {
      const res = await sendCommunityCircleInvite(memberId);
      // Store the invite id in followers list item if needed
      setFollowers((prev) =>
        prev.map((f) => (String(f.id) === String(memberId) ? { ...f, invite_id: res?.invite_id } : f))
      );
    } catch (e) {
      console.warn("[CommunityFollowers] sendCommunityCircleInvite failed:", e);
      setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
    } finally {
      setCircleActionLoading((prev) => ({ ...prev, [memberId]: false }));
    }
  }, []);

  // Cancel Community Circle Invite
  const handleCancelCircleInvite = useCallback(async (item) => {
    const memberId = item.id;
    const inviteId = item.invite_id;
    if (!inviteId) {
      // Re-fetch status to get invite ID if missing
      try {
        const stat = await getCommunityCircleStatus(memberId);
        if (stat.invite_id) {
          item.invite_id = stat.invite_id;
        } else {
          return;
        }
      } catch (e) { return; }
    }

    hapticsService.triggerImpactLight();
    showAlert({
      title: 'Withdraw Invite?',
      message: `Cancel the circle invite sent to ${item.name || 'this member'}?`,
      icon: Clock,
      iconColor: '#FF9500',
      secondaryAction: { text: 'Keep', onPress: hideAlert },
      primaryAction: {
        text: 'Cancel Invite',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setCircleActionLoading((prev) => ({ ...prev, [memberId]: true }));
          setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
          try {
            await cancelCommunityCircleInvite(item.invite_id);
          } catch (e) {
            console.warn('[CommunityFollowers] cancelCommunityCircleInvite failed:', e);
            setCircleStates((prev) => ({ ...prev, [memberId]: "pending_outgoing" }));
          } finally {
            setCircleActionLoading((prev) => ({ ...prev, [memberId]: false }));
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  // Remove Member from Community Circle
  const handleRemoveFromCircle = useCallback((item) => {
    const memberId = String(item.id);
    hapticsService.triggerImpactLight();
    showAlert({
      title: 'Remove from Circle?',
      message: `${item.name || 'This member'} will be removed from your community circle.`,
      icon: UserMinus,
      iconColor: '#E53935',
      secondaryAction: { text: 'Cancel', onPress: hideAlert },
      primaryAction: {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setCircleActionLoading((prev) => ({ ...prev, [memberId]: true }));
          setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
          setCircleTotal((t) => Math.max(0, t - 1));
          // Optimistically remove from circles list
          setCircleMembers((prev) => prev.filter((m) => String(m.id) !== memberId));
          hapticsService.triggerImpactLight();
          try {
            await removeMemberFromCommunityCircle(memberId, false); // keep follow (follow restored)
            EventBus.emit('circle:member-removed', { creatorId: communityId, memberId, alsoUnfollow: false });
            EventBus.emit('my:circle-member-removed', { memberId, alsoUnfollow: false });
            // Follow is restored — add member to Followers tab and update count
            setFollowersTotal((t) => t + 1);
            setFollowers((prev) => {
              if (prev.some((f) => String(f.id) === memberId)) return prev;
              return [
                {
                  id: item.id,
                  name: item.name,
                  username: item.username,
                  avatar_url: item.avatar_url,
                  type: 'member',
                  created_at: new Date().toISOString(),
                },
                ...prev,
              ];
            });
          } catch (e) {
            console.warn('[CommunityFollowers] removeMemberFromCommunityCircle failed:', e);
            // Revert state
            setCircleStates((prev) => ({ ...prev, [memberId]: "in_circle" }));
            setCircleTotal((t) => t + 1);
            loadCircle(1, circleSearch);
          } finally {
            setCircleActionLoading((prev) => ({ ...prev, [memberId]: false }));
          }
        },
      },
      tertiaryAction: {
        text: 'Remove from Circle & as Follower',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setCircleActionLoading((prev) => ({ ...prev, [memberId]: true }));
          setCircleStates((prev) => ({ ...prev, [memberId]: "none" }));
          setCircleTotal((t) => Math.max(0, t - 1));
          setFollowersTotal((t) => Math.max(0, t - 1));
          // Optimistically remove from circles and followers list
          setCircleMembers((prev) => prev.filter((m) => String(m.id) !== memberId));
          setFollowers((prev) => prev.filter((f) => String(f.id) !== memberId));
          hapticsService.triggerImpactLight();
          try {
            await removeMemberFromCommunityCircle(memberId, true); // also unfollow
            EventBus.emit('circle:member-removed', { creatorId: communityId, memberId, alsoUnfollow: true });
            EventBus.emit('my:circle-member-removed', { memberId, alsoUnfollow: true });
          } catch (e) {
            console.warn('[CommunityFollowers] removeMemberFromCommunityCircle failed:', e);
            // Revert state
            setCircleStates((prev) => ({ ...prev, [memberId]: "in_circle" }));
            setCircleTotal((t) => t + 1);
            setFollowersTotal((t) => t + 1);
            loadCircle(1, circleSearch);
          } finally {
            setCircleActionLoading((prev) => ({ ...prev, [memberId]: false }));
          }
        },
      },
    });
  }, [showAlert, hideAlert, circleSearch, loadCircle, communityId]);

  // Remove Follower
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
            await removeCommunityFollower(item.id, item.follower_type || item.type || 'member');
            EventBus.emit('community:follower-removed', { communityId, followerId: String(item.id) });
          } catch (e) {
            console.warn('[CommunityFollowers] removeCommunityFollower failed:', e);
            // Revert on failure
            setHiddenFollowerIds((prev) => {
              const s = new Set(prev); s.delete(String(item.id)); return s;
            });
            setFollowersTotal((t) => t + 1);
          }
        },
      },
    });
  }, [showAlert, hideAlert, communityId]);

  // Follow back community followers
  const handleFollowBack = useCallback(async (item) => {
    const communityId = item.id;
    const isFollowing = followBackStates[communityId];
    if (isFollowing) {
      hapticsService.triggerImpactLight();
      showAlert({
        title: 'Unfollow?',
        message: `Are you sure you want to unfollow ${item.name || 'this member'}?`,
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
              await unfollowMember(communityId);
            } catch (e) {
              console.warn('[CommunityFollowers] handleFollowBack error:', e);
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
        await followMember(communityId);
      } catch (e) {
        console.warn('[CommunityFollowers] handleFollowBack error:', e);
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
      await sendCircleRequest(targetId);
    } catch (e) {
      console.warn('[CommunityFollowers] sendCircleRequest failed:', e);
      setMemberCircleStates((prev) => ({ ...prev, [targetId]: "none" }));
    } finally {
      setMemberCircleLoadingMap((prev) => ({ ...prev, [targetId]: false }));
    }
  }, []);

  // Navigation helper
  const navigateTo = useCallback((item) => {
    const type = item.type || item.follower_type || "member";
    if (type === "member") {
      navigation.push("MemberPublicProfile", { memberId: item.id });
    } else if (type === "community") {
      navigation.push("CommunityPublicProfile", { communityId: item.id });
    }
  }, [navigation]);

  // Render lists
  const renderFollowerItem = useCallback(({ item }) => {
    if (hiddenFollowerIds.has(String(item.id))) {
      return null;
    }
    const circleLoading = !!circleActionLoading[item.id] || !!memberCircleLoadingMap[item.id];

    // If a user is there in circles, then remove them from the followers list as we are giving more priority to circle
    if (circleStates[item.id] === "in_circle") {
      return null;
    }

    return (
      <PersonRow
        item={item}
        isOwnProfile={isOwnProfile}
        viewerType={viewerType}
        myId={myId}
        circleState={circleStates[item.id] || "none"}
        circleLoading={circleLoading}
        onAddToCircle={handleAddToCircle}
        onCancelCircleInvite={handleCancelCircleInvite}
        onRemoveFromCircle={handleRemoveFromCircle}
        onRemoveFollower={handleRemoveFollower}
        onPress={() => navigateTo(item)}
        followBackState={followBackStates[item.id]}
        followBackLoading={!!followBackLoadingMap[item.id]}
        onFollowBack={handleFollowBack}
        memberToMemberCircleState={memberCircleStates[item.id] || "none"}
        onMemberCircleRequest={handleMemberCircleRequest}
      />
    );
  }, [isOwnProfile, viewerType, myId, circleStates, circleActionLoading, handleAddToCircle, handleCancelCircleInvite, handleRemoveFromCircle, handleRemoveFollower, hiddenFollowerIds, navigateTo, followBackStates, followBackLoadingMap, handleFollowBack, memberCircleStates, memberCircleLoadingMap, handleMemberCircleRequest]);

  const renderCircleItem = useCallback(({ item }) => {
    const circleLoading = !!circleActionLoading[item.id] || !!memberCircleLoadingMap[item.id];
    return (
      <PersonRow
        item={item}
        isOwnProfile={isOwnProfile}
        viewerType={viewerType}
        myId={myId}
        circleState={isOwnProfile ? "in_circle" : (circleStates[item.id] || "none")}
        circleLoading={circleLoading}
        onRemoveFromCircle={handleRemoveFromCircle}
        onPress={() => navigateTo(item)}
        memberToMemberCircleState={memberCircleStates[item.id] || "none"}
        onMemberCircleRequest={handleMemberCircleRequest}
      />
    );
  }, [isOwnProfile, viewerType, myId, circleStates, circleActionLoading, memberCircleLoadingMap, handleRemoveFromCircle, navigateTo, memberCircleStates, handleMemberCircleRequest]);

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

  const followersExtraData = useMemo(
    () => ({
      myId,
      viewerType,
      circleStates,
      circleActionLoading,
      memberCircleStates,
      memberCircleLoadingMap,
      followBackStates,
      followBackLoadingMap,
      hiddenFollowerIds,
    }),
    [
      myId,
      viewerType,
      circleStates,
      circleActionLoading,
      memberCircleStates,
      memberCircleLoadingMap,
      followBackStates,
      followBackLoadingMap,
      hiddenFollowerIds,
    ]
  );

  const circleExtraData = useMemo(
    () => ({
      myId,
      viewerType,
      circleActionLoading,
      memberCircleStates,
      memberCircleLoadingMap,
    }),
    [myId, viewerType, circleActionLoading, memberCircleStates, memberCircleLoadingMap]
  );

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
        {/* Header */}
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

        {/* Tab Bar */}
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

        {/* Search Bar */}
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

        {/* Content Lists */}
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
              extraData={followersExtraData}
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
              keyExtractor={(item, i) => `c-${item.id ?? i}`}
              renderItem={renderCircleItem}
              extraData={circleExtraData}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
    letterSpacing: -0.3,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2962FF",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#8E8E93",
  },
  tabTextActive: {
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#1C1C1E",
    padding: 0,
  },
  loaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F2F7",
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
  },
  avatarInitials: {
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
  },
  rowUsername: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    marginTop: 2,
  },
  rowTime: {
    fontSize: 11,
    fontFamily: "Manrope-Regular",
    color: "#C7C7CC",
    marginTop: 2,
  },
  ctaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999, // CAPSULE shape as per guidelines
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDefault: {
    backgroundColor: "#2962FF",
    borderColor: "#2962FF",
  },
  ctaBtnInCircle: {
    backgroundColor: "rgba(41,98,255,0.08)",
    borderColor: "rgba(41,98,255,0.2)",
  },
  ctaBtnRequested: {
    backgroundColor: "rgba(255,149,0,0.08)",
    borderColor: "rgba(255,149,0,0.2)",
  },
  ctaTextDefault: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  ctaTextInCircle: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  ctaTextRequested: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#FF9500",
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#8E8E93",
  },
  loadMoreWrap: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
