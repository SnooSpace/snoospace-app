import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Users, Clock, MapPin, Pencil } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import PlanCropImage from '../../screens/plans/PlanCropImage';
import ContentActionsSheet from '../modals/ContentActionsSheet';

const ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100', label: 'Sports' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A', label: 'Movies' },
  bar:          { bg: '#E8EAF6', text: '#303F9F', label: 'Bar' },
  food:         { bg: '#FFF8E1', text: '#F57F17', label: 'Food' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E', label: 'Cafe' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32', label: 'Yoga' },
  gym:          { bg: '#FCE4EC', text: '#880E4F', label: 'Gym' },
  walk:         { bg: '#E0F2F1', text: '#00695C', label: 'Walk' },
  rides:        { bg: '#E3F2FD', text: '#1565C0', label: 'Rides' },
  live_music:   { bg: '#FCE4EC', text: '#C62828', label: 'Live Music' },
  study:        { bg: '#EDE7F6', text: '#4527A0', label: 'Study / Co-work' },
  creative:     { bg: '#FFF9C4', text: '#F57F17', label: 'Creative' },
  games:        { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  gaming:       { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E', label: 'Pet Friendly' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20', label: 'Hangout' },
  house_party:  { bg: '#FBE9E7', text: '#D84315', label: 'House Party' },
  club:         { bg: '#EDE7F6', text: '#5E35B1', label: 'Club' },
  hiking:       { bg: '#E8F5E9', text: '#2E7D32', label: 'Hiking' },
  shopping:     { bg: '#FCE4EC', text: '#D81B60', label: 'Shopping' },
  other:        { bg: '#F5F5F5', text: '#424242', label: 'Other' },
};

