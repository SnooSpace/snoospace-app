import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { Clock, MapPin, Users, Heart, ChartNoAxesCombined, MessageCircle, Send, BadgeCheck } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

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
  null:      { label: 'Request to join',     bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
  pending:   { label: 'Requested · Pending', bg: '#F5F5F5', textColor: '#6B7280', disabled: true  },
  approved:  { label: "Approved — You're in!", bg: '#E8F5E9', textColor: '#2E7D32', disabled: true },
  declined:  { label: 'Request declined',    bg: '#F5F5F5', textColor: '#9E9E9E', disabled: true  },
  withdrawn: { label: 'Request to join',     bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n ?? 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

const OpenPlanCard = ({
  plan,
  currentUserId,
  onPress,
  onRequestPress,
  onLike,
  onComment,
  onShare,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(plan.like_count ?? 0);

  const handleLike = useCallback(async () => {
    const prev = { isLiked, likeCount };
    setIsLiked(v => !v);
    setLikeCount(v => isLiked ? v - 1 : v + 1);
    try {
      await onLike(plan.id, !isLiked);
    } catch {
      setIsLiked(prev.isLiked);
      setLikeCount(prev.likeCount);
    }
  }, [isLiked, likeCount, plan.id, onLike]);

  const isOwner = plan.created_by === currentUserId;
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

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.93} onPress={() => onPress(plan.id)}>
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
      <Text style={styles.title} numberOfLines={2}>{plan.title}</Text>

      {/* Host */}
      <View style={styles.hostRow}>
        <Text style={styles.hostedBy}>
          Hosted by{' '}
          <Text style={styles.hostName}>{plan.host_profile?.name || 'Someone'}</Text>
        </Text>
        {plan.host_profile?.is_verified && (
          <BadgeCheck size={14} color="#2962FF" strokeWidth={2} style={{ marginLeft: 4 }} />
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Time & location */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={13} color={COLORS.textSecondary} strokeWidth={2} />
          <Text style={styles.metaText}>{formatScheduled(plan.scheduled_at)}</Text>
        </View>
        {plan.location_public ? (
          <View style={[styles.metaItem, { marginLeft: 12 }]}>
            <MapPin size={13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>{plan.location_public}</Text>
          </View>
        ) : null}
      </View>

      {/* Acceptance bar */}
      <View style={styles.acceptanceRow}>
        <Text style={styles.acceptanceLabel}>
          <Text style={styles.acceptanceBold}>{plan.accepted_count ?? 0} / {plan.max_accepted}</Text> accepted
        </Text>
        {spotsLeft <= 2 && spotsLeft > 0 && (
          <View style={styles.spotsLeftPill}>
            <Text style={styles.spotsLeftText}>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</Text>
          </View>
        )}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Shared community */}
      {plan.shared_community_name ? (
        <View style={styles.sharedPill}>
          <Users size={12} color="#2962FF" strokeWidth={2} />
          <Text style={styles.sharedText}>
            Shared community: <Text style={{ color: '#2962FF' }}>{plan.shared_community_name}</Text>
          </Text>
        </View>
      ) : null}

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
        <Pressable onPress={() => onComment(plan.id)} style={styles.engItem}>
          <MessageCircle size={18} color="#6B7280" strokeWidth={2} />
          <Text style={styles.engCount}>{formatCount(plan.comment_count)}</Text>
        </Pressable>

        {/* View */}
        <View style={styles.engItem}>
          <ChartNoAxesCombined size={18} color="#6B7280" strokeWidth={2} />
          <Text style={styles.engCount}>{formatCount(plan.view_count)}</Text>
        </View>

        {/* Share */}
        <Pressable onPress={() => onShare(plan.id)} style={styles.engItem}>
          <Send size={18} color="#6B7280" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Request button or owner badge */}
      {isOwner ? (
        <View style={styles.ownerBadge}>
          <Text style={styles.ownerBadgeText}>Your plan</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.requestBtn, { backgroundColor: btnCfg.bg }, btnCfg.disabled && styles.requestBtnDisabled]}
          onPress={() => !btnCfg.disabled && onRequestPress(plan.id)}
          disabled={btnCfg.disabled}
          activeOpacity={btnCfg.disabled ? 1 : 0.85}
        >
          <Text style={[styles.requestBtnText, { color: btnCfg.textColor }]}>{btnCfg.label}</Text>
        </TouchableOpacity>
      )}

      {/* Fine print */}
      <Text style={styles.finePrint}>Exact location shared only after host approves</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.md,
  },
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
  title: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    lineHeight: 23,
    marginBottom: 6,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostedBy: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  hostName: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
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
  spotsLeftPill: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  spotsLeftText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
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
  requestBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  requestBtnDisabled: {
    opacity: 0.85,
  },
  requestBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  ownerBadge: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2962FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ownerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#2962FF',
  },
  finePrint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default OpenPlanCard;
