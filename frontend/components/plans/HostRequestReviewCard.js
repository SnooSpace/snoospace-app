import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { BadgeCheck, Instagram, Calendar, FileText, Info, MessageCircle, MoveRight } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../constants/theme';

function monthsAgo(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86400000);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

const HostRequestReviewCard = ({ request, onApprove, onDecline, onOpenDm, onViewProfile }) => {
  const [loading, setLoading] = useState(null); // 'approve' | 'decline' | null
  const { requester } = request;
  const hasInstagram = requester.social_connections?.some(s => s.platform === 'instagram');
  const isApproved = request.status === 'approved';

  const handleApprove = async () => {
    setLoading('approve');
    try { await onApprove(request.id); } finally { setLoading(null); }
  };

  const handleDecline = async () => {
    setLoading('decline');
    try { await onDecline(request.id); } finally { setLoading(null); }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {/* Avatar: real photo or initial fallback */}
        {requester.profile_photo_url ? (
          <Image
            source={{ uri: requester.profile_photo_url }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(requester.name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{requester.name}</Text>
            {requester.is_verified && (
              <BadgeCheck size={15} color="#2962FF" strokeWidth={2} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.meta}>
            {requester.role ? `${requester.role} · ` : ''}Member {monthsAgo(requester.created_at)}
          </Text>
        </View>

        <TouchableOpacity onPress={() => onViewProfile(requester.id)} hitSlop={8} style={styles.viewProfileBtn}>
          <Text style={styles.viewProfile}>View profile</Text>
          <MoveRight size={13} color="#2962FF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* In common */}
      {(requester.shared_communities?.length > 0 || requester.shared_events?.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>IN COMMON</Text>
          <View style={styles.pillRow}>
            {requester.shared_communities?.map(c => (
              <View key={c.id} style={styles.commonPill}>
                <Text style={styles.commonPillText}>{c.name}</Text>
              </View>
            ))}
            {requester.shared_events?.map(e => (
              <View key={e.id} style={styles.commonPill}>
                <Text style={styles.commonPillText}>{e.title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {requester.shared_communities?.length === 0 && requester.shared_events?.length === 0 && (
        <Text style={styles.noCommon}>No common events yet</Text>
      )}

      {/* Their activity */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>THEIR ACTIVITY</Text>
        <View style={styles.pillRow}>
          <View style={styles.activityPill}>
            <Calendar size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.activityPillText}>{requester.events_attended_count ?? 0} events attended</Text>
          </View>
          <View style={styles.activityPill}>
            <FileText size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.activityPillText}>{requester.post_count ?? 0} posts</Text>
          </View>
          {hasInstagram && (
            <View style={styles.activityPill}>
              <Instagram size={11} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.activityPillText}>Instagram linked</Text>
            </View>
          )}
        </View>
      </View>

      {/* Note */}
      {request.note ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Their note</Text>
          <Text style={styles.noteText}>"{request.note}"</Text>
        </View>
      ) : null}

      {/* Info disclaimer — only for pending */}
      {!isApproved && (
        <View style={styles.infoRow}>
          <Info size={13} color={COLORS.textMuted} strokeWidth={2} />
          <Text style={styles.infoText}>
            Approving opens a DM thread. Exact location is revealed to them. No contacts are shared automatically.
          </Text>
        </View>
      )}

      {/* Actions */}
      {isApproved ? (
        /* Approved tab: just offer Open DM */
        <TouchableOpacity
          style={styles.openDmBtn}
          onPress={() => onOpenDm?.(request.conversation_id)}
        >
          <MessageCircle size={16} color="#fff" strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={styles.approveBtnText}>Open DM</Text>
        </TouchableOpacity>
      ) : (
        /* Pending tab: Decline + Approve & open DM */
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineBtn, loading && styles.btnDisabled]}
            onPress={handleDecline}
            disabled={!!loading}
          >
            {loading === 'decline'
              ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
              : <Text style={styles.declineBtnText}>Decline</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveBtn, loading && styles.btnDisabled]}
            onPress={handleApprove}
            disabled={!!loading}
          >
            {loading === 'approve'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.approveBtnText}>Approve & open DM</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#EEF2FF',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: '#2962FF',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  meta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  viewProfile: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#2962FF',
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  commonPill: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  commonPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#2962FF',
  },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activityPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  noCommon: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  noteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#2962FF',
    paddingLeft: 12,
    marginBottom: 12,
    backgroundColor: '#F8FAFF',
    borderRadius: 4,
    padding: 10,
  },
  noteLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  noteText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  declineBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  approveBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2962FF',
  },
  openDmBtn: {
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#2962FF',
  },
  approveBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default HostRequestReviewCard;
