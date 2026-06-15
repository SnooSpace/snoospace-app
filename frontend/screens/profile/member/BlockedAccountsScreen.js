import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldOff, UserX } from 'lucide-react-native';
import { apiGet, apiDelete } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import HapticsService from '../../../services/HapticsService';
import SnooLoader from '../../../components/ui/SnooLoader';
import DynamicStatusBar from '../../../components/DynamicStatusBar';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../../constants/theme';

export default function BlockedAccountsScreen({ navigation }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);
  const [error, setError] = useState(null);

  const loadBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      const result = await apiGet('/users/me/blocks', 15000, token);
      setBlockedUsers(result?.blocked_users || []);
    } catch (err) {
      console.error('[BlockedAccountsScreen] load error:', err);
      setError('Failed to load blocked accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = useCallback((user) => {
    HapticsService.triggerImpactLight();
    Alert.alert(
      `Unblock ${user.name}?`,
      'They will be able to find your profile and interact with you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              setUnblockingId(user.id);
              const token = await getAuthToken();
              await apiDelete(`/users/${user.id}/block`, null, 15000, token);
              setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));
              HapticsService.triggerNotificationSuccess();
            } catch (err) {
              console.error('[BlockedAccountsScreen] unblock error:', err);
              Alert.alert('Error', 'Could not unblock this user. Please try again.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  }, []);

  const renderItem = ({ item }) => {
    const isUnblocking = unblockingId === item.id;
    const avatarUrl =
      item.profile_photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'U')}&background=6A0DAD&color=FFFFFF&size=80&bold=true`;

    return (
      <View style={styles.row}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || 'Unknown User'}
          </Text>
          {item.blocked_at && (
            <Text style={styles.meta}>
              Blocked {new Date(item.blocked_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.unblockBtn, isUnblocking && styles.unblockBtnDisabled]}
          onPress={() => handleUnblock(item)}
          disabled={isUnblocking}
          activeOpacity={0.75}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.unblockText}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <ShieldOff size={32} color={COLORS.textSecondary} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>No blocked accounts</Text>
        <Text style={styles.emptySubtitle}>
          Accounts you block will appear here. You can unblock them at any time.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DynamicStatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Accounts</Text>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <UserX size={48} color={COLORS.textSecondary} strokeWidth={1.5} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadBlockedUsers}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              blockedUsers.length === 0 && styles.listContentEmpty,
            ]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFFFFF',
    minHeight: 56,
  },
  backBtn: {
    padding: 12,
  },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 48,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.pill,
  },
  retryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginVertical: 4,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: 14,
    gap: 12,
    ...SHADOWS.sm,
    shadowOpacity: 0.04,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  meta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  unblockBtn: {
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  unblockBtnDisabled: {
    opacity: 0.6,
  },
  unblockText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
