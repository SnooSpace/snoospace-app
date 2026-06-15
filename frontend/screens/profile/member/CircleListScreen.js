import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Image, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Users, Bell, X, UserMinus, AlertTriangle, CheckCircle } from 'lucide-react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import { COLORS, FONTS, BORDER_RADIUS, SPACING } from '../../../constants/theme';
import { getCircleMembers, removeFromCircle, getIncomingCircleRequestCount } from '../../../api/members';
import CustomAlertModal from '../../../components/ui/CustomAlertModal';
import HapticsService from '../../../services/HapticsService';

// ─────────────────────────────────────────────────────────
// Single circle member row
// ─────────────────────────────────────────────────────────
const CircleMemberRow = React.memo(({ item, onPress, onRemove }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Reanimated.View entering={FadeInDown.duration(280)} style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={() => onPress(item)}
        style={styles.row}
      >
        <Image
          source={{ uri: item.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'M')}&background=448AFF&color=fff&size=80` }}
          style={styles.avatar}
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || 'Member'}</Text>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(item)}
          hitSlop={8}
        >
          <UserMinus size={18} color={COLORS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </Pressable>
    </Reanimated.View>
  );
});

// ─────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────
export default function CircleListScreen({ route, navigation }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const searchTimer = useRef(null);

  const showAlert = useCallback((config) => setAlertConfig({ ...config, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const fetchMembers = useCallback(async (pageNum = 1, searchQuery = '', reset = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const data = await getCircleMembers({ page: pageNum, limit: 20, search: searchQuery });
      const fetched = data?.members || [];
      setMembers((prev) => reset || pageNum === 1 ? fetched : [...prev, ...fetched]);
      setHasMore(fetched.length >= 20);
      setPage(pageNum);
    } catch (err) {
      console.error('[CircleListScreen] fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await getIncomingCircleRequestCount();
      setPendingCount(res?.count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchMembers(1, '', true);
    fetchPendingCount();
  }, []);

  const handleSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchMembers(1, text, true);
    }, 350);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchMembers(page + 1, search);
  };

  const handlePress = (item) => {
    navigation.navigate('MemberPublicProfile', { memberId: item.member_id });
  };

  const handleRemove = useCallback((item) => {
    HapticsService.triggerImpactLight();
    showAlert({
      title: 'Remove from Circle?',
      message: `${item.name || 'This person'} will be removed from your circle. They can still message you and find your profile.`,
      icon: UserMinus,
      iconColor: '#E53935',
      secondaryAction: { text: 'Cancel', onPress: hideAlert },
      primaryAction: {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          try {
            await removeFromCircle(item.member_id);
            setMembers((prev) => prev.filter((m) => m.member_id !== item.member_id));
            HapticsService.triggerImpactLight();
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to remove. Please try again.',
              icon: AlertTriangle,
              iconColor: '#E53935',
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          }
        },
      },
    });
  }, [showAlert, hideAlert]);

  const renderItem = useCallback(({ item }) => (
    <CircleMemberRow item={item} onPress={handlePress} onRemove={handleRemove} />
  ), [handlePress, handleRemove]);

  const keyExtractor = useCallback((item) => item.member_id, []);

  const ListEmptyComponent = !loading ? (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Users size={36} color={COLORS.textSecondary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>
        {search ? 'No results found' : 'Your circle is empty'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {search
          ? 'Try a different name or username.'
          : "When you connect with people, they\u2019ll appear here."}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Circle</Text>
        <TouchableOpacity
          style={styles.requestsBtn}
          onPress={() => navigation.navigate('CircleRequests')}
          hitSlop={8}
        >
          <Bell size={22} color={COLORS.textPrimary} strokeWidth={2} />
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={COLORS.textSecondary} strokeWidth={2} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your circle…"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={8}>
              <X size={16} color={COLORS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={COLORS.primary} /> : null}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
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
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary },
  requestsBtn: { width: 40, alignItems: 'flex-end', position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -4,
    backgroundColor: '#E53935', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: FONTS.semiBold, fontSize: 10, color: '#fff' },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: {
    flex: 1, fontFamily: FONTS.regular, fontSize: 15,
    color: COLORS.textPrimary, padding: 0,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB', marginRight: 12 },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  rowUsername: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(68,138,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
