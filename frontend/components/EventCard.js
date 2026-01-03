import React, { useState, useEffect, useRef } from "react";
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
import { getActiveAccount } from "../api/auth";

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
    Boolean(event?.is_interested)
  );
  const [userRole, setUserRole] = useState(null);
  const [interestLoading, setInterestLoading] = useState(false);

  // Ref to track if we're the source of an EventBus event (prevent self-listening)
  const isEmittingRef = useRef(false);

  // Fetch current user role
  useEffect(() => {
    getActiveAccount()
      .then((account) => {
        if (account?.type) {
          setUserRole(account.type);
        }
      })
      .catch((err) =>
        console.error("[EventCard] Error fetching account:", err)
      );
  }, []);

  // Listen for interest updates from other components (e.g., EventDetailsScreen)
  useEffect(() => {
    if (!event?.id) return;

    const unsubscribe = EventBus.on("event-interest-updated", (payload) => {
      // Skip if we emitted this event ourselves
      if (isEmittingRef.current) return;

      if (payload?.eventId === event.id) {
        setIsInterested(Boolean(payload.isInterested));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [event?.id]);

  // Also update if the event prop changes (e.g., on screen focus refresh)
  useEffect(() => {
    if (event?.is_interested !== undefined) {
      setIsInterested(Boolean(event.is_interested));
    }
  }, [event?.is_interested]);

  // Check if user is registered for this event
  const isRegistered = Boolean(event?.is_registered);

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
    access_type,
    invite_public_visibility,
    is_invited,
  } = event;

  // Check if location should be hidden (invite-only event with public visibility, user NOT invited/registered)
  const shouldHideLocation =
    access_type === "invite_only" &&
    invite_public_visibility === true &&
    !is_invited &&
    !isRegistered;

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

  // Get location name from Google Maps URL (handles shortened URLs), or hide if invite-only
  const rawLocationName = useLocationName(location_url, {
    fallback: event_type === "virtual" ? "Virtual Event" : "Location TBD",
  });

  // Use custom location_name if provided, but hide for invite-only events
  const locationName = shouldHideLocation
    ? null
    : event.location_name || rawLocationName;

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
        const newInterestState = Boolean(response.is_interested);
        setIsInterested(newInterestState);

        // Mark that we're emitting to prevent self-listening
        isEmittingRef.current = true;
        EventBus.emit("event-interest-updated", {
          eventId: id,
          isInterested: newInterestState,
        });
        // Reset flag after a tick to allow future external events
        setTimeout(() => {
          isEmittingRef.current = false;
        }, 0);
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
            {/* Location - hidden for invite-only events with public visibility */}
            {locationName && (
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
            )}
          </View>

          {/* Bottom Row: Attendees + Interested Button */}
          <View
            style={[
              styles.bottomRow,
              userRole === "community" && { justifyContent: "flex-start" },
            ]}
          >
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

            {userRole !== "community" && (
              <>
                {isRegistered ? (
                  <View style={[styles.interestedButton, styles.goingButton]}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#16A34A"
                    />
                    <Text style={styles.goingText}>You are going</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={`interest-btn-${isInterested}`}
                    style={[
                      styles.interestedButton,
                      isInterested === true && styles.interestedButtonActive,
                    ]}
                    onPress={handleInterestedPress}
                    disabled={interestLoading}
                  >
                    {isInterested === true ? (
                      <View style={styles.interestedActiveContent}>
                        <Ionicons
                          name="bookmark"
                          size={16}
                          color={COLORS.primary}
                        />
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
                )}
              </>
            )}
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
    minWidth: 100,
    minHeight: 36,
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
  goingButton: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
});
