import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Clock, MapPin, Calendar, CheckCircle2, Video, Bookmark } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { formatPrice } from '../../utils/pricingUtils';
import { getOptimizedImageUrl } from '../../utils/imageUtils';

function parseEventDate(dateString, formattedDate) {
  if (formattedDate) {
    const parts = formattedDate.trim().split(/\s+/);
    if (parts.length >= 2) {
      const monthPart = parts[parts.length - 2].toUpperCase().replace(/,/g, '');
      const dayPart = parts[parts.length - 1].replace(/\D/g, '');
      if (monthPart && dayPart) {
        return { month: monthPart.slice(0, 3), day: dayPart };
      }
    }
  }
  if (!dateString) return { day: '•', month: 'EVT' };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    return { day: '•', month: 'EVT' };
  }
  const day = d.getDate();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[d.getMonth()];
  return { day: String(day), month };
}

function formatEventTime(dateString, formattedTime) {
  if (formattedTime) return formattedTime;
  if (!dateString) return 'Time TBD';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Time TBD';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getEventPriceLabel(event) {
  if (event.is_free || event.isFree || event.cost_type === 'free') return 'Free';
  if (event.ticket_types && event.ticket_types.length > 0) {
    const prices = event.ticket_types
      .map((t) => parseFloat(t.base_price) || 0)
      .filter((p) => p > 0);
    if (prices.length > 0) {
      return formatPrice(Math.min(...prices));
    }
  }
  if (event.min_price && parseFloat(event.min_price) > 0) {
    return formatPrice(parseFloat(event.min_price));
  }
  if (event.base_price && parseFloat(event.base_price) > 0) {
    return formatPrice(parseFloat(event.base_price));
  }
  if (event.ticket_price && parseFloat(event.ticket_price) > 0) {
    return formatPrice(parseFloat(event.ticket_price));
  }
  return 'Free';
}

