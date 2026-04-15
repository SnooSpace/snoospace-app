import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from "react-native";
import { Ticket } from "lucide-react-native";
import { COLORS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

/**
 * TicketMessageCard - Clean Instagram-style ticket card for chat messages
 * Matches reference image with #CEF2F2 background and clean typography
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

  const isConfirmed = status === "confirmed" || status === "registered";
  const isPending = status === "pending";
  const isDeclined = status === "declined";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header with ticket icon */}
        <View style={styles.header}>
          <Ticket size={16} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.headerText}>
            Sent {quantity} ticket{quantity > 1 ? "s" : ""}
          </Text>
        </View>

        {/* Dashed separator */}
        <View style={styles.separator}>
          {[...Array(20)].map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>

        {/* Event Title */}
        <Text style={styles.eventTitle} numberOfLines={2}>
          {eventTitle}
        </Text>

        {/* Ticket Badge */}
        <View style={styles.ticketBadge}>
          <Text style={styles.ticketBadgeText}>
            {quantity}X {ticketName}
          </Text>
        </View>

        {/* View Event Details Link */}
        <TouchableOpacity style={styles.viewEventLink} onPress={onViewEvent}>
          <Text style={styles.viewEventText}>View Event Details</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: "rgba(206, 242, 242, 0.09)", // #CEF2F2 at 9% opacity
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(206, 242, 242, 0.2)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  headerText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: COLORS.primary,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dash: {
    width: 4,
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 0.5,
  },
  eventTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 17,
    color: "#000000",
    marginBottom: 12,
    lineHeight: 24,
  },
  ticketBadge: {
    backgroundColor: "#CEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  ticketBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  viewEventLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.08)",
  },
  viewEventText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  arrow: {
    fontSize: 20,
    color: COLORS.primary,
    marginLeft: 4,
  },
});

export default TicketMessageCard;
