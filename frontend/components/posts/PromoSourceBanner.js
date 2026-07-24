/**
 * PromoSourceBanner — Split into two named exports + default
 *
 * Exports:
 *   PlanPreviewCard  — the compact plan/event card shown at BOTTOM of promo posts
 *   PromoTopRow      — the promo pill shown inline with the author header at TOP
 *   default          — used by non-promo detection (returns null when no promo)
 *
 * Post type_data fields consumed:
 *   promo_source_type  'plan' | 'event'
 *   promo_source_id    plan.id | event.id (stored as string)
 *   promo_text         optional caption
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { Megaphone, MapPin, Calendar, Users, ChevronRight } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import { getPlanById }     from '../../api/plans';
import { getEventDetails } from '../../api/events';
import { getAuthToken }    from '../../api/auth';
import { getOptimizedImageUrl } from '../../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Activity assets (shared with OpenPlanCard) ────────────────────────────────

const ACTIVITY_IMAGES = {
  sports:       require('../../assets/Illustrations/Sports.webp'),
  bar:          require('../../assets/Illustrations/Bar.webp'),
  food:         require('../../assets/Illustrations/Food.webp'),
  cafe:         require('../../assets/Illustrations/Cafe.webp'),
  yoga:         require('../../assets/Illustrations/Yoga.webp'),
  gym:          require('../../assets/Illustrations/Gym.webp'),
  walk:         require('../../assets/Illustrations/walk.webp'),
  rides:        require('../../assets/Illustrations/ride.webp'),
  live_music:   require('../../assets/Illustrations/Music.webp'),
  study:        require('../../assets/Illustrations/Co-work_Study.webp'),
  creative:     require('../../assets/Illustrations/Creative.webp'),
  games:        require('../../assets/Illustrations/Gaming.webp'),
  gaming:       require('../../assets/Illustrations/Gaming.webp'),
  hangout:      require('../../assets/Illustrations/Hangout.webp'),
  pet_friendly: require('../../assets/Illustrations/Pet_Friendly.webp'),
  movies:       require('../../assets/Illustrations/Movie.webp'),
  other:        require('../../assets/Illustrations/Other.webp'),
  house_party:  require('../../assets/Illustrations/HouseParty.webp'),
  club:         require('../../assets/Illustrations/Party.webp'),
  hiking:       require('../../assets/Illustrations/Hiking.webp'),
  shopping:     require('../../assets/Illustrations/Shopping.webp'),
};

const PILL_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A' },
  bar:          { bg: '#E8EAF6', text: '#303F9F' },
  food:         { bg: '#FFF8E1', text: '#F57F17' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32' },
  gym:          { bg: '#FCE4EC', text: '#880E4F' },
  walk:         { bg: '#E0F2F1', text: '#00695C' },
  rides:        { bg: '#E3F2FD', text: '#1565C0' },
  live_music:   { bg: '#FCE4EC', text: '#C62828' },
  study:        { bg: '#EDE7F6', text: '#4527A0' },
  creative:     { bg: '#FFF9C4', text: '#F57F17' },
  games:        { bg: '#E1F5FE', text: '#01579B' },
  gaming:       { bg: '#E1F5FE', text: '#01579B' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20' },
  house_party:  { bg: '#FBE9E7', text: '#D84315' },
  club:         { bg: '#EDE7F6', text: '#5E35B1' },
  hiking:       { bg: '#E8F5E9', text: '#2E7D32' },
  shopping:     { bg: '#FCE4EC', text: '#D81B60' },
  other:        { bg: '#F5F5F5', text: '#424242' },
};

const ACTIVITY_LABELS = {
  sports: 'Sports', movies: 'Movies', bar: 'Bar', food: 'Food',
  cafe: 'Cafe', yoga: 'Yoga', gym: 'Gym', walk: 'Walk', rides: 'Rides',
  live_music: 'Live Music', study: 'Study', creative: 'Creative',
  games: 'Games', gaming: 'Games', pet_friendly: 'Pet Friendly',
  hangout: 'Hangout', house_party: 'House Party', club: 'Club',
  hiking: 'Hiking', shopping: 'Shopping', other: 'Other',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the plan's scheduled_at has passed the 3-hour live window */
function isPlanEnded(plan) {
  if (!plan?.scheduled_at) return false;
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  return Date.now() > new Date(plan.scheduled_at).getTime() + THREE_HOURS_MS;
}

function formatDate(iso) {
  if (!iso) return null;
  const d   = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today • ${time}`;
  const tmr = new Date(now.getTime() + 86400000);
  if (d.toDateString() === tmr.toDateString()) return `Tomorrow • ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` • ${time}`;
}

