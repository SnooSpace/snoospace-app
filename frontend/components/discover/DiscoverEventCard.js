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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75; // 75% of screen width
const CARD_HEIGHT = CARD_WIDTH * 1.25; // 5:4 aspect ratio (taller cards)

/**
 * DiscoverEventCard - Event card for the category carousels
 * Matches the reference design with:
 * - Full image background
 * - Date badge (top-left)
 * - Bookmark icon (top-right)
 * - Event details at bottom (title, venue, price)
 */
export default function DiscoverEventCard({
  event,
  onPress,
  onBookmark,
  isBookmarked = false,
  width = CARD_WIDTH,
  height = CARD_HEIGHT,
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
    location_url,
    attendee_count,
  } = event;

  // Format price display
  const priceDisplay = ticket_price ? `₹${ticket_price}` : "Free";

  // Parse venue from location_url or use community name
  const venueName = community_name || "Venue TBD";

  return (
    <TouchableOpacity
      style={[styles.card, { width, height }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.9}
    >
      {/* Background Image */}
      {banner_url ? (
        <Image
          source={{ uri: banner_url }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={COLORS.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundImage}
        />
      )}

      {/* Dark overlay for better text readability */}
      <LinearGradient
        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]}
        style={styles.overlay}
      />

      {/* Top Row - Date Badge & Bookmark */}
      <View style={styles.topRow}>
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formatted_date || "Date TBD"}</Text>
        </View>

        {/* Bookmark Button */}
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={() => onBookmark?.(event)}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Bottom Content */}
      <View style={styles.bottomContent}>
        {/* Event Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Venue */}
        <View style={styles.venueRow}>
          {community_logo ? (
            <Image
              source={{ uri: community_logo }}
              style={styles.communityLogo}
            />
          ) : (
            <View style={[styles.communityLogo, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>
                {community_name?.charAt(0) || "E"}
              </Text>
            </View>
          )}
          <Text style={styles.venueText} numberOfLines={1}>
            {venueName}
          </Text>
        </View>

        {/* Price Row */}
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{priceDisplay}</Text>
          {attendee_count > 0 && (
            <View style={styles.attendeeBadge}>
              <Ionicons name="people-outline" size={12} color="#FFFFFF" />
              <Text style={styles.attendeeText}>{attendee_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    ...SHADOWS.medium,
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 12,
  },
  dateBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backdropFilter: "blur(8px)",
  },
  dateText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  bookmarkButton: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  communityLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  logoPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  venueText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  attendeeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  attendeeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
