import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { getRequests, updateRequest } from '../../api/plans';
import HostRequestReviewCard from '../../components/plans/HostRequestReviewCard';
import SnooLoader from '../../components/ui/SnooLoader';

export default function HostRequestsScreen({ navigation, route }) {
  const { planId, planTitle } = route.params;
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const token = await getAuthToken();
      const [pendingData, approvedData] = await Promise.all([
        getRequests(planId, 'pending', token),
        getRequests(planId, 'approved', token),
      ]);
      setPendingRequests(pendingData.requests || []);
      setApprovedRequests(approvedData.requests || []);
      setPendingCount((pendingData.requests || []).length);
    } catch (err) {
      console.error('[HostRequestsScreen]', err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [planId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = useCallback(async (reqId) => {
    try {
      const token = await getAuthToken();
      const data = await updateRequest(planId, reqId, 'approved', token);
      // Move from pending to approved
      const approved = pendingRequests.find(r => r.id === reqId);
      if (approved) {
        setPendingRequests(prev => prev.filter(r => r.id !== reqId));
        // Store conversation_id so the approved card can offer "Open DM"
        setApprovedRequests(prev => [
          { ...approved, status: 'approved', conversation_id: data.conversation_id },
          ...prev,
        ]);
        setPendingCount(v => Math.max(0, v - 1));
      }
      if (data.conversation_id) {
        navigation.navigate('Chat', { conversationId: data.conversation_id });
      }
    } catch (err) {
      if (err.status === 400 && err.data?.error === 'plan_at_capacity') {
        Alert.alert('Plan full', 'This plan has reached its acceptance limit.');
      } else {
        Alert.alert('Error', err.message || 'Could not approve request');
      }
    }
  }, [planId, pendingRequests, navigation]);

  const handleDecline = useCallback(async (reqId) => {
    try {
      const token = await getAuthToken();
      await updateRequest(planId, reqId, 'declined', token);
      setPendingRequests(prev => prev.filter(r => r.id !== reqId));
      setPendingCount(v => Math.max(0, v - 1));
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not decline request');
    }
  }, [planId]);

  const handleOpenDm = useCallback((conversationId) => {
    if (conversationId) {
      navigation.navigate('Chat', { conversationId });
    }
  }, [navigation]);

  const currentRequests = activeTab === 'pending' ? pendingRequests : approvedRequests;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Manage Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{planTitle}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'pending', label: `Pending (${pendingCount})` },
          { key: 'approved', label: `Approved (${approvedRequests.length})` },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <SnooLoader size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={currentRequests}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <HostRequestReviewCard
                request={item}
                onApprove={activeTab === 'pending' ? handleApprove : null}
                onDecline={activeTab === 'pending' ? handleDecline : null}
                onOpenDm={activeTab === 'approved' ? handleOpenDm : null}
                onViewProfile={(uid) => navigation.navigate('MemberPublicProfile', { memberId: uid })}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={COLORS.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {activeTab === 'pending' ? 'No pending requests yet.' : 'No approved attendees yet.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: 1,
  },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.semiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 60 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textSecondary },
});
