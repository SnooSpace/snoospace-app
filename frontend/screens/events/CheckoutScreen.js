/**
 * CheckoutScreen - Review booking and confirm
 * Shows order summary, timer, promo codes, and confirmation
 */
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, TextInput, Alert, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import {
  registerForEvent,
  reserveTickets,
  releaseReservation,
} from "../../api/events";
import EventBus from "../../utils/EventBus";
import CelebrationModal from "../../components/CelebrationModal";
import SnooLoader from "../../components/ui/SnooLoader";

// White Theme Colors
const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1F2937";
const MUTED_TEXT = "#6B7280";
const BORDER_COLOR = "#E5E7EB";
const PRIMARY_COLOR = COLORS.primary;
const SUCCESS_COLOR = "#34C759";

export default function CheckoutScreen({ route, navigation }) {
  const { event, cartItems, totalAmount } = route.params;
  const insets = useSafeAreaInsets();

  // 10-minute countdown timer
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes in seconds
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Reservation state
  const [sessionId, setSessionId] = useState(null);
  const [reservationError, setReservationError] = useState(null);
  const [isReserving, setIsReserving] = useState(true);

  // Reserve tickets on mount
  useEffect(() => {
    let isMounted = true;

    const doReserve = async () => {
      try {
        const tickets = cartItems.map((item) => ({
          ticketTypeId: item.ticket.id,
          quantity: item.quantity,
        }));

        const response = await reserveTickets(event.id, tickets);

        if (!isMounted) return;

        if (response.success) {
          setSessionId(response.sessionId);
          setReservationError(null);
        } else {
          setReservationError(response.error || "Failed to reserve tickets");
          Alert.alert(
            "Reservation Failed",
            response.error || "Unable to reserve tickets. Please try again.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        if (!isMounted) return;
        setReservationError(error.message);
        Alert.alert(
          "Reservation Failed",
          error.message || "Unable to reserve tickets. Please try again.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } finally {
        if (isMounted) setIsReserving(false);
      }
    };

    doReserve();

    // Cleanup: release reservation if not completed
    return () => {
      isMounted = false;
      // Note: We'll handle release in handleGoBack and timer expiry
    };
  }, []);

  // Release reservation when leaving without completing
  const handleReleaseReservation = async () => {
    if (sessionId && !isConfirmed) {
      try {
        await releaseReservation(event.id, sessionId);
      } catch (err) {
        console.warn("Failed to release reservation:", err);
      }
    }
  };

  useEffect(() => {
    if (timeLeft <= 0 || isConfirmed) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Release reservation on timeout
          handleReleaseReservation();
          Alert.alert(
            "Session Expired",
            "Your booking session has expired. Please try again.",
            [{ text: "OK", onPress: () => navigation.popToTop() }]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isConfirmed, sessionId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase().trim();
    if (!code) return;

    const discount = event.discount_codes?.find(
      (dc) => dc.code.toUpperCase() === code && dc.is_active
    );

    if (discount) {
      setAppliedDiscount(discount);
      Alert.alert("Success", `Promo code "${code}" applied!`);
    } else {
      Alert.alert(
        "Invalid Code",
        "This promo code is not valid or has expired."
      );
    }
  };

  const handleRemoveItem = (index) => {
    Alert.alert("Remove Item", "Are you sure you want to remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (cartItems.length === 1) {
            navigation.goBack();
          } else {
            // Would need to update cart, for MVP just go back
            navigation.goBack();
          }
        },
      },
    ]);
  };

  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    if (appliedDiscount.discount_type === "percentage") {
      return (totalAmount * appliedDiscount.discount_value) / 100;
    }
    return Math.min(appliedDiscount.discount_value, totalAmount);
  };

  const discountAmount = calculateDiscount();
  const bookingFee = 0; // As requested, 0 for now
  const finalAmount = totalAmount - discountAmount + bookingFee;

  const handleConfirmBooking = async () => {
    if (isConfirmed || isLoading) return;

    setIsLoading(true);
    try {
      const bookingData = {
        tickets: cartItems.map((item) => ({
          ticketTypeId: item.ticket.id,
          quantity: item.quantity,
          unitPrice: calculateEffectivePrice(item.ticket, event.pricing_rules)
            .effectivePrice,
          ticketName: item.ticket.name,
        })),
        promoCode: appliedDiscount?.code || null,
        totalAmount: finalAmount,
        discountAmount: discountAmount,
        sessionId: sessionId, // Pass reservation session for consumption
      };

      const response = await registerForEvent(event.id, bookingData);

      if (response.success) {
        setIsConfirmed(true);

        // Update other screens via EventBus
        EventBus.emit("event-registration-updated", {
          eventId: event.id,
          isRegistered: true,
        });

        // Remove from interested list
        EventBus.emit("event-interest-updated", {
          eventId: event.id,
          isInterested: false,
        });

        // PEAK MOMENT
        setShowCelebration(true);
      } else {
        throw new Error(response.error || "Booking failed");
      }
    } catch (error) {
      console.error("Booking error:", error);
      Alert.alert(
        "Booking Failed",
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    navigation.popToTop();
  };

  // Handle back button - release reservation before going back
  const handleGoBack = async () => {
    await handleReleaseReservation();
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Reservation loading overlay */}
      {isReserving && (
        <View style={styles.reservingOverlay}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={styles.reservingText}>Reserving your tickets...</Text>
        </View>
      )}

      <CelebrationModal
        visible={showCelebration}
        onClose={handleCelebrationClose}
        type="booking"
        data={{ title: event?.title || "Event" }}
      />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review your booking</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Timer Bar */}
      <View style={styles.timerBar}>
        <Text style={styles.timerText}>
          Complete your booking in{" "}
          <Text style={styles.timerHighlight}>{formatTime(timeLeft)}</Text> mins
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Event Card */}
        <View style={styles.eventCard}>
          <View style={styles.eventRow}>
            {event.banner_carousel?.[0]?.url ? (
              <Image
                source={{ uri: event.banner_carousel[0].url }}
                style={styles.eventThumb}
              />
            ) : (
              <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
                <Ionicons name="calendar" size={24} color={MUTED_TEXT} />
              </View>
            )}
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={styles.eventVenue} numberOfLines={1}>
                {event.location_url ? "Venue" : "Online Event"}
              </Text>
            </View>
          </View>

          <View style={styles.eventMeta}>
            <Text style={styles.eventMetaText}>
              {formatDate(event.start_datetime || event.event_date)} |{" "}
              {formatTimeOnly(event.start_datetime || event.event_date)}
            </Text>
          </View>

          {/* Line Items */}
          {cartItems.map((item, index) => {
            const pricing = calculateEffectivePrice(
              item.ticket,
              event.pricing_rules
            );
            const itemTotal = item.quantity * pricing.effectivePrice;

            return (
              <View key={index} style={styles.lineItem}>
                <View style={styles.lineItemInfo}>
                  <Text style={styles.lineItemText}>
                    {item.quantity} x {item.ticket.name}
                  </Text>
                  {pricing.hasDiscount && (
                    <Text style={styles.lineItemDiscount}>
                      {pricing.discountLabel} (Early Bird)
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.lineItemPriceContainer}>
                  <Text style={styles.lineItemPrice}>
                    ₹{itemTotal.toLocaleString("en-IN")}
                  </Text>
                  {pricing.hasDiscount && (
                    <Text style={styles.lineItemPriceOriginal}>
                      ₹
                      {(item.quantity * pricing.originalPrice).toLocaleString(
                        "en-IN"
                      )}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* M-Ticket Note */}
          <View style={styles.ticketNote}>
            <Ionicons name="qr-code-outline" size={20} color={MUTED_TEXT} />
            <Text style={styles.ticketNoteText}>
              M-Ticket: Entry using the QR code in your app
            </Text>
          </View>
        </View>

        {/* Offers Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>OFFERS</Text>
        </View>

        <View style={styles.offersCard}>
          {event.discount_codes?.some((dc) => dc.is_active) && (
            <TouchableOpacity style={styles.offerRow}>
              <Ionicons name="pricetag-outline" size={20} color={TEXT_COLOR} />
              <Text style={styles.offerText}>View all event offers</Text>
              <Ionicons name="chevron-forward" size={20} color={MUTED_TEXT} />
            </TouchableOpacity>
          )}

          {/* Promo Code Input */}
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter promo code"
              placeholderTextColor={MUTED_TEXT}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.applyButtonWrapper}
              onPress={handleApplyPromo}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {appliedDiscount && (
            <View style={styles.appliedPromo}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={SUCCESS_COLOR}
              />
              <Text style={styles.appliedPromoText}>
                {appliedDiscount.code} applied -
                {appliedDiscount.discount_type === "percentage"
                  ? ` ${appliedDiscount.discount_value}% off`
                  : ` ₹${appliedDiscount.discount_value} off`}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>PAYMENT SUMMARY</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order amount</Text>
            <Text style={styles.summaryValue}>
              ₹{totalAmount.toLocaleString("en-IN")}
            </Text>
          </View>

          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: SUCCESS_COLOR }]}>
                Discount
              </Text>
              <Text style={[styles.summaryValue, { color: SUCCESS_COLOR }]}>
                -₹{discountAmount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Booking fee (inc. of GST)</Text>
            <Text style={styles.summaryValue}>
              {bookingFee === 0
                ? "Free"
                : `₹${bookingFee.toLocaleString("en-IN")}`}
            </Text>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>To pay now</Text>
            <Text style={styles.totalValue}>
              ₹{finalAmount.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.confirmButtonWrapper}
          onPress={handleConfirmBooking}
          disabled={isConfirmed || isLoading}
        >
          <LinearGradient
            colors={
              isConfirmed ? ["#34C759", "#2FB350"] : COLORS.primaryGradient
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmButtonGradient}
          >
            {isLoading ? (
              <SnooLoader color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>
                {isConfirmed ? "Booking Confirmed ✓" : "Confirm Booking"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  timerBar: {
    backgroundColor: "#E3F2FD",
    paddingVertical: 10,
    alignItems: "center",
  },
  timerText: {
    fontSize: 13,
    color: TEXT_COLOR,
  },
  timerHighlight: {
    color: "#FF9500",
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  eventCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  eventThumbPlaceholder: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  eventVenue: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  eventMeta: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  eventMetaText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  lineItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  lineItemText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  lineItemDiscount: {
    fontSize: 12,
    color: "#059669", // Green
    marginTop: 2,
  },
  removeText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    marginTop: 4,
    textDecorationLine: "underline",
  },
  lineItemPriceContainer: {
    alignItems: "flex-end",
  },
  lineItemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  lineItemPriceOriginal: {
    fontSize: 12,
    color: MUTED_TEXT,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  ticketNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    gap: 10,
  },
  ticketNoteText: {
    fontSize: 13,
    color: MUTED_TEXT,
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    alignItems: "center",
  },
  sectionHeaderText: {
    fontSize: 12,
    color: MUTED_TEXT,
    letterSpacing: 1,
  },
  offersCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  offerText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  promoInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT_COLOR,
    fontSize: 14,
  },
  applyButtonWrapper: {
    borderRadius: 8,
    overflow: "hidden",
  },
  applyButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  appliedPromo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  appliedPromoText: {
    fontSize: 13,
    color: SUCCESS_COLOR,
  },
  summaryCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: MUTED_TEXT,
  },
  summaryValue: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: CARD_BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  confirmButtonWrapper: {
    borderRadius: 30,
    overflow: "hidden",
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  reservingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  reservingText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_COLOR,
    fontWeight: "500",
  },
});
