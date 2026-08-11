/**
 * CollabRequestsScreen.js
 *
 * Received and Sent tabs for the Collab Requests feature.
 * Matches the tab + FlatList + pull-to-refresh pattern from CircleRequestsScreen.
 *
 * Navigation:
 *   - From any profile screen: navigation.navigate('CollabRequests')
 *   - On accept success: offers to navigate to 'Chat' screen with the created thread
 *   - Counterpart avatar press: navigates to MemberPublicProfile or CommunityPublicProfile
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Pressable as GHPressable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Handshake, TriangleAlert } from 'lucide-react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '../../constants/theme';
import {
  getReceivedCollabRequests,
  getSentCollabRequests,
  acceptCollabRequest,
  declineCollabRequest,
  withdrawCollabRequest,
} from '../../api/collabRequests';
import CollabRequestCard, { CollabRequestCardSkeleton } from '../../components/cards/CollabRequestCard';
import HapticsService from '../../services/HapticsService';
import CustomAlertModal from '../../components/ui/CustomAlertModal';

// ─── Status filter chips ──────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: undefined,    label: 'Pending' },
  { value: 'accepted',   label: 'Accepted' },
  { value: 'declined',   label: 'Declined' },
  { value: 'withdrawn',  label: 'Withdrawn' },
  { value: 'expired',    label: 'Expired' },
];

// pending is default, but we send status=pending explicitly only when we want non-pending
// (API default returns all; we filter client-side for cleaner chips)
// Actually we pass the status param directly; pending is the label for "no status filter"
// but backend filters by exact status, so 'pending' tab sends status=pending.
const STATUS_FILTER_VALUES = {
  'Pending':   'pending',
  'Accepted':  'accepted',
  'Declined':  'declined',
  'Withdrawn': 'withdrawn',
  'Expired':   'expired',
};

function FilterChips({ selected, onChange }) {
  return (
    <View
      style={styles.filterWrapper}
      onTouchStart={() => EventBus.emit('disable-tab-swipe')}
      onTouchEnd={() => EventBus.emit('enable-tab-swipe')}
      onTouchCancel={() => EventBus.emit('enable-tab-swipe')}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        onScrollBeginDrag={() => EventBus.emit('disable-tab-swipe')}
        onScrollEndDrag={() => EventBus.emit('enable-tab-swipe')}
        onMomentumScrollEnd={() => EventBus.emit('enable-tab-swipe')}
      >
        {STATUS_FILTERS.map(({ value, label }) => {
          const isActive = selected === (value ?? 'pending');
          return (
            <GHPressable
              key={label}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onChange(value ?? 'pending')}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {label}
              </Text>
            </GHPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab, status }) {
  const isReceived = tab === 'received';
  const isPending  = status === 'pending';
  const title = isReceived
    ? (isPending ? 'No requests yet' : `No ${status} requests`)
    : (isPending ? "You haven't sent any requests" : `No ${status} requests`);
  const subtitle = isReceived && isPending
    ? 'When someone sends you a collab pitch, it will appear here'
    : !isReceived && isPending
    ? 'Send a collab pitch to a Community or Creator to get started'
    : null;
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Handshake size={30} color={COLORS.textSecondary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;

export default function CollabRequestsScreen({ navigation }) {
  const [activeTab, setActiveTab]     = useState('received');
  const [statusFilter, setStatusFilter] = useState('pending');

  // Per-tab state
  const [receivedItems, setReceivedItems] = useState([]);
  const [sentItems, setSentItems]         = useState([]);
  const [receivedPage, setReceivedPage]   = useState(1);
  const [sentPage, setSentPage]           = useState(1);
  const [receivedTotal, setReceivedTotal] = useState(0);
  const [sentTotal, setSentTotal]         = useState(0);
  const [receivedLoading, setReceivedLoading] = useState(true);
  const [sentLoading, setSentLoading]         = useState(true);
  const [receivedLoadingMore, setReceivedLoadingMore] = useState(false);
  const [sentLoadingMore, setSentLoadingMore]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [actionLoading, setActionLoading] = useState({});
  const [alertConfig, setAlertConfig]     = useState({ visible: false });

  // ── Animated tab indicator (mirror of CircleRequestsScreen) ──────────────
  const tabUnderlineX     = useSharedValue(0);
  const tabUnderlineScale = useSharedValue(0);
  const tabWidths         = useRef({}).current;
  const tabOffsets        = useRef({}).current;

  const animatedUnderlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabUnderlineX.value }],
    width: tabUnderlineScale.value,
  }));

  useEffect(() => {
    if (tabOffsets[activeTab] !== undefined) {
      tabUnderlineX.value     = withTiming(tabOffsets[activeTab], { duration: 200 });
      tabUnderlineScale.value = withTiming(tabWidths[activeTab],  { duration: 200 });
    }
  }, [activeTab]);

  const handleTabLayout = (tab, e) => {
    const { x, width } = e.nativeEvent.layout;
    if (width <= 0 || !Number.isFinite(x) || !Number.isFinite(width)) return;
    if (tabOffsets[tab] === x && tabWidths[tab] === width) return;
    tabOffsets[tab] = x;
    tabWidths[tab]  = width;
    if (tab === activeTab) {
      tabUnderlineX.value     = x;
      tabUnderlineScale.value = width;
    }
  };

  // ── Alert helpers ─────────────────────────────────────────────────────────
  const showAlert = useCallback((cfg) => setAlertConfig({ ...cfg, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  // ── Load helpers ──────────────────────────────────────────────────────────

  const loadReceived = useCallback(async ({ page = 1, status = statusFilter, append = false } = {}) => {
    if (page === 1) setReceivedLoading(true);
    else setReceivedLoadingMore(true);
    try {
      const data = await getReceivedCollabRequests({ status, page, limit: PAGE_LIMIT });
      const rows = data?.requests || [];
      setReceivedItems((prev) => append ? [...prev, ...rows] : rows);
      setReceivedPage(page);
      setReceivedTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.warn('[CollabRequestsScreen] loadReceived error:', err?.message);
    } finally {
      setReceivedLoading(false);
      setReceivedLoadingMore(false);
    }
  }, [statusFilter]);

  const loadSent = useCallback(async ({ page = 1, status = statusFilter, append = false } = {}) => {
    if (page === 1) setSentLoading(true);
    else setSentLoadingMore(true);
    try {
      const data = await getSentCollabRequests({ status, page, limit: PAGE_LIMIT });
      const rows = data?.requests || [];
      setSentItems((prev) => append ? [...prev, ...rows] : rows);
      setSentPage(page);
      setSentTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.warn('[CollabRequestsScreen] loadSent error:', err?.message);
    } finally {
      setSentLoading(false);
      setSentLoadingMore(false);
    }
  }, [statusFilter]);

  // Initial load
  useEffect(() => {
    loadReceived({ status: statusFilter });
    loadSent({ status: statusFilter });
  }, []);

  // Re-fetch when status filter changes (reset to page 1)
  const prevFilter = useRef(statusFilter);
  useEffect(() => {
    if (prevFilter.current === statusFilter) return;
    prevFilter.current = statusFilter;
    if (activeTab === 'received') loadReceived({ page: 1, status: statusFilter });
    else loadSent({ page: 1, status: statusFilter });
  }, [statusFilter, activeTab]);

  // Re-fetch the inactive tab when switching to it (if not yet loaded for this filter)
  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'received' && receivedLoading) loadReceived({ status: statusFilter });
    if (tab === 'sent'     && sentLoading)     loadSent({ status: statusFilter });
  }, [receivedLoading, sentLoading, statusFilter]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'received') await loadReceived({ page: 1, status: statusFilter });
    else                           await loadSent({ page: 1, status: statusFilter });
    setRefreshing(false);
  }, [activeTab, statusFilter]);

  // Pagination / infinite scroll
  const handleEndReached = useCallback(() => {
    if (activeTab === 'received') {
      if (receivedLoadingMore) return;
      if (receivedItems.length >= receivedTotal) return;
      loadReceived({ page: receivedPage + 1, status: statusFilter, append: true });
    } else {
      if (sentLoadingMore) return;
      if (sentItems.length >= sentTotal) return;
      loadSent({ page: sentPage + 1, status: statusFilter, append: true });
    }
  }, [activeTab, receivedLoadingMore, sentLoadingMore, receivedItems, sentItems, receivedTotal, sentTotal, receivedPage, sentPage, statusFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async (item) => {
    HapticsService.triggerImpactMedium();
    setActionLoading((p) => ({ ...p, [item.id]: true }));
    try {
      const result = await acceptCollabRequest(item.id);
      // Optimistic: update status in place
      setReceivedItems((prev) => prev.map((r) =>
        r.id === item.id ? { ...r, status: 'accepted', linked_chat_thread_id: result?.chat_thread_id } : r,
      ));
      // Offer to open the chat
      if (result?.chat_thread_id) {
        showAlert({
          title: 'Request Accepted 🎉',
          message: `You've accepted ${item.counterpart?.display_name || 'this'}'s collab request. Open the chat to continue?`,
          icon: Handshake,
          iconColor: COLORS.primary,
          primaryAction: {
            text: 'Open Chat',
            onPress: () => {
              hideAlert();
              navigation.navigate('Chat', { conversationId: result.chat_thread_id });
            },
          },
          secondaryAction: { text: 'Later', onPress: hideAlert },
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err?.message || 'Failed to accept. Please try again.',
        icon: TriangleAlert, iconColor: COLORS.error,
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally {
      setActionLoading((p) => ({ ...p, [item.id]: false }));
    }
  }, [showAlert, hideAlert, navigation]);

  const handleDecline = useCallback(async (item, reason) => {
    HapticsService.triggerImpactLight();
    setActionLoading((p) => ({ ...p, [item.id]: true }));
    try {
      await declineCollabRequest(item.id, reason);
      setReceivedItems((prev) => prev.map((r) =>
        r.id === item.id ? { ...r, status: 'declined' } : r,
      ));
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err?.message || 'Failed to decline. Please try again.',
        icon: TriangleAlert, iconColor: COLORS.error,
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally {
      setActionLoading((p) => ({ ...p, [item.id]: false }));
    }
  }, [showAlert, hideAlert]);

  const handleWithdraw = useCallback((item) => {
    HapticsService.triggerImpactLight();
    showAlert({
      title: 'Withdraw Request?',
      message: `This will cancel your pending collab request to ${item.counterpart?.display_name || 'this entity'}. You can send a new one later.`,
      icon: TriangleAlert, iconColor: '#D97706',
      secondaryAction: { text: 'Keep', onPress: hideAlert },
      primaryAction: {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setActionLoading((p) => ({ ...p, [item.id]: true }));
          try {
            await withdrawCollabRequest(item.id);
            setSentItems((prev) => prev.map((r) =>
              r.id === item.id ? { ...r, status: 'withdrawn' } : r,
            ));
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to withdraw.',
              icon: TriangleAlert, iconColor: COLORS.error,
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          } finally {
            setActionLoading((p) => ({ ...p, [item.id]: false }));
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  const handleOpenChat = useCallback((chatThreadId) => {
    navigation.navigate('Chat', { conversationId: chatThreadId });
  }, [navigation]);

  const handlePressProfile = useCallback((counterpart) => {
    if (!counterpart) return;
    if (counterpart.type === 'community') {
      navigation.navigate('CommunityPublicProfile', { communityId: counterpart.id });
    } else {
      navigation.navigate('MemberPublicProfile', { memberId: counterpart.id });
    }
  }, [navigation]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item }) => (
    <CollabRequestCard
      item={item}
      tab={activeTab}
      actionLoading={!!actionLoading[item.id]}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onWithdraw={handleWithdraw}
      onOpenChat={handleOpenChat}
      onPressProfile={handlePressProfile}
    />
  ), [activeTab, actionLoading, handleAccept, handleDecline, handleWithdraw, handleOpenChat, handlePressProfile]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const isLoading = activeTab === 'received' ? receivedLoading : sentLoading;
  const isLoadingMore = activeTab === 'received' ? receivedLoadingMore : sentLoadingMore;
  const data = activeTab === 'received' ? receivedItems : sentItems;
  const pendingCount = receivedItems.filter((r) => r.status === 'pending').length;

  const ListFooter = isLoadingMore
    ? () => <ActivityIndicator style={{ padding: 20 }} color={COLORS.primary} />
    : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <GHPressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </GHPressable>
          <Text style={styles.headerTitle}>Collab Requests</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabRow}>
          {['received', 'sent'].map((tab) => (
            <GHPressable
              key={tab}
              style={styles.tab}
              onPress={() => handleTabSwitch(tab)}
              onLayout={(e) => handleTabLayout(tab, e)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'received'
                  ? `Received${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                  : 'Sent'}
              </Text>
            </GHPressable>
          ))}
          <Reanimated.View style={[styles.activeTabIndicator, animatedUnderlineStyle]} />
        </View>

        {/* ── Status filter chips ── */}
        <FilterChips selected={statusFilter} onChange={setStatusFilter} />

        {/* ── Content ── */}
        {isLoading ? (
          <View style={{ paddingTop: 12 }}>
            {[1, 2, 3].map((k) => <CollabRequestCardSkeleton key={k} />)}
          </View>
        ) : (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={
              <EmptyState tab={activeTab} status={statusFilter} />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
          />
        )}

        <CustomAlertModal
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          iconColor={alertConfig.iconColor}
          primaryAction={alertConfig.primaryAction}
          secondaryAction={alertConfig.secondaryAction}
          onClose={hideAlert}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBackground },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontFamily: FONTS.primary, fontSize: 18, color: COLORS.textPrimary },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.07)',
    position: 'relative',
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.semiBold },
  activeTabIndicator: {
    position: 'absolute', bottom: 0, height: 2,
    backgroundColor: COLORS.primary, borderRadius: 1,
  },

  // Status filter chips
  filterWrapper: {
    backgroundColor: COLORS.screenBackground,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  filterChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  // List
  listContent: { paddingTop: 12, paddingBottom: 40, flexGrow: 1 },

  // Empty
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(41,98,255,0.07)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold, fontSize: 15,
    color: COLORS.textPrimary, textAlign: 'center', marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular, fontSize: 13,
    color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19,
  },
});
