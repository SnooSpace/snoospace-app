/**
 * CollabRequestCard.js
 *
 * Renders a single collab request card for both Received and Sent tabs.
 * Consumed by CollabRequestsScreen.
 *
 * Design system:
 *   - FONTS.primary    (BasicCommercial-Bold)  → counterpart name only (one per card)
 *   - FONTS.semiBold   (Manrope-SemiBold)       → buttons, badges
 *   - FONTS.medium     (Manrope-Medium)          → metadata, counts
 *   - FONTS.regular    (Manrope-Regular)         → pitch preview, helper text
 *   - All icons from lucide-react-native only
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import {
  Handshake, Clock, Star, ChevronRight, Check, X, Minus,
  RefreshCw, CalendarCheck, Shuffle, Mic2, Sparkles,
} from 'lucide-react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, FONTS } from '../../constants/theme';
import { COLLAB_TYPES, DECLINE_REASONS } from '../../api/collabRequests';

const { width } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map raw type string → display label. Never surfaces raw 'member'. */
function entityTypeLabel(type) {
  if (type === 'community') return 'Community';
  if (type === 'member') return 'Creator';
  return '';
}

/** Map collab_type value → human label (from shared constant). */
function collabTypeLabel(value) {
  return COLLAB_TYPES.find((c) => c.value === value)?.label ?? value;
}

/** Map collab_type value → lucide icon component (20px, strokeWidth 1.8). */
function CollabTypeIcon({ value, size = 14, color }) {
  const props = { size, color, strokeWidth: 1.8 };
  switch (value) {
    case 'event_partnership': return <CalendarCheck {...props} />;
    case 'cross_promo':       return <RefreshCw {...props} />;
    case 'guest_collab':      return <Mic2 {...props} />;
    case 'custom':            return <Sparkles {...props} />;
    default:                  return <Handshake {...props} />;
  }
}

/**
 * Reputation row.
 * Response-time and rating are independently gated signals.
 */
function ReputationRow({ reputation }) {
  if (!reputation) return null;

  const {
    avg_response_hours,
    responses_counted,
    avg_rating,
    rating_count,
  } = reputation;

  // Response-time signal — hidden until ≥ 2 data points
  let responseText = null;
  if (responses_counted < 2) {
    responseText = 'New to requests';
  } else if (avg_response_hours != null) {
    const h = avg_response_hours;
    if (h < 1) responseText = 'Responds quickly';
    else if (h < 24) responseText = `Responds in ~${Math.round(h)}h`;
    else responseText = `Responds in ~${Math.round(h / 24)}d`;
  }

  // Rating signal — shown regardless of response-time readiness
  let ratingNode = null;
  if (rating_count === 0) {
    ratingNode = (
      <Text style={styles.reputationMuted}>No reviews yet</Text>
    );
  } else if (rating_count <= 3) {
    // count leads, rating trails (small)
    ratingNode = (
      <View style={styles.repRow}>
        <Text style={styles.reputationCount}>{rating_count} {rating_count === 1 ? 'review' : 'reviews'}</Text>
        <Star size={11} color="#F59E0B" strokeWidth={2} fill="#F59E0B" />
        <Text style={styles.reputationRatingSmall}>{avg_rating?.toFixed(1)}</Text>
      </View>
    );
  } else {
    // rating leads, count trails (muted)
    ratingNode = (
      <View style={styles.repRow}>
        <Star size={12} color="#F59E0B" strokeWidth={2} fill="#F59E0B" />
        <Text style={styles.reputationRatingBold}>{avg_rating?.toFixed(1)}</Text>
        <Text style={styles.reputationCountMuted}>({rating_count})</Text>
      </View>
    );
  }

  return (
    <View style={styles.reputationContainer}>
      {responseText ? (
        <View style={styles.repRow}>
          <Clock size={11} color={COLORS.textMuted} strokeWidth={1.8} />
          <Text style={styles.reputationMuted}>{responseText}</Text>
        </View>
      ) : null}
      {ratingNode}
    </View>
  );
}

/** Collab type pill/chip */
function CollabTypePill({ value }) {
  return (
    <View style={styles.pill}>
      <CollabTypeIcon value={value} size={11} color={COLORS.primary} />
      <Text style={styles.pillText}>{collabTypeLabel(value)}</Text>
    </View>
  );
}

/** Status pill for terminal states */
const STATUS_PILL_STYLES = {
  accepted:  { bg: '#ECFDF5', text: '#065F46' },
  declined:  { bg: '#FEF2F2', text: '#991B1B' },
  withdrawn: { bg: '#F3F4F6', text: '#374151' },
  expired:   { bg: '#FFF7ED', text: '#92400E' },
};