function formatScheduled(iso) {
  if (!iso) return 'Date TBD';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Date TBD';
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === todayStr) return `Today, ${time}`;
  if (d.toDateString() === tomorrowStr) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const created = new Date(isoString);
  if (isNaN(created.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return created.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getCostLabel(plan) {
  if (plan.cost_type === 'free' || (!plan.cost_type && !plan.cost_amount_paise)) return 'Free';
  if (plan.cost_type === 'self_pay') return 'Self-pay';
  if (plan.cost_type === 'split') {
    return plan.cost_amount_paise
      ? `~₹${Math.round(plan.cost_amount_paise / 100)} split`
      : 'Split cost';
  }
  if (plan.cost_type === 'entry_fee') {
    return plan.cost_amount_paise
      ? `₹${Math.round(plan.cost_amount_paise / 100)}`
      : 'Entry fee';
  }
  return 'Free';
}

export default function CompactPlanCard({
  plan,
  currentUserId,
  onPress,
  navigation,
  variant = 'light',
}) {
  const [cardW, setCardW] = useState((Dimensions.get('window').width - 44) / 2);
  const isOwner = currentUserId && (plan.created_by === currentUserId || plan.created_by === String(currentUserId));
  const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const activityLabel = plan.activity_type === 'other'
    ? (plan.custom_activity_label || 'Other')
    : activityStyle.label;

  const reqStatus = plan.my_request_status ?? plan.request_status ?? null;
  const acceptedN = plan.accepted_count ?? 0;
  const maxAccepted = plan.max_accepted ?? 0;
  const costLabel = getCostLabel(plan);
  const isDark = variant === 'dark';

  let bottomPillLabel = null;
  if (isOwner) {
    bottomPillLabel = 'Hosting';
  } else if (reqStatus === 'approved') {
    bottomPillLabel = 'Joined';
  } else if (reqStatus === 'pending') {
    bottomPillLabel = 'Requested';
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
      ]}
      activeOpacity={0.88}
      onPress={() => onPress ? onPress(plan.id) : navigation?.navigate('PlanDetail', { planId: plan.id })}
      onLayout={(e) => {
        if (e.nativeEvent.layout.width > 0) {
          setCardW(e.nativeEvent.layout.width);
        }
      }}
    >
      {/* Poster Half */}
      <View style={[styles.poster, { width: cardW }]}>
        {plan.banner_image_url ? (
          <Image
            source={{ uri: plan.banner_image_url }}
            style={{ width: cardW, height: 112 }}
            contentFit="cover"
          />
        ) : (
          <PlanCropImage activityType={activityKey} containerW={cardW} height={112} />
        )}

        {/* Top-Left Category Badge */}
        <View style={[styles.categoryPill, { backgroundColor: activityStyle.bg }]}>
          <Text style={[styles.categoryPillText, { color: activityStyle.text }]}>
            {activityLabel}
          </Text>
        </View>

        {/* Top-Right Count Badge */}
        <View style={styles.countPill}>
          <Users size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.countPillText}>
            {`${acceptedN}/${maxAccepted}`}
          </Text>
        </View>

        {/* Bottom-Left Status Badge */}
        {bottomPillLabel && (
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                bottomPillLabel === 'Hosting'
                  ? styles.statusDotHosting
                  : bottomPillLabel === 'Joined'
                  ? styles.statusDotJoined
                  : styles.statusDotPending,
              ]}
            />
            <Text style={styles.statusPillText}>
              {bottomPillLabel}
            </Text>
          </View>
        )}

        {/* Bottom-Right: Edit (owner) or Report/Share */}
        {isOwner ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={(e) => {
              e.stopPropagation();
              navigation?.navigate('PlanDetail', { planId: plan.id });
            }}
            activeOpacity={0.8}
            hitSlop={8}
          >
            <Pencil size={11} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <View style={styles.editBtn}>
            <ContentActionsSheet
              type="open_plan"
              targetId={plan.id}
              targetName={plan.title || 'Open Plan'}
              label="Open Plan"
              iconColor="#FFFFFF"
              iconSize={12}
            />
          </View>
        )}
      </View>

      {/* Info Half */}
      <View style={[styles.content, isDark ? styles.contentDark : styles.contentLight]}>
        <Text
          style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}
          numberOfLines={2}
        >
          {plan.title}
        </Text>

        <View style={styles.metaRow}>
          <MapPin size={11} color="#64748B" strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>
            {plan.location_public || 'Location TBD'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Clock size={11} color="#64748B" strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatScheduled(plan.scheduled_at)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View
            style={[
              styles.costPill,
              costLabel === 'Free' ? styles.costPillFree : styles.costPillPaid,
            ]}
          >
            <Text
              style={[
                styles.costPillText,
                costLabel === 'Free' ? styles.costPillTextFree : styles.costPillTextPaid,
              ]}
            >
              {costLabel}
            </Text>
          </View>

          <Text style={styles.timeAgoText}>
            {formatTimeAgo(plan.created_at || plan.createdAt || plan.scheduled_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    height: 236,
    width: '100%',
    ...SHADOWS.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  poster: {
    height: 112,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  categoryPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  categoryPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 9.5,
  },
  countPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  countPillText: {
    fontFamily: FONTS.medium,
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  statusPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  statusPillText: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: '#FFFFFF',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  statusDotHosting: {
    backgroundColor: '#38BDF8',
  },
  statusDotJoined: {
    backgroundColor: '#34D399',
  },
  statusDotPending: {
    backgroundColor: '#FBBF24',
  },
  editBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2962FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2962FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  contentLight: {
    backgroundColor: '#FFFFFF',
  },
  contentDark: {
    backgroundColor: '#1E293B',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    lineHeight: 17.5,
    marginBottom: 2,
  },
  titleLight: {
    color: '#0F172A',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  costPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  costPillFree: {
    backgroundColor: '#ECFDF5',
  },
  costPillPaid: {
    backgroundColor: '#EFF6FF',
  },
  costPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  costPillTextFree: {
    color: '#059669',
  },
  costPillTextPaid: {
    color: '#2563EB',
  },
  timeAgoText: {
    fontFamily: FONTS.medium,
    fontSize: 9.5,
    color: '#94A3B8',
  },
});
