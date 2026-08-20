/**
 * RequestsScreen.js
 *
 * Unified Collabs screen shared by both Community and Member (Creator) callers.
 * Supports:
 *   1. Board    — public marketplace for open collab spots, with join flow and posting.
 *   2. Received — incoming collab pitches and applicants for board posts.
 *   3. Sent     — outgoing collab pitches and join-requests.
 *
 * Props:
 *   - callerType:  'community' | 'member' (default: derived from route or active account)
 *   - callerId:    id of caller (optional, resolved via auth if omitted)
 *   - isBottomTab: boolean (if true, renders as bottom-tab root screen without back arrow)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Pressable as GHPressable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Handshake,
  TriangleAlert,
  Plus,
  Users,
  X,
} from 'lucide-react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import {
  getReceivedCollabRequests,
  getSentCollabRequests,
  acceptCollabRequest,
  declineCollabRequest,
  withdrawCollabRequest,
  getBoardPosts,
  getMyBoardPosts,
  joinBoardPost,
  COLLAB_TYPES,
} from '../../api/collabRequests';
import { getActiveAccount } from '../../api/auth';
import CollabRequestCard, { CollabRequestCardSkeleton } from '../../components/cards/CollabRequestCard';
import BoardPostCard, { BoardPostCardSkeleton } from '../../components/cards/BoardPostCard';
import CollabRequestSheet from '../../components/modals/CollabRequestSheet';
import CreateBoardPostModal from '../../components/modals/CreateBoardPostModal';
import MyBoardPostsModal from '../../components/modals/MyBoardPostsModal';
import CustomAlertModal from '../../components/ui/CustomAlertModal';
import GradientSafeArea from '../../components/ui/GradientSafeArea';
import Toast from '../../components/ui/Toast';
import HapticsService from '../../services/HapticsService';
import EventBus from '../../utils/EventBus';

const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.09)';
const DASHBOARD_BG = '#F9F9F9';
const PAGE_LIMIT = 20;

// ─── Status filter chips (Received / Sent) ────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'pending',   label: 'Pending' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'declined',  label: 'Declined' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'expired',   label: 'Expired' },
];

function StatusFilterChips({ selected, onChange }) {
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
          const isActive = selected === value;
          return (
            <GHPressable
              key={label}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onChange(value)}
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

// ─── Collab-type filter chips (Board) ─────────────────────────────────────────

const BOARD_COLLAB_FILTERS = [
  { value: 'all', label: 'All Openings' },
  ...COLLAB_TYPES,
];

function BoardTypeFilterChips({ selected, onChange }) {
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
        {BOARD_COLLAB_FILTERS.map(({ value, label }) => {
          const isActive = (selected || 'all') === value;
          return (
            <GHPressable
              key={value}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onChange(value === 'all' ? null : value)}
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

function EmptyState({ tab, status, onActionPress }) {
  if (tab === 'board') {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Handshake size={32} color={TEAL} strokeWidth={1.8} />
        </View>
        <Text style={styles.emptyTitle}>No open collab spots yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to post an open collab spot or check back soon for new opportunities.
        </Text>
        <TouchableOpacity
          style={styles.emptyActionBtn}
          onPress={onActionPress}
          activeOpacity={0.85}
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.emptyActionBtnText}>Post an Opening</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isReceived = tab === 'received';
  const isPending  = status === 'pending';
  const title = isReceived
    ? (isPending ? 'No requests yet' : `No ${status} requests`)
    : (isPending ? "You haven't sent any requests" : `No ${status} requests`);
  const subtitle = isReceived && isPending
    ? 'When someone sends you a collab pitch or joins your opening, it will appear here'
    : !isReceived && isPending
    ? 'Send a collab pitch to a Community or Creator, or request to join a Board opening'
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

// ─── Main Screen Component ────────────────────────────────────────────────────

export default function RequestsScreen({
  navigation,
  route,
  callerType: propCallerType,
  callerId: propCallerId,
  isBottomTab: propIsBottomTab,
}) {
  const initialTabParam   = route?.params?.initialTab;
  const initialPostId     = route?.params?.boardPostId;
  const initialPostTitle  = route?.params?.boardPostTitle;
  const routeCallerType   = route?.params?.callerType;
  const routeIsBottomTab  = route?.params?.isBottomTab;

  const resolvedCallerType = propCallerType || routeCallerType || 'member';
  const isBottomTab = propIsBottomTab !== undefined
    ? propIsBottomTab
    : routeIsBottomTab !== undefined
    ? routeIsBottomTab
    : (resolvedCallerType === 'community');

  const [activeTab, setActiveTab] = useState(
    initialTabParam || (initialPostId ? 'received' : 'board'),
  );

  // Status filters for Received/Sent
  const [statusFilter, setStatusFilter] = useState('pending');

  // Collab type filter for Board
  const [boardTypeFilter, setBoardTypeFilter] = useState(null);

  // Filter Received tab by specific Board Post ID
  const [boardPostFilterId, setBoardPostFilterId] = useState(initialPostId || null);
  const [boardPostFilterTitle, setBoardPostFilterTitle] = useState(initialPostTitle || null);

  // Active current user info for ownership checks
  const [currentUser, setCurrentUser] = useState(null);

  // ── Board tab state ──
  const [boardItems, setBoardItems]             = useState([]);
  const [boardPage, setBoardPage]               = useState(1);
  const [boardTotal, setBoardTotal]             = useState(0);
  const [boardLoading, setBoardLoading]         = useState(true);
  const [boardLoadingMore, setBoardLoadingMore] = useState(false);
  const [myPostsPendingCount, setMyPostsPendingCount] = useState(0);

  // ── Received tab state ──
  const [receivedItems, setReceivedItems]             = useState([]);
  const [receivedPage, setReceivedPage]               = useState(1);
  const [receivedTotal, setReceivedTotal]             = useState(0);
  const [receivedLoading, setReceivedLoading]         = useState(true);
  const [receivedLoadingMore, setReceivedLoadingMore] = useState(false);

  // ── Sent tab state ──
  const [sentItems, setSentItems]                     = useState([]);
  const [sentPage, setSentPage]                       = useState(1);
  const [sentTotal, setSentTotal]                     = useState(0);
  const [sentLoading, setSentLoading]                 = useState(true);
  const [sentLoadingMore, setSentLoadingMore]         = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // ── Modals & Alerts ──
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const [toast, setToast] = useState(null);

  const [joinSheetVisible, setJoinSheetVisible] = useState(false);
  const [selectedBoardPost, setSelectedBoardPost] = useState(null);

  const [createBoardModalVisible, setCreateBoardModalVisible] = useState(false);
  const [myBoardPostsModalVisible, setMyBoardPostsModalVisible] = useState(false);

  // Load current user identity on mount
  useEffect(() => {
    getActiveAccount()
      .then((acc) => setCurrentUser(acc))
      .catch((err) => console.warn('[RequestsScreen] getActiveAccount error:', err));
  }, []);

  // ── Tab indicator animation ──
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

  const showAlert = useCallback((cfg) => setAlertConfig({ ...cfg, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Data Loading: Board Feed ──
  const loadBoard = useCallback(async ({ page = 1, collab_type = boardTypeFilter, append = false } = {}) => {
    if (page === 1) setBoardLoading(true);
    else setBoardLoadingMore(true);
    try {
      const data = await getBoardPosts({
        status: 'open',
        collab_type: collab_type || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      const rows = data?.posts || [];
      setBoardItems((prev) => (append ? [...prev, ...rows] : rows));
      setBoardPage(page);
      setBoardTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.warn('[RequestsScreen] loadBoard error:', err?.message);
    } finally {
      setBoardLoading(false);
      setBoardLoadingMore(false);
    }
  }, [boardTypeFilter]);

  // Load top-level badge count (pending applicants for own posts)
  const loadPendingApplicationsCount = useCallback(async () => {
    try {
      const res = await getMyBoardPosts();
      const totalPending = (res?.posts || []).reduce(
        (sum, p) => sum + (parseInt(p.pending_count, 10) || 0),
        0,
      );
      setMyPostsPendingCount(totalPending);
    } catch (err) {
      console.warn('[RequestsScreen] loadPendingApplicationsCount error:', err?.message);
    }
  }, []);

  // ── Data Loading: Received ──
  const loadReceived = useCallback(async ({ page = 1, status = statusFilter, board_post_id = boardPostFilterId, append = false } = {}) => {
    if (page === 1) setReceivedLoading(true);
    else setReceivedLoadingMore(true);
    try {
      const data = await getReceivedCollabRequests({
        status,
        board_post_id: board_post_id || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      const rows = data?.requests || [];
      setReceivedItems((prev) => (append ? [...prev, ...rows] : rows));
      setReceivedPage(page);
      setReceivedTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.warn('[RequestsScreen] loadReceived error:', err?.message);
    } finally {
      setReceivedLoading(false);
      setReceivedLoadingMore(false);
    }
  }, [statusFilter, boardPostFilterId]);

  // ── Data Loading: Sent ──
  const loadSent = useCallback(async ({ page = 1, status = statusFilter, append = false } = {}) => {
    if (page === 1) setSentLoading(true);
    else setSentLoadingMore(true);
    try {
      const data = await getSentCollabRequests({ status, page, limit: PAGE_LIMIT });
      const rows = data?.requests || [];
      setSentItems((prev) => (append ? [...prev, ...rows] : rows));
      setSentPage(page);
      setSentTotal(data?.pagination?.total || 0);
    } catch (err) {
      console.warn('[RequestsScreen] loadSent error:', err?.message);
    } finally {
      setSentLoading(false);
      setSentLoadingMore(false);
    }
  }, [statusFilter]);

  // Trigger loads when tab or filters change
  useEffect(() => {
    if (activeTab === 'board') {
      loadBoard({ page: 1, collab_type: boardTypeFilter });
      loadPendingApplicationsCount();
    } else if (activeTab === 'received') {
      loadReceived({ page: 1, status: statusFilter, board_post_id: boardPostFilterId });
    } else if (activeTab === 'sent') {
      loadSent({ page: 1, status: statusFilter });
    }
  }, [activeTab, statusFilter, boardTypeFilter, boardPostFilterId, loadBoard, loadPendingApplicationsCount, loadReceived, loadSent]);

  // Refresh listener from EventBus
  useEffect(() => {
    const unsubBoard = EventBus.on('board-posts:refresh', () => {
      if (activeTab === 'board') {
        loadBoard({ page: 1, collab_type: boardTypeFilter });
        loadPendingApplicationsCount();
      }
    });
    return () => {
      if (unsubBoard) unsubBoard();
    };
  }, [activeTab, boardTypeFilter, loadBoard, loadPendingApplicationsCount]);

  const handleTabSwitch = useCallback((tab) => {
    HapticsService.triggerImpactLight();
    setActiveTab(tab);
  }, []);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'board') {
      await Promise.all([
        loadBoard({ page: 1, collab_type: boardTypeFilter }),
        loadPendingApplicationsCount(),
      ]);
    } else if (activeTab === 'received') {
      await loadReceived({ page: 1, status: statusFilter, board_post_id: boardPostFilterId });
    } else {
      await loadSent({ page: 1, status: statusFilter });
    }
    setRefreshing(false);
  }, [activeTab, boardTypeFilter, statusFilter, boardPostFilterId, loadBoard, loadPendingApplicationsCount, loadReceived, loadSent]);

  // Pagination / infinite scroll
  const handleEndReached = useCallback(() => {
    if (activeTab === 'board') {
      if (boardLoadingMore) return;
      if (boardItems.length >= boardTotal) return;
      loadBoard({ page: boardPage + 1, collab_type: boardTypeFilter, append: true });
    } else if (activeTab === 'received') {
      if (receivedLoadingMore) return;
      if (receivedItems.length >= receivedTotal) return;
      loadReceived({ page: receivedPage + 1, status: statusFilter, board_post_id: boardPostFilterId, append: true });
    } else {
      if (sentLoadingMore) return;
      if (sentItems.length >= sentTotal) return;
      loadSent({ page: sentPage + 1, status: statusFilter, append: true });
    }
  }, [activeTab, boardLoadingMore, boardItems, boardTotal, boardPage, boardTypeFilter, receivedLoadingMore, receivedItems, receivedTotal, receivedPage, statusFilter, boardPostFilterId, sentLoadingMore, sentItems, sentTotal, sentPage, loadBoard, loadReceived, loadSent]);

  // ── Actions: Board Join ──
  const handleRequestJoin = useCallback((post) => {
    HapticsService.triggerImpactLight();
    setSelectedBoardPost(post);
    setJoinSheetVisible(true);
  }, []);

  const handleManageApplicants = useCallback((post) => {
    HapticsService.triggerImpactLight();
    setBoardPostFilterId(post.id);
    setBoardPostFilterTitle(post.title);
    setActiveTab('received');
  }, []);

  // ── Actions: Accept / Decline / Withdraw (Received & Sent) ──
  const handleAccept = useCallback(async (item) => {
    HapticsService.triggerImpactMedium();
    setActionLoading((p) => ({ ...p, [item.id]: true }));
    try {
      const result = await acceptCollabRequest(item.id);
      setReceivedItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, status: 'accepted', linked_chat_thread_id: result?.chat_thread_id }
            : r,
        ),
      );
      if (result?.chat_thread_id) {
        showAlert({
          title: 'Request Accepted 🎉',
          message: `You've accepted ${item.counterpart?.display_name || 'this'}'s collab request. Open the chat to continue?`,
          icon: Handshake,
          iconColor: TEAL,
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
        icon: TriangleAlert,
        iconColor: COLORS.error,
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
      setReceivedItems((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: 'declined' } : r)),
      );
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err?.message || 'Failed to decline. Please try again.',
        icon: TriangleAlert,
        iconColor: COLORS.error,
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
      icon: TriangleAlert,
      iconColor: '#D97706',
      secondaryAction: { text: 'Keep', onPress: hideAlert },
      primaryAction: {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setActionLoading((p) => ({ ...p, [item.id]: true }));
          try {
            await withdrawCollabRequest(item.id);
            setSentItems((prev) =>
              prev.map((r) => (r.id === item.id ? { ...r, status: 'withdrawn' } : r)),
            );
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to withdraw.',
              icon: TriangleAlert,
              iconColor: COLORS.error,
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

  // ── Render Item Helpers ──
  const renderBoardItem = useCallback(({ item }) => {
    const isPoster =
      String(currentUser?.id) === String(item.poster_id) &&
      (currentUser?.type || resolvedCallerType) === item.poster_type;

    return (
      <BoardPostCard
        item={item}
        isPoster={isPoster}
        actionLoading={!!actionLoading[item.id]}
        onRequestJoin={handleRequestJoin}
        onManageApplicants={handleManageApplicants}
        onPressProfile={handlePressProfile}
      />
    );
  }, [currentUser, resolvedCallerType, actionLoading, handleRequestJoin, handleManageApplicants, handlePressProfile]);

  const renderRequestItem = useCallback(({ item }) => (
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

  const pendingReceivedCount = receivedItems.filter((r) => r.status === 'pending').length;

  const isCurrentLoading =
    activeTab === 'board'
      ? boardLoading
      : activeTab === 'received'
      ? receivedLoading
      : sentLoading;

  const isCurrentLoadingMore =
    activeTab === 'board'
      ? boardLoadingMore
      : activeTab === 'received'
      ? receivedLoadingMore
      : sentLoadingMore;

  const ListFooter = isCurrentLoadingMore
    ? () => <ActivityIndicator style={{ padding: 20 }} color={TEAL} />
    : null;

  const screenBody = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Premium Gradient Overlay for Status Bar Contrast */}
        <GradientSafeArea variant="primary" />
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* ── Top Header ── */}
        <View style={[styles.header, isBottomTab && styles.bottomTabHeader]}>
          {!isBottomTab ? (
            <GHPressable
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2.5} />
            </GHPressable>
          ) : null}
          <Text style={[styles.headerTitle, isBottomTab && styles.bottomTabHeaderTitle]}>
            {boardPostFilterId && activeTab === 'received'
              ? 'Post Applicants'
              : 'Collabs'}
          </Text>
          {!isBottomTab ? <View style={{ width: 40 }} /> : null}
        </View>

        {/* ── Tabs Row: Board | Received | Sent ── */}
        <View style={styles.tabRow}>
          {['board', 'received', 'sent'].map((tab) => (
            <GHPressable
              key={tab}
              style={styles.tab}
              onPress={() => handleTabSwitch(tab)}
              onLayout={(e) => handleTabLayout(tab, e)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'board'
                  ? 'Board'
                  : tab === 'received'
                  ? `Received${pendingReceivedCount > 0 ? ` (${pendingReceivedCount})` : ''}`
                  : 'Sent'}
              </Text>
            </GHPressable>
          ))}
          <Reanimated.View style={[styles.activeTabIndicator, animatedUnderlineStyle]} />
        </View>

        {/* ── Sub-header / Filters based on active tab ── */}

        {/* Board Tab Sub-header: Manage Applications + Post an opening */}
        {activeTab === 'board' && (
          <View style={styles.boardActionRow}>
            <TouchableOpacity
              style={styles.manageApplicationsBtn}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setMyBoardPostsModalVisible(true);
              }}
              activeOpacity={0.82}
            >
              <Users size={14} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.manageApplicationsText}>My Openings</Text>
              {myPostsPendingCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{myPostsPendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.postOpeningBtn}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setCreateBoardModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.postOpeningText}>Post Opening</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Board Collab Type Filter Chips */}
        {activeTab === 'board' && (
          <BoardTypeFilterChips
            selected={boardTypeFilter}
            onChange={setBoardTypeFilter}
          />
        )}

        {/* Received Tab: Board Post Filter Banner (when pre-filtered) */}
        {activeTab === 'received' && boardPostFilterId && (
          <View style={styles.boardFilterBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardFilterBannerLabel}>Applicants for opening:</Text>
              <Text style={styles.boardFilterBannerTitle} numberOfLines={1}>
                {boardPostFilterTitle || `Opening #${boardPostFilterId}`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setBoardPostFilterId(null);
                setBoardPostFilterTitle(null);
              }}
              activeOpacity={0.7}
            >
              <X size={14} color={COLORS.textSecondary} />
              <Text style={styles.clearFilterText}>Show All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Received / Sent Status Filter Chips */}
        {(activeTab === 'received' || activeTab === 'sent') && (
          <StatusFilterChips selected={statusFilter} onChange={setStatusFilter} />
        )}

        {/* ── Content Feed ── */}
        {isCurrentLoading ? (
          <View style={{ paddingTop: 12 }}>
            {[1, 2, 3].map((k) =>
              activeTab === 'board' ? (
                <BoardPostCardSkeleton key={k} />
              ) : (
                <CollabRequestCardSkeleton key={k} />
              ),
            )}
          </View>
        ) : activeTab === 'board' ? (
          <FlatList
            data={boardItems}
            renderItem={renderBoardItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={
              <EmptyState
                tab="board"
                onActionPress={() => setCreateBoardModalVisible(true)}
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={TEAL}
                colors={[TEAL]}
              />
            }
          />
        ) : (
          <FlatList
            data={activeTab === 'received' ? receivedItems : sentItems}
            renderItem={renderRequestItem}
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
                tintColor={TEAL}
                colors={[TEAL]}
              />
            }
          />
        )}

        {/* ── Join Sheet (uses reusable CollabRequestSheet in join mode) ── */}
        {selectedBoardPost && (
          <CollabRequestSheet
            visible={joinSheetVisible}
            onClose={() => {
              setJoinSheetVisible(false);
              setSelectedBoardPost(null);
            }}
            receiverId={selectedBoardPost.poster_id}
            receiverType={selectedBoardPost.poster_type}
            receiverName={selectedBoardPost.poster?.display_name || selectedBoardPost.poster_name}
            title={`Join: ${selectedBoardPost.title}`}
            buttonLabel="Request to Join"
            showTypeChips={false}
            pitchRequired={false}
            maxLength={150}
            placeholder="Add an optional note to your join request…"
            sectionLabel="Note (optional)"
            onSubmit={async (payload) => {
              return await joinBoardPost(selectedBoardPost.id, {
                note: payload.note || payload.pitch_text,
              });
            }}
            onSuccess={() => {
              setBoardItems((prev) =>
                prev.map((p) =>
                  p.id === selectedBoardPost.id ? { ...p, joined_status: 'pending' } : p,
                ),
              );
              showToast('Request sent!', 'Your request to join this opening has been submitted.');
            }}
          />
        )}

        {/* ── Create Opening Modal ── */}
        <CreateBoardPostModal
          visible={createBoardModalVisible}
          onClose={() => setCreateBoardModalVisible(false)}
          onSuccess={(newPost) => {
            showToast('Opening posted!', 'Your opening is now live on the public Board.');
            loadBoard({ page: 1 });
            loadPendingApplicationsCount();
          }}
        />

        {/* ── My Board Posts Modal (Manage Openings & View counts) ── */}
        <MyBoardPostsModal
          visible={myBoardPostsModalVisible}
          onClose={() => setMyBoardPostsModalVisible(false)}
          onCreateNewPress={() => {
            setMyBoardPostsModalVisible(false);
            setTimeout(() => {
              setCreateBoardModalVisible(true);
            }, 250);
          }}
          onSelectPost={(post) => {
            setBoardPostFilterId(post.id);
            setBoardPostFilterTitle(post.title);
            setActiveTab('received');
          }}
          onPostClosed={() => {
            loadBoard({ page: 1 });
            loadPendingApplicationsCount();
          }}
        />

        {/* ── Shared Alert & Toast ── */}
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

        {toast && (
          <Toast
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );

  return screenBody;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: '#FFFFFF',
  },
  bottomTabHeader: {
    height: 'auto',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 0,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'BasicCommercial-Black',
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  bottomTabHeaderTitle: {
    fontFamily: FONTS.black, // PlusJakartaSans-ExtraBold — matching Community Dashboard title
    fontSize: 34,
    color: COLORS.textPrimary,
    letterSpacing: -1,
    textAlign: 'left',
  },
  tabRow: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: TEAL,
    fontFamily: FONTS.semiBold,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    backgroundColor: TEAL,
    borderRadius: 2,
  },

  // Board top actions row
  boardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: DASHBOARD_BG,
    gap: 10,
  },
  manageApplicationsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  manageApplicationsText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  pendingBadge: {
    backgroundColor: TEAL,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: {
    fontFamily: FONTS.bold || FONTS.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  postOpeningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  postOpeningText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Filter chips wrapper
  filterWrapper: {
    backgroundColor: DASHBOARD_BG,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
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
    borderColor: TEAL,
    backgroundColor: TEAL_BG,
  },
  filterChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: TEAL,
    fontFamily: FONTS.semiBold,
  },

  // Board post filter banner in Received tab
  boardFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TEAL_BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 148, 136, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 12,
  },
  boardFilterBannerLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: TEAL,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  boardFilterBannerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#111827',
    marginTop: 1,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  clearFilterText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Feed list
  listContent: {
    backgroundColor: DASHBOARD_BG,
    paddingTop: 8,
    paddingBottom: 100,
    flexGrow: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TEAL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.pill,
    gap: 6,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyActionBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