function StatusPill({ status }) {
  const s = STATUS_PILL_STYLES[status];
  if (!s) return null;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.text }]}>{label}</Text>
    </View>
  );
}

/** Decline reason picker — renders inline chips */
function DeclineReasonPicker({ onSelect, onCancel, loading }) {
  const [selected, setSelected] = useState(null);
  return (
    <View style={styles.declinePickerBox}>
      <Text style={styles.declinePickerTitle}>Reason (optional)</Text>
      <View style={styles.declineChips}>
        {DECLINE_REASONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.declineChip, selected === r.value && styles.declineChipSelected]}
            onPress={() => setSelected((prev) => prev === r.value ? null : r.value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.declineChipText, selected === r.value && styles.declineChipTextSelected]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.declineActions}>
        <TouchableOpacity style={styles.declineCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.declineCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineConfirmBtn, loading && styles.declineConfirmDisabled]}
          onPress={() => onSelect(selected)}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.declineConfirmText}>{loading ? 'Declining…' : 'Decline'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   props.item           — request row from API (includes counterpart)
 * @param {'received'|'sent'} props.tab
 * @param {boolean}  props.actionLoading  — true while this card's action is in-flight
 * @param {function} props.onAccept       — (item) => void   [received only]
 * @param {function} props.onDecline      — (item, reason) => void  [received only]
 * @param {function} props.onWithdraw     — (item) => void   [sent, pending only]
 * @param {function} props.onOpenChat     — (chatThreadId) => void [accepted]
 * @param {function} props.onPressProfile — (counterpart) => void
 */
const CollabRequestCard = React.memo(({
  item,
  tab,
  actionLoading,
  onAccept,
  onDecline,
  onWithdraw,
  onOpenChat,
  onPressProfile,
}) => {
  const [showDeclinePicker, setShowDeclinePicker] = useState(false);

  const { counterpart, status, collab_type, pitch_text, created_at, linked_chat_thread_id } = item;

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    counterpart?.display_name || 'C',
  )}&background=2962FF&color=fff&size=80&rounded=true`;

  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  const handleDeclineConfirm = useCallback((reason) => {
    setShowDeclinePicker(false);
    onDecline(item, reason);
  }, [item, onDecline]);

  return (
    <Reanimated.View entering={FadeInDown.duration(250)} style={styles.card}>
      {/* ── Header: avatar + name + entity badge + date ── */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => onPressProfile(counterpart)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: counterpart?.avatar_url || avatarFallback }}
          defaultSource={{ uri: avatarFallback }}
          style={styles.avatar}
        />
        <View style={styles.headerMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {counterpart?.display_name || 'Unknown'}
            </Text>
            <View style={styles.entityBadge}>
              <Text style={styles.entityBadgeText}>
                {entityTypeLabel(counterpart?.type)}
              </Text>
            </View>
          </View>
          {counterpart?.username ? (
            <Text style={styles.username} numberOfLines={1}>
              @{counterpart.username}
            </Text>
          ) : null}
          <ReputationRow reputation={counterpart?.reputation} />
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <ChevronRight size={14} color={COLORS.textMuted} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {/* ── Collab type chip ── */}
      <View style={styles.chipRow}>
        <CollabTypePill value={collab_type} />
      </View>

      {/* ── Pitch preview ── */}
      <Text style={styles.pitchText} numberOfLines={3}>{pitch_text}</Text>

      {/* ── Actions / Status ── */}
      {status === 'pending' && tab === 'received' && !showDeclinePicker && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.acceptBtn, actionLoading && styles.btnDisabled]}
            onPress={() => onAccept(item)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Check size={14} color="#fff" strokeWidth={2.5} />
            <Text style={styles.acceptBtnText}>{actionLoading ? 'Accepting…' : 'Accept'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, actionLoading && styles.btnDisabled]}
            onPress={() => setShowDeclinePicker(true)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <X size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}

      {showDeclinePicker && (
        <DeclineReasonPicker
          onSelect={handleDeclineConfirm}
          onCancel={() => setShowDeclinePicker(false)}
          loading={actionLoading}
        />
      )}

      {status === 'pending' && tab === 'sent' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.withdrawBtn, actionLoading && styles.btnDisabled]}
            onPress={() => onWithdraw(item)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Minus size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
            <Text style={styles.withdrawBtnText}>{actionLoading ? 'Withdrawing…' : 'Withdraw'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Accepted: show open-chat option */}
      {status === 'accepted' && linked_chat_thread_id && (
        <View style={styles.actionRow}>
          <StatusPill status="accepted" />
          <TouchableOpacity
            style={styles.openChatBtn}
            onPress={() => onOpenChat(linked_chat_thread_id)}
            activeOpacity={0.8}
          >
            <Text style={styles.openChatText}>Open Chat</Text>
            <ChevronRight size={13} color={COLORS.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}

      {/* Accepted with no thread yet (edge case) */}
      {status === 'accepted' && !linked_chat_thread_id && <StatusPill status="accepted" />}

      {/* Terminal states: declined / withdrawn / expired */}
      {['declined', 'withdrawn', 'expired'].includes(status) && (
        <View style={styles.actionRow}>
          <StatusPill status={status} />
        </View>
      )}
    </Reanimated.View>
  );
});

export default CollabRequestCard;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

import { Animated, Easing } from 'react-native';
import { useEffect } from 'react';

const Shimmer = ({ w, h, style }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, []);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View style={[{ width: w, height: h, borderRadius: 6, backgroundColor: '#F0F2F5', overflow: 'hidden' }, style]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          transform: [{ translateX: tx }],
          background: 'transparent',
        }]}
      />
    </View>
  );
};

export const CollabRequestCardSkeleton = () => (
  <View style={[styles.card, { opacity: 0.7 }]}>
    <View style={styles.header}>
      <View style={[styles.avatar, { backgroundColor: '#E5E7EB' }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: 120, height: 14, borderRadius: 6, backgroundColor: '#E5E7EB' }} />
        <View style={{ width: 80, height: 11, borderRadius: 6, backgroundColor: '#F0F2F5' }} />
      </View>
    </View>
    <View style={{ width: 90, height: 22, borderRadius: 10, backgroundColor: '#F0F2F5', margin: 16, marginTop: 8 }} />
    <View style={{ paddingHorizontal: 16, gap: 6 }}>
      <View style={{ width: width - 80, height: 13, borderRadius: 5, backgroundColor: '#F0F2F5' }} />
      <View style={{ width: width - 120, height: 13, borderRadius: 5, backgroundColor: '#F0F2F5' }} />
    </View>
    <View style={[styles.actionRow, { paddingTop: 12 }]}>
      <View style={{ width: 80, height: 34, borderRadius: 10, backgroundColor: '#F0F2F5' }} />
      <View style={{ width: 80, height: 34, borderRadius: 10, backgroundColor: '#F0F2F5' }} />
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 10,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
  headerMeta: { flex: 1, gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    fontFamily: FONTS.primary,  // BasicCommercial-Bold — ONE per card (counterpart name)
    fontSize: 15,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  username: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  dateText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },

  // Entity badge
  entityBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  entityBadgeText: { fontFamily: FONTS.semiBold, fontSize: 10, color: '#4338CA' },

  // Reputation
  reputationContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reputationMuted: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },
  reputationCount: { fontFamily: FONTS.semiBold, fontSize: 11, color: COLORS.textSecondary },
  reputationRatingSmall: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },
  reputationRatingBold: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textPrimary },
  reputationCountMuted: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },

  // Collab type pill
  chipRow: { paddingHorizontal: 16, marginBottom: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: { fontFamily: FONTS.semiBold, fontSize: 11, color: COLORS.primary },

  // Pitch
  pitchText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 4,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    marginTop: 4,
  },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  acceptBtnText: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#fff' },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F2F2F7',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  declineBtnText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.textSecondary },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F2F2F7',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  withdrawBtnText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.textSecondary },
  btnDisabled: { opacity: 0.5 },

  // Open chat
  openChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginLeft: 'auto',
  },
  openChatText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary },

  // Status pills
  statusPill: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusPillText: { fontFamily: FONTS.semiBold, fontSize: 12 },

  // Decline picker
  declinePickerBox: {
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)',
    padding: 16, gap: 10,
  },
  declinePickerTitle: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  declineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  declineChip: {
    borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#F9FAFB',
  },
  declineChipSelected: {
    borderColor: COLORS.primary, backgroundColor: '#EEF2FF',
  },
  declineChipText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  declineChipTextSelected: { color: COLORS.primary },
  declineActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  declineCancelBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  declineCancelText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.textSecondary },
  declineConfirmBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  declineConfirmDisabled: { opacity: 0.5 },
  declineConfirmText: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#991B1B' },
});
