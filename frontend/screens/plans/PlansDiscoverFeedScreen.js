import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import { getPlans, likePlan, unlikePlan } from '../../api/plans';
import OpenPlanCard from '../../components/plans/OpenPlanCard';
import HostPlanBottomSheet from './HostPlanBottomSheet';
import RequestBottomSheet from './RequestBottomSheet';
import SnooLoader from '../../components/ui/SnooLoader';

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

  const loadPlans = useCallback(async (cursorVal = null, isRefresh = false) => {
    if (!isRefresh && !cursorVal && plans.length > 0) return;
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
  }, [plans.length]);

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

  const handleShare = useCallback(async (plan) => {
    try {
      await Share.share({
        message: `Check out this open plan "${plan?.title || 'Open Plan'}" on SnooSpace!`,
      });
    } catch (err) {
      console.error('[PlansDiscoverFeedScreen] Share error:', err.message);
    }
  }, []);

  const handleRequestSuccess = useCallback((planId) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, my_request_status: 'pending' } : p));
  }, []);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.cardWrapper}>
      <OpenPlanCard
        plan={item}
        currentUserId={currentUserId}
        onPress={(id) => navigation.navigate('PlanDetail', { planId: id })}
        onRequestPress={(id) => setRequestSheet({ planId: id, planTitle: item.title })}
        onLike={handleLike}
        onComment={(id) => navigation.navigate('PlanDetail', { planId: id, openComments: true })}
        onShare={() => handleShare(item)}
      />
    </View>
  ), [currentUserId, navigation, handleLike, handleShare]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Open Plans</Text>
          <TouchableOpacity
            style={styles.hostBtn}
            onPress={() => setHostSheetOpen(true)}
          >
            <Plus size={18} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
    </View>
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
  headerTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  hostBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 60 },
  cardWrapper: { marginBottom: 0 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary },
  emptyCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 12,
  },
  emptyCTAText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },
});
