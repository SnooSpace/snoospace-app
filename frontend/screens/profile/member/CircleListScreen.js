import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Image, ActivityIndicator,
} from 'react-native';
import { Pressable as GHPressable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Users, Bell, X, UserMinus, TriangleAlert, CircleCheck } from 'lucide-react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import { COLORS, FONTS, BORDER_RADIUS, SPACING } from '../../../constants/theme';
import { 
  getCircleMembers, 
  removeFromCircle, 
  getIncomingCircleRequestCount, 
  getPublicCircleMembers,
  getFollowStatusForMember,
  getCircleStatus,
  sendCircleRequest,
  followMember,
  unfollowMember
} from '../../../api/members';
import CustomAlertModal from '../../../components/ui/CustomAlertModal';
import HapticsService from '../../../services/HapticsService';
import EventBus from '../../../utils/EventBus';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────
// Single circle member row
// ─────────────────────────────────────────────────────────
const CircleMemberRow = React.memo(({ 
  item, 
  onPress, 
  onRemove, 
  readOnly,
  viewerType,
  myId,
  followState,
  followLoading,
  onFollow,
  circleState,
  circleLoading,
  onCircleRequest,
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isCreator = !!(item.isCreator || item.is_creator || item.is_creator_mode_enabled);
  const isSelf = myId && String(myId) === String(item.member_id || item.id);

  return (
    <Reanimated.View entering={FadeInDown.duration(280)} style={animStyle}>
      <GHPressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={() => onPress(item)}
        style={styles.row}
      >
        <Image
          source={{ uri: item.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'M')}&background=448AFF&color=fff&size=80` }}
          style={styles.avatar}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || 'Member'}</Text>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>

        {/* Own circle list: show remove button */}
        {!readOnly && (
          <GHPressable
            style={styles.removeBtn}
            onPress={() => onRemove(item)}
            hitSlop={8}
          >
            <UserMinus size={18} color={COLORS.textSecondary} strokeWidth={2} />
          </GHPressable>
        )}

        {/* Public circle list: show relationship chips */}
        {readOnly && !isSelf && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Creator Row: Follow / Following */}
            {isCreator && (viewerType === "member" || viewerType === "community") && (
              <GHPressable
                style={[
                  styles.ctaBtn,
                  followState === true
                    ? { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                    : { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                ]}
                onPress={() => onFollow && onFollow(item)}
                disabled={followLoading || followState === null}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={followState === true ? "#2962FF" : "#fff"} style={{ width: 60 }} />
                ) : (
                  <Text style={[
                    styles.ctaTextDefault,
                    followState === true ? { color: "#2962FF" } : { color: "#fff" },
                  ]}>
                    {followState === true ? 'Following' : 'Follow'}
                  </Text>
                )}
              </GHPressable>
            )}

            {/* Regular Member Row: Add / Requested / In Circle */}
            {!isCreator && viewerType === "member" && (
              <GHPressable
                style={[
                  styles.ctaBtn,
                  circleState === "in_circle"
                    ? { backgroundColor: 'rgba(41,98,255,0.1)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                    : circleState === "pending_outgoing"
                    ? { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.2)', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                    : { backgroundColor: '#2962FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }
                ]}
                onPress={() => {
                  if (circleState === "none" || !circleState) {
                    onCircleRequest && onCircleRequest(item.member_id || item.id);
                  }
                }}
                disabled={circleLoading || (circleState !== "none" && !!circleState)}
              >
                {circleLoading ? (
                  <ActivityIndicator size="small" color={circleState === "in_circle" ? "#2962FF" : circleState === "pending_outgoing" ? "#FF9500" : "#fff"} style={{ width: 60 }} />
                ) : circleState === "in_circle" ? (
                  <Text style={[styles.ctaTextDefault, { color: '#2962FF' }]}>In Circle</Text>
                ) : circleState === "pending_outgoing" ? (
                  <Text style={[styles.ctaTextDefault, { color: '#FF9500' }]}>Requested</Text>
                ) : (
                  <Text style={[styles.ctaTextDefault, { color: '#fff' }]}>Add</Text>
                )}
              </GHPressable>
            )}
          </View>
        )}
      </GHPressable>
    </Reanimated.View>
  );
});

// ─────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────
export default function CircleListScreen({ route, navigation }) {
  const readOnly = route?.params?.readOnly === true;
  const targetMemberId = route?.params?.memberId;  // only used in readOnly mode
  const memberName = route?.params?.memberName || null;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const [isViewerCreator, setIsViewerCreator] = useState(false);
  const searchTimer = useRef(null);

  const [viewerType, setViewerType] = useState(null);
  const [myId, setMyId] = useState(null);

  // Public view relationship states
  const [memberCircleStates, setMemberCircleStates] = useState({});
  const [memberCircleLoadingMap, setMemberCircleLoadingMap] = useState({});
  const [followStates, setFollowStates] = useState({});
  const [followLoadingMap, setFollowLoadingMap] = useState({});

  useEffect(() => {
    async function checkViewerMode() {
      try {
        const val = await AsyncStorage.getItem("creator_mode_enabled");
        if (val === "true") {
          setIsViewerCreator(true);
        }
      } catch (e) {
        console.warn("[CircleList] Error reading creator_mode_enabled:", e);
      }
    }
    checkViewerMode();
  }, []);

  const showAlert = useCallback((config) => setAlertConfig({ ...config, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const fetchMembers = useCallback(async (pageNum = 1, searchQuery = '', reset = false, vt = viewerType, mid = myId) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      let fetched;
      if (readOnly && targetMemberId) {
        const data = await getPublicCircleMembers(targetMemberId, { page: pageNum, limit: 20, search: searchQuery });
        fetched = data?.members || [];
      } else {
        const data = await getCircleMembers({ page: pageNum, limit: 20, search: searchQuery });
        fetched = data?.members || [];
      }

      const normalizedRows = fetched.map((r) => ({
        member_id: r.member_id || r.id,
        id: r.member_id || r.id,
        name: r.name,
        username: r.username,
        profile_photo_url: r.profile_photo_url || r.avatar_url,
        isCreator: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
        is_creator: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
        is_creator_mode_enabled: !!r.is_creator_mode_enabled || !!r.is_creator || !!r.isCreator,
      }));

      setMembers((prev) => reset || pageNum === 1 ? normalizedRows : [...prev, ...normalizedRows]);
      setHasMore(normalizedRows.length >= 20);
      setPage(pageNum);

      // Fetch relationship statuses in readOnly mode
      if (readOnly) {
        const preSeededFollow = {};
        const preSeededMemberCircle = {};

        await Promise.all(
          normalizedRows.map(async (row) => {
            const isCreator = row.isCreator || row.is_creator || row.is_creator_mode_enabled;
            if (isCreator) {
              const status = await getFollowStatusForMember(row.id).catch(() => null);
              preSeededFollow[row.id] = !!status?.isFollowing;
            } else if (vt === "member" && String(row.id) !== String(mid)) {
              const status = await getCircleStatus(row.id).catch(() => null);
              if (status?.status) {
                preSeededMemberCircle[row.id] = status.status;
              }
            }
          })
        );

        if (Object.keys(preSeededFollow).length > 0) {
          setFollowStates((prev) => ({ ...prev, ...preSeededFollow }));
        }
        if (vt === "member" && Object.keys(preSeededMemberCircle).length > 0) {
          setMemberCircleStates((prev) => ({ ...prev, ...preSeededMemberCircle }));
        }
      }
    } catch (err) {
      console.error('[CircleListScreen] fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [readOnly, targetMemberId, viewerType, myId]);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await getIncomingCircleRequestCount();
      setPendingCount(res?.count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    (async () => {
      let resolvedViewerType = null;
      let resolvedMyId = null;
      try {
        const { getActiveAccount } = await import('../../../api/auth');
        const acc = await getActiveAccount();
        if (acc) {
          resolvedViewerType = acc.type?.toLowerCase();
          resolvedMyId = acc.id;
          setViewerType(resolvedViewerType);
          setMyId(resolvedMyId);
        }
      } catch (_) {}
      
      await fetchMembers(1, '', true, resolvedViewerType, resolvedMyId);
    })();
    fetchPendingCount();
  }, [fetchMembers, fetchPendingCount]);

  // Refresh circle list when screen comes back into focus (e.g. returning from CircleRequests)
  useFocusEffect(
    useCallback(() => {
      fetchPendingCount();
    }, [fetchPendingCount]),
  );

  // Listen for instant accept/remove events
  useEffect(() => {
    const unsub = EventBus.on('circle-request-responded', ({ action, memberId, memberName, memberUsername, memberAvatar }) => {
      if (action !== 'accepted') return;
      // Prepend the newly accepted member to the list immediately
      const newMember = {
        member_id: String(memberId),
        name: memberName || 'Member',
        username: memberUsername || null,
        profile_photo_url: memberAvatar || null,
      };
      setMembers((prev) => {
        // Avoid duplicates if screen also refreshed via focus
        if (prev.some((m) => String(m.member_id) === String(memberId))) return prev;
        return [newMember, ...prev];
      });
      // Decrement pending badge
      setPendingCount((c) => Math.max(0, c - 1));
    });
    const unsubRemove = EventBus.on('my:circle-member-removed', ({ memberId }) => {
      if (!memberId) return;
      setMembers((prev) => prev.filter((m) => String(m.member_id || m.id) !== String(memberId)));
    });
    return () => {
      if (unsub) unsub();
      if (unsubRemove) unsubRemove();
    };
  }, []);

  const handleSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchMembers(1, text, true, viewerType, myId);
    }, 350);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchMembers(page + 1, search, false, viewerType, myId);
  };

  const handlePress = (item) => {
    navigation.push('MemberPublicProfile', { memberId: item.member_id });
  };

  // Follow/Unfollow toggle for creators in public views
  const handleFollowToggle = useCallback(async (item) => {
    const memberId = item.id || item.member_id;
    const isFollowing = followStates[memberId];
    HapticsService.triggerImpactMedium();
    setFollowLoadingMap((prev) => ({ ...prev, [memberId]: true }));
    setFollowStates((prev) => ({ ...prev, [memberId]: !isFollowing }));
    try {
      if (isFollowing) {
        await unfollowMember(memberId);
      } else {
        await followMember(memberId);
      }
    } catch (e) {
      console.warn('[CircleList] handleFollowToggle error:', e);
      setFollowStates((prev) => ({ ...prev, [memberId]: isFollowing }));
    } finally {
      setFollowLoadingMap((prev) => ({ ...prev, [memberId]: false }));
    }
  }, [followStates]);

  // Circle request for regular members in public views
  const handleMemberCircleRequest = useCallback(async (targetId) => {
    HapticsService.triggerImpactMedium();
    setMemberCircleLoadingMap((prev) => ({ ...prev, [targetId]: true }));
    setMemberCircleStates((prev) => ({ ...prev, [targetId]: "pending_outgoing" }));
    try {
      const res = await sendCircleRequest(targetId);
      const isAuto = !!(res?.auto_accepted || res?.status === "in_circle");
      setMemberCircleStates((prev) => ({ ...prev, [targetId]: isAuto ? "in_circle" : "pending_outgoing" }));
    } catch (e) {
      console.warn('[CircleList] sendCircleRequest failed:', e);
      setMemberCircleStates((prev) => ({ ...prev, [targetId]: "none" }));
    } finally {
      setMemberCircleLoadingMap((prev) => ({ ...prev, [targetId]: false }));
    }
  }, []);

  const handleRemove = useCallback((item) => {
    HapticsService.triggerImpactLight();
    const isTargetCreator = !!item.is_creator_mode_enabled;
    const showTertiary = isTargetCreator || isViewerCreator;
    const tertiaryText = isTargetCreator ? 'Remove from Circle & Unfollow' : 'Remove from Circle & as Follower';

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
          try {
            await removeFromCircle(item.member_id, false); // follow restored
            setMembers((prev) => prev.filter((m) => m.member_id !== item.member_id));
            EventBus.emit('my:circle-member-removed', { alsoUnfollow: false });
            HapticsService.triggerImpactLight();
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to remove. Please try again.',
              icon: TriangleAlert,
              iconColor: '#E53935',
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          }
        },
      },
      tertiaryAction: showTertiary ? {
        text: tertiaryText,
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          try {
            await removeFromCircle(item.member_id, true); // also delete follow
            setMembers((prev) => prev.filter((m) => m.member_id !== item.member_id));
            EventBus.emit('my:circle-member-removed', { alsoUnfollow: true });
            HapticsService.triggerImpactLight();
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to remove. Please try again.',
              icon: TriangleAlert,
              iconColor: '#E53935',
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          }
        },
      } : undefined,
    });
  }, [showAlert, hideAlert, isViewerCreator]);

  const renderItem = useCallback(({ item }) => {
    const circleLoading = !!memberCircleLoadingMap[item.member_id || item.id];
    return (
      <CircleMemberRow 
        item={item} 
        onPress={handlePress} 
        onRemove={handleRemove} 
        readOnly={readOnly}
        viewerType={viewerType}
        myId={myId}
        followState={followStates[item.member_id || item.id]}
        followLoading={!!followLoadingMap[item.member_id || item.id]}
        onFollow={handleFollowToggle}
        circleState={memberCircleStates[item.member_id || item.id] || "none"}
        circleLoading={circleLoading}
        onCircleRequest={handleMemberCircleRequest}
      />
    );
  }, [handlePress, handleRemove, readOnly, viewerType, myId, followStates, followLoadingMap, handleFollowToggle, memberCircleStates, handleMemberCircleRequest, memberCircleLoadingMap]);

  const keyExtractor = useCallback((item) => item.member_id || item.id, []);

  const ListEmptyComponent = !loading ? (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Users size={36} color={COLORS.textSecondary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>
        {search ? 'No results found' : (readOnly ? 'No connections yet' : 'Your circle is empty')}
      </Text>
      <Text style={styles.emptySubtitle}>
        {search
          ? 'Try a different name or username.'
          : readOnly
            ? `${memberName || 'This member'} hasn\u2019t connected with anyone yet.`
            : "When you connect with people, they\u2019ll appear here."}
      </Text>
    </View>
  ) : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <GHPressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </GHPressable>
          <Text style={styles.headerTitle}>
            {readOnly && memberName ? `${memberName}'s Circle` : 'My Circle'}
          </Text>
          {!readOnly ? (
            <GHPressable
              style={styles.requestsBtn}
              onPress={() => navigation.navigate('CircleRequests')}
              hitSlop={8}
            >
              <Bell size={22} color={COLORS.textPrimary} strokeWidth={2} />
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                </View>
              )}
            </GHPressable>
          ) : (
            <View style={styles.requestsBtn} />
          )}
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={readOnly ? "Search circle…" : "Search your circle…"}
              placeholderTextColor={COLORS.textSecondary}
              value={search}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <GHPressable onPress={() => handleSearchChange('')} hitSlop={8}>
                <X size={16} color={COLORS.textSecondary} strokeWidth={2} />
              </GHPressable>
            )}
          </View>
        </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={COLORS.primary} /> : null}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <CustomAlertModal onClose={hideAlert} {...alertConfig} />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 16,
    color: '#1D1D1F',
  },
  requestsBtn: { width: 40, alignItems: 'flex-end', position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -4,
    backgroundColor: '#E53935', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: FONTS.semiBold, fontSize: 10, color: '#fff' },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: {
    flex: 1, fontFamily: FONTS.regular, fontSize: 15,
    color: COLORS.textPrimary, padding: 0,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB', marginRight: 12 },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  rowUsername: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTextDefault: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(68,138,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
