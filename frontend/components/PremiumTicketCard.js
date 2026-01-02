import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = CARD_WIDTH * 0.55;

/**
 * Premium Cyberpunk Ticket Card
 * A futuristic, animated ticket component with holographic effects
 *
 * @param {Object} props
 * @param {string} props.eventTitle - Event name
 * @param {string} props.ticketType - Ticket type name (e.g., "VIP", "General")
 * @param {string} props.date - Formatted event date
 * @param {string} props.time - Formatted event time
 * @param {string} props.location - Event location
 * @param {string} props.ticketId - Unique ticket ID for display
 * @param {string} props.holderName - Name of ticket holder
 * @param {boolean} props.isGifted - Whether this was a gifted ticket
 * @param {string} props.giftedFrom - Name of person who gifted (if applicable)
 * @param {string} props.status - Ticket status: 'active', 'used', 'revoked'
 */
const PremiumTicketCard = ({
  eventTitle = "Event Name",
  ticketType = "General Admission",
  date = "Jan 1, 2026",
  time = "7:00 PM",
  location = "Venue Name",
  ticketId = "TKT-000000",
  holderName = "Guest",
  isGifted = false,
  giftedFrom = null,
  status = "active",
}) => {
  // Animated values for holographic shimmer effect
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Shimmer animation - moves across the card
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Subtle pulse for active tickets
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    if (status === "active") {
      shimmerLoop.start();
      pulseLoop.start();
    }

    return () => {
      shimmerLoop.stop();
      pulseLoop.stop();
    };
  }, [status, shimmerAnim, pulseAnim]);

  // Calculate shimmer position
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH],
  });

  // Status-based styling
  const getStatusStyles = () => {
    switch (status) {
      case "revoked":
        return {
          gradient: ["#2D2D2D", "#1A1A1A"],
          accentColor: "#FF4444",
          opacity: 0.6,
          overlay: true,
        };
      case "used":
        return {
          gradient: ["#3D3D3D", "#2A2A2A"],
          accentColor: "#888888",
          opacity: 0.8,
          overlay: true,
        };
      default: // active
        return {
          gradient: ["#0A0A1A", "#1A0A2E", "#0A1A2E"],
          accentColor: "#00FFFF",
          opacity: 1,
          overlay: false,
        };
    }
  };

  const statusStyles = getStatusStyles();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: status === "active" ? pulseAnim : 1 }],
          opacity: statusStyles.opacity,
        },
      ]}
    >
      <LinearGradient
        colors={statusStyles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Holographic shimmer overlay */}
        {status === "active" && (
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerTranslate }] },
            ]}
          >
            <LinearGradient
              colors={[
                "transparent",
                "rgba(0, 255, 255, 0.1)",
                "rgba(255, 0, 255, 0.1)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>
        )}

        {/* Circuit pattern background */}
        <View style={styles.circuitPattern}>
          <View style={[styles.circuitLine, { top: "20%", width: "40%" }]} />
          <View
            style={[
              styles.circuitLine,
              { top: "50%", left: "30%", width: "50%" },
            ]}
          />
          <View style={[styles.circuitLine, { top: "80%", width: "35%" }]} />
          <View style={[styles.circuitDot, { top: "20%", left: "40%" }]} />
          <View style={[styles.circuitDot, { top: "50%", left: "80%" }]} />
          <View style={[styles.circuitDot, { top: "80%", left: "35%" }]} />
        </View>

        {/* Top section - Event info */}
        <View style={styles.topSection}>
          <View style={styles.eventInfo}>
            <Text
              style={[styles.eventTitle, { color: statusStyles.accentColor }]}
              numberOfLines={1}
            >
              {eventTitle}
            </Text>
            <View style={styles.ticketTypeBadge}>
              <Text style={styles.ticketTypeText}>{ticketType}</Text>
            </View>
          </View>
          {isGifted && (
            <View style={styles.giftBadge}>
              <Ionicons name="gift" size={14} color="#FF69B4" />
              <Text style={styles.giftText}>Gift</Text>
            </View>
          )}
        </View>

        {/* Dashed line separator */}
        <View style={styles.separator}>
          <View style={styles.notchLeft} />
          {[...Array(20)].map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
          <View style={styles.notchRight} />
        </View>

        {/* Bottom section - Details */}
        <View style={styles.bottomSection}>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{date}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{time}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.detailText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          </View>

          <View style={styles.ticketMeta}>
            <Text style={styles.holderName}>{holderName}</Text>
            <Text style={styles.ticketIdText}>{ticketId}</Text>
          </View>
        </View>

        {/* Status overlay for revoked/used */}
        {statusStyles.overlay && (
          <View style={styles.statusOverlay}>
            <View
              style={[
                styles.statusBadge,
                { borderColor: statusStyles.accentColor },
              ]}
            >
              <Text
                style={[styles.statusText, { color: statusStyles.accentColor }]}
              >
                {status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Gifted from info */}
        {isGifted && giftedFrom && (
          <View style={styles.giftedFromBanner}>
            <Text style={styles.giftedFromText}>🎁 Gifted by {giftedFrom}</Text>
          </View>
        )}

        {/* Corner accents */}
        <View
          style={[
            styles.cornerAccent,
            styles.cornerTopLeft,
            { borderColor: statusStyles.accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerTopRight,
            { borderColor: statusStyles.accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerBottomLeft,
            { borderColor: statusStyles.accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerBottomRight,
            { borderColor: statusStyles.accentColor },
          ]}
        />
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "center",
  },
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: CARD_HEIGHT,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 255, 0.2)",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  shimmerGradient: {
    flex: 1,
    width: CARD_WIDTH * 0.5,
  },
  circuitPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  circuitLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "#00FFFF",
    left: 0,
  },
  circuitDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00FFFF",
  },
  topSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    zIndex: 2,
  },
  eventInfo: {
    flex: 1,
    marginRight: 10,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
    textShadowColor: "rgba(0, 255, 255, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ticketTypeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  ticketTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  giftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 105, 180, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 105, 180, 0.4)",
  },
  giftText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF69B4",
    textTransform: "uppercase",
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  notchLeft: {
    width: 12,
    height: 24,
    backgroundColor: "#F9FAFB",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    position: "absolute",
    left: -20,
  },
  notchRight: {
    width: 12,
    height: 24,
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    position: "absolute",
    right: -20,
  },
  dash: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 2,
    borderRadius: 1,
  },
  bottomSection: {
    zIndex: 2,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: "#CCCCCC",
    fontWeight: "500",
  },
  ticketMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  holderName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ticketIdText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666666",
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  statusOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 10,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 8,
    transform: [{ rotate: "-15deg" }],
  },
  statusText: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 4,
  },
  giftedFromBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 105, 180, 0.15)",
    paddingVertical: 4,
    alignItems: "center",
    zIndex: 3,
  },
  giftedFromText: {
    fontSize: 10,
    color: "#FF69B4",
    fontWeight: "600",
  },
  cornerAccent: {
    position: "absolute",
    width: 12,
    height: 12,
    borderWidth: 2,
    zIndex: 5,
  },
  cornerTopLeft: {
    top: 8,
    left: 8,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 8,
    right: 8,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 8,
    left: 8,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 8,
    right: 8,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
});

export default PremiumTicketCard;
