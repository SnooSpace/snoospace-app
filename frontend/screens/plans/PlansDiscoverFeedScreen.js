import React, { useState, useEffect, useCallback, useRef, Profiler } from 'react';

const onRenderProfiler = (id, phase, actualDuration) => {
  console.log(`[PERF-RENDER] ${id} - Phase: ${phase}, Duration: ${actualDuration.toFixed(2)}ms`);
};
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Share, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, LayoutGrid, LayoutList, Clock, MapPin, Users, Pencil } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import { getPlans, likePlan, unlikePlan } from '../../api/plans';
import OpenPlanCard from '../../components/plans/OpenPlanCard';
import HostPlanBottomSheet from './HostPlanBottomSheet';
import RequestBottomSheet from './RequestBottomSheet';
import SnooLoader from '../../components/ui/SnooLoader';
import CommentsModal from '../../components/CommentsModal';
import ShareModal from '../../components/ShareModal';
import { Image } from 'expo-image';
import PlanCropImage from './PlanCropImage';
import ContentActionsSheet from '../../components/ContentActionsSheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100', label: 'Sports' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A', label: 'Movies' },
  bar:          { bg: '#E8EAF6', text: '#303F9F', label: 'Bar' },
  food:         { bg: '#FFF8E1', text: '#F57F17', label: 'Food' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E', label: 'Cafe' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32', label: 'Yoga' },
  gym:          { bg: '#FCE4EC', text: '#880E4F', label: 'Gym' },
  walk:         { bg: '#E0F2F1', text: '#00695C', label: 'Walk' },
  rides:        { bg: '#E3F2FD', text: '#1565C0', label: 'Rides' },
  live_music:   { bg: '#FCE4EC', text: '#C62828', label: 'Live Music' },
  study:        { bg: '#EDE7F6', text: '#4527A0', label: 'Study / Co-work' },
  creative:     { bg: '#FFF9C4', text: '#F57F17', label: 'Creative' },
  games:        { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  gaming:       { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E', label: 'Pet Friendly' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20', label: 'Hangout' },
  house_party:  { bg: '#FBE9E7', text: '#D84315', label: 'House Party' },
  club:         { bg: '#EDE7F6', text: '#5E35B1', label: 'Club' },
  hiking:       { bg: '#E8F5E9', text: '#2E7D32', label: 'Hiking' },
  shopping:     { bg: '#FCE4EC', text: '#D81B60', label: 'Shopping' },
  other:        { bg: '#F5F5F5', text: '#424242', label: 'Other' },
};

function formatScheduled(iso) {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === todayStr) return `Today, ${time}`;
  if (d.toDateString() === tomorrowStr) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const created = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return created.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getCostLabel(plan) {
  if (plan.cost_type === 'free')     return 'Free';
  if (plan.cost_type === 'self_pay') return 'Self-pay';
  if (plan.cost_type === 'split') {
    return plan.cost_amount_paise
      ? `~₹${Math.round(plan.cost_amount_paise / 100)} split`
      : 'Split cost';
  }
  if (plan.cost_type === 'entry_fee') {
    return plan.cost_amount_paise
      ? `₹${Math.round(plan.cost_amount_paise / 100)}`
      : 'Entry fee';
  }
  return null;
}

