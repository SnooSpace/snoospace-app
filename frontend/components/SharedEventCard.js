import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, MapPin, Video, ArrowRight } from "lucide-react-native";
import { COLORS, FONTS } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.72;

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

/**
 * SharedEventCard — premium preview rendered in chat when
 * someone shares an event (message_type === "event_share").
 *
 * Metadata shape (from shareEvent backend):
 *   { eventId, title, description, bannerUrl, eventDate, locationName,
 *     eventType, communityId, communityName, communityUsername, communityLogo }
 */
const SharedEventCard = React.memo(({ metadata, onPress, style }) => {
  if (!metadata) return null;

  const {
    eventId,
    title,
    description,
    bannerUrl,
    eventDate,
    locationName,
    eventType,
    communityName,
    communityLogo,
    communityUsername,
  } = metadata;

  const targetId = eventId || metadata.event_id || metadata.id;
  const displayTitle = title || "Untitled Event";
  const displayCommunity = communityName || communityUsername || "Community";
  const formattedDate = formatEventDate(eventDate);
  const isVirtual = eventType === "virtual" || eventType === "hybrid";

  const handlePress = useCallback(() => {
    if (onPress && targetId) onPress(targetId);
  }, [onPress, targetId]);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={["#1A1826", "#2D2640"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* ── Header badge ─────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>EVENT</Text>
          </View>
          <View style={styles.iconContainer}>
            <Calendar size={14} color="#A78BFA" strokeWidth={2} />
          </View>
        </View>

        {/* ── Banner image ──────────────────────────────────────── */}
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={styles.banner}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <Calendar size={28} color="rgba(167, 139, 250, 0.4)" strokeWidth={1.5} />
          </View>
        )}

        {/* ── Community row ─────────────────────────────────────── */}
        <View style={styles.communityRow}>
          <Image
            source={
              communityLogo
                ? { uri: communityLogo }
                : {
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      displayCommunity
                    )}&background=7C3AED&color=FFFFFF&size=88`,
                  }
            }
            style={styles.communityAvatar}
          />
          <Text style={styles.communityName} numberOfLines={1}>
            {displayCommunity}
          </Text>
        </View>

        {/* ── Title ─────────────────────────────────────────────── */}
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>

        {/* ── Meta row ─────────────────────────────────────────── */}
        <View style={styles.metaRow}>
          {formattedDate && (
            <View style={styles.metaItem}>
              <Calendar size={11} color="#A78BFA" strokeWidth={2} />
              <Text style={styles.metaText}>{formattedDate}</Text>
            </View>
          )}
          {(locationName || isVirtual) && (
            <View style={styles.metaItem}>
              {isVirtual ? (
                <Video size={11} color="#A78BFA" strokeWidth={2} />
              ) : (
                <MapPin size={11} color="#A78BFA" strokeWidth={2} />
              )}
              <Text style={styles.metaText} numberOfLines={1}>
                {isVirtual ? "Virtual" : locationName}
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer CTA ───────────────────────────────────────── */}
        <View style={styles.footerRow}>
          <View style={styles.viewButton}>
            <LinearGradient
              colors={["#7C3AED", "#5B21B6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewButtonGradient}
            >
              <Text style={styles.viewButtonText}>View Event</Text>
              <ArrowRight size={11} color="#FFFFFF" style={{ marginLeft: 4 }} strokeWidth={2.5} />
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeBadge: {
    backgroundColor: "rgba(124, 58, 237, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.semiBold,
    color: "#A78BFA",
    letterSpacing: 0.8,
  },
  iconContainer: {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
  },
  banner: {
    width: "100%",
    height: 110,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  bannerPlaceholder: {
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  communityAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  communityName: {
    fontSize: 11,
    color: "rgba(167, 139, 250, 0.8)",
    fontFamily: FONTS.medium,
    flex: 1,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: "#FFFFFF",
    marginBottom: 8,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "rgba(167, 139, 250, 0.8)",
    fontFamily: FONTS.medium,
    maxWidth: 120,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  viewButton: {
    borderRadius: 10,
    overflow: "hidden",
  },
  viewButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
});

export default SharedEventCard;
