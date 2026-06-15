import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserCheck, UserX, X, Users, AlertTriangle } from 'lucide-react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, FONTS } from '../../../constants/theme';
import {
  getIncomingCircleRequests,
  getOutgoingCircleRequests,
  respondToCircleRequest,
  cancelCircleRequest,
} from '../../../api/members';
import HapticsService from '../../../services/HapticsService';
import CustomAlertModal from '../../../components/ui/CustomAlertModal';

// ─────────────────────────────────────────────────────────
// Incoming request row — Accept / Decline inline
// ─────────────────────────────────────────────────────────
const IncomingRow = React.memo(({ item, onAccept, onDecline, onPress }) => (
  <Reanimated.View entering={FadeInDown.duration(260)} style={styles.row}>
    <Pressable onPress={() => onPress(item)} style={styles.rowLeft}>
      <Image
        source={{ uri: item.sender_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.sender_name || 'M')}&background=448AFF&color=fff&size=80` }}
        style={styles.avatar}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.sender_name || 'Member'}</Text>
        {item.sender_username ? (
          <Text style={styles.rowUsername} numberOfLines={1}>@{item.sender_username}</Text>
        ) : null}
      </View>
    </Pressable>
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(item)} hitSlop={4}>
        <UserCheck size={15} color="#fff" strokeWidth={2.5} />
        <Text style={styles.acceptBtnText}>Accept</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline(item)} hitSlop={4}>
        <UserX size={15} color={COLORS.textSecondary} strokeWidth={2.5} />
        <Text style={styles.declineBtnText}>Decline</Text>
      </TouchableOpacity>
    </View>
  </Reanimated.View>
));

// ─────────────────────────────────────────────────────────
// Outgoing (sent) request row — Cancel inline
// ─────────────────────────────────────────────────────────
const OutgoingRow = React.memo(({ item, onCancel, onPress }) => (
  <Reanimated.View entering={FadeInDown.duration(260)} style={styles.row}>
    <Pressable onPress={() => onPress(item)} style={styles.rowLeft}>
      <Image
        source={{ uri: item.receiver_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.receiver_name || 'M')}&background=448AFF&color=fff&size=80` }}
        style={styles.avatar}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.receiver_name || 'Member'}</Text>
        {item.receiver_username ? (
          <Text style={styles.rowUsername} numberOfLines={1}>@{item.receiver_username}</Text>
        ) : null}
        <Text style={styles.pendingTag}>Pending</Text>
      </View>
    </Pressable>
    <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(item)} hitSlop={4}>
      <X size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
      <Text style={styles.cancelBtnText}>Cancel</Text>
    </TouchableOpacity>
  </Reanimated.View>
));

// ─────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────
const EmptyState = ({ label }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconBox}>
      <Users size={32} color={COLORS.textSecondary} strokeWidth={1.5} />
    </View>
    <Text style={styles.emptyText}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────
export default function CircleRequestsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('received');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(true);
  const [loadingOutgoing, setLoadingOutgoing] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const showAlert = useCallback((config) => setAlertConfig({ ...config, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const loadIncoming = useCallback(async () => {
    try {
      setLoadingIncoming(true);
      const data = await getIncomingCircleRequests({ page: 1, limit: 50 });
      setIncoming(data?.requests || []);
    } catch (_) {} finally { setLoadingIncoming(false); }
  }, []);

  const loadOutgoing = useCallback(async () => {
    try {
      setLoadingOutgoing(true);
      const data = await getOutgoingCircleRequests({ page: 1, limit: 50 });
      setOutgoing(data?.requests || []);
    } catch (_) {} finally { setLoadingOutgoing(false); }
  }, []);

  useEffect(() => {
    loadIncoming();
    loadOutgoing();
  }, []);

  const handleAccept = useCallback(async (item) => {
    HapticsService.triggerImpactMedium();
    setActionLoading((p) => ({ ...p, [item.id]: true }));
    try {
      await respondToCircleRequest(item.id, 'accepted');
      setIncoming((prev) => prev.filter((r) => r.id !== item.id));
    } catch (err) {
      showAlert({
        title: 'Error', message: err?.message || 'Failed to accept. Try again.',
        icon: AlertTriangle, iconColor: '#E53935',
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally { setActionLoading((p) => ({ ...p, [item.id]: false })); }
  }, [showAlert, hideAlert]);

  const handleDecline = useCallback(async (item) => {
    HapticsService.triggerImpactLight();
    setActionLoading((p) => ({ ...p, [item.id]: true }));
    try {
      await respondToCircleRequest(item.id, 'declined');
      setIncoming((prev) => prev.filter((r) => r.id !== item.id));
    } catch (err) {
      showAlert({
        title: 'Error', message: err?.message || 'Failed to decline. Try again.',
        icon: AlertTriangle, iconColor: '#E53935',
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally { setActionLoading((p) => ({ ...p, [item.id]: false })); }
  }, [showAlert, hideAlert]);

  const handleCancel = useCallback((item) => {
    HapticsService.triggerImpactLight();
    showAlert({
      title: 'Cancel Request?',
      message: `Cancel your circle request to ${item.receiver_name || 'this user'}?`,
      icon: X, iconColor: '#E53935',
      secondaryAction: { text: 'Keep', onPress: hideAlert },
      primaryAction: {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setActionLoading((p) => ({ ...p, [item.id]: true }));
          try {
            await cancelCircleRequest(item.id);
            setOutgoing((prev) => prev.filter((r) => r.id !== item.id));
          } catch (err) {
            showAlert({
              title: 'Error', message: err?.message || 'Failed to cancel.',
              icon: AlertTriangle, iconColor: '#E53935',
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          } finally { setActionLoading((p) => ({ ...p, [item.id]: false })); }
        },
      },
    });
  }, [showAlert, hideAlert]);

  const handlePressIncoming = (item) => {
    navigation.navigate('MemberPublicProfile', { memberId: item.sender_id });
  };
  const handlePressOutgoing = (item) => {
    navigation.navigate('MemberPublicProfile', { memberId: item.receiver_id });
  };

  const renderIncoming = useCallback(({ item }) => (
    <IncomingRow
      item={item}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onPress={handlePressIncoming}
    />
  ), [handleAccept, handleDecline]);

  const renderOutgoing = useCallback(({ item }) => (
    <OutgoingRow item={item} onCancel={handleCancel} onPress={handlePressOutgoing} />
  ), [handleCancel]);

  const isLoading = activeTab === 'received' ? loadingIncoming : loadingOutgoing;
  const data = activeTab === 'received' ? incoming : outgoing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circle Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {['received', 'sent'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'received' ? `Received${incoming.length > 0 ? ` (${incoming.length})` : ''}` : 'Sent'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={activeTab === 'received' ? renderIncoming : renderOutgoing}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState label={
              activeTab === 'received'
                ? 'No pending requests'
                : 'No sent requests'
            } />
          }
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.07)' },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontFamily: FONTS.semiBold },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB', marginRight: 12 },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  rowUsername: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  pendingTag: { fontFamily: FONTS.medium, fontSize: 11, color: '#FF9500', marginTop: 3 },
  // Accept / Decline
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  acceptBtnText: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#fff' },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  declineBtnText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textSecondary },
  // Cancel
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F2F2F7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  cancelBtnText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textSecondary },
  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(68,138,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyText: { fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
});
