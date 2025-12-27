import React, { useState } from "react";
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
import { COLORS, BORDER_RADIUS, SHADOWS } from "../constants/theme";
import { getGradientForName, getInitials } from "../utils/AvatarGenerator";
import { useLocationName } from "../utils/locationNameCache";
import { toggleEventInterest } from "../api/events";
import HapticsService from "../services/HapticsService";
import EventBus from "../utils/EventBus";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40; // 20px padding on each side
const CARD_HEIGHT = 280;

/**
 * EventCard - Display event in feed (interspersed with posts)
 *
 * @param {Object} event - Event data from API
 * @param {Function} onPress - Callback when card is pressed
 * @param {Function} onInterestedPress - Callback when interested button is pressed
 * @param {string} style - Additional styles
 */
export default function EventCard({
  event,
  onPress,
  onInterestedPress,
  style,
}) {
  const [isInterested, setIsInterested] = useState(
    event?.is_interested || false
  );
  const [interestLoading, setInterestLoading] = useState(false);

  if (!event) return null;

  const {
    id,
    title,
    description,
    banner_url,
    banner_carousel,
    formatted_date,
    formatted_time,
    event_date,
    community_name,
    community_username,
    community_logo,
    community_id,
    location_url,
    event_type,
    attendee_count,
    is_following_community,
  } = event;

  // Get display image - prioritize carousel, then banner_url
  const displayImage = banner_carousel?.[0]?.image_url || banner_url;

  // Format date if not pre-formatted
  const displayDate =
    formatted_date ||
    (event_date &&
      new Date(event_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }));

  const displayTime =
    formatted_time ||
    (event_date &&
      new Date(event_date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }));

  // Get location name from Google Maps URL (handles shortened URLs)
  const locationName = useLocationName(location_url, {
    fallback: event_type === "virtual" ? "Virtual Event" : "Location TBD",
  });

  const hasValidPhoto = community_logo && /^https?:\/\//.test(community_logo);

  // Handle interested button press
  const handleInterestedPress = async () => {
    if (interestLoading) return;

    try {
      setInterestLoading(true);
      HapticsService.triggerImpactLight();

      // Optimistic update
      const newState = !isInterested;
      setIsInterested(newState);

      const response = await toggleEventInterest(id);

      if (response?.success) {
        setIsInterested(response.is_interested);
        // Notify other components about the change
        EventBus.emit("event-interest-updated", {
          eventId: id,
          isInterested: response.is_interested,
        });
      } else {
        // Revert on failure
        setIsInterested(!newState);
      }
    } catch (error) {
      console.error("Error toggling interest:", error);
      // Revert on error
      setIsInterested(isInterested);
    } finally {
      setInterestLoading(false);
    }

    // Also call parent callback if provided
    onInterestedPress?.(event);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.95}
    >
      {/* Event Label */}
      <View style={styles.eventLabel}>
        <Ionicons name="calendar" size={12} color={COLORS.primary} />
        <Text style={styles.eventLabelText}>Event</Text>
      </View>

      {/* Main Card */}
      <View style={styles.card}>
        {/* Banner Image */}
        <View style={styles.imageContainer}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderBanner}
            >
              <Ionicons
                name="calendar-outline"
                size={48}
                color="rgba(255,255,255,0.7)"
              />
            </LinearGradient>
          )}

          {/* Date Badge */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{displayDate}</Text>
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {/* Community Info */}
          <TouchableOpacity
            style={styles.communityRow}
            onPress={() => {
              /* Navigate to community profile */
            }}
          >
            {hasValidPhoto ? (
              <Image
                source={{ uri: community_logo }}
                style={styles.communityAvatar}
              />
            ) : (
              <LinearGradient
                colors={getGradientForName(community_name || "Community")}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.communityAvatar, styles.communityAvatarGradient]}
              >
                <Text style={styles.communityInitials}>
                  {getInitials(community_name || "C")}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.communityName} numberOfLines={1}>
              {community_name}
            </Text>
            {is_following_community && (
              <View style={styles.followingBadge}>
                <Text style={styles.followingText}>Following</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Meta Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.metaText}>{displayTime}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons
                name={
                  event_type === "virtual"
                    ? "videocam-outline"
                    : "location-outline"
                }
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.metaText} numberOfLines={1}>
                {locationName}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Attendees + Interested Button */}
          <View style={styles.bottomRow}>
            <View style={styles.attendeeInfo}>
              <Ionicons
                name="people-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.attendeeText}>
                {attendee_count > 0
                  ? `${attendee_count} attending`
                  : "Be the first!"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.interestedButton,
                isInterested && styles.interestedButtonActive,
              ]}
              onPress={handleInterestedPress}
              disabled={interestLoading}
            >
              {isInterested ? (
                <View style={styles.interestedActiveContent}>
                  <Ionicons name="bookmark" size={16} color={COLORS.primary} />
                  <Text style={styles.interestedActiveText}>Saved</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.interestedGradient}
                >
                  <Text style={styles.interestedText}>Interested</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  eventLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  eventLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  imageContainer: {
    height: 160,
    position: "relative",
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
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.s,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 10,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  communityAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  communityAvatarGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  communityInitials: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  communityName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  followingBadge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  followingText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    maxWidth: 120,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attendeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendeeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  interestedButton: {
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
  },
  interestedButtonActive: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "#F0E6FF",
  },
  interestedActiveContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  interestedActiveText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  interestedGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  interestedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