function CompactPlanCard({ plan, currentUserId, onPress, navigation }) {
  const [cardW, setCardW] = useState((Dimensions.get('window').width - 48) / 2);
  const isOwner = currentUserId && (plan.created_by === currentUserId || plan.created_by === String(currentUserId));
  const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const activityLabel = plan.activity_type === 'other'
    ? (plan.custom_activity_label || 'Other')
    : activityStyle.label;

  const reqStatus = plan.my_request_status ?? plan.request_status ?? null;
  const acceptedN = plan.accepted_count ?? 0;
  const maxAccepted = plan.max_accepted ?? 0;
  const costLabel = getCostLabel(plan);
  const createdTime = plan.created_at || plan.createdAt || plan.scheduled_at;

  let bottomPillLabel = null;
  if (isOwner) {
    bottomPillLabel = 'Hosting';
  } else if (reqStatus === 'approved') {
    bottomPillLabel = 'Joined';
  } else if (reqStatus === 'pending') {
    bottomPillLabel = 'Requested';
  }

  return (
    <TouchableOpacity
      style={[
        styles.compactCard,
        isOwner && styles.compactCardHostingOutline
      ]}
      activeOpacity={0.9}
      onPress={() => onPress(plan.id)}
      onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
    >
      {/* Upper Poster Half */}
      <View style={[styles.compactCardPoster, { width: cardW }]}>
        {plan.banner_image_url ? (
          <Image
            source={{ uri: plan.banner_image_url }}
            style={{ width: cardW, height: 110 }}
            contentFit="cover"
          />
        ) : (
          <PlanCropImage activityType={activityKey} containerW={cardW} height={110} />
        )}
        
        {/* Top-Left Category Badge */}
        <View style={[styles.compactCategoryPill, { backgroundColor: activityStyle.bg }]}>
          <Text style={[styles.compactCategoryPillText, { color: activityStyle.text }]}>
            {activityLabel}
          </Text>
        </View>

        {/* Top-Right Count Badge */}
        <View style={styles.compactCountPill}>
          <Users size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.compactCountPillText}>
            {`${acceptedN}/${maxAccepted}`}
          </Text>
        </View>

        {/* Bottom-Left Status Badge (Hosting / Joined / Requested) */}
        {bottomPillLabel && (
          <View style={styles.compactStatusPill}>
            <View style={[styles.compactStatusDot, bottomPillLabel === 'Hosting' ? styles.compactStatusDotHosting : styles.compactStatusDotJoined]} />
            <Text style={styles.compactStatusPillText}>
              {bottomPillLabel}
            </Text>
          </View>
        )}

        {/* Bottom-Right: Edit (owner) or Report (non-owner) */}
        {isOwner ? (
          <TouchableOpacity
            style={styles.compactEditBtn}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate('PlanDetail', { planId: plan.id });
            }}
            activeOpacity={0.8}
          >
            <Pencil size={11} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <View style={styles.compactEditBtn}>
            <ContentActionsSheet
              type="open_plan"
              targetId={plan.id}
              targetName={plan.title || 'Open Plan'}
              label="Open Plan"
              iconColor="#FFFFFF"
              iconSize={13}
            />
          </View>
        )}
      </View>

      {/* Lower Content Half */}
      <View style={styles.compactContent}>
        <Text style={styles.compactTitle} numberOfLines={2}>
          {plan.title}
        </Text>

        <View style={styles.compactMetaRow}>
          <MapPin size={12} color="#94A3B8" />
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {plan.location_public || 'Location TBD'}
          </Text>
        </View>

        <View style={styles.compactMetaRow}>
          <Clock size={12} color="#94A3B8" />
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {formatScheduled(plan.scheduled_at)}
          </Text>
        </View>

        <View style={styles.compactBottomRow}>
          {/* Price tag */}
          <View style={[styles.compactCostPill, costLabel === 'Free' ? styles.compactCostPillFree : styles.compactCostPillPaid]}>
            <Text style={[styles.compactCostPillText, costLabel === 'Free' ? styles.compactCostPillTextFree : styles.compactCostPillTextPaid]}>
              {costLabel || 'Free'}
            </Text>
          </View>
          
          {/* Posted time ago */}
          <Text style={styles.compactTimeAgoText}>
            {formatTimeAgo(createdTime)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PlansDiscoverFeedScreen({ navigation, route }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hostSheetOpen, setHostSheetOpen] = useState(false);
  const [requestSheet, setRequestSheet] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingPlan, setSharingPlan] = useState(null);
  const [isGrid, setIsGrid] = useState(false);

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

  const loadPlans = useCallback(async (cursorVal = null, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (!cursorVal) setLoading(true);
      else setLoadingMore(true);


      const token = await getAuthToken();
      const data = await getPlans(cursorVal, token);
      const newPlans = data.plans || [];
      const nextCursor = data.next_cursor || null;

      if (isRefresh || !cursorVal) {
        setPlans(newPlans);
      } else {
        setPlans(prev => [...prev, ...newPlans]);
      }
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (err) {
      console.error('[PlansDiscoverFeedScreen]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // Load userId and initial plans on mount
    getActiveAccount().then(account => {
      if (account?.id) setCurrentUserId(account.id);
    }).catch(() => {});
    loadPlans();
  }, []);

  const handleLike = useCallback(async (planId, liked) => {
    const token = await getAuthToken();
    if (liked) await likePlan(planId, token);
    else await unlikePlan(planId, token);
  }, []);

  const handleShare = useCallback((plan) => {
    setSharingPlan(plan);
    setShareModalVisible(true);
  }, []);

  const handleRequestSuccess = useCallback((planId) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, my_request_status: 'pending' } : p));
  }, []);

  const renderItem = useCallback(({ item }) => (
    <View style={isGrid ? styles.cardWrapperGrid : styles.cardWrapper}>
      {isGrid ? (
        <CompactPlanCard
          plan={item}
          currentUserId={currentUserId}
          onPress={(id) => navigation.navigate('PlanDetail', { planId: id })}
          navigation={navigation}
        />
      ) : (
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
      )}
    </View>
  ), [currentUserId, navigation, handleLike, handleShare, openCommentsModal, isGrid]);

  return (
    <Profiler id="PlansDiscoverFeedScreen" onRender={onRenderProfiler}>
      <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
              <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Open Plans</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.layoutToggleBtn}
              onPress={() => setIsGrid(prev => !prev)}
              activeOpacity={0.7}
              hitSlop={12}
            >
              {isGrid ? (
                <LayoutList size={20} color={COLORS.textPrimary} strokeWidth={2} />
              ) : (
                <LayoutGrid size={20} color={COLORS.textPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.hostBtn}
              onPress={() => setHostSheetOpen(true)}
            >
              <Plus size={18} color="#FFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          key={isGrid ? 'grid' : 'list'}
          numColumns={isGrid ? 2 : 1}
          data={plans}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={isGrid ? styles.listContentGrid : styles.listContent}
          columnWrapperStyle={isGrid ? styles.columnWrapper : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPlans(null, true)}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => { if (hasMore && !loadingMore) loadPlans(cursor); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={COLORS.primary} />
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No open plans nearby</Text>
              <Text style={styles.emptyBody}>Be the first to host one in your communities.</Text>
              <TouchableOpacity style={styles.emptyCTA} onPress={() => setHostSheetOpen(true)}>
                <Plus size={16} color="#FFF" strokeWidth={2.5} />
                <Text style={styles.emptyCTAText}>Host a plan</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <HostPlanBottomSheet
        isVisible={hostSheetOpen}
        onClose={() => setHostSheetOpen(false)}
        onPlanCreated={(plan) => setPlans(prev => [plan, ...prev])}
        navigation={navigation}
      />
      {requestSheet && (
        <RequestBottomSheet
          isVisible={!!requestSheet}
          planId={requestSheet.planId}
          planTitle={requestSheet.planTitle}
          onClose={() => setRequestSheet(null)}
          onRequested={() => { handleRequestSuccess(requestSheet.planId); setRequestSheet(null); }}
        />
      )}
      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        baseRoute="/plans"
        onClose={closeCommentsModal}
        onCommentCountChange={(newCount) => {
          if (commentsModalState.postId) {
            setPlans((prevPlans) =>
              prevPlans.map((p) =>
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
    </Profiler>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerLeft: {
    width: 80,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerRight: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  layoutToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  hostBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 60 },
  listContentGrid: { paddingHorizontal: 8, paddingTop: 16, paddingBottom: 60 },
  cardWrapper: { marginBottom: 0 },
  cardWrapperGrid: { flex: 0.5, maxWidth: '50%', marginHorizontal: 8, marginBottom: 16 },
  columnWrapper: { justifyContent: 'space-between' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary },
  emptyCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 12,
  },
  emptyCTAText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },

  // Compact Card styles (Matching OpenPlansSection.js exactly)
  compactCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    height: 240,
    width: '100%',
  },
  compactCardHostingOutline: {
    borderColor: '#2962FF',
  },
  compactCardPoster: {
    height: 110,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  compactCategoryPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compactCategoryPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  compactCountPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compactCountPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  compactStatusPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compactStatusPillText: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: '#FFFFFF',
  },
  compactStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  compactStatusDotHosting: {
    backgroundColor: '#38BDF8',
  },
  compactStatusDotJoined: {
    backgroundColor: '#34D399',
  },
  compactEditBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2962FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2962FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContent: {
    padding: 12,
    backgroundColor: '#1E293B',
    flex: 1,
    justifyContent: 'space-between',
  },
  compactTitle: {
    fontFamily: FONTS.primary,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 4,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  compactMetaText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#CBD5E1',
    flex: 1,
  },
  compactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  compactCostPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compactCostPillFree: {
    backgroundColor: '#064E3B',
  },
  compactCostPillPaid: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactCostPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  compactCostPillTextFree: {
    color: '#34D399',
  },
  compactCostPillTextPaid: {
    color: '#E2E8F0',
  },
  compactTimeAgoText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#94A3B8',
  },
});