function getCostLabel(plan) {
  if (plan.cost_type === 'free')     return 'Free';
  if (plan.cost_type === 'self_pay') return 'Self-pay';
  if (plan.cost_type === 'split')
    return plan.cost_amount_paise ? `~₹${Math.round(plan.cost_amount_paise / 100)} split` : 'Split cost';
  if (plan.cost_type === 'entry_fee')
    return plan.cost_amount_paise ? `₹${Math.round(plan.cost_amount_paise / 100)}` : 'Entry fee';
  return null;
}

// ── PromoTopRow — shown inline with author header at the TOP of the card ──────

export function PromoTopRow({ sourceType }) {
  if (!sourceType) return null;
  const isEvent = sourceType === 'event';
  return (
    <View style={topRowStyles.pill}>
      <Megaphone size={10} color="#7C3AED" strokeWidth={2.5} />
      <Text style={topRowStyles.pillText}>
        Promoted {isEvent ? 'Event' : 'Plan'}
      </Text>
    </View>
  );
}

const topRowStyles = StyleSheet.create({
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    backgroundColor:  '#F3EFFE',
    paddingHorizontal: 8,
    paddingVertical:  3,
    borderRadius:     20,
    alignSelf:        'flex-start',
  },
  pillText: {
    fontFamily: FONTS.semiBold,
    fontSize:   10,
    color:      '#7C3AED',
    letterSpacing: 0.2,
  },
});

// ── PlanPreviewCard — compact plan card for the BOTTOM of the promo post ──────

export function PlanPreviewCard({ typeData, onPress }) {
  const [source,  setSource]  = useState(null);
  const [loading, setLoading] = useState(false);

  const sourceType = typeData?.promo_source_type;
  const sourceId   = typeData?.promo_source_id;

  useEffect(() => {
    if (!sourceType || !sourceId) return;
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        let data = null;
        if (sourceType === 'plan') {
          const res = await getPlanById(sourceId, token);
          data = res?.plan || res;
        } else {
          const res = await getEventDetails(sourceId);
          data = res?.event || res;
        }
        if (!cancelled && data) setSource(data);
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    };
    fetch();
    return () => { cancelled = true; };
  }, [sourceType, sourceId]);

  if (!sourceType) return null;

  if (loading) {
    return (
      <View style={cardStyles.loadingWrap}>
        <ActivityIndicator size="small" color="#7C3AED" />
      </View>
    );
  }

  if (!source) return null;

  if (sourceType === 'event') {
    return <EventCard event={source} onPress={onPress} />;
  }
  return <PlanCard plan={source} onPress={onPress} ended={isPlanEnded(source)} />;
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

