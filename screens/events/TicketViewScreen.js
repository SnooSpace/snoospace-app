/**
 * TicketViewScreen - Display user's event ticket with QR code
 * Shows: QR code for entry, event details, ticket breakdown
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { getMyTicket } from "../../api/events";
import { useLocationName } from "../../utils/locationNameCache";
import SnooLoader from "../../components/ui/SnooLoader";

const BACKGROUND_COLOR = "#F5F5F5";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1F2937";
const MUTED_TEXT = "#6B7280";
const PRIMARY_COLOR = "#6A0DAD";
const SUCCESS_COLOR = "#16A34A";
const WARNING_COLOR = "#F59E0B";
const ERROR_COLOR = "#DC2626";

export default function TicketViewScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve location name
  const locationName = useLocationName(ticket?.locationUrl);

  useEffect(() => {
    loadTicket();
  }, [eventId]);

  const loadTicket = async () => {
    if (!eventId) {
      setError("No event specified");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await getMyTicket(eventId);
      if (response?.ticket) {
        setTicket(response.ticket);
      } else if (response?.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error("Error loading ticket:", err);
      setError(err.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateTime = (dateString) => {
    return `${formatDate(dateString)} • ${formatTime(dateString)}`;
  };

  const handleOpenLocation = () => {
    if (ticket?.locationUrl) {
      Linking.openURL(ticket.locationUrl).catch(() => {
        Alert.alert("Error", "Unable to open maps");
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "registered":
        return SUCCESS_COLOR;
      case "attended":
        return PRIMARY_COLOR;
      case "cancelled":
        return ERROR_COLOR;
      case "revoked":
        return ERROR_COLOR;
      default:
        return MUTED_TEXT;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "registered":
        return "✓ Confirmed";
      case "attended":
        return "✓ Attended";
      case "cancelled":
        return "✗ Cancelled";
      case "revoked":
        return "⊘ Revoked";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { fontFamily: 'Manrope-Medium' }]}>Loading ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={ERROR_COLOR} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTicket}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCancelled = ticket?.status === "cancelled";
  const isRevoked = ticket?.status === "revoked";
  const isInvalid = isCancelled || isRevoked;
  const isPast = new Date(ticket?.eventDate) < new Date();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Ticket</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket Card */}
        <View style={styles.ticketCard}>
          {/* QR Code Section */}
          <View
            style={[styles.qrSection, isInvalid && styles.qrSectionCancelled]}
          >
            <View
              style={[
                styles.qrContainer,
                isInvalid && styles.qrContainerCancelled,
              ]}
            >
              <QRCode
                value={ticket?.qrCodeData || "INVALID"}
                size={200}
                backgroundColor={isInvalid ? "#F3F4F6" : "#FFFFFF"}
                color={isInvalid ? "#9CA3AF" : "#000000"}
              />
            </View>
            {isRevoked ? (
              <Text style={styles.qrCancelledText}>Ticket Revoked</Text>
            ) : isCancelled ? (
              <Text style={styles.qrCancelledText}>Ticket Cancelled</Text>
            ) : (
              <Text style={styles.qrHint}>Scan this QR code at entry</Text>
            )}
          </View>

          {/* Revoked Banner */}
          {isRevoked && ticket?.revokedReason && (
            <View style={styles.revokedBanner}>
              <Ionicons name="warning" size={18} color={ERROR_COLOR} />
              <Text style={styles.revokedText}>{ticket.revokedReason}</Text>
            </View>
          )}

          {/* Dashed Divider */}
          <View style={styles.dashedDivider}>
            <View style={styles.circleLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.circleRight} />
          </View>

          {/* Event Info */}
          <View style={styles.eventSection}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {ticket?.eventTitle}
            </Text>
            <Text style={styles.communityName}>{ticket?.communityName}</Text>

            {/* Date & Time */}
            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.infoText}>
                {formatDateTime(ticket?.eventDate)}
              </Text>
            </View>

            {/* Location */}
            {ticket?.locationUrl && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={handleOpenLocation}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.infoText} numberOfLines={2}>
                  {locationName || "View Location"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={MUTED_TEXT} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Ticket Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Ticket Details</Text>

          {ticket?.tickets?.map((t, index) => (
            <View key={index} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>
                  {t.quantity}× {t.name}
                </Text>
                <Text style={styles.ticketPrice}>
                  ₹{t.unitPrice.toLocaleString("en-IN")} each
                </Text>
              </View>
              <Text style={styles.ticketTotal}>
                ₹{t.totalPrice.toLocaleString("en-IN")}
              </Text>
            </View>
          ))}

          {ticket?.discountAmount > 0 && (
            <View style={styles.ticketRow}>
              <Text style={styles.discountLabel}>
                Discount {ticket?.promoCode && `(${ticket.promoCode})`}
              </Text>
              <Text style={styles.discountAmount}>
                -₹{ticket.discountAmount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalAmount}>
              ₹{(ticket?.totalAmount || 0).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* Booking Info Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Booking Information</Text>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booking ID</Text>
            <Text style={styles.bookingValue}>#{ticket?.registrationId}</Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booked by</Text>
            <Text style={styles.bookingValue}>{ticket?.memberName}</Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booked on</Text>
            <Text style={styles.bookingValue}>
              {formatDate(ticket?.registeredAt)}
            </Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Status</Text>
            <Text
              style={[
                styles.statusValue,
                { color: getStatusColor(ticket?.status) },
              ]}
            >
              {getStatusLabel(ticket?.status)}
            </Text>
          </View>

          {isCancelled && ticket?.refundAmount > 0 && (
            <View style={styles.bookingRow}>
              <Text style={styles.bookingLabel}>Refund</Text>
              <Text style={[styles.bookingValue, { color: SUCCESS_COLOR }]}>
                ₹{ticket.refundAmount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}
        </View>

        {/* Past Event Notice */}
        {isPast && !isCancelled && (
          <View style={styles.noticeCard}>
            <Ionicons name="time-outline" size={20} color={WARNING_COLOR} />
            <Text style={styles.noticeText}>
              This event has ended. This ticket is kept for your records.
            </Text>
          </View>
        )}

        {/* Bottom spacing to prevent content being covered by bottom navigation */}
        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_BACKGROUND,
  },
  headerWrapper: {
    backgroundColor: CARD_BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 12,
  
    fontFamily: "Manrope-Regular",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContent: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: CARD_BACKGROUND,
  },
  qrSectionCancelled: {
    backgroundColor: "#F9FAFB",
  },
  qrContainer: {
    padding: 16,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qrContainerCancelled: {
    opacity: 0.5,
  },
  qrHint: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 16,
  },
  qrCancelledText: {
    fontSize: 14,
    color: ERROR_COLOR,
    fontWeight: "600",
    marginTop: 16,
  },
  dashedDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 0,
  },
  circleLeft: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BACKGROUND_COLOR,
    marginLeft: -12,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  circleRight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BACKGROUND_COLOR,
    marginRight: -12,
  },
  eventSection: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  communityName: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  detailsCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED_TEXT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  ticketPrice: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  ticketTotal: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  discountLabel: {
    fontSize: 14,
    color: SUCCESS_COLOR,
  },
  discountAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: SUCCESS_COLOR,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY_COLOR,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  bookingLabel: {
    fontSize: 14,
    color: MUTED_TEXT,
  },
  bookingValue: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
  },
  revokedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  revokedText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
  },
});
