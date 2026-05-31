import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Share, Image, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, BadgeCheck, MapPin, Clock, Users, Lock,
  Heart, MessageCircle, ChartNoAxesCombined, Send,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import {
  getPlanById, recordView, likePlan, unlikePlan,
} from '../../api/plans';
import RequestBottomSheet from './RequestBottomSheet';
import CommentsModal from '../../components/CommentsModal';
import SnooLoader from '../../components/ui/SnooLoader';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_COLORS = {
  sports: { bg: '#EEF2FF', text: '#3B5BDB' },
  study:  { bg: '#E8F5E9', text: '#2E7D32' },
  food:   { bg: '#FFF8E1', text: '#B45309' },
  gaming: { bg: '#FCE4EC', text: '#C2185B' },
  other:  { bg: '#F5F5F5', text: '#555555' },
};

const COST_LABELS = {
  free:      { label: 'Free',     bg: '#E8F5E9', text: '#2E7D32' },
  self_pay:  { label: 'Self-pay', bg: '#E8F5E9', text: '#2E7D32' },
  split:     { label: 'We split', bg: '#EEF2FF', text: '#3B5BDB' },
  entry_fee: { label: null,       bg: '#FFF8E1', text: '#B45309' },
};

const REQUEST_BUTTON = {
  null:      { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
  pending:   { label: 'Requested · Pending',   bg: '#F5F5F5', textColor: '#6B7280', disabled: true  },
  approved:  { label: "Approved — You're in!", bg: '#E8F5E9', textColor: '#2E7D32', disabled: true  },
  declined:  { label: 'Request declined',      bg: '#F5F5F5', textColor: '#9E9E9E', disabled: true  },
  withdrawn: { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n ?? 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanDetailScreen({ navigation, route }) {
  const { planId, openComments } = route.params;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(openComments || false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      const [token, account] = await Promise.all([
        getAuthToken(),
        getActiveAccount(),
      ]);
      if (account?.id) setCurrentUserId(account.id);
      const data = await getPlanById(planId, token);
      setPlan(data.plan);
      setLikeCount(data.plan.like_count ?? 0);
      setIsLiked(data.plan.is_liked === true);
      recordView(planId, token).catch(() => {});
    } catch (err) {
      console.error('[PlanDetailScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlan();
    const unsubscribe = navigation.addListener('focus', () => {
      loadPlan();
    });
    return unsubscribe;
  }, [loadPlan, navigation]);

  const handleLike = useCallback(async () => {
    const prev = { isLiked, likeCount };
    setIsLiked(v => !v);
    setLikeCount(v => isLiked ? v - 1 : v + 1);
    try {
      const token = await getAuthToken();
      if (isLiked) await unlikePlan(planId, token);
      else await likePlan(planId, token);
    } catch {
      setIsLiked(prev.isLiked);
      setLikeCount(prev.likeCount);
    }
  }, [isLiked, likeCount, planId]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this open plan "${plan?.title || 'Open Plan'}" on SnooSpace!`,
      });
    } catch (err) {
      console.error('[PlanDetailScreen] Share error:', err.message);
    }
  }, [plan?.title]);

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SnooLoader size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Plan not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const isOwner = plan.created_by === currentUserId;
  const isApproved = plan.my_request_status === 'approved';
  const showPrivateLocation = isOwner || isApproved;

  const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const activityLabel = plan.activity_type === 'other'
    ? (plan.custom_activity_label || 'Other')
    : plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1);

  const costCfg = COST_LABELS[plan.cost_type] || COST_LABELS.free;
  const costLabel = plan.cost_type === 'entry_fee'
    ? (plan.cost_amount_paise ? `₹${plan.cost_amount_paise / 100} entry` : 'Entry fee')
    : costCfg.label;

  const reqStatus = plan.my_request_status;
  const btnCfg = REQUEST_BUTTON[reqStatus] || REQUEST_BUTTON['null'];

  const spotsLeft = plan.max_accepted - (plan.accepted_count ?? 0);
  const progress = Math.min(1, (plan.accepted_count ?? 0) / (plan.max_accepted || 1));

  const genderPref = plan.gender_preference;
  const showGenderBadge = genderPref && genderPref !== 'all';
  const genderBadgeStyle = genderPref === 'Female'
    ? { bg: '#FCE4EC', text: '#C2185B', label: 'Women only' }
    : { bg: '#E3F2FD', text: '#1565C0', label: 'Men only' };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Open Plans</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View style={styles.card}>

            {/* Top row: activity tag + gender + cost */}
            <View style={styles.topRow}>
              <View style={styles.topRowLeft}>
                <View style={[styles.pill, { backgroundColor: activityStyle.bg }]}>
                  <Text style={[styles.pillText, { color: activityStyle.text }]}>{activityLabel}</Text>
                </View>
                {showGenderBadge && (
                  <View style={[styles.pill, { backgroundColor: genderBadgeStyle.bg, marginLeft: 6 }]}>
                    <Text style={[styles.pillText, { color: genderBadgeStyle.text }]}>{genderBadgeStyle.label}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.pill, { backgroundColor: costCfg.bg }]}>
                <Text style={[styles.pillText, { color: costCfg.text }]}>{costLabel}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{plan.title}</Text>

            {/* Host row — inline with avatar */}
            <View style={styles.hostRow}>
              {plan.host_profile?.profile_photo_url ? (
                <Image
                  source={{ uri: plan.host_profile.profile_photo_url }}
                  style={styles.hostAvatar}
                />
              ) : (
                <View style={styles.hostAvatarFallback}>
                  <Text style={styles.hostInitial}>
                    {(plan.host_profile?.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.hostedByText}>
                Hosted by{' '}
                <Text style={styles.hostNameBold}>{plan.host_profile?.name || 'Someone'}</Text>
              </Text>
              {plan.host_profile?.is_verified && (
                <BadgeCheck size={14} color="#2962FF" strokeWidth={2} style={{ marginLeft: 4 }} />
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Time & location — inline */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={13} color={COLORS.textSecondary} strokeWidth={2} />
                <Text style={styles.metaText}>{formatScheduled(plan.scheduled_at)}</Text>
              </View>
              {plan.location_public ? (
                <View style={[styles.metaItem, { marginLeft: 14 }]}>
                  <MapPin size={13} color={COLORS.textSecondary} strokeWidth={2} />
                  <Text style={styles.metaText} numberOfLines={1}>{plan.location_public}</Text>
                </View>
              ) : null}
            </View>

            {/* Private location */}
            {showPrivateLocation && plan.location_private ? (
              <View style={styles.privateLocationBox}>
                <Lock size={13} color="#2962FF" strokeWidth={2} />
                <Text style={styles.privateLocationText}>{plan.location_private}</Text>
              </View>
            ) : null}

            {/* Acceptance bar */}
            <View style={styles.acceptanceRow}>
              <Text style={styles.acceptanceLabel}>
                <Text style={styles.acceptanceBold}>{plan.accepted_count ?? 0} / {plan.max_accepted}</Text> accepted
              </Text>
              {isOwner && plan.pending_count > 0 && (
                <Text style={styles.pendingText}>{plan.pending_count} pending</Text>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            {/* Shared community pill */}
            {!isOwner && plan.shared_communities?.length > 0 && (
              <View style={styles.sharedPill}>
                <Users size={12} color="#2962FF" strokeWidth={2} />
                <Text style={styles.sharedText}>
                  Shared community:{' '}
                  <Text style={{ color: '#2962FF' }}>
                    {plan.shared_communities.map(c => c.name).join(', ')}
                  </Text>
                </Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Engagement row */}
            <View style={styles.engagementRow}>
              {/* Like */}
              <Pressable onPress={handleLike} style={styles.engItem}>
                <Heart
                  size={18}
                  color={isLiked ? '#E53E3E' : '#6B7280'}
                  fill={isLiked ? '#E53E3E' : 'transparent'}
                  strokeWidth={2}
                />
                <Text style={[styles.engCount, isLiked && styles.likedCount]}>
                  {formatCount(likeCount)}
                </Text>
              </Pressable>

              {/* Comment */}
              <Pressable onPress={() => setCommentsModalVisible(true)} style={styles.engItem}>
                <MessageCircle size={18} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.comment_count)}</Text>
              </Pressable>

              {/* Views */}
              <View style={styles.engItem}>
                <ChartNoAxesCombined size={18} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.view_count)}</Text>
              </View>

              {/* Share */}
              <Pressable onPress={handleShare} style={styles.engItem}>
                <Send size={18} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Host: manage requests button */}
            {isOwner && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => navigation.navigate('HostRequests', { planId: plan.id, planTitle: plan.title })}
              >
                <Users size={16} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.manageBtnText}>Manage requests</Text>
                {plan.pending_count > 0 && (
                  <View style={styles.manageBadge}>
                    <Text style={styles.manageBadgeText}>{plan.pending_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Request to join button — non-hosts only */}
            {!isOwner && (
              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: btnCfg.bg }, btnCfg.disabled && { opacity: 0.85 }]}
                onPress={() => !btnCfg.disabled && setRequestSheetOpen(true)}
                disabled={btnCfg.disabled}
                activeOpacity={btnCfg.disabled ? 1 : 0.85}
              >
                <Text style={[styles.requestBtnText, { color: btnCfg.textColor }]}>{btnCfg.label}</Text>
              </TouchableOpacity>
            )}

            {/* Fine print */}
            {!isOwner && (
              <Text style={styles.finePrint}>Exact location shared only after host approves</Text>
            )}

          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <RequestBottomSheet
        isVisible={requestSheetOpen}
        planId={plan.id}
        planTitle={plan.title}
        onClose={() => setRequestSheetOpen(false)}
        onRequested={() => {
          setPlan(p => ({ ...p, my_request_status: 'pending' }));
          setRequestSheetOpen(false);
        }}
      />

      <CommentsModal
        visible={commentsModalVisible}
        postId={plan.id}
        onClose={() => setCommentsModalVisible(false)}
        baseRoute="/plans"
        replyBaseRoute="/comments"
        navigation={navigation}
        onCommentCountChange={(newCount) => {
          setPlan(p => ({ ...p, comment_count: newCount }));
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  errorText: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Card — matches OpenPlanCard exactly
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    ...SHADOWS.md,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },

  // Title
  title: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    lineHeight: 23,
    marginBottom: 8,
  },

  // Host row — inline style matching image 1
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    overflow: 'hidden',
  },
  hostAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  hostInitial: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#2962FF',
  },
  hostedByText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  hostNameBold: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  // Meta row — time + location inline
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Private location
  privateLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  privateLocationText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2962FF',
  },

  // Acceptance
  acceptanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  acceptanceLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  acceptanceBold: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  pendingText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#E65100',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2962FF',
    borderRadius: 3,
  },

  // Shared community pill
  sharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sharedText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Engagement row
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  engItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
  },
  engCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  likedCount: {
    color: '#E53E3E',
  },

  // Manage button (host)
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  manageBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#FFF', flex: 1 },
  manageBadge: {
    backgroundColor: '#FFF',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBadgeText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.primary },

  // Request button
  requestBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  requestBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },

  // Fine print
  finePrint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