function PlanCard({ plan, onPress, ended = false }) {
  const activityKey   = plan.activity_type || 'other';
  const pillColor     = PILL_COLORS[activityKey]  || PILL_COLORS.other;
  const activityLabel =
    activityKey === 'other'
      ? (plan.custom_activity_label || 'Other')
      : (ACTIVITY_LABELS[activityKey] || activityKey);
  const imgSrc    = ACTIVITY_IMAGES[activityKey] || ACTIVITY_IMAGES.other;
  const dateStr   = formatDate(plan.scheduled_at);
  const location  = plan.location_public || null;
  const costLabel = getCostLabel(plan);
  const accepted  = plan.accepted_count ?? 0;
  const maxAcc    = plan.max_accepted   ?? 0;
  const spotsLeft = maxAcc - accepted;

  return (
    <TouchableOpacity
      style={[cardStyles.card, ended && cardStyles.cardEnded]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Illustration strip */}
      <View style={cardStyles.imgWrap}>
        <Image source={imgSrc} style={[cardStyles.img, ended && { opacity: 0.45 }]} resizeMode="cover" />
        {/* Ended overlay */}
        {ended && (
          <View style={cardStyles.endedOverlay}>
            <View style={cardStyles.endedBadge}>
              <Text style={cardStyles.endedBadgeText}>Ended</Text>
            </View>
          </View>
        )}
        {!ended && (
          <View style={[cardStyles.activityPill, { backgroundColor: pillColor.bg }]}>
            <Text style={[cardStyles.activityPillText, { color: pillColor.text }]}>
              {activityLabel}
            </Text>
          </View>
        )}
        {!ended && maxAcc > 0 && (
          <View style={cardStyles.spotsOverlay}>
            <Users size={10} color="#fff" strokeWidth={2} />
            <Text style={cardStyles.spotsText}>
              {spotsLeft <= 0 ? 'Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
            </Text>
          </View>
        )}
      </View>
      {/* Info */}
      <View style={cardStyles.info}>
        <Text style={[cardStyles.title, ended && { color: COLORS.textSecondary }]} numberOfLines={2}>
          {plan.title}
        </Text>
        {!!dateStr && (
          <View style={cardStyles.metaRow}>
            <Calendar size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={cardStyles.metaText} numberOfLines={1}>{dateStr}</Text>
          </View>
        )}
        {!!location && (
          <View style={cardStyles.metaRow}>
            <MapPin size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={cardStyles.metaText} numberOfLines={1}>{location}</Text>
          </View>
        )}
        <View style={cardStyles.bottomRow}>
          {!ended && !!costLabel && (
            <View style={cardStyles.costBadge}>
              <Text style={cardStyles.costText}>{costLabel}</Text>
            </View>
          )}
          <TouchableOpacity style={cardStyles.viewBtn} onPress={onPress}>
            <Text style={cardStyles.viewBtnText}>{ended ? 'View Plan' : 'View Plan'}</Text>
            <ChevronRight size={11} color={ended ? COLORS.textSecondary : '#7C3AED'} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ event, onPress }) {
  const dateStr  = formatDate(event.start_datetime || event.event_date);
  const location = event.location_name || null;
  const banner   = event.banner_url    || null;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.82}>
      {banner
        ? <Image source={{ uri: getOptimizedImageUrl(banner, { width: SCREEN_WIDTH }) }} style={cardStyles.img} resizeMode="cover" />
        : <View style={[cardStyles.imgWrap, { height: 90, backgroundColor: '#EDE7F6' }]} />
      }
      <View style={cardStyles.info}>
        <Text style={cardStyles.title} numberOfLines={2}>{event.title}</Text>
        {!!dateStr && (
          <View style={cardStyles.metaRow}>
            <Calendar size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={cardStyles.metaText} numberOfLines={1}>{dateStr}</Text>
          </View>
        )}
        {!!location && (
          <View style={cardStyles.metaRow}>
            <MapPin size={11} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={cardStyles.metaText} numberOfLines={1}>{location}</Text>
          </View>
        )}
        <View style={cardStyles.bottomRow}>
          <TouchableOpacity style={cardStyles.viewBtn} onPress={onPress}>
            <Text style={cardStyles.viewBtnText}>View Event</Text>
            <ChevronRight size={11} color="#7C3AED" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Default export — kept for backward-compat, renders nothing ────────────────
// The new unified layout renders PromoTopRow and PlanPreviewCard separately.
// This default export is a no-op so old import sites don't crash.

export default function PromoSourceBanner() { return null; }

// ── Shared styles ─────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    borderRadius:    14,
    overflow:        'hidden',
    backgroundColor: '#FAFAFA',
    borderWidth:     1,
    borderColor:     '#ECEEF0',
    marginTop:       12,
    marginBottom:    4,
  },
  cardEnded: {
    backgroundColor: '#F8F8F8',
    borderColor:     '#E0E0E0',
    opacity:         0.85,
  },
  endedOverlay: {
    position:        'absolute',
    top:             0, left: 0, right: 0, bottom: 0,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  endedBadge: {
    backgroundColor:  'rgba(30,30,30,0.82)',
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      20,
  },
  endedBadgeText: {
    fontFamily:    FONTS.semiBold,
    fontSize:      12,
    color:         '#FFFFFF',
    letterSpacing: 0.4,
  },
  imgWrap: {
    height:   110,
    width:    '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  img: {
    width:  '100%',
    height: 110,
  },
  activityPill: {
    position:         'absolute',
    bottom:           8,
    left:             10,
    borderRadius:     12,
    paddingHorizontal: 8,
    paddingVertical:  3,
  },
  activityPillText: {
    fontFamily: FONTS.semiBold,
    fontSize:   10,
  },
  spotsOverlay: {
    position:         'absolute',
    top:              8,
    right:            10,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              3,
    backgroundColor:  'rgba(0,0,0,0.45)',
    borderRadius:     20,
    paddingHorizontal: 7,
    paddingVertical:  3,
  },
  spotsText: {
    fontFamily: FONTS.semiBold,
    fontSize:   10,
    color:      '#fff',
  },
  info: {
    padding:    12,
    paddingTop: 10,
  },
  title: {
    fontFamily:   FONTS.semiBold,
    fontSize:     14,
    color:        COLORS.textPrimary,
    marginBottom: 6,
    lineHeight:   20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  4,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize:   12,
    color:      COLORS.textSecondary,
    flex:       1,
  },
  bottomRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      8,
  },
  costBadge: {
    backgroundColor:  '#F0FDF4',
    borderRadius:     8,
    paddingHorizontal: 8,
    paddingVertical:  3,
  },
  costText: {
    fontFamily: FONTS.semiBold,
    fontSize:   11,
    color:      '#15803D',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    marginLeft:    'auto',
  },
  viewBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize:   12,
    color:      '#7C3AED',
  },
  loadingWrap: {
    paddingVertical: 12,
    alignItems:      'center',
  },
});
