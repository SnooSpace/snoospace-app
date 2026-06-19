import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image"; // ── PERF: memory-disk cache + off-thread decode
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Clock, MapPin, Video, MoveRight } from "lucide-react-native";
import { COLORS, FONTS, SHADOWS } from "../constants/theme";
import { getEventDetails } from "../api/events";
import SnooLoader from "./ui/SnooLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65; // Scaled down to match SharedPostCard and fit nicely in chat

const formatEventDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
};

const formatEventTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
};

/**
 * Parses a display date string into distinct Month and Day values
 * @param {string} dateStr - e.g. "Sun, May 31" or "May 31"
 * @returns {Object} { month: string, day: string }
 */
const parseDisplayDate = (dateStr) => {
  if (!dateStr) return { month: "EVT", day: "•" };
  const cleanStr = dateStr.replace(/,/g, "").trim();
  const parts = cleanStr.split(/\s+/);

  let month = "EVT";
  let day = "•";

  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  for (let part of parts) {
    const lower = part.toLowerCase();
    if (monthNames.some((m) => lower.startsWith(m))) {
      month = part.substring(0, 3).toUpperCase();
    } else if (/^\d+$/.test(part)) {
      day = part;
    }
  }

  if (day === "•") {
    for (let part of parts) {
      const match = part.match(/^(\d+)(st|nd|rd|th)?$/i);
      if (match) {
        day = match[1];
        break;
      }
    }
  }

  return { month, day };
};

// ── Module-level event cache ───────────────────────────────────────────────
// Keyed by eventId. Survives remount so scrolling back over an event share
// doesn't re-fetch from the API.
const eventCache = new Map();

/**
 * SharedEventCard — premium preview rendered in chat when
 * someone shares an event (message_type === "event_share").
 *
 * Matches the layout and style of EventCard in a compact view.
 */
