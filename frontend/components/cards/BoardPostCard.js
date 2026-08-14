/**
 * BoardPostCard.js
 *
 * Renders a single public collab opening card on the Board tab.
 *
 * Visual language matches CollabRequestCard:
 *   - FONTS.primary (BasicCommercial-Bold) -> Poster name & Title (controlled hierarchy)
 *   - FONTS.semiBold (Manrope-SemiBold)    -> Buttons, badges, chips
 *   - FONTS.medium (Manrope-Medium)        -> Metadata, spots count, timestamps
 *   - FONTS.regular (Manrope-Regular)       -> Description, helper text
 *   - All icons from lucide-react-native only
 *   - Collab teal identity (#0D9488)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Handshake,
  Clock,
  Star,
  Users,
  Check,
  X,
  ChevronRight,
  RefreshCw,
  CalendarCheck,
  Mic2,
  Sparkles,
} from 'lucide-react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, FONTS } from '../../constants/theme';
import { COLLAB_TYPES } from '../../api/collabRequests';

const { width } = Dimensions.get('window');
const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.09)';
const TEAL_BORDER = 'rgba(13, 148, 136, 0.25)';

/** Map entity type to display label */
function entityTypeLabel(type) {
  if (type === 'community') return 'Community';
  if (type === 'member') return 'Creator';
  return '';
}

/** Map collab_type to human label */
function collabTypeLabel(value) {
  return COLLAB_TYPES.find((c) => c.value === value)?.label ?? value;
}

/** Map collab_type to icon component */
function CollabTypeIcon({ value, size = 13, color = TEAL }) {
  const props = { size, color, strokeWidth: 1.8 };
  switch (value) {
    case 'event_partnership': return <CalendarCheck {...props} />;
    case 'cross_promo':       return <RefreshCw {...props} />;
    case 'guest_collab':      return <Mic2 {...props} />;
    case 'custom':            return <Sparkles {...props} />;
    default:                  return <Handshake {...props} />;
  }
}

/** Reputation row for the poster */
function ReputationRow({ reputation }) {
  if (!reputation) return null;

  const {
    avg_response_hours,
    responses_counted,
    avg_rating,
    rating_count,
  } = reputation;

  let responseText = null;
  if (responses_counted < 2) {
    responseText = 'New to requests';
  } else if (avg_response_hours != null) {
    const h = avg_response_hours;
    if (h < 1) responseText = 'Responds quickly';
    else if (h < 24) responseText = `Responds in ~${Math.round(h)}h`;
    else responseText = `Responds in ~${Math.round(h / 24)}d`;
  }

  let ratingNode = null;
  if (rating_count === 0) {
    ratingNode = (
      <Text style={styles.reputationMuted}>No reviews yet</Text>
    );
  } else if (rating_count <= 3) {
    ratingNode = (
      <View style={styles.repRow}>
        <Text style={styles.reputationCount}>{rating_count} {rating_count === 1 ? 'review' : 'reviews'}</Text>
        <Star size={11} color="#F59E0B" strokeWidth={2} fill="#F59E0B" />
        <Text style={styles.reputationRatingSmall}>{avg_rating?.toFixed(1)}</Text>
      </View>
    );
  } else {
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

/** Status badge for viewer join status */
function JoinedStatusBadge({ status }) {
  if (status === 'pending') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
        <Clock size={13} color="#D97706" strokeWidth={2.2} />
        <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Pending</Text>
      </View>
    );
  }
  if (status === 'accepted') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5' }]}>
        <Check size={13} color="#065F46" strokeWidth={2.2} />
        <Text style={[styles.statusBadgeText, { color: '#065F46' }]}>Accepted</Text>
      </View>
    );
  }
  if (status === 'declined') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#FEF2F2' }]}>
        <X size={13} color="#991B1B" strokeWidth={2.2} />
        <Text style={[styles.statusBadgeText, { color: '#991B1B' }]}>Declined</Text>
      </View>
    );
  }
  if (status === 'withdrawn') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
        <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Withdrawn</Text>
      </View>
    );
  }
  return null;
}

