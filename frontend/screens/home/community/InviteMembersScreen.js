/**
 * InviteMembersScreen
 *
 * Allows communities to discover and invite members into their Circle.
 *
 * Features:
 *  - Filter tabs: Members (Global), Creators (Global), Followers (Own)
 *  - Live debounced search per tab
 *  - Creator badge on creator-mode members
 *  - Inline invite chips: Invite → Invited → In Circle
 *  - Bulk selection mode with a floating "Invite Selected" action bar
 *  - Cancel pending invite by tapping "Invited"
 *
 * Route: InviteMembers  (in CommunityDashboardStackNavigator)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  Search,
  X,
  UserPlus,
  Clock,
  CircleCheck,
  Sparkles,
  Users,
  CheckSquare,
  Square,
  Send,
} from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../../constants/theme';
import {
  sendCommunityCircleInvite,
  cancelCommunityCircleInvite,
} from '../../../api/members';
import { getCommunityFollowers } from '../../../api/communities';
import { getAuthToken, getActiveAccount } from '../../../api/auth';
import { apiGet } from '../../../api/client';
import HapticsService from '../../../services/HapticsService';
import CustomAlertModal from '../../../components/ui/CustomAlertModal';

// ─── Constants ───────────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'members',   label: 'Members'   },
  { key: 'creators',  label: 'Creators'  },
  { key: 'followers', label: 'Followers' },
];

const DEBOUNCE_MS = 350;

async function searchPeople(query, type, offset = 0, limit = 20) {
  const token = await getAuthToken();
  const params = new URLSearchParams();
  params.set('q', query || ' ');
  const backendType = type === 'creators' ? 'creators' : 'people';
  params.set('type', backendType);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiGet(`/search?${params.toString()}`, 15000, token);
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

const MemberRow = React.memo(({
  item,
  circleState,   // 'none' | 'pending_outgoing' | 'in_circle'
  circleLoading,
  onInvite,
  onCancelInvite,
  isSelected,
  onSelect,
  bulkMode,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isInCircle   = circleState === 'in_circle';
  const isPending    = circleState === 'pending_outgoing';
  const isCreator    = !!(item.is_creator_mode_enabled || item.is_creator || item.isCreator);

  const avatarUri = item.profile_photo_url || item.logo_url || item.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.full_name || 'M')}&background=448AFF&color=fff&size=80`;

  const handleChipPress = () => {
    if (isInCircle) return;
    if (isPending) {
      onCancelInvite(item);
    } else {
      onInvite(item.id);
    }
  };

  return (
    <Reanimated.View entering={FadeInDown.duration(240)} style={animStyle}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => bulkMode ? onSelect(item) : onPress(item)}
        onLongPress={() => { HapticsService.triggerImpactLight(); onSelect(item); }}
      >
        {/* Selection checkbox */}
        {bulkMode && (
          <Reanimated.View entering={FadeIn.duration(200)} style={styles.checkBox}>
            {isSelected
              ? <CheckSquare size={20} color={COLORS.primary} strokeWidth={2} />
              : <Square size={20} color={COLORS.textSecondary} strokeWidth={2} />
            }
          </Reanimated.View>
        )}

        {/* Avatar */}
        <View>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          {isCreator && (
            <View style={styles.creatorBadge}>
              <Sparkles size={9} color="#fff" strokeWidth={2.5} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.name || item.full_name || 'Member'}
            </Text>
          </View>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>

        {/* Chip — hidden in bulk mode */}
        {!bulkMode && (
          <TouchableOpacity
            style={[
              styles.chip,
              isInCircle  ? styles.chipInCircle :
              isPending   ? styles.chipPending  :
              styles.chipDefault,
            ]}
            onPress={handleChipPress}
            disabled={circleLoading || isInCircle}
            hitSlop={8}
            activeOpacity={0.75}
          >
            {circleLoading ? (
              <ActivityIndicator
                size="small"
                color={isInCircle ? COLORS.primary : isPending ? '#FF9500' : '#fff'}
                style={{ width: 56 }}
              />
            ) : isInCircle ? (
              <View style={styles.chipInner}>
                <CircleCheck size={12} color={COLORS.primary} strokeWidth={2.5} />
                <Text style={[styles.chipText, { color: COLORS.primary }]}>In Circle</Text>
              </View>
            ) : isPending ? (
              <View style={styles.chipInner}>
                <Clock size={12} color="#FF9500" strokeWidth={2.5} />
                <Text style={[styles.chipText, { color: '#FF9500' }]}>Invited</Text>
              </View>
            ) : (
              <View style={styles.chipInner}>
                <UserPlus size={12} color="#fff" strokeWidth={2.5} />
                <Text style={[styles.chipText, { color: '#fff' }]}>Invite</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Reanimated.View>
  );
});

// ─── FilterTab ────────────────────────────────────────────────────────────────
const FilterTab = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.filterTab, active && styles.filterTabActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ search, filter }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Users size={34} color={COLORS.textSecondary} strokeWidth={1.5} />
    </View>
    <Text style={styles.emptyTitle}>
      {search ? 'No results found' : filter === 'followers' ? 'No followers yet' : 'Start searching'}
    </Text>
    <Text style={styles.emptySubtitle}>
      {search
        ? 'Try a different name or username.'
        : filter === 'followers'
          ? 'Your followers will appear here as they follow you.'
          : 'Type a name or username above to discover members.'}
    </Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InviteMembersScreen({ navigation }) {
  const [communityId, setCommunityId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('members');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Per-item circle state: { [memberId]: 'none' | 'pending_outgoing' | 'in_circle' }
  const [circleStates, setCircleStates]   = useState({});
  const [circleLoading, setCircleLoading] = useState({});
  // invite_id map (for cancel)
  const inviteIdMap = useRef({});

  // Bulk mode
  const [bulkMode, setBulkMode]       = useState(false);
  const [selected, setSelected]       = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Alert
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const showAlert = useCallback((cfg) => setAlertConfig({ ...cfg, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const searchTimer = useRef(null);
  const LIMIT = 20;

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchResults = useCallback(async (q, filter, off = 0, append = false, commId = null) => {
    try {
      if (off === 0) setLoading(true); else setLoadingMore(true);

      let rows = [];
      let more = false;

      if (filter === 'followers') {
        // Use community followers endpoint — pass our own community ID
        const res = await getCommunityFollowers(commId || communityId, {
          limit: LIMIT,
          page: Math.floor(off / LIMIT) + 1,
          search: q,
        });
        const raw = res?.followers || res?.results || [];
        rows = raw.map((r) => ({
          id: r.follower_id || r.id,
          name: r.follower_name || r.name,
          username: r.follower_username || r.username,
          profile_photo_url: r.follower_photo_url || r.profile_photo_url || r.avatar_url,
          is_creator_mode_enabled: !!(r.is_creator || r.is_creator_mode_enabled),
          in_circle: false,
          circle_requested: false,
          circle_request_id: null,
        }));
        more = rows.length >= LIMIT;
      } else {
        // Use unified search (people or creators)
        const res = await searchPeople(q, filter, off, LIMIT);
        rows = (res?.results || []).map((r) => ({
          id: r.id,
          name: r.name || r.full_name,
          username: r.username,
          profile_photo_url: r.profile_photo_url || r.logo_url,
          is_creator_mode_enabled: !!(r.is_creator_mode_enabled),
          in_circle: !!(r.in_circle),
          circle_requested: !!(r.circle_requested),
          circle_request_id: r.circle_request_id || null,
        }));
        more = res?.hasMore || false;
      }

      // Seed circle states from response
      const seeded = {};
      const seededInviteIds = {};
      rows.forEach((r) => {
        if (r.in_circle) {
          seeded[r.id] = 'in_circle';
        } else if (r.circle_requested) {
          seeded[r.id] = 'pending_outgoing';
          if (r.circle_request_id) seededInviteIds[r.id] = r.circle_request_id;
        }
      });

      setCircleStates((prev) => ({ ...prev, ...seeded }));
      inviteIdMap.current = { ...inviteIdMap.current, ...seededInviteIds };

      if (append) {
        setResults((prev) => [...prev, ...rows]);
      } else {
        setResults(rows);
      }
      setOffset(off + rows.length);
      setHasMore(more);
    } catch (e) {
      console.error('[InviteMembers] fetchResults error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [communityId]);

  // Resolve community ID once on mount
  useEffect(() => {
    (async () => {
      try {
        const acc = await getActiveAccount();
        if (acc?.id) setCommunityId(acc.id);
      } catch (_) {}
    })();
  }, []);

  // Initial load for followers tab (waits for communityId to be resolved)
  useEffect(() => {
    if (activeFilter === 'followers' && communityId) {
      fetchResults('', 'followers', 0, false, communityId);
    } else if (activeFilter !== 'followers') {
      setResults([]);
      setHasMore(false);
    }
    setBulkMode(false);
    setSelected(new Set());
  }, [activeFilter, communityId]);

  // Debounced search
  const handleSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchResults(text, activeFilter, 0, false, communityId);
    }, DEBOUNCE_MS);
  };

  const handleFilterChange = (filter) => {
    HapticsService.triggerImpactLight();
    setSearch('');
    clearTimeout(searchTimer.current);
    setResults([]);
    setOffset(0);
    setHasMore(false);
    setActiveFilter(filter);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchResults(search, activeFilter, offset, true, communityId);
  };

  // ── Invite Actions ──────────────────────────────────────────────────────────
  const handleInvite = useCallback(async (memberId) => {
    HapticsService.triggerImpactMedium();
    setCircleLoading((p) => ({ ...p, [memberId]: true }));
    setCircleStates((p) => ({ ...p, [memberId]: 'pending_outgoing' }));
    try {
      const res = await sendCommunityCircleInvite(memberId);
      if (res?.invite_id) inviteIdMap.current[memberId] = res.invite_id;
      if (res?.status === 'in_circle' || res?.auto_accepted) {
        setCircleStates((p) => ({ ...p, [memberId]: 'in_circle' }));
      }
    } catch (e) {
      console.warn('[InviteMembers] sendCommunityCircleInvite error:', e);
      setCircleStates((p) => ({ ...p, [memberId]: 'none' }));
    } finally {
      setCircleLoading((p) => ({ ...p, [memberId]: false }));
    }
  }, []);

  const handleCancelInvite = useCallback((item) => {
    const memberId = item.id;
    const inviteId = inviteIdMap.current[memberId];
    HapticsService.triggerImpactLight();
    showAlert({
      title: 'Withdraw Invite?',
      message: `Cancel the circle invite sent to ${item.name || 'this member'}?`,
      icon: Clock,
      iconColor: '#FF9500',
      secondaryAction: { text: 'Keep', onPress: hideAlert },
      primaryAction: {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          if (!inviteId) {
            setCircleStates((p) => ({ ...p, [memberId]: 'none' }));
            return;
          }
          setCircleLoading((p) => ({ ...p, [memberId]: true }));
          setCircleStates((p) => ({ ...p, [memberId]: 'none' }));
          try {
            await cancelCommunityCircleInvite(inviteId);
            delete inviteIdMap.current[memberId];
          } catch (e) {
            console.warn('[InviteMembers] cancelCommunityCircleInvite error:', e);
            setCircleStates((p) => ({ ...p, [memberId]: 'pending_outgoing' }));
          } finally {
            setCircleLoading((p) => ({ ...p, [memberId]: false }));
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  // ── Bulk Mode ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback((item) => {
    if (circleStates[item.id] === 'in_circle' || circleStates[item.id] === 'pending_outgoing') return;
    HapticsService.triggerImpactLight();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (!bulkMode) setBulkMode(true);
  }, [bulkMode, circleStates]);

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelected(new Set());
  };

  const handleBulkInvite = useCallback(async () => {
    const ids = [...selected].filter(
      (id) => circleStates[id] !== 'in_circle' && circleStates[id] !== 'pending_outgoing'
    );
    if (ids.length === 0) return;
    HapticsService.triggerImpactMedium();
    setBulkLoading(true);

    // Optimistic
    const updates = {};
    ids.forEach((id) => { updates[id] = 'pending_outgoing'; });
    setCircleStates((p) => ({ ...p, ...updates }));
    exitBulkMode();

    // Fire all in parallel
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await sendCommunityCircleInvite(id);
        if (res?.invite_id) inviteIdMap.current[id] = res.invite_id;
        if (res?.status === 'in_circle' || res?.auto_accepted) {
          setCircleStates((p) => ({ ...p, [id]: 'in_circle' }));
        }
        return { id, success: true };
      })
    );

    // Revert any that failed
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        setCircleStates((p) => ({ ...p, [ids[idx]]: 'none' }));
      }
    });
    setBulkLoading(false);
  }, [selected, circleStates]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleMemberPress = (item) => {
    navigation.push('MemberPublicProfile', { memberId: item.id });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <MemberRow
      item={item}
      circleState={circleStates[item.id] || 'none'}
      circleLoading={!!circleLoading[item.id]}
      onInvite={handleInvite}
      onCancelInvite={handleCancelInvite}
      isSelected={selected.has(item.id)}
      onSelect={handleSelect}
      bulkMode={bulkMode}
      onPress={handleMemberPress}
    />
  ), [circleStates, circleLoading, handleInvite, handleCancelInvite, selected, handleSelect, bulkMode]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const showResults = results.length > 0;
  const showEmpty = !loading && (activeFilter === 'followers' || search.length >= 2);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (bulkMode) { exitBulkMode(); }
              else { navigation.goBack(); }
            }}
            style={styles.backBtn}
            hitSlop={8}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {bulkMode ? `${selected.size} Selected` : 'Invite Members'}
          </Text>

          {bulkMode ? (
            <TouchableOpacity style={styles.cancelBulkBtn} onPress={exitBulkMode} hitSlop={8}>
              <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <FilterTab
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onPress={() => handleFilterChange(f.key)}
            />
          ))}
        </View>

        {/* ── Search Bar ──────────────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeFilter === 'followers'
                  ? 'Search followers…'
                  : activeFilter === 'creators'
                    ? 'Search creators by name…'
                    : 'Search members by name or username…'
              }
              placeholderTextColor={COLORS.textSecondary}
              value={search}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={8}>
                <X size={15} color={COLORS.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Section Header ──────────────────────────────────────────────── */}
        {showResults && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>
              {activeFilter === 'followers' ? 'Your Followers' :
               activeFilter === 'creators'  ? 'Creators'       : 'Members'}
            </Text>
            {!bulkMode && results.some(r => circleStates[r.id] !== 'in_circle' && circleStates[r.id] !== 'pending_outgoing') && (
              <TouchableOpacity
                onPress={() => setBulkMode(true)}
                hitSlop={8}
                style={styles.bulkToggleBtn}
              >
                <CheckSquare size={15} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.bulkToggleText}>Select</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── List ────────────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={showEmpty ? (
              <EmptyState search={search} filter={activeFilter} />
            ) : null}
            ListFooterComponent={loadingMore ? (
              <ActivityIndicator style={{ margin: 16 }} color={COLORS.primary} />
            ) : null}
            contentContainerStyle={{ paddingBottom: bulkMode ? 100 : 40, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}

        {/* ── Bulk Action Bar ─────────────────────────────────────────────── */}
        {bulkMode && (
          <Reanimated.View
            entering={SlideInDown.springify().damping(20)}
            exiting={SlideOutDown.duration(200)}
            style={styles.bulkBar}
          >
            <View style={styles.bulkBarInner}>
              <Text style={styles.bulkBarLabel}>
                {selected.size === 0
                  ? 'Tap members to select'
                  : `${selected.size} member${selected.size > 1 ? 's' : ''} selected`}
              </Text>
              <TouchableOpacity
                style={[
                  styles.bulkInviteBtn,
                  (selected.size === 0 || bulkLoading) && styles.bulkInviteBtnDisabled,
                ]}
                onPress={handleBulkInvite}
                disabled={selected.size === 0 || bulkLoading}
                activeOpacity={0.8}
              >
                {bulkLoading ? (
                  <ActivityIndicator size="small" color="#fff" style={{ width: 80 }} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Send size={15} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.bulkInviteBtnText}>Invite Selected</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        )}

        <CustomAlertModal onClose={hideAlert} {...alertConfig} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  cancelBulkBtn: {
    width: 40,
    alignItems: 'flex-end',
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: '#F2F2F7',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // Search
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bulkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkToggleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  checkBox: {
    marginRight: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  creatorBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  rowInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  rowUsername: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // Chips
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  chipDefault: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipPending: {
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderColor: 'rgba(255,149,0,0.25)',
  },
  chipInCircle: {
    backgroundColor: 'rgba(41,98,255,0.08)',
    borderColor: 'rgba(41,98,255,0.2)',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },

  // Empty
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(68,138,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.bold ?? FONTS.semiBold,
    fontSize: 17,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Bulk Bar
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  bulkBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bulkBarLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  bulkInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
  },
  bulkInviteBtnDisabled: {
    opacity: 0.45,
  },
  bulkInviteBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#fff',
  },
});
