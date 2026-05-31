import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserX } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { getBlockedUsers, unblockUser } from '../../api/plans';
import SnooLoader from '../../components/ui/SnooLoader';

function BlockedUserRow({ item, onUnblock }) {
  const [unblocking, setUnblocking] = useState(false);

  const handleUnblock = async () => {
    Alert.alert(
      `Unblock ${item.name}?`,
      'They will be able to see your plans and profile again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(true);
            try { await onUnblock(item.id); } finally { setUnblocking(false); }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        {item.blocked_at && (
          <Text style={styles.rowMeta}>
            Blocked on {new Date(item.blocked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.unblockBtn, unblocking && { opacity: 0.5 }]}
        onPress={handleUnblock}
        disabled={unblocking}
      >
        {unblocking
          ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
          : <Text style={styles.unblockText}>Unblock</Text>}
      </TouchableOpacity>
    </View>
  );
}

export default function BlockedUsersScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBlocks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const token = await getAuthToken();
      const data = await getBlockedUsers(token);
      setBlockedUsers(data.blocked_users || []);
    } catch (err) {
      console.error('[BlockedUsersScreen]', err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const handleUnblock = useCallback(async (userId) => {
    try {
      const token = await getAuthToken();
      await unblockUser(userId, token);
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not unblock user');
    }
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked users</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <BlockedUserRow item={item} onUnblock={handleUnblock} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadBlocks(true)} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <UserX size={40} color={COLORS.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
            </View>
          }
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
  headerTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { fontFamily: FONTS.primary, fontSize: 18, color: COLORS.primary },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  rowMeta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border,
  },
  unblockText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.textSecondary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.textSecondary },
});
