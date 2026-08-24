import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Clock, MapPin, Calendar, CheckCircle2, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { formatPrice } from '../../utils/pricingUtils';

function parseEventDate(dateString) {
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

function formatEventTime(dateString) {
  if (!dateString) return 'Time TBD';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Time TBD';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getEventPriceLabel(event) {
  if (event.is_free || event.cost_type === 'free') return 'Free';
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
  return 'Free';
}

export default function CompactEventCard({
  event,
  onPress,
  isPast = false,
}) {
  const [cardW, setCardW] = useState((Dimensions.get('window').width - 44) / 2);
  const dateStr = event.start_datetime || event.event_date || event.date;
  const { day, month } = parseEventDate(dateStr);
  const priceLabel = getEventPriceLabel(event);
  const isFree = priceLabel === 'Free';

  // Comprehensive image fallback checking all known SnooSpace event image fields
  const imageUrl =
    event.banner_url ||
    event.banner_image_url ||
    (event.banner_carousel && event.banner_carousel[0]?.image_url) ||
    (event.banners && event.banners[0]?.image_url) ||
    event.image_url ||
    event.poster_url ||
    event.cover_photo_url ||
    event.cover_image_url ||
    (Array.isArray(event.media_urls) && event.media_urls[0]) ||
    (Array.isArray(event.media) && (event.media[0]?.url || event.media[0])) ||
    null;

  const locationText =
    event.venue_name ||
    event.location_name ||
    event.location ||
    event.address ||
    'Venue TBD';

  let statusBadge = null;
  if (isPast || event.is_past) {
    statusBadge = 'Past';
  } else if (event.attendance_status === 'attended' || event.registration_status === 'attended') {
    statusBadge = 'Attended';
  } else if (event.registration_status === 'registered' || event.attendance_status === 'registered' || event.registration_status === 'confirmed') {
    statusBadge = 'Going';
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress && onPress(event)}
      onLayout={(e) => {
        if (e.nativeEvent.layout.width > 0) {
          setCardW(e.nativeEvent.layout.width);
        }
      }}
    >
      {/* Poster Half */}
      <View style={[styles.poster, { width: cardW }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: cardW, height: 112 }}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.placeholderPoster, { width: cardW, height: 112 }]}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* Subtle geometric overlay box inspired by TribeCard */}
            <View style={styles.geometricAccent} />
            <Calendar size={28} color="rgba(255, 255, 255, 0.7)" strokeWidth={1.5} />
          </View>
        )}

        {/* Top-Left Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateMonth}>{month}</Text>
          <Text style={styles.dateDay}>{day}</Text>
        </View>

        {/* Top-Right Status Badge */}
        {statusBadge && (
          <View
            style={[
              styles.statusBadge,
              statusBadge === 'Past'
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
          <MapPin size={11} color="#64748B" strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Clock size={11} color="#64748B" strokeWidth={2} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatEventTime(dateStr)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={[styles.pricePill, isFree ? styles.pricePillFree : styles.pricePillPaid]}>
            <Text style={[styles.pricePillText, isFree ? styles.pricePillTextFree : styles.pricePillTextPaid]}>
              {priceLabel}
            </Text>
          </View>

          {event.category ? (
            <Text style={styles.categoryText} numberOfLines={1}>
              {event.category}
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
    fontFamily: FONTS.bold,
    color: '#0F172A',
    lineHeight: 14,
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
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    lineHeight: 17.5,
    color: '#0F172A',
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
    color: '#94A3B8',
    maxWidth: '45%',
  },
});
