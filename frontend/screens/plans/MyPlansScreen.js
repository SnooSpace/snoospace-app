import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { getHostedPlans, getAttendingPlans } from '../../api/plans';
import SnooLoader from '../../components/ui/SnooLoader';
import HostPlanBottomSheet from './HostPlanBottomSheet';

const ACTIVITY_COLORS = {
  sports: { bg: '#EEF2FF', text: '#3B5BDB' },
  study:  { bg: '#E8F5E9', text: '#2E7D32' },
  food:   { bg: '#FFF8E1', text: '#B45309' },
  gaming: { bg: '#FCE4EC', text: '#C2185B' },
  other:  { bg: '#F5F5F5', text: '#555555' },
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
    : item.activity_type.charAt(0).toUpperCase() + item.activity_type.slice(1);
  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.active;

  return (
    <TouchableOpacity style={styles.planRow} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={styles.planRowLeft}>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: activityStyle.bg }]}>
            <Text style={[styles.pillText, { color: activityStyle.text }]}>{activityLabel}</Text>
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

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const token = await getAuthToken();
      const [hostedData, attendingData] = await Promise.all([
        getHostedPlans(token),
        getAttendingPlans(token),
      ]);
      setHostedPlans(hostedData.plans || []);
      setAttendingPlans(attendingData.plans || []);
    } catch (err) {
      console.error('[MyPlansScreen]', err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const currentData = activeTab === 'Hosted' ? hostedPlans : attendingPlans;

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
          renderItem={({ item }) =>
            activeTab === 'Hosted'
              ? <HostedPlanRow item={item} onPress={(p) => navigation.navigate('HostRequests', { planId: p.id, planTitle: p.title })} />
              : <AttendingPlanRow item={item} onPress={(p) => navigation.navigate('PlanDetail', { planId: p.id })} />
          }
          contentContainerStyle={styles.listContent}
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
});
