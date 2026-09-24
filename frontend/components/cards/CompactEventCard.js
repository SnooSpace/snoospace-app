import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Clock, MapPin, Calendar, CheckCircle2, Video, Bookmark, Layers, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { formatPrice } from '../../utils/pricingUtils';
import { getOptimizedImageUrl } from '../../utils/imageUtils';
import { getEventModeDetails } from '../../utils/eventStateUtils';
import { getGradientForName, getInitials } from '../../utils/AvatarGenerator';

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
  if (!event || event.is_free || event.isFree || event.cost_type === 'free') return 'Free';

  let parsedTickets = [];
  if (event.ticket_types) {
    if (typeof event.ticket_types === 'string') {
      try {
        parsedTickets = JSON.parse(event.ticket_types);
      } catch (_) {
        parsedTickets = [];
      }
    } else if (Array.isArray(event.ticket_types)) {
      parsedTickets = event.ticket_types;
    }
  }

  let lowestPrice = 0;
  let fromScalar = false; // true when price came from an aggregated/fallback scalar, not from counting parsedTickets

  if (parsedTickets && parsedTickets.length > 0) {
    const prices = parsedTickets
      .map((t) => parseFloat(t.base_price ?? t.price) || 0)
      .filter((p) => p > 0);
    if (prices.length > 0) {
      lowestPrice = Math.min(...prices);
    }
  }

  // Only fall back to scalar price fields when ticket_types was not returned by the API.
  // NOTE: ticket_price may be null on newer events (legacy column not populated).
  // Treat null/undefined ticket_price as "unknown" — don't default to Free.
  if (lowestPrice <= 0) {
    const mtp = event.minTicketPrice != null ? parseFloat(event.minTicketPrice) : null;
    const tp  = event.ticket_price   != null ? parseFloat(event.ticket_price)   : null;
    const mp  = event.min_price      != null ? parseFloat(event.min_price)      : null;
    const bp  = event.base_price     != null ? parseFloat(event.base_price)     : null;

    if (mtp != null && mtp > 0) {
      lowestPrice = mtp; fromScalar = true;
    } else if (tp != null && tp > 0) {
      lowestPrice = tp; fromScalar = true;
    } else if (mp != null && mp > 0) {
      lowestPrice = mp; fromScalar = true;
    } else if (bp != null && bp > 0) {
      lowestPrice = bp; fromScalar = true;
    } else if (mtp === null && tp === null && mp === null && bp === null && parsedTickets.length === 0) {
      // No pricing info returned at all — don't claim it's free, show nothing
      return null;
    }
  }

  if (lowestPrice <= 0) return 'Free';

  const formattedPrice = formatPrice(lowestPrice);
  // "onwards" = there are (or may be) multiple ticket tiers.
  // When price came from a scalar aggregate we can't know how many tiers exist → always show "onwards".
  // When we enumerated parsedTickets directly, only skip "onwards" for a single-tier event.
  const showOnwards = fromScalar || parsedTickets.length > 1;
  return showOnwards ? `${formattedPrice} onwards` : formattedPrice;
}

