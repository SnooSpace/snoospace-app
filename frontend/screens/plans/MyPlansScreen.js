import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import { getHostedPlans, getAttendingPlans, likePlan, unlikePlan } from '../../api/plans';
import SnooLoader from '../../components/ui/SnooLoader';
import HostPlanBottomSheet from './HostPlanBottomSheet';
import OpenPlanCard from '../../components/plans/OpenPlanCard';
import RequestBottomSheet from './RequestBottomSheet';
import CommentsModal from '../../components/CommentsModal';
import ShareModal from '../../components/ShareModal';

// Matches OpenPlanCard PILL_COLORS — all 16 activity types
const ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A' },
  bar:          { bg: '#E8EAF6', text: '#303F9F' },
  food:         { bg: '#FFF8E1', text: '#F57F17' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32' },
  gym:          { bg: '#FCE4EC', text: '#880E4F' },
  walk:         { bg: '#E0F2F1', text: '#00695C' },
  rides:        { bg: '#E3F2FD', text: '#1565C0' },
  live_music:   { bg: '#FCE4EC', text: '#C62828' },
  study:        { bg: '#EDE7F6', text: '#4527A0' },
  creative:     { bg: '#FFF9C4', text: '#F57F17' },
  games:        { bg: '#E1F5FE', text: '#01579B' },
  gaming:       { bg: '#E1F5FE', text: '#01579B' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20' },
  house_party:  { bg: '#FBE9E7', text: '#D84315' },
  club:         { bg: '#EDE7F6', text: '#5E35B1' },
  hiking:       { bg: '#E8F5E9', text: '#2E7D32' },
  shopping:     { bg: '#FCE4EC', text: '#D81B60' },
  other:        { bg: '#F5F5F5', text: '#424242' },
};

const ACTIVITY_EMOJIS = {
  sports:       '🏀',
  food:         '🍜',
  cafe:         '☕',
  bar:          '🍸',
  movies:       '🎬',
  live_music:   '🎵',
  games:        '🎮',
  gaming:       '🎮',
  gym:          '💪',
  yoga:         '🧘',
  walk:         '🚶',
  rides:        '🏍',
  hangout:      '🌳',
  creative:     '🎨',
  study:        '📚',
  pet_friendly: '🐾',
  house_party:  '🏡',
  club:         '🪩',
  hiking:       '🥾',
  shopping:     '🛍️',
  other:        '＋',
};

const STATUS_COLORS = {
  active:    { bg: '#E8F5E9', text: '#2E7D32' },
  closed:    { bg: '#F5F5F5', text: '#555555' },
  cancelled: { bg: '#FFEBEE', text: '#C62828' },
};

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ` · ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function HostedPlanRow({ item, onPress }) {
  const activityKey = item.activity_type in ACTIVITY_COLORS ? item.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const activityLabel = item.activity_type === 'other'
    ? (item.custom_activity_label || 'Other')
    : (activityStyle.label || item.activity_type);
  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.active;

  return (
    <TouchableOpacity style={styles.planRow} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={styles.planRowLeft}>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: activityStyle.bg }]}>
            <Text style={[styles.pillText, { color: activityStyle.text }]}>
              {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.pillText, { color: statusStyle.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.planMeta}>{formatDate(item.scheduled_at)}{item.location_public ? ` · ${item.location_public}` : ''}</Text>
      </View>
      <View style={styles.planRowRight}>
        <Text style={styles.acceptedCount}>{item.accepted_count ?? 0}/{item.max_accepted} accepted</Text>
        {(item.pending_count ?? 0) > 0 && (
          <Text style={styles.pendingCount}>{item.pending_count} pending</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function AttendingPlanRow({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.planRow} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={styles.planRowLeft}>
        <View style={[styles.pill, styles.openPlanPill]}>
          <Text style={[styles.pillText, { color: COLORS.primary }]}>Open Plan</Text>
        </View>
        <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.planMeta}>{formatDate(item.scheduled_at)}{item.location_private ? ` · ${item.location_private}` : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyPlansScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Hosted');
  const [hostedPlans, setHostedPlans] = useState([]);
  const [attendingPlans, setAttendingPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hostSheetOpen, setHostSheetOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [requestSheet, setRequestSheet] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingPlan, setSharingPlan] = useState(null);

  // Screen-level comments modal state and callbacks
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
  });

  const openCommentsModal = useCallback((postId) => {
    if (postId) {
      setCommentsModalState({ visible: true, postId });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null });
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [token, account] = await Promise.all([
        getAuthToken(),
        getActiveAccount(),
      ]);
      if (account?.id) setCurrentUserId(account.id);
      const [hostedData, attendingData] = await Promise.all([
        getHostedPlans(token),
        getAttendingPlans(token),
      ]);
      setHostedPlans((hostedData.plans || []).filter(p => !p.parent_plan_id));
      setAttendingPlans(attendingData.plans || []);
    } catch (err) {
      console.error('[MyPlansScreen]', err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLike = useCallback(async (planId, liked) => {
    const token = await getAuthToken();
    if (liked) await likePlan(planId, token);
    else await unlikePlan(planId, token);
  }, []);

  const handleShare = useCallback((plan) => {
    setSharingPlan(plan);
    setShareModalVisible(true);
  }, []);

  const currentData = activeTab === 'Hosted' ? hostedPlans : attendingPlans;

  const renderItem = useCallback(({ item }) => {
    if (activeTab === 'Hosted') {
      return <HostedPlanRow item={item} onPress={(p) => navigation.navigate('HostRequests', { planId: p.id, planTitle: p.title })} />;
    }
    // Attending tab — full OpenPlanCard
    return (
      <View style={styles.cardWrapper}>
        <OpenPlanCard
          plan={item}
          currentUserId={currentUserId}
          onPress={(id) => navigation.navigate('PlanDetail', { planId: id })}
          onRequestPress={(id) => setRequestSheet({ planId: id, planTitle: item.title })}
          onLike={handleLike}
          onShare={() => handleShare(item)}
          onComment={openCommentsModal}
          navigation={navigation}
        />
      </View>
    );
  }, [activeTab, currentUserId, navigation, handleLike, handleShare, openCommentsModal]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Plans</Text>
          <TouchableOpacity
            onPress={() => setHostSheetOpen(true)}
            hitSlop={8}
          >
            <Plus size={24} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {['Hosted', 'Attending'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            activeTab === 'Attending' && styles.cardListContent,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'Hosted'
                  ? "You haven't hosted any plans yet."
                  : "You're not attending any plans yet."}
              </Text>
              {activeTab === 'Hosted' && (
                <TouchableOpacity style={styles.emptyCTA} onPress={() => setHostSheetOpen(true)}>
                  <Plus size={16} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.emptyCTAText}>Host a plan</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <HostPlanBottomSheet
        isVisible={hostSheetOpen}
        onClose={() => setHostSheetOpen(false)}
        onPlanCreated={(plan) => setHostedPlans(prev => [plan, ...prev])}
        navigation={navigation}
      />
      {requestSheet && (
        <RequestBottomSheet
          isVisible={!!requestSheet}
          planId={requestSheet.planId}
          planTitle={requestSheet.planTitle}
          onClose={() => setRequestSheet(null)}
          onRequested={() => {
            setAttendingPlans(prev => prev.map(p =>
              p.id === requestSheet.planId ? { ...p, my_request_status: 'pending' } : p
            ));
            setRequestSheet(null);
          }}
        />
      )}
      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        baseRoute="/plans"
        onClose={closeCommentsModal}
        onCommentCountChange={(newCount) => {
          if (commentsModalState.postId) {
            setAttendingPlans((prev) =>
              prev.map((p) =>
                p.id === commentsModalState.postId
                  ? { ...p, comment_count: newCount }
                  : p,
              ),
            );
          }
        }}
        navigation={navigation}
      />
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        post={sharingPlan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.semiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 60 },
  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    marginBottom: 10, ...SHADOWS.md, shadowOpacity: 0.04,
  },
  planRowLeft: { flex: 1, gap: 4 },
  planRowRight: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  pillRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  openPlanPill: { backgroundColor: '#EEF2FF' },
  pillText: { fontFamily: FONTS.medium, fontSize: 11 },
  planTitle: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  planMeta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  acceptedCount: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary },
  pendingCount: { fontFamily: FONTS.medium, fontSize: 12, color: '#E65100' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textSecondary, marginBottom: 20 },
  emptyCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  emptyCTAText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },
  cardWrapper: { marginHorizontal: 0 },
  cardListContent: { padding: 16, paddingBottom: 80 },
});
