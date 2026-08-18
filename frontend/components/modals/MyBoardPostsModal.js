/**
 * MyBoardPostsModal.js
 *
 * Full-height / bottom sheet modal displaying the caller's own posted openings
 * from GET /board-posts/mine with pending, accepted, and declined applicant counts.
 *
 * Features:
 *   - List of own posts with status badge and count chips
 *   - Tapping a row calls onSelectPost(post) to view its applicant list
 *   - "Close" action on open posts with confirmation dialog (auto-declines pending applicants)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Users,
  Clock,
  Check,
  X,
  Lock,
  ChevronRight,
  Plus,
  TriangleAlert,
  Handshake,
} from 'lucide-react-native';
import SwipeableModal from './SwipeableModal';
import CustomAlertModal from '../ui/CustomAlertModal';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { getMyBoardPosts, closeBoardPost, COLLAB_TYPES } from '../../api/collabRequests';
import HapticsService from '../../services/HapticsService';
import EventBus from '../../utils/EventBus';

const { height: screenHeight } = Dimensions.get('window');

const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.09)';
const TEAL_BORDER = 'rgba(13, 148, 136, 0.25)';

function collabTypeLabel(value) {
  return COLLAB_TYPES.find((c) => c.value === value)?.label ?? value;
}

const POST_STATUS_STYLES = {
  open:    { bg: '#ECFDF5', text: '#065F46', label: 'Open' },
  filled:  { bg: '#FEF3C7', text: '#D97706', label: 'Filled' },
  closed:  { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' },
  expired: { bg: '#FFF7ED', text: '#92400E', label: 'Expired' },
};

export default function MyBoardPostsModal({
  visible,
  onClose,
  onSelectPost,
  onCreateNewPress,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingPostId, setClosingPostId] = useState(null);
  const [alertConfig, setAlertConfig] = useState({ visible: false });

  const loadPosts = useCallback(async () => {
    try {
      const res = await getMyBoardPosts();
      setPosts(res?.posts || []);
    } catch (err) {
      console.warn('[MyBoardPostsModal] loadPosts error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadPosts();
    }
  }, [visible, loadPosts]);

  const showAlert = useCallback((cfg) => {
    setAlertConfig({ ...cfg, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleClosePost = useCallback((post) => {
    HapticsService.triggerImpactMedium();
    showAlert({
      title: 'Close this opening?',
      message: `Closing "${post.title}" will stop new join requests and automatically decline any remaining pending applicants.`,
      icon: TriangleAlert,
      iconColor: '#DC2626',
      primaryAction: {
        text: 'Close Opening',
        style: 'destructive',
        onPress: async () => {
          hideAlert();
          setClosingPostId(post.id);
          try {
            await closeBoardPost(post.id);
            HapticsService.triggerImpactLight();
            setPosts((prev) =>
              prev.map((p) => (p.id === post.id ? { ...p, status: 'closed' } : p)),
            );
            EventBus.emit('board-posts:refresh');
          } catch (err) {
            showAlert({
              title: 'Error',
              message: err?.message || 'Failed to close post. Please try again.',
              icon: TriangleAlert,
              iconColor: COLORS.error,
              primaryAction: { text: 'OK', onPress: hideAlert },
            });
          } finally {
            setClosingPostId(null);
          }
        },
      },
      secondaryAction: { text: 'Keep Open', onPress: hideAlert },
    });
  }, [showAlert, hideAlert]);

  const renderPostItem = ({ item }) => {
    const statusStyle = POST_STATUS_STYLES[item.status] || POST_STATUS_STYLES.closed;
    const pendingCount  = item.pending_count  || 0;
    const acceptedCount = item.accepted_count || 0;
    const declinedCount = item.declined_count || 0;
    const isClosing = closingPostId === item.id;

    return (
      <View style={styles.postCard}>
        {/* ── Top row: status + collab type + date ── */}
        <View style={styles.cardTopRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
          <Text style={styles.cardType}>{collabTypeLabel(item.collab_type)}</Text>
          <Text style={styles.cardSpots}>
            {item.spots_filled || 0}/{item.spots_total} spots
          </Text>
        </View>

        {/* ── Title ── */}
        <TouchableOpacity
          onPress={() => {
            onClose();
            onSelectPost?.(item);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.postTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </TouchableOpacity>

        {/* ── Applicant counts row ── */}
        <TouchableOpacity
          style={styles.countsRow}
          onPress={() => {
            onClose();
            onSelectPost?.(item);
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.countChip, pendingCount > 0 && styles.countChipPendingActive]}>
            <Clock size={12} color={pendingCount > 0 ? '#D97706' : COLORS.textMuted} strokeWidth={2.2} />
            <Text style={[styles.countChipText, pendingCount > 0 && { color: '#D97706', fontFamily: FONTS.semiBold }]}>
              {pendingCount} pending
            </Text>
          </View>

          <View style={styles.countChip}>
            <Check size={12} color="#059669" strokeWidth={2.2} />
            <Text style={[styles.countChipText, { color: '#059669' }]}>
              {acceptedCount} accepted
            </Text>
          </View>

          <View style={styles.countChip}>
            <X size={12} color="#9CA3AF" strokeWidth={2.2} />
            <Text style={[styles.countChipText, { color: '#6B7280' }]}>
              {declinedCount} declined
            </Text>
          </View>

          <View style={{ flex: 1 }} />
          <ChevronRight size={16} color={COLORS.textMuted} strokeWidth={2} />
        </TouchableOpacity>

        {/* ── Card footer: View Applicants & Close button ── */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.viewApplicantsBtn}
            onPress={() => {
              onClose();
              onSelectPost?.(item);
            }}
            activeOpacity={0.8}
          >
            <Users size={14} color={TEAL} strokeWidth={2.2} />
            <Text style={styles.viewApplicantsText}>View Applicants</Text>
          </TouchableOpacity>

          {item.status === 'open' && (
            <TouchableOpacity
              style={[styles.closeBtn, isClosing && { opacity: 0.5 }]}
              disabled={isClosing}
              onPress={() => handleClosePost(item)}
              activeOpacity={0.8}
            >
              <Lock size={13} color="#DC2626" strokeWidth={2} />
              <Text style={styles.closeBtnText}>
                {isClosing ? 'Closing…' : 'Close'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const headerContent = (
    <View style={styles.handle}>
      <View style={styles.pill} />
    </View>
  );

  return (
    <>
      <SwipeableModal
        visible={visible}
        onClose={onClose}
        header={headerContent}
        sheetStyle={styles.sheet}
        springConfig={{ damping: 24, stiffness: 200, mass: 1 }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Users size={20} color={TEAL} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.headerTitle}>My Openings</Text>
                <Text style={styles.headerSubtitle}>Manage applicants for your board posts</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.newPostHeaderBtn}
              onPress={() => {
                onClose();
                onCreateNewPress?.();
              }}
              activeOpacity={0.8}
            >
              <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.newPostHeaderText}>New</Text>
            </TouchableOpacity>
          </View>

          {/* List content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={TEAL} size="large" />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Handshake size={32} color={COLORS.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No openings posted yet</Text>
              <Text style={styles.emptySubtitle}>
                Create an opening on the Board to receive collab pitches from creators and communities.
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                onPress={() => {
                  onClose();
                  onCreateNewPress?.();
                }}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.emptyCreateBtnText}>Post an Opening</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SwipeableModal.FlatList
              data={posts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderPostItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadPosts();
                  }}
                  tintColor={TEAL}
                  colors={[TEAL]}
                />
              }
            />
          )}
        </View>
      </SwipeableModal>

      {/* Confirmation / Error alert */}
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
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: screenHeight * 0.88,
    minHeight: screenHeight * 0.6,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TEAL_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: '#111827',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  newPostHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  newPostHeaderText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TEAL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.pill,
  },
  emptyCreateBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  cardType: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardSpots: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 'auto',
  },
  postTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 20,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countChipPendingActive: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: 10,
  },
  viewApplicantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  viewApplicantsText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: TEAL,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  closeBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#DC2626',
  },
});
