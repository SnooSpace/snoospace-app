import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import { useLocationName } from "../../utils/locationNameCache";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.78; // Slightly wider cards
const IMAGE_HEIGHT = 280; // Taller image section

/**
 * DiscoverEventCard - Event card for the category carousels
 *
 * Redesigned layout:
 * ┌─────────────────────────┐
 * │                         │
 * │       EVENT IMAGE       │  ← Clean image, no overlays
 * │                         │
 * └─────────────────────────┘
 * │ Date                 🔖 │
 * │ Title (Bold)            │
 * │ Location                │
 * │ ₹XXX onwards            │
 * └─────────────────────────┘
 */
export default function DiscoverEventCard({
  event,
  onPress,
  onBookmark,
  isBookmarked = false,
  width = CARD_WIDTH,
}) {
  const {
    id,
    title,
    banner_url,
    formatted_date,
    formatted_time,
    community_name,
    community_logo,
    ticket_price,
    has_free_tickets,
    location_url,
    attendee_count,
    access_type,
    invite_public_visibility,
  } = event;

  // Check if location should be hidden (invite-only event shown in discover feed)
  const shouldHideLocation =
    access_type === "invite_only" && invite_public_visibility === true;

  // Format price display - check for free tickets first
  const getPriceDisplay = () => {
    if (has_free_tickets) return "Free";
    if (!ticket_price || ticket_price === 0) return "Free";
    return `₹${Number(ticket_price).toLocaleString("en-IN")} onwards`;
  };

  // Get location name from Google Maps URL (handles shortened URLs)
  const decodedLocationName = useLocationName(location_url, {
    fallback: community_name || "Location TBD",
  });

  // Prioritize custom location_name if provided, but hide if invite-only
  const displayLocation = shouldHideLocation
    ? null
    : event.location_name || decodedLocationName;

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.95}
    >
      {/* Image Section - Clean, no overlays */}
      <View style={styles.imageContainer}>
        {banner_url ? (
          <Image
            source={{ uri: banner_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imagePlaceholder}
          >
            <Ionicons
              name="calendar-outline"
              size={48}
              color="rgba(255,255,255,0.7)"
            />
          </LinearGradient>
        )}
      </View>

      {/* Info Section - Below Image */}
      <View style={styles.infoSection}>
        {/* Date Row with Bookmark */}
        <View style={styles.dateRow}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{formatted_date || "Date TBD"}</Text>
          </View>

          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onBookmark?.(event);
            }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isBookmarked ? COLORS.primary : "#8E8E93"}
            />
          </TouchableOpacity>
        </View>

        {/* Title - Fixed height for 2 lines */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>

        {/* Location - Fixed height container for consistent card sizing */}
        <View style={styles.locationRow}>
          {displayLocation ? (
            <>
              <Ionicons name="location-outline" size={14} color="#8E8E93" />
              <Text style={styles.locationText} numberOfLines={1}>
                {displayLocation}
              </Text>
            </>
          ) : null}
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{getPriceDisplay()}</Text>
          {attendee_count > 0 && (
            <View style={styles.attendeeBadge}>
              <Ionicons name="people-outline" size={12} color="#8E8E93" />
              <Text style={styles.attendeeText}>{attendee_count} going</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    ...SHADOWS.md,
  },
  // Image Section
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: "100%",
    backgroundColor: "#F0F0F0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  // Info Section
  infoSection: {
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dateBadge: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dateText: {
    color: "#1C1C1E",
    fontSize: 12,
    fontWeight: "600",
  },
  bookmarkButton: {
    padding: 4,
  },
  titleContainer: {
    height: 44, // Fixed height for 2 lines (lineHeight 22 * 2)
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
    minHeight: 18, // Fixed height to ensure consistent card sizing
  },
  locationText: {
    fontSize: 13,
    color: "#8E8E93",
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  attendeeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendeeText: {
    fontSize: 12,
    color: "#8E8E93",
  },
});
