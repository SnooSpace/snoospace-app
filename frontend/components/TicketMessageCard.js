import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.8;

/**
 * TicketMessageCard - Cyberpunk-styled ticket card for chat messages
 * Matches the PremiumTicketCard aesthetic with dark gradients and shimmer effects
 */
const TicketMessageCard = ({
  metadata,
  isFromMe,
  senderName,
  onViewEvent,
  onConfirmGoing,
  onDecline,
  loading,
}) => {
  const { eventId, eventTitle, ticketName, quantity, isFree, message, status } =
    metadata || {};

  // 'registered' is the confirmed state for RSVP'd free tickets
  const isConfirmed = status === "confirmed" || status === "registered";
  const isPending = status === "pending";
  const isDeclined = status === "declined";

  // Shimmer animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Show shimmer only for pending tickets
    if (!isConfirmed && status !== "declined") {
      const shimmerLoop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      shimmerLoop.start();
      return () => shimmerLoop.stop();
    }
  }, [status, shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH],
  });

  // Status-based styling
  const getAccentColor = () => {
    if (isConfirmed) return "#22C55E";
    if (isDeclined) return "#6B7280";
    return "#00FFFF"; // Cyan for pending
  };

  const getGradient = () => {
    if (isConfirmed) return ["#0A1A0A", "#0D2A0D"];
    if (isDeclined) return ["#1A1A1A", "#2D2D2D"];
    return ["#0A0A1A", "#1A0A2E", "#0A1A2E"];
  };

  const accentColor = getAccentColor();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={getGradient()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, isDeclined && { opacity: 0.7 }]}
      >
        {/* Shimmer effect for pending tickets */}
        {isPending && (
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerTranslate }] },
            ]}
          >
            <LinearGradient
              colors={[
                "transparent",
                "rgba(0, 255, 255, 0.15)",
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
          <View style={[styles.circuitLine, { top: "15%", width: "35%" }]} />
          <View
            style={[
              styles.circuitLine,
              { top: "45%", left: "25%", width: "45%" },
            ]}
          />
          <View style={[styles.circuitLine, { top: "75%", width: "30%" }]} />
          <View style={[styles.circuitDot, { top: "15%", left: "35%" }]} />
          <View style={[styles.circuitDot, { top: "45%", left: "70%" }]} />
          <View style={[styles.circuitDot, { top: "75%", left: "30%" }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View
            style={[styles.ticketIconContainer, { borderColor: accentColor }]}
          >
            <Ionicons name="ticket" size={18} color={accentColor} />
          </View>
          <Text style={[styles.headerText, { color: accentColor }]}>
            {isFromMe
              ? `Sent ${quantity} ticket${quantity > 1 ? "s" : ""}`
              : isConfirmed
              ? "You're going!"
              : `${quantity} ticket${quantity > 1 ? "s" : ""} received!`}
          </Text>
          {!isFromMe && isPending && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        {/* Dashed separator */}
        <View style={styles.separator}>
          <View style={styles.notchLeft} />
          {[...Array(15)].map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
          <View style={styles.notchRight} />
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text
            style={[styles.eventTitle, { textShadowColor: `${accentColor}80` }]}
            numberOfLines={2}
          >
            {eventTitle}
          </Text>
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>
              {quantity}x {ticketName}
            </Text>
          </View>
        </View>

        {/* Personal Message */}
        {message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>"{message}"</Text>
            {senderName && (
              <Text style={styles.messageSender}>— {senderName}</Text>
            )}
          </View>
        )}

        {/* Action Buttons for pending free tickets */}
        {!isFromMe && isPending && isFree && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.goingButton}
              onPress={onConfirmGoing}
              disabled={loading}
            >
              <LinearGradient
                colors={["#22C55E", "#16A34A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.goingButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.goingButtonText}>I'm Going!</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              disabled={loading}
            >
              <Text style={styles.declineButtonText}>Not Going</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Confirmed Status */}
        {isConfirmed && (
          <View style={styles.confirmedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={styles.confirmedText}>You're attending!</Text>
          </View>
        )}

        {/* View Event Link */}
        <TouchableOpacity style={styles.viewEventLink} onPress={onViewEvent}>
          <Text style={[styles.viewEventText, { color: accentColor }]}>
            View Event Details
          </Text>
          <Ionicons name="chevron-forward" size={14} color={accentColor} />
        </TouchableOpacity>

        {/* Corner accents */}
        <View
          style={[
            styles.cornerAccent,
            styles.cornerTopLeft,
            { borderColor: accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerTopRight,
            { borderColor: accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerBottomLeft,
            { borderColor: accentColor },
          ]}
        />
        <View
          style={[
            styles.cornerAccent,
            styles.cornerBottomRight,
            { borderColor: accentColor },
          ]}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    marginVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 255, 0.25)",
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
    opacity: 0.12,
  },
  circuitLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "#00FFFF",
    left: 0,
  },
  circuitDot: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#00FFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    zIndex: 2,
  },
  ticketIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 255, 255, 0.1)",
  },
  headerText: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    letterSpacing: 0.3,
  },
  newBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  notchLeft: {
    width: 10,
    height: 20,
    backgroundColor: "#FFFFFF",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    position: "absolute",
    left: -16,
  },
  notchRight: {
    width: 10,
    height: 20,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    position: "absolute",
    right: -16,
  },
  dash: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 2,
    borderRadius: 1,
  },
  eventInfo: {
    marginBottom: 12,
    zIndex: 2,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ticketBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageBox: {
    backgroundColor: "rgba(255, 105, 180, 0.15)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#FF69B4",
  },
  messageText: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#FFFFFF",
  },
  messageSender: {
    fontSize: 11,
    color: "#FF69B4",
    marginTop: 6,
    textAlign: "right",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
    zIndex: 2,
  },
  goingButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  goingButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  goingButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  declineButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#AAAAAA",
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  confirmedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
  },
  viewEventLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    zIndex: 2,
  },
  viewEventText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cornerAccent: {
    position: "absolute",
    width: 10,
    height: 10,
    borderWidth: 2,
    zIndex: 5,
  },
  cornerTopLeft: {
    top: 6,
    left: 6,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 6,
    right: 6,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 6,
    left: 6,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 6,
    right: 6,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
});

export default TicketMessageCard;