const SharedEventCard = React.memo(({ metadata, onPress, style }) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState(false);

  if (!metadata) return null;

  const {
    eventId,
    title: metaTitle,
    bannerUrl: metaBannerUrl,
    eventDate: metaEventDate,
    locationName: metaLocationName,
    eventType: metaEventType,
    communityName: metaCommunityName,
    communityLogo: metaCommunityLogo,
    communityUsername: metaCommunityUsername,
  } = metadata;

  const targetId = eventId || metadata.event_id || metadata.id;

  useEffect(() => {
    let isMounted = true;

    if (!targetId) {
      setDeleted(true);
      setLoading(false);
      return;
    }

    // ── PERF: Return cached result immediately — no network round-trip.
    if (eventCache.has(targetId)) {
      setEvent(eventCache.get(targetId));
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      try {
        const response = await getEventDetails(targetId);
        const data = response?.event || response;
        if (isMounted && data && (data.id || data.title)) {
          eventCache.set(targetId, data); // cache before setState
          setEvent(data);
        } else if (isMounted) {
          setDeleted(true);
        }
      } catch (err) {
        console.warn("[SharedEventCard] Event unavailable (likely deleted):", err?.message);
        if (isMounted) setDeleted(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchEvent();
    return () => { isMounted = false; };
  }, [targetId]);

  // Resolve display values — prefer live data, fall back to metadata
  const displayTitle = event?.title || metaTitle || "Untitled Event";
  const displayCommunity =
    event?.community_name ||
    event?.organizer_name ||
    metaCommunityName ||
    metaCommunityUsername ||
    "Community";
  const displayBannerUrl = event?.banner_url || metaBannerUrl || null;
  const displayDate =
    event?.start_datetime || event?.event_date || metaEventDate || null;
  const displayLocation =
    event?.location_name || event?.venue_name || metaLocationName || null;
  const displayEventType = event?.event_type || metaEventType || null;
  const displayCommunityLogo =
    event?.community_logo || event?.organizer_logo || metaCommunityLogo || null;

  const formattedDate = formatEventDate(displayDate);
  const formattedTime = event?.formatted_time || formatEventTime(displayDate);
  const isVirtual =
    displayEventType === "virtual" || displayEventType === "hybrid";

  const getLowestPrice = () => {
    if (!event) return 0;

    let parsedTickets = [];
    if (event.ticket_types) {
      if (typeof event.ticket_types === "string") {
        try {
          parsedTickets = JSON.parse(event.ticket_types);
        } catch (err) {
          parsedTickets = [];
        }
      } else if (Array.isArray(event.ticket_types)) {
        parsedTickets = event.ticket_types;
      }
    }

    if (parsedTickets && parsedTickets.length > 0) {
      const prices = parsedTickets
        .map((t) => parseFloat(t.base_price) || 0)
        .filter((p) => p > 0);
      if (prices.length > 0) return Math.min(...prices);
    }

    if (event.ticket_price && parseFloat(event.ticket_price) > 0) {
      return parseFloat(event.ticket_price);
    }
    if (event.min_price && parseFloat(event.min_price) > 0) {
      return parseFloat(event.min_price);
    }
    if (event.base_price && parseFloat(event.base_price) > 0) {
      return parseFloat(event.base_price);
    }

    return 0;
  };

  const lowestPrice = getLowestPrice();
  const isFree = lowestPrice <= 0;
  const displayPrice = isFree ? "Free" : `₹${lowestPrice.toLocaleString("en-IN")} onwards`;

  const { month, day } = parseDisplayDate(formattedDate);

  const handlePress = useCallback(() => {
    if (onPress && targetId) onPress(targetId);
  }, [onPress, targetId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.eventLabel}>
          <Calendar size={12} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.eventLabelText}>Event</Text>
        </View>
        <View style={[styles.card, styles.loadingCard]}>
          <SnooLoader size="small" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // ── Deleted / not-found state ──────────────────────────────────────────────
  if (deleted) {
    const hasMetaInfo = metaTitle || metaCommunityName || metaCommunityUsername;
    return (
      <View style={[styles.container, style]}>
        <View style={styles.eventLabel}>
          <Calendar size={12} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.eventLabelText}>Event</Text>
        </View>
        <View style={styles.deletedCard}>
          <Text style={styles.deletedIcon}>📭</Text>
          <Text style={styles.deletedText}>Event no longer available</Text>
          {hasMetaInfo ? (
            <Text style={styles.deletedSubtext} numberOfLines={2}>
              {metaTitle || ""}
              {metaTitle && (metaCommunityName || metaCommunityUsername)
                ? "\n"
                : ""}
              {metaCommunityName
                ? metaCommunityUsername
                  ? `${metaCommunityName} (@${metaCommunityUsername})`
                  : metaCommunityName
                : metaCommunityUsername
                ? `@${metaCommunityUsername}`
                : ""}
            </Text>
          ) : (
            <Text style={styles.deletedSubtext}>
              This event may have been deleted
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── Normal card ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, style]}>
      {/* Event Label */}
      <View style={styles.eventLabel}>
        <Calendar size={12} color={COLORS.primary} strokeWidth={2} />
        <Text style={styles.eventLabelText}>Event</Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Banner image */}
        <View style={styles.imageContainer}>
          {displayBannerUrl ? (
            <Image
              source={{ uri: displayBannerUrl }}
              style={styles.bannerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderBanner}
            >
              <Calendar size={24} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
            </LinearGradient>
          )}

          {/* Date Badge */}
          {formattedDate && (
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeHeader}>{month}</Text>
              <Text style={styles.dateBadgeNumber}>{day}</Text>
            </View>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)"]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Organizer/Community Row */}
          <View style={styles.communityRow}>
            <Image
              source={
                displayCommunityLogo
                  ? { uri: displayCommunityLogo }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        displayCommunity
                      )}&background=7C3AED&color=FFFFFF&size=88`,
                    }
              }
              style={styles.communityAvatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <Text style={styles.communityName} numberOfLines={1}>
              {displayCommunity}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>

          {/* Metadata Grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Clock size={12} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {formattedDate || "TBD"}{formattedTime ? ` • ${formattedTime}` : ""}
              </Text>
            </View>
            {(displayLocation || isVirtual) && (
              <View style={styles.metaItem}>
                {isVirtual ? (
                  <Video size={12} color={COLORS.textSecondary} strokeWidth={2} />
                ) : (
                  <MapPin size={12} color={COLORS.textSecondary} strokeWidth={2} />
                )}
                <Text style={styles.metaText} numberOfLines={1}>
                  {isVirtual ? "Virtual Event" : displayLocation}
                </Text>
              </View>
            )}
          </View>

          {/* Price & Explicit View Details CTA Row */}
          <View style={styles.priceDetailsRow}>
            <Text style={[styles.priceText, isFree && styles.freePriceText]} numberOfLines={1}>
              {displayPrice}
            </Text>

            <View style={styles.viewDetailsRow}>
              <Text style={styles.viewDetailsText}>View details</Text>
              <MoveRight size={12} color={COLORS.primary} strokeWidth={2.2} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  eventLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  eventLabelText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    width: "100%",
  },
  loadingCard: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Deleted state ──────────────────────────────────────────────────────────
  deletedCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deletedIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  deletedText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  deletedSubtext: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#9CA3AF",
    textAlign: "center",
  },
  // ── Normal card ────────────────────────────────────────────────────────────
  imageContainer: {
    height: 100,
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBanner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 36,
  },
  dateBadgeHeader: {
    fontSize: 8,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  dateBadgeNumber: {
    fontSize: 13,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  content: {
    padding: 12,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  communityAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  communityName: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#5e8d9b",
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaGrid: {
    gap: 4,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    flex: 1,
  },
  priceDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  priceText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 4,
  },
  freePriceText: {
    color: "#2E7D32",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
});

export default SharedEventCard;
