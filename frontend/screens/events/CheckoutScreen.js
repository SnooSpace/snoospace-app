/**
 * CheckoutScreen - Review booking and confirm
 * Shows order summary, timer, promo codes, and confirmation
 *
 * Payment flow (paid tickets, finalAmount > 0):
 *   1. createPaymentOrder  → get Razorpay order from backend
 *   2. RazorpayCheckout.open() → user pays via Razorpay sheet
 *   3. verifyPayment        → backend verifies HMAC signature
 *   4. Show 'payment received' state → webhook confirms & creates registration
 *
 * Free tickets: registerForEvent() directly (unchanged).
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Hourglass,
  Tag,
  QrCode,
  CircleCheck,
  TriangleAlert,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import {
  registerForEvent,
  reserveTickets,
  releaseReservation,
} from "../../api/events";
import { createPaymentOrder, verifyPayment } from "../../api/payments";
import RazorpayCheckout from "@codearcade/expo-razorpay";
import EventBus from "../../utils/EventBus";
import CelebrationModal from "../../components/CelebrationModal";
import SnooLoader from "../../components/ui/SnooLoader";
import { useToast } from "../../context/ToastContext";
import DynamicStatusBar from "../../components/DynamicStatusBar";
import { getActiveAccount } from "../../api/auth";

// Premium Theme Colors
const BACKGROUND_COLOR = "#F8F9FA";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1D1D1F";
const MUTED_TEXT = "#86868B";
const BORDER_COLOR = "#F2F2F7";
const PRIMARY_COLOR = COLORS.primary;
const SUCCESS_COLOR = "#34C759";
const WARNING_COLOR = "#FF9500";

export default function CheckoutScreen({ route, navigation }) {
  const { event, cartItems, totalAmount } = route.params;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  // 10-minute countdown timer
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Reservation state
  const [sessionId, setSessionId] = useState(null);
  const [reservationError, setReservationError] = useState(null);
  const [isReserving, setIsReserving] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Monitor keyboard state to hide floating CTA button dynamically when keyboard is active
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

    return () => {
      isMounted = false;
    };
  }, []);

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
      // Check if code is restricted to specific tickets and user has none in cart
      if (discount.applies_to === "specific" && discount.selected_tickets) {
        const hasEligibleTicket = cartItems.some((item) =>
          discount.selected_tickets.some(
            (ticketNameOrId) =>
              ticketNameOrId?.toString() === item.ticket.id?.toString() ||
              ticketNameOrId?.toString() === item.ticket.name
          )
        );

        if (!hasEligibleTicket) {
          Alert.alert(
            "Promo Code Error",
            `This code is only applicable to specific ticket types: ${discount.selected_tickets.join(", ")}.`
          );
          return;
        }
      }

      setAppliedDiscount(discount);
      showToast("Success", `Promo code "${code}" applied successfully!`);
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
          navigation.goBack();
        },
      },
    ]);
  };

  // CORRECT FIXED DISCOUNT CALCULATION: Only apply to eligible ticket types!
  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    if (appliedDiscount.applies_to === "specific" && appliedDiscount.selected_tickets) {
      let discountableAmount = 0;
      cartItems.forEach((item) => {
        const isEligible = appliedDiscount.selected_tickets.some(
          (ticketNameOrId) =>
            ticketNameOrId?.toString() === item.ticket.id?.toString() ||
            ticketNameOrId?.toString() === item.ticket.name
        );
        if (isEligible) {
          const pricing = calculateEffectivePrice(item.ticket, event.pricing_rules);
          discountableAmount += item.quantity * pricing.effectivePrice;
        }
      });

      if (appliedDiscount.discount_type === "percentage") {
        return (discountableAmount * parseFloat(appliedDiscount.discount_value)) / 100;
      }
      return Math.min(parseFloat(appliedDiscount.discount_value), discountableAmount);
    }

    // Default: applies to whole cart
    if (appliedDiscount.discount_type === "percentage") {
      return (totalAmount * parseFloat(appliedDiscount.discount_value)) / 100;
    }
    return Math.min(parseFloat(appliedDiscount.discount_value), totalAmount);
  };

  const discountAmount = calculateDiscount();
  const bookingFee = 0; // Free as requested
  const finalAmount = totalAmount - discountAmount + bookingFee;

  // ─── Confirm Booking ────────────────────────────────────────────────────────
  // For FREE tickets (finalAmount === 0): calls registerForEvent directly.
  // For PAID tickets (finalAmount > 0): creates a Razorpay order, opens the
  // Razorpay payment sheet, verifies the signature, and shows a 'payment received'
  // state. The actual registration is created by the backend webhook.
  const handleConfirmBooking = async () => {
    if (isConfirmed || isLoading) return;

    setIsLoading(true);
    try {
      if (finalAmount > 0) {
        // ── PAID FLOW ──────────────────────────────────────────────────────
        // Step 1: Create Razorpay order on backend
        const order = await createPaymentOrder(event.id, finalAmount);

        if (!order.success) {
          throw new Error(order.error || "Failed to create payment order");
        }

        // Fetch current user info for prefill (best-effort)
        let prefillName = order.prefill?.name || "";
        let prefillEmail = order.prefill?.email || "";
        try {
          const activeAccount = await getActiveAccount();
          if (activeAccount) {
            prefillName = activeAccount.name || prefillName;
            prefillEmail = activeAccount.email || prefillEmail;
          }
        } catch (_) { /* non-critical */ }

        // Step 2: Open Razorpay payment sheet
        const options = {
          description: `Ticket for ${order.eventTitle}`,
          currency: order.currency,
          key: order.keyId,         // public key — safe to use in frontend
          amount: order.amount,     // amount in paise
          name: "SnooSpace",
          order_id: order.orderId,
          prefill: {
            name: prefillName,
            email: prefillEmail,
            contact: "",            // phone not required
          },
          theme: { color: COLORS.primary },
        };

        let paymentData;
        try {
          paymentData = await RazorpayCheckout.open(options);
          // paymentData = { razorpay_payment_id, razorpay_order_id, razorpay_signature }
        } catch (rzpError) {
          // User dismissed the sheet or payment was cancelled — not an app error
          if (
            rzpError?.code === "PAYMENT_CANCELLED" ||
            rzpError?.description?.toLowerCase().includes("cancelled") ||
            rzpError?.description?.toLowerCase().includes("dismissed")
          ) {
            showToast("Info", "Payment was cancelled");
          } else {
            console.error("[Checkout] Razorpay error:", rzpError);
            Alert.alert(
              "Payment Failed",
              rzpError?.description || "Payment could not be completed. Please try again."
            );
          }
          return; // Do not mark as confirmed
        }

        // Step 3: Verify payment signature on backend
        await verifyPayment(paymentData);

        // Step 4: Payment received — registration will be confirmed by webhook
        // Show optimistic success state. The webhook creates the event_registrations row.
        setIsConfirmed(true);

        EventBus.emit("event-registration-updated", {
          eventId: event.id,
          isRegistered: true,
        });
        EventBus.emit("event-interest-updated", {
          eventId: event.id,
          isInterested: false,
        });
        if (event.community_id || event.organizer_id) {
          EventBus.emit("event-registered", {
            communityId: event.community_id || event.organizer_id,
            eventId: event.id,
          });
        }

        setShowCelebration(true);

      } else {
        // ── FREE FLOW (unchanged) ───────────────────────────────────────────
        const bookingData = {
          tickets: cartItems.map((item) => ({
            ticketTypeId: item.ticket.id,
            quantity: item.quantity,
            unitPrice: calculateEffectivePrice(item.ticket, event.pricing_rules)
              .effectivePrice,
            ticketName: item.ticket.name,
          })),
          promoCode: appliedDiscount?.code || null,
          totalAmount: 0,
          discountAmount: discountAmount,
          sessionId: sessionId,
        };

        const response = await registerForEvent(event.id, bookingData);

        if (response.success) {
          setIsConfirmed(true);

          EventBus.emit("event-registration-updated", {
            eventId: event.id,
            isRegistered: true,
          });
          EventBus.emit("event-interest-updated", {
            eventId: event.id,
            isInterested: false,
          });
          if (event.community_id || event.organizer_id) {
            EventBus.emit("event-registered", {
              communityId: event.community_id || event.organizer_id,
              eventId: event.id,
            });
          }

          setShowCelebration(true);
        } else {
          throw new Error(response.error || "Booking failed");
        }
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

  const handleGoBack = async () => {
    await handleReleaseReservation();
    navigation.goBack();
  };

  const displayDate = event.start_datetime || event.event_date;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
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
        <DynamicStatusBar style="dark-content" />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review your booking</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Timer Banner (Sleek Alerting Hue) */}
        <View style={styles.timerBar}>
          <Hourglass size={14} color={WARNING_COLOR} strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={styles.timerText}>
            Complete your booking in{" "}
            <Text style={styles.timerHighlight}>{formatTime(timeLeft)}</Text> mins
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Event Physical Stub Card */}
          <View style={styles.eventCard}>
            <View style={styles.eventRow}>
              {event.banner_carousel?.[0]?.url ? (
                <Image
                  source={{ uri: event.banner_carousel[0].url }}
                  style={styles.eventThumb}
                />
              ) : (
                <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
                  <Calendar size={20} color={MUTED_TEXT} strokeWidth={2} />
                </View>
              )}
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.eventVenue} numberOfLines={1}>
                  {event.location_url ? "Venue Event" : "Online Event"}
                </Text>
              </View>
            </View>

            <View style={styles.eventMeta}>
              <Clock size={13} color={MUTED_TEXT} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.eventMetaText}>
                {formatDate(displayDate)}  •  {formatTimeOnly(displayDate)}
              </Text>
            </View>

            {/* Cart Line Items */}
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
                      <View style={styles.earlyBirdRow}>
                        <Tag size={10} color="#059669" strokeWidth={2.5} />
                        <Text style={styles.lineItemDiscount}>
                          {pricing.discountLabel} (Early Bird)
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => handleRemoveItem(index)} activeOpacity={0.7}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.lineItemPriceContainer}>
                    <Text style={styles.lineItemPrice}>
                      ₹{itemTotal.toLocaleString("en-IN")}
                    </Text>
                    {pricing.hasDiscount && (
                      <Text style={styles.lineItemPriceOriginal}>
                        ₹{(item.quantity * pricing.originalPrice).toLocaleString("en-IN")}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* M-Ticket Dotted Stub Note */}
            <View style={styles.ticketNote}>
              <QrCode size={18} color={MUTED_TEXT} strokeWidth={2} />
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
              <TouchableOpacity style={styles.offerRow} activeOpacity={0.7}>
                <Tag size={18} color={TEXT_COLOR} strokeWidth={2} />
                <Text style={styles.offerText}>View all event offers</Text>
                <ChevronRight size={16} color={MUTED_TEXT} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Promo Code Input Block */}
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
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#2563EB", "#1D4ED8"]} // Slightly different shade of royal blue
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
                <CircleCheck size={14} color={SUCCESS_COLOR} strokeWidth={2.5} />
                <Text style={styles.appliedPromoText}>
                  Code "{appliedDiscount.code}" applied:
                  {appliedDiscount.discount_type === "percentage"
                    ? ` ${appliedDiscount.discount_value}% off`
                    : ` ₹${parseFloat(appliedDiscount.discount_value).toLocaleString("en-IN")} off`}
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
                <Text style={[styles.summaryLabel, { color: SUCCESS_COLOR, fontFamily: 'Manrope-SemiBold' }]}>
                  Promo Discount
                </Text>
                <Text style={[styles.summaryValue, { color: SUCCESS_COLOR, fontFamily: 'Manrope-SemiBold' }]}>
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

          <View style={{ height: 160 }} />
        </ScrollView>

        {/* Floating Bottom Panel CTA without solid background (hides when keyboard is active) */}
        {!keyboardVisible && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={styles.confirmButtonWrapper}
              onPress={handleConfirmBooking}
              disabled={isConfirmed || isLoading}
              activeOpacity={0.9}
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
                    {isConfirmed
                      ? (finalAmount > 0 ? "Payment Received ✓" : "Booking Confirmed ✓")
                      : (finalAmount > 0 ? `Pay ₹${finalAmount.toLocaleString("en-IN")}` : "Confirm Booking")}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  reservingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.96)",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  reservingText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  timerBar: {
    backgroundColor: "#FFF9E6",
    borderBottomWidth: 1,
    borderBottomColor: "#FFEBB3",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  timerHighlight: {
    color: WARNING_COLOR,
    fontFamily: "Manrope-SemiBold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
  },
  eventThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  eventVenue: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    marginTop: 3,
  },
  eventMeta: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    flexDirection: "row",
    alignItems: "center",
  },
  eventMetaText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  lineItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  lineItemText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  earlyBirdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  lineItemDiscount: {
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
    color: "#059669",
  },
  removeText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: PRIMARY_COLOR,
    marginTop: 6,
    textDecorationLine: "underline",
  },
  lineItemPriceContainer: {
    alignItems: "flex-end",
  },
  lineItemPrice: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  lineItemPriceOriginal: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  ticketNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    borderStyle: "dashed",
    gap: 8,
  },
  ticketNoteText: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    alignItems: "center",
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: "BasicCommercial-Bold",
    color: MUTED_TEXT,
    letterSpacing: 1.5,
  },
  offersCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingBottom: 12,
    marginBottom: 6,
  },
  offerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 10,
  },
  promoInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: TEXT_COLOR,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
  },
  applyButtonWrapper: {
    borderRadius: 10,
    overflow: "hidden",
  },
  applyButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
  appliedPromo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  appliedPromoText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: SUCCESS_COLOR,
  },
  summaryCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
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
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  totalValue: {
    fontSize: 19,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  confirmButtonWrapper: {
    borderRadius: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  confirmButtonGradient: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});