export default function CompactEventCard({
  event,
  onPress,
  isPast = false,
  isInterested = false,
  onToggleInterest = null,
  showBookmark = false,
  style,
  width: customWidth,
}) {
  const defaultWidth = (Dimensions.get('window').width - 44) / 2;
  const [cardW, setCardW] = useState(customWidth || defaultWidth);
  const dateStr = event.start_datetime || event.startDatetime || event.event_date || event.date;
  const formattedDateStr = event.formatted_date || event.formattedDate;
  const formattedTimeStr = event.formatted_time || event.formattedTime;
  const { day, month } = parseEventDate(dateStr, formattedDateStr);
  const priceLabel = getEventPriceLabel(event);
  const isFree = priceLabel === 'Free';
  const isVirtual = event.event_type === 'virtual' || event.eventType === 'virtual' || event.event_type === 'hybrid' || event.eventType === 'hybrid';

  // Comprehensive image fallback checking all known SnooSpace event image fields
  const rawImageUrl =
    event.banner_url ||
    event.banner_image_url ||
    event.coverUrl ||
    (event.banner_carousel && event.banner_carousel[0]?.image_url) ||
    (event.banners && event.banners[0]?.image_url) ||
    event.image_url ||
    event.poster_url ||
    event.cover_photo_url ||
    event.cover_image_url ||
    (Array.isArray(event.media_urls) && event.media_urls[0]) ||
    (Array.isArray(event.media) && (event.media[0]?.url || event.media[0])) ||
    null;

  const imageUrl = rawImageUrl ? getOptimizedImageUrl(rawImageUrl, { width: Math.round(cardW * 2) }) : null;

  const locationText = isVirtual
    ? (event.location_name || event.venue_name || 'Online Event')
    : (event.venue_name || event.location_name || event.location || event.address || 'Venue TBD');

  let statusBadge = null;
  if (event.isLiveNow || event.is_live) {
    statusBadge = 'LIVE';
  } else if (isPast || event.is_past) {
    statusBadge = 'Past';
  } else if (event.attendance_status === 'attended' || event.registration_status === 'attended') {
    statusBadge = 'Attended';
  } else if (event.registration_status === 'registered' || event.attendance_status === 'registered' || event.registration_status === 'confirmed') {
    statusBadge = 'Going';
  } else if (event.spotsLeft !== undefined && event.spotsLeft !== null && event.spotsLeft <= 5 && event.spotsLeft > 0) {
    statusBadge = `${event.spotsLeft} left`;
  }

  const effectiveCardWidth = customWidth || cardW;

  return (
    <TouchableOpacity
      style={[styles.card, customWidth ? { width: customWidth } : null, style]}
      activeOpacity={0.88}
      onPress={() => onPress && onPress(event)}
      onLayout={(e) => {
        if (!customWidth && e.nativeEvent.layout.width > 0) {
          setCardW(e.nativeEvent.layout.width);
        }
      }}
    >
      {/* Poster Half */}
      <View style={[styles.poster, { width: '100%' }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: 112 }}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.placeholderPoster, { width: '100%', height: 112 }]}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.geometricAccent} />
            <Calendar size={28} color="rgba(255, 255, 255, 0.7)" strokeWidth={1.5} />
          </View>
        )}

        {/* Top-Left Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateMonth}>{month}</Text>
          <Text style={styles.dateDay}>{day}</Text>
        </View>

        {/* Top-Right Bookmark Button */}
        {showBookmark && onToggleInterest && (
          <TouchableOpacity
            style={styles.bookmarkBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e) => {
              e?.stopPropagation?.();
              const targetId = event.eventId || event.id;
              onToggleInterest(targetId);
            }}
          >
            <Bookmark
              size={13}
              color={isInterested ? '#2962FF' : '#2C2C2A'}
              fill={isInterested ? '#2962FF' : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}

        {/* Top-Right Status Badge (rendered when not bookmarked or positioned nicely) */}
        {statusBadge && (!showBookmark || statusBadge === 'LIVE') && (
          <View
            style={[
              styles.statusBadge,
              statusBadge === 'LIVE'
                ? styles.statusBadgeLive
                : statusBadge === 'Past'
                ? styles.statusBadgePast
                : statusBadge === 'Attended'
                ? styles.statusBadgeAttended
                : styles.statusBadgeGoing,
            ]}
          >
            {statusBadge === 'Attended' && (
              <CheckCircle2 size={9} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 2 }} />
            )}
            <Text style={styles.statusBadgeText}>{statusBadge}</Text>
          </View>
        )}
      </View>

      {/* Info Half */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title || event.name || 'Event'}
        </Text>

        <View style={styles.metaRow}>
          {isVirtual ? (
            <Video size={11} color={COLORS.textSecondary} strokeWidth={2} />
          ) : (
            <MapPin size={11} color={COLORS.textSecondary} strokeWidth={2} />
          )}
          <Text style={styles.metaText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Clock size={11} color={COLORS.textSecondary} strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatEventTime(dateStr, formattedTimeStr)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={[styles.pricePill, isFree ? styles.pricePillFree : styles.pricePillPaid]}>
            <Text style={[styles.pricePillText, isFree ? styles.pricePillTextFree : styles.pricePillTextPaid]}>
              {priceLabel}
            </Text>
          </View>

          {event.category || event.categoryName ? (
            <Text style={styles.categoryText} numberOfLines={1}>
              {event.category || event.categoryName}
            </Text>
          ) : (event.attendee_count > 0 || event.attendeeCount > 0) ? (
            <Text style={styles.categoryText} numberOfLines={1}>
              {`${event.attendee_count || event.attendeeCount} going`}
            </Text>
          ) : null}
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
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    height: 236,
    width: '100%',
    ...SHADOWS.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  poster: {
    height: 112,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  placeholderPoster: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  geometricAccent: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    width: 60,
    height: 60,
    top: -10,
    right: -10,
    transform: [{ rotate: '15deg' }],
  },
  dateBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  dateMonth: {
    fontSize: 8,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
    lineHeight: 10,
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 12,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    lineHeight: 14,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...SHADOWS.sm,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(216, 90, 48, 0.95)',
  },
  statusBadgeGoing: {
    backgroundColor: '#2962FF',
  },
  statusBadgeAttended: {
    backgroundColor: '#059669',
  },
  statusBadgePast: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  content: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 13.5,
    lineHeight: 17.5,
    color: COLORS.textPrimary,
    marginBottom: 2,
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
    color: COLORS.textSecondary,
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
  pricePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  pricePillFree: {
    backgroundColor: '#ECFDF5',
  },
  pricePillPaid: {
    backgroundColor: '#EFF6FF',
  },
  pricePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  pricePillTextFree: {
    color: '#059669',
  },
  pricePillTextPaid: {
    color: '#2563EB',
  },
  categoryText: {
    fontFamily: FONTS.medium,
    fontSize: 9.5,
    color: COLORS.textMuted,
    maxWidth: '45%',
  },
});