/**
 * @param {object} props
 * @param {object} props.item - Board post row from API
 * @param {boolean} props.isPoster - True if current viewer created this post
 * @param {boolean} props.actionLoading - True while mutation in flight
 * @param {function} props.onRequestJoin - (item) => void
 * @param {function} props.onManageApplicants - (item) => void
 * @param {function} props.onPressProfile - (poster) => void
 */
const BoardPostCard = React.memo(({
  item,
  isPoster,
  actionLoading,
  onRequestJoin,
  onManageApplicants,
  onPressProfile,
}) => {
  const [expanded, setExpanded] = useState(false);

  const {
    id,
    title,
    description,
    collab_type,
    spots_total = 1,
    spots_filled = 0,
    status,
    created_at,
    poster,
    poster_name,
    poster_avatar_url,
    poster_username,
    poster_type,
    poster_id,
    joined_status,
  } = item;

  const posterObj = poster || {
    id: poster_id,
    type: poster_type,
    display_name: poster_name,
    avatar_url: poster_avatar_url,
    username: poster_username,
  };

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    posterObj?.display_name || 'Poster',
  )}&background=0D9488&color=fff&size=80&rounded=true`;

  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  const spotsLeft = Math.max(0, spots_total - spots_filled);
  const isFilled = spots_filled >= spots_total || status === 'filled';
  const isClosed = status === 'closed';
  const isExpired = status === 'expired';
  const isOpen = status === 'open' && !isFilled;
  const isOneSpotLeft = spotsLeft === 1 && isOpen;

  const descText = description || '';
  const isLongDesc = descText.length > 130;
  const displayDesc = isLongDesc && !expanded
    ? `${descText.slice(0, 130).trim()}…`
    : descText;

  return (
    <Reanimated.View entering={FadeInDown.duration(250)} style={styles.card}>
      {/* ── Header: poster avatar + name + entity badge + date ── */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => onPressProfile?.(posterObj)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: posterObj?.avatar_url || avatarFallback }}
          defaultSource={{ uri: avatarFallback }}
          style={styles.avatar}
        />
        <View style={styles.headerMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {posterObj?.display_name || 'Creator'}
            </Text>
            <View style={styles.entityBadge}>
              <Text style={styles.entityBadgeText}>
                {entityTypeLabel(posterObj?.type)}
              </Text>
            </View>
          </View>
          {posterObj?.username ? (
            <Text style={styles.username} numberOfLines={1}>
              @{posterObj.username}
            </Text>
          ) : null}
          <ReputationRow reputation={posterObj?.reputation} />
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <ChevronRight size={14} color={COLORS.textMuted} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {/* ── Chips row: Collab type pill + Spots counter badge ── */}
      <View style={styles.chipsRow}>
        <View style={styles.pill}>
          <CollabTypeIcon value={collab_type} size={12} color={TEAL} />
          <Text style={styles.pillText}>{collabTypeLabel(collab_type)}</Text>
        </View>

        <View
          style={[
            styles.spotsBadge,
            isOneSpotLeft && styles.spotsBadgeWarning,
            (isFilled || isClosed || isExpired) && styles.spotsBadgeFilled,
          ]}
        >
          <Users
            size={12}
            color={
              isOneSpotLeft
                ? '#D97706'
                : isFilled || isClosed || isExpired
                ? '#6B7280'
                : TEAL
            }
            strokeWidth={2}
          />
          <Text
            style={[
              styles.spotsBadgeText,
              isOneSpotLeft && styles.spotsBadgeTextWarning,
              (isFilled || isClosed || isExpired) && styles.spotsBadgeTextFilled,
            ]}
          >
            {isFilled
              ? 'Filled'
              : isClosed
              ? 'Closed'
              : isExpired
              ? 'Expired'
              : isOneSpotLeft
              ? '1 spot left'
              : `${spots_filled}/${spots_total} filled`}
          </Text>
        </View>
      </View>

      {/* ── Title ── */}
      <Text style={styles.title}>{title}</Text>

      {/* ── Description (with see more) ── */}
      {descText ? (
        <View style={styles.descWrapper}>
          <Text style={styles.descText}>{displayDesc}</Text>
          {isLongDesc && (
            <TouchableOpacity
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeMoreText}>
                {expanded ? 'See less' : 'See more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* ── Action area ── */}
      <View style={styles.actionRow}>
        {isPoster ? (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => onManageApplicants?.(item)}
            activeOpacity={0.82}
          >
            <Users size={15} color={TEAL} strokeWidth={2.2} />
            <Text style={styles.manageBtnText}>Manage Applicants</Text>
          </TouchableOpacity>
        ) : joined_status && joined_status !== 'withdrawn' ? (
          <JoinedStatusBadge status={joined_status} />
        ) : isFilled ? (
          <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Opening Filled</Text>
          </View>
        ) : isClosed ? (
          <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Opening Closed</Text>
          </View>
        ) : isExpired ? (
          <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Opening Expired</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinBtn, actionLoading && styles.btnDisabled]}
            disabled={actionLoading}
            onPress={() => onRequestJoin?.(item)}
            activeOpacity={0.85}
          >
            <Handshake size={15} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.joinBtnText}>
              {actionLoading ? 'Sending…' : 'Request to join'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Reanimated.View>
  );
});

export default BoardPostCard;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export const BoardPostCardSkeleton = () => (
  <View style={[styles.card, { opacity: 0.7 }]}>
    <View style={styles.header}>
      <View style={[styles.avatar, { backgroundColor: '#E5E7EB' }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: 120, height: 14, borderRadius: 6, backgroundColor: '#E5E7EB' }} />
        <View style={{ width: 80, height: 11, borderRadius: 6, backgroundColor: '#F0F2F5' }} />
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
      <View style={{ width: 110, height: 24, borderRadius: 12, backgroundColor: '#F0F2F5' }} />
      <View style={{ width: 90, height: 24, borderRadius: 12, backgroundColor: '#F0F2F5' }} />
    </View>
    <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 14 }}>
      <View style={{ width: width - 100, height: 16, borderRadius: 6, backgroundColor: '#E5E7EB' }} />
      <View style={{ width: width - 60, height: 13, borderRadius: 5, backgroundColor: '#F0F2F5' }} />
      <View style={{ width: width - 120, height: 13, borderRadius: 5, backgroundColor: '#F0F2F5' }} />
    </View>
    <View style={[styles.actionRow, { paddingTop: 10 }]}>
      <View style={{ width: 130, height: 36, borderRadius: 18, backgroundColor: '#F0F2F5' }} />
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
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
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 15,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  username: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  dateText: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },

  // Entity badge
  entityBadge: {
    backgroundColor: TEAL_BG,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  entityBadgeText: { fontFamily: FONTS.semiBold, fontSize: 10, color: TEAL },

  // Reputation
  reputationContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reputationMuted: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },
  reputationCount: { fontFamily: FONTS.semiBold, fontSize: 11, color: COLORS.textSecondary },
  reputationRatingSmall: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },
  reputationRatingBold: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.textPrimary },
  reputationCountMuted: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textMuted },

  // Chips row
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TEAL_BG,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  pillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: TEAL,
  },
  spotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TEAL_BG,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  spotsBadgeWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  spotsBadgeFilled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  spotsBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: TEAL,
  },
  spotsBadgeTextWarning: {
    color: '#D97706',
    fontFamily: FONTS.semiBold,
  },
  spotsBadgeTextFilled: {
    color: '#6B7280',
  },

  // Title
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 6,
    letterSpacing: -0.2,
  },

  // Description
  descWrapper: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  descText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  seeMoreText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: TEAL,
    marginTop: 4,
  },

  // Action area
  actionRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  joinBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TEAL_BG,
    borderWidth: 1.5,
    borderColor: TEAL_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
  },
  manageBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: TEAL,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
