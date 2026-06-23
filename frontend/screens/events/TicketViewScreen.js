/**
 * TicketViewScreen - Display user's event ticket with QR code
 * Shows: QR code for entry, event details, ticket breakdown
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, Image } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ChevronRight,
  Clock,
  AlertCircle,
  TriangleAlert,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import { getMyTicket } from "../../api/events";
import { useLocationName } from "../../utils/locationNameCache";
import SnooLoader from "../../components/ui/SnooLoader";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";

const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1A2D4A";
const MUTED_TEXT = "#6B7280";
const PRIMARY_COLOR = "#2962FF";
const SUCCESS_COLOR = "#16A34A";
const WARNING_COLOR = "#D97706";
const ERROR_COLOR = "#EF4444";

export default function TicketViewScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve location name with fallback
  const rawLocationName = useLocationName(ticket?.locationUrl, {
    fallback: ticket?.eventType === "virtual" ? "Virtual Event" : "Location TBD",
  });
  const displayLocation = ticket?.locationName || rawLocationName;

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
      case "revoked":
        return ERROR_COLOR;
      default:
        return MUTED_TEXT;
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case "registered":
        return "#E8F5E9"; // Soft green
      case "attended":
        return "#E0F2FE"; // Soft blue
      case "cancelled":
      case "revoked":
        return "#FEE2E2"; // Soft red
      default:
        return "#F3F4F6";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "registered":
        return "Confirmed";
      case "attended":
        return "Attended";
      case "cancelled":
        return "Cancelled";
      case "revoked":
        return "Revoked";
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
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading ticket...</Text>
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
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <AlertCircle size={60} color={ERROR_COLOR} strokeWidth={2} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTicket} activeOpacity={0.85}>
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
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
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
              <TriangleAlert size={18} color={ERROR_COLOR} strokeWidth={2} />
              <Text style={styles.revokedText}>{ticket.revokedReason}</Text>
            </View>
          )}

          {/* Dashed Divider with Semicircular coupon bite notches */}
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
            
            {/* Organizer/Community Row */}
            <View style={styles.communityRow}>
              {ticket?.communityLogo && /^https?:\/\//.test(ticket.communityLogo) ? (
                <Image
                  source={{ uri: ticket.communityLogo }}
                  style={styles.communityAvatar}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(ticket?.communityName || "Community")}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.communityAvatar, styles.communityAvatarGradient]}
                >
                  <Text style={styles.communityInitials}>
                    {getInitials(ticket?.communityName || "C")}
                  </Text>
                </LinearGradient>
              )}
              <Text style={styles.communityName} numberOfLines={1}>
                {ticket?.communityName}
              </Text>
            </View>

            {/* Date & Time Row */}
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Calendar size={18} color={PRIMARY_COLOR} strokeWidth={2} />
              </View>
              <Text style={styles.infoText}>
                {formatDateTime(ticket?.eventDate)}
              </Text>
            </View>

            {/* Location Row */}
            {ticket?.locationUrl && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={handleOpenLocation}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <MapPin size={18} color={PRIMARY_COLOR} strokeWidth={2} />
                </View>
                <Text style={styles.infoText} numberOfLines={2}>
                  {displayLocation || "View Location"}
                </Text>
                <ChevronRight size={16} color={MUTED_TEXT} strokeWidth={2.2} />
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
            <View style={[styles.statusPill, { backgroundColor: getStatusBgColor(ticket?.status) }]}>
              <Text
                style={[
                  styles.statusValue,
                  { color: getStatusColor(ticket?.status) },
                ]}
              >
                {getStatusLabel(ticket?.status)}
              </Text>
            </View>
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
            <Clock size={18} color={WARNING_COLOR} strokeWidth={2} />
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
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.black,
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 15,
    color: MUTED_TEXT,
    marginTop: 12,
    fontFamily: FONTS.semiBold,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
    marginTop: 8,
    fontFamily: FONTS.semiBold,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
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
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
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
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qrContainerCancelled: {
    opacity: 0.5,
  },
  qrHint: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 16,
    fontFamily: FONTS.semiBold,
  },
  qrCancelledText: {
    fontSize: 14,
    color: ERROR_COLOR,
    fontFamily: FONTS.semiBold,
    marginTop: 16,
  },
  dashedDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 0,
    position: "relative",
  },
  circleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR,
    marginLeft: -10,
    zIndex: 10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  circleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR,
    marginRight: -10,
    zIndex: 10,
  },
  eventSection: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 22,
    fontFamily: FONTS.primary,
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
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
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  communityName: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#5E8D9B",
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.primary,
    color: MUTED_TEXT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  ticketPrice: {
    fontSize: 12.5,
    fontFamily: FONTS.semiBold,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  ticketTotal: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  discountLabel: {
    fontSize: 14,
    color: SUCCESS_COLOR,
    fontFamily: FONTS.semiBold,
  },
  discountAmount: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: SUCCESS_COLOR,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  totalAmount: {
    fontSize: 19,
    fontFamily: FONTS.semiBold,
    color: PRIMARY_COLOR,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  bookingLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: MUTED_TEXT,
  },
  bookingValue: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statusValue: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  revokedText: {
    flex: 1,
    fontSize: 13,
    color: "#EF4444",
    fontFamily: FONTS.semiBold,
  },
});