function getAvatarPhoto(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string' && /^https?:\/\//.test(avatar)) return avatar;
  const url = avatar.profile_photo_url || avatar.avatar_url || avatar.photo_url || avatar.image_url || avatar.photo || avatar.avatar;
  if (url && typeof url === 'string' && /^https?:\/\//.test(url)) return url;
  return null;
}

function getAvatarName(avatar, index) {
  if (!avatar) return `User ${index + 1}`;
  if (typeof avatar === 'string') return 'U';
  return avatar.name || avatar.full_name || avatar.username || `User ${index + 1}`;
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
  const { displayText: locationText, iconName } = getEventModeDetails(event);
  const isFree = priceLabel === 'Free';

  let parsedAvatars = [];
  if (Array.isArray(event.attendee_avatars)) {
    parsedAvatars = event.attendee_avatars;
  } else if (typeof event.attendee_avatars === 'string') {
    try {
      parsedAvatars = JSON.parse(event.attendee_avatars);
    } catch (_) {
      parsedAvatars = [];
    }
  } else if (Array.isArray(event.attendees)) {
    parsedAvatars = event.attendees;
  } else if (Array.isArray(event.attendeeAvatars)) {
    parsedAvatars = event.attendeeAvatars;
  }

  const rawAttendeeCount = Number(
    event.attendee_count ??
    event.attendeeCount ??
    event.attendees_count ??
    event.current_attendees ??
    (Array.isArray(event.attendees) ? event.attendees.length : 0) ??
    (Array.isArray(parsedAvatars) ? parsedAvatars.length : 0)
  ) || 0;

  const attendeeCount = Math.max(rawAttendeeCount, parsedAvatars.length);
  const maxAvatars = 3;
  const shownCount = parsedAvatars.length > 0
    ? Math.min(parsedAvatars.length, maxAvatars)
    : Math.min(attendeeCount, maxAvatars);
  const remainingCount = attendeeCount > maxAvatars ? attendeeCount - maxAvatars : 0;

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
  } else if (event.isFeatured || event.is_featured) {
    statusBadge = 'Featured';
  }

  return (
    <TouchableOpacity
      style={[styles.cardOuter, customWidth ? { width: customWidth } : null, style]}
      activeOpacity={0.88}
      onPress={() => onPress && onPress(event)}
      onLayout={(e) => {
        if (!customWidth && e.nativeEvent.layout.width > 0) {
          setCardW(e.nativeEvent.layout.width);
        }
      }}
    >
      <View style={styles.cardInner}>
        {/* Poster Half */}
        <View style={styles.poster}>
          {imageUrl ? (
            <View style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.posterImage}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.22)']}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : (
            <View style={styles.placeholderPoster}>
              <LinearGradient
                colors={['#0B0F19', '#1E1B4B', '#0F172A']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.placeholderIconContainer}>
                <Calendar size={22} color="rgba(255, 255, 255, 0.85)" strokeWidth={1.8} />
              </View>
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
                  : statusBadge === 'Featured'
                  ? styles.statusBadgeFeatured
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
            {iconName === 'Layers' ? (
              <Layers size={11.5} color="#64748B" strokeWidth={1.8} />
            ) : iconName === 'Video' ? (
              <Video size={11.5} color="#64748B" strokeWidth={1.8} />
            ) : (
              <MapPin size={11.5} color="#64748B" strokeWidth={1.8} />
            )}
            <Text style={styles.metaText} numberOfLines={1}>
              {locationText}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Clock size={11.5} color="#64748B" strokeWidth={1.8} />
            <Text style={styles.metaText} numberOfLines={1}>
              {formatEventTime(dateStr, formattedTimeStr)}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            {priceLabel != null && (
              <View style={[styles.pricePill, isFree ? styles.pricePillFree : styles.pricePillPaid]}>
                <Text style={[styles.pricePillText, isFree ? styles.pricePillTextFree : styles.pricePillTextPaid]}>
                  {priceLabel}
                </Text>
              </View>
            )}

            {attendeeCount > 0 ? (
              <View style={styles.attendeesContainer}>
                <View style={styles.avatarStack}>
                  {parsedAvatars.length > 0 ? (
                    parsedAvatars.slice(0, 3).map((avatar, idx) => {
                      const photoUrl = getAvatarPhoto(avatar);
                      const name = getAvatarName(avatar, idx);
                      const zIndex = 3 - idx;
                      const marginLeft = idx > 0 ? -5 : 0;
                      if (photoUrl) {
                        return (
                          <Image
                            key={`attendee-avatar-${idx}`}
                            source={{ uri: getOptimizedImageUrl(photoUrl, { width: 36 }) }}
                            style={[styles.attendeeAvatar, { marginLeft, zIndex }]}
                            contentFit="cover"
                          />
                        );
                      }
                      return (
                        <LinearGradient
                          key={`attendee-avatar-${idx}`}
                          colors={getGradientForName(name)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.attendeeAvatar, styles.avatarGradient, { marginLeft, zIndex }]}
                        >
                          <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
                        </LinearGradient>
                      );
                    })
                  ) : (
                    Array.from({ length: shownCount }).map((_, idx) => {
                      const zIndex = 3 - idx;
                      const marginLeft = idx > 0 ? -5 : 0;
                      const gradientColors = getGradientForName(String(idx + (event.id || 1)));
                      return (
                        <LinearGradient
                          key={`attendee-ph-${idx}`}
                          colors={gradientColors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.attendeeAvatar, styles.avatarGradient, { marginLeft, zIndex }]}
                        >
                          <Text style={styles.avatarInitials}>•</Text>
                        </LinearGradient>
                      );
                    })
                  )}
                </View>

                {remainingCount > 0 && (
                  <View style={styles.moreAttendeesBadge}>
                    <Plus size={8} color="#64748B" strokeWidth={2.6} />
                    <Text style={styles.moreAttendeesText}>{remainingCount}</Text>
                  </View>
                )}
              </View>
            ) : (priceLabel == null && (event.category || event.categoryName)) ? (
              <Text style={styles.categoryText} numberOfLines={1}>
                {event.category || event.categoryName}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    height: 242,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInner: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  poster: {
    height: 114,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  posterImage: {
    width: '100%',
    height: 114,
  },
  placeholderPoster: {
    width: '100%',
    height: 114,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    minWidth: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dateMonth: {
    fontSize: 8,
    fontFamily: 'Manrope-Bold',
    color: '#2563EB',
    lineHeight: 10,
    letterSpacing: 0.6,
  },
  dateDay: {
    fontSize: 13,
    fontFamily: 'Manrope-Bold',
    color: '#0F172A',
    lineHeight: 15,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
  statusBadgeFeatured: {
    backgroundColor: '#D97706',
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
    paddingHorizontal: 11,
    paddingVertical: 10,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 13.5,
    lineHeight: 18,
    color: '#0F172A',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pricePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  pricePillFree: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pricePillPaid: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pricePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  pricePillTextFree: {
    color: '#047857',
  },
  pricePillTextPaid: {
    color: '#1E293B',
  },
  categoryText: {
    fontFamily: FONTS.medium,
    fontSize: 9.5,
    color: '#64748B',
    maxWidth: '45%',
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FONTS.semiBold,
    fontSize: 8,
    color: '#FFFFFF',
    lineHeight: 10,
  },
  moreAttendeesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 3,
    gap: 0.5,
  },
  moreAttendeesText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#64748B',
    lineHeight: 12,
  },
});
