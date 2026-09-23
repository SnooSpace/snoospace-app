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
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Image,
  Platform,
  Keyboard,
  Animated,
  Easing,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Hourglass,
  Tag,
  QrCode,
  Check,
  CircleCheck,
  TriangleAlert,
  ChevronRight,
  Info,
  MapPin,
  Ticket,
} from "lucide-react-native";
import Svg, { Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import {
  registerForEvent,
  reserveTickets,
  releaseReservation,
  validatePromoCode,
} from "../../api/events";
import { createPaymentOrder, verifyPayment } from "../../api/payments";
import { useRazorpay } from "../../hooks/useRazorpay";
import EventBus from "../../utils/EventBus";
import CelebrationModal from "../../components/modals/CelebrationModal";
import SnooLoader from "../../components/ui/SnooLoader";
import { useToast } from "../../context/ToastContext";
import DynamicStatusBar from "../../components/navigation/DynamicStatusBar";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
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

const DEAD_SESSION_CODES = new Set([
  "reservation_expired",
  "reservation_mismatch",
  "price_mismatch",
  "session_expired",
]);

function isDeadSessionError(error) {
  const code = error?.code || error?.data?.error || error?.data?.code;
  return DEAD_SESSION_CODES.has(code);
}

export default function CheckoutScreen({ route, navigation }) {
  const { event, cartItems, totalAmount } = route.params;
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { openCheckout, RazorpayUI, isVisible: isRazorpayVisible } = useRazorpay();

  const isMountedRef = useRef(true);
  const isRazorpayVisibleRef = useRef(false);
  const expiresAtRef = useRef(null);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    isRazorpayVisibleRef.current = !!isRazorpayVisible;
  }, [isRazorpayVisible]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Rotating animation for Hourglass icon
  const hourglassAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(hourglassAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
        Animated.timing(hourglassAnim, {
          toValue: 2,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
      ])
    );
    rotateAnimation.start();
    return () => rotateAnimation.stop();
  }, [hourglassAnim]);

  const hourglassRotation = hourglassAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ["0deg", "180deg", "360deg"],
  });

  // Event mode resolution (In-Person, Virtual, Hybrid)
  const eventMode = useMemo(() => {
    const raw = (event?.event_type || event?.eventType || event?.mode || "").toLowerCase().replace(/_/g, "-");
    if (raw.includes("virtual") || raw.includes("online")) {
      return { label: "Virtual", isVirtual: true };
    }
    if (raw.includes("hybrid") || raw.includes("both")) {
      return { label: "Hybrid", isHybrid: true };
    }
    return { label: "In-Person", isInPerson: true };
  }, [event?.event_type, event?.eventType, event?.mode]);

  // 10-minute countdown timer state
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState(null);

  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: COLORS.primary,
    showClose: true,
  });

  const showAlert = (config) => setAlertConfig({ showClose: true, ...config, visible: true });
  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

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

  const handleReleaseReservation = async () => {
    if (sessionId && !isConfirmed) {
      try {
        await releaseReservation(event.id, sessionId);
      } catch (err) {
        console.warn("Failed to release reservation:", err);
      }
    }
  };

  const triggerSessionExpired = (force = false) => {
    if (hasExpiredRef.current) return;
    if (!force && isRazorpayVisibleRef.current) {
      // Defer/suppress proactive alert and navigation while Razorpay sheet is open
      return;
    }
    hasExpiredRef.current = true;
    expiresAtRef.current = null;
    setTimeLeft(0);
    handleReleaseReservation();
    showAlert({
      title: "Session Expired",
      message: "Your booking session has expired. Please try again.",
      icon: Hourglass,
      iconColor: WARNING_COLOR,
      primaryAction: { text: "OK", onPress: () => navigation.popToTop() },
      showClose: false,
    });
  };

  const attemptReservation = async () => {
    if (!isMountedRef.current) return;
    setIsReserving(true);
    try {
      const tickets = cartItems.map((item) => ({
        ticketTypeId: item.ticket.id,
        quantity: item.quantity,
      }));

      const response = await reserveTickets(event.id, tickets);

      if (!isMountedRef.current) {
        if (response?.success && response?.sessionId) {
          releaseReservation(event.id, response.sessionId).catch((err) =>
            console.warn("[Checkout] Auto-release on unmounted attemptReservation failed:", err)
          );
        }
        return;
      }

      if (response.success) {
        setSessionId(response.sessionId);
        setReservationError(null);
        hasExpiredRef.current = false;
        const expiryMs = response.expiresAt
          ? new Date(response.expiresAt).getTime()
          : Date.now() + 10 * 60 * 1000;
        expiresAtRef.current = expiryMs;
        const initialSeconds = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
        setTimeLeft(initialSeconds);
      } else {
        expiresAtRef.current = null;
        setReservationError(response.error || "Failed to reserve tickets");
        showAlert({
          title: "Reservation Failed",
          message: response.error || "Unable to reserve tickets. Please try again.",
          icon: TriangleAlert,
          iconColor: COLORS.error,
          primaryAction: { text: "OK", onPress: () => navigation.goBack() },
          showClose: false,
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      expiresAtRef.current = null;
      setReservationError(error.message);
      showAlert({
        title: "Reservation Failed",
        message: error.message || "Unable to reserve tickets. Please try again.",
        icon: TriangleAlert,
        iconColor: COLORS.error,
        primaryAction: { text: "OK", onPress: () => navigation.goBack() },
        showClose: false,
      });
    } finally {
      if (isMountedRef.current) setIsReserving(false);
    }
  };

  // Reserve tickets on mount
  useEffect(() => {
    attemptReservation();
  }, []);

  // Auto-release reservation on any screen exit: hardware back button,
  // iOS swipe-back gesture, tab switch, or programmatic navigation away.
  // This is the safety net that handleGoBack (explicit tap) and the
  // 10-minute timer don't cover.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      if (sessionId && !isConfirmed) {
        // Fire-and-forget — do not block navigation on this call.
        releaseReservation(event.id, sessionId).catch((err) =>
          console.warn("[Checkout] Auto-release on screen removal failed:", err)
        );
      }
    });
    return unsubscribe;
  }, [navigation, sessionId, isConfirmed, event.id]);

  // Fix 1: Timestamp-based countdown timer
  useEffect(() => {
    if (!sessionId || isConfirmed) return;

    const checkAndTick = () => {
      if (!expiresAtRef.current) return;
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiresAtRef.current - Date.now()) / 1000)
      );
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        if (isRazorpayVisibleRef.current) return;
        triggerSessionExpired();
      }
    };

    checkAndTick();
    const timer = setInterval(checkAndTick, 1000);
    return () => clearInterval(timer);
  }, [sessionId, isConfirmed]);

  // Fix 2: Proactive re-validation on app resume via existing appResumed event
  useEffect(() => {
    const handleAppResumed = () => {
      if (!isMountedRef.current || !sessionId || isConfirmed) return;
      if (isRazorpayVisibleRef.current) return;
      if (expiresAtRef.current && expiresAtRef.current <= Date.now()) {
        triggerSessionExpired();
      } else if (expiresAtRef.current) {
        setTimeLeft(Math.max(0, Math.floor((expiresAtRef.current - Date.now()) / 1000)));
      }
    };

    const unsubscribe = EventBus.on("appResumed", handleAppResumed);
    return () => {
      unsubscribe();
    };
  }, [sessionId, isConfirmed]);

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

  const handleApplyPromo = async () => {
    Keyboard.dismiss();
    const code = promoCode.toUpperCase().trim();
    if (!code || isValidatingPromo) return;

    // 1. Immediate client-side pre-validation against event.discount_codes (if cached)
    const discount = event.discount_codes?.find(
      (dc) => dc.code.toUpperCase() === code
    );

    if (discount) {
      if (discount.is_active === false) {
        showAlert({
          title: "Invalid Code",
          message: "This promo code is currently inactive.",
          icon: Tag,
          iconColor: WARNING_COLOR,
          primaryAction: { text: "OK", onPress: hideAlert },
        });
        return;
      }

      if (discount.valid_from && new Date() < new Date(discount.valid_from)) {
        showAlert({
          title: "Promo Code Inactive",
          message: "This promo code is not yet active.",
          icon: Tag,
          iconColor: WARNING_COLOR,
          primaryAction: { text: "OK", onPress: hideAlert },
        });
        return;
      }

      if (discount.valid_until && new Date() > new Date(discount.valid_until)) {
        showAlert({
          title: "Promo Code Expired",
          message: "This promo code has expired.",
          icon: Tag,
          iconColor: WARNING_COLOR,
          primaryAction: { text: "OK", onPress: hideAlert },
        });
        return;
      }

      if (
        discount.max_uses !== null &&
        discount.max_uses !== undefined &&
        Number(discount.current_uses) >= Number(discount.max_uses)
      ) {
        showAlert({
          title: "Usage Limit Reached",
          message: "This promo code has reached its maximum usage limit.",
          icon: Tag,
          iconColor: WARNING_COLOR,
          primaryAction: { text: "OK", onPress: hideAlert },
        });
        return;
      }

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
          showAlert({
            title: "Promo Code Error",
            message: `This code is only applicable to specific ticket types: ${discount.selected_tickets.join(", ")}.`,
            icon: Tag,
            iconColor: WARNING_COLOR,
            primaryAction: {
              text: "OK",
              onPress: () => {
                hideAlert();
                setPromoCode("");
                setAppliedDiscount(null);
              },
            },
          });
          setPromoCode("");
          setAppliedDiscount(null);
          return;
        }
      }

      // Check minimum cart value requirement against post-pricing-rules subtotal
      if (discount.min_cart_value && parseFloat(discount.min_cart_value) > 0) {
        if (pricingBreakdown.subtotalAfterPricingRules < parseFloat(discount.min_cart_value)) {
          showAlert({
            title: "Promo Code Error",
            message: `Order total must be at least ₹${discount.min_cart_value} to use this promo code.`,
            icon: Tag,
            iconColor: WARNING_COLOR,
            primaryAction: { text: "OK", onPress: hideAlert },
          });
          return;
        }
      }
    }

    // 2. Authoritative server-side validation using pricingCalculator
    setIsValidatingPromo(true);
    try {
      const ticketsPayload = cartItems.map((item) => ({
        ticketTypeId: item.ticket.id,
        quantity: item.quantity,
      }));

      const res = await validatePromoCode(
        event.id,
        code,
        ticketsPayload,
        sessionId
      );

      if (res && res.success && res.pricing) {
        const appliedObj = {
          ...(discount || {}),
          code: res.pricing.validatedPromoCode || code,
          discount_type: res.pricing.promoDiscountType,
          discount_value: res.pricing.promoDiscountValue,
          serverDiscount: res.pricing.promoDiscount,
        };
        setAppliedDiscount(appliedObj);
        showToast("Success", `Promo code "${code}" applied successfully!`);
      } else {
        showAlert({
          title: "Invalid Code",
          message: res?.message || "This promo code is not valid or has expired.",
          icon: Tag,
          iconColor: WARNING_COLOR,
          primaryAction: { text: "OK", onPress: hideAlert },
        });
      }
    } catch (err) {
      showAlert({
        title: "Promo Code Error",
        message: err.message || "Failed to validate promo code.",
        icon: Tag,
        iconColor: WARNING_COLOR,
        primaryAction: { text: "OK", onPress: hideAlert },
      });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemoveItem = (index) => {
    showAlert({
      title: "Remove Item",
      message: "Are you sure you want to remove this item?",
      icon: TriangleAlert,
      iconColor: COLORS.error,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          hideAlert();
          navigation.goBack();
        },
      },
    });
  };

  // Recompute pricing breakdown from raw cart items and active pricing rules
  const pricingBreakdown = useMemo(() => {
    let rawSubtotal = 0;
    let subtotalAfterPricingRules = 0;
    const ruleDiscountsByName = {};

    cartItems.forEach((item) => {
      const basePrice = parseFloat(item.ticket.base_price) || 0;
      rawSubtotal += basePrice * item.quantity;

      const pricing = calculateEffectivePrice(
        item.ticket,
        event.pricing_rules,
        item.quantity
      );

      const effectivePrice = pricing.effectivePrice;
      subtotalAfterPricingRules += effectivePrice * item.quantity;

      const itemRuleDiscount = (basePrice - effectivePrice) * item.quantity;
      if (itemRuleDiscount > 0 && pricing.ruleName) {
        const name = pricing.ruleName;
        ruleDiscountsByName[name] = (ruleDiscountsByName[name] || 0) + itemRuleDiscount;
      }
    });

    return {
      rawSubtotal,
      subtotalAfterPricingRules,
      ruleDiscountsByName,
    };
  }, [cartItems, event.pricing_rules]);

  // CORRECT FIXED DISCOUNT CALCULATION: Matches pricingCalculator.js sequence
  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    let discountableAmount = 0;
    if (
      appliedDiscount.applies_to === "specific" &&
      appliedDiscount.selected_tickets &&
      appliedDiscount.selected_tickets.length > 0
    ) {
      cartItems.forEach((item) => {
        const isEligible = appliedDiscount.selected_tickets.some(
          (ticketNameOrId) =>
            ticketNameOrId?.toString() === item.ticket.id?.toString() ||
            ticketNameOrId?.toString() === item.ticket.name
        );
        if (isEligible) {
          const pricing = calculateEffectivePrice(
            item.ticket,
            event.pricing_rules,
            item.quantity
          );
          discountableAmount += item.quantity * pricing.effectivePrice;
        }
      });
    } else {
      // Default: applies to whole cart after pricing rules
      discountableAmount = pricingBreakdown.subtotalAfterPricingRules;
    }

    if (discountableAmount <= 0) return 0;

    if (appliedDiscount.serverDiscount !== undefined && appliedDiscount.serverDiscount !== null) {
      return Math.min(appliedDiscount.serverDiscount, discountableAmount);
    }

    const promoVal = parseFloat(appliedDiscount.discount_value) || 0;
    let promoDiscount = 0;
    if (appliedDiscount.discount_type === "percentage") {
      promoDiscount = (discountableAmount * promoVal) / 100;
    } else {
      promoDiscount = Math.min(promoVal, discountableAmount);
    }
    return Math.round(promoDiscount * 100) / 100;
  };

  const discountAmount = calculateDiscount();
  const bookingFee = 0; // Free as requested
  const finalAmount = Math.max(
    0,
    Math.round(pricingBreakdown.subtotalAfterPricingRules - discountAmount + bookingFee)
  );

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
        // Step 1: Create Razorpay order on backend with complete booking details
        const tickets = cartItems.map((item) => ({
          ticketTypeId: item.ticket.id,
          quantity: item.quantity,
          unitPrice: calculateEffectivePrice(
            item.ticket,
            event.pricing_rules,
            item.quantity
          ).effectivePrice,
          ticketName: item.ticket.name,
        }));

        const order = await createPaymentOrder(
          event.id,
          finalAmount,
          tickets,
          appliedDiscount?.code || null,
          discountAmount,
          sessionId
        );

        if (!order.success) {
          throw new Error(order.error || "Failed to create payment order");
        }

        if (order.orderId) {
          setConfirmedOrderId(order.orderId);
        }

        // Fetch current user info for prefill (best-effort)
        let prefillName = order.prefill?.name || "";
        let prefillEmail = order.prefill?.email || "";
        let prefillContact = order.prefill?.contact || "";
        try {
          const activeAccount = await getActiveAccount();
          if (activeAccount) {
            prefillName = activeAccount.name || prefillName;
            prefillEmail = activeAccount.email || prefillEmail;
            prefillContact =
              activeAccount.phone ||
              activeAccount.phone_number ||
              activeAccount.mobile ||
              prefillContact;
          }
        } catch (_) { /* non-critical */ }

        // Step 2: Open Razorpay payment sheet via @codearcade/expo-razorpay hook
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
            contact: prefillContact || "",
          },
          theme: { color: "#FFFFFF" },
          modal: {
            confirm_close: true,
          },
        };

        // Note: openCheckout returns immediately; loading state is managed inside callbacks.
        openCheckout(options, {
          onSuccess: async (paymentData) => {
            try {
              // Step 3: Verify payment signature on backend
              await verifyPayment(paymentData);

              // Step 4: Payment received — registration will be confirmed by webhook
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
            } catch (vErr) {
              console.error("[Checkout] Payment verification failed:", vErr);
              showAlert({
                title: "Verification Error",
                message: "Payment received, but verification timed out. Please check your tickets under My Profile.",
                icon: TriangleAlert,
                iconColor: WARNING_COLOR,
                primaryAction: { text: "OK", onPress: hideAlert },
              });
            } finally {
              setIsLoading(false);
            }
          },
          onFailure: (rzpError) => {
            setIsLoading(false);
            console.warn("[Checkout] Razorpay error:", rzpError?.description || rzpError?.message || rzpError);
            const errorMessage =
              rzpError?.description ||
              rzpError?.message ||
              (typeof rzpError === "string" ? rzpError : null) ||
              "Payment could not be completed. Please try again.";

            const isExpired =
              isDeadSessionError(rzpError) ||
              (expiresAtRef.current && expiresAtRef.current <= Date.now());

            if (isExpired) {
              triggerSessionExpired(true);
              return;
            }

            showAlert({
              title: "Payment Failed",
              message: errorMessage,
              icon: TriangleAlert,
              iconColor: COLORS.error,
              primaryAction: { text: "OK", onPress: hideAlert },
            });
            handleReleaseReservation()
              .catch((err) =>
                console.warn("[Checkout] Failed to release reservation after payment failure:", err)
              )
              .finally(() => {
                // The old hold is dead — clear it and get a fresh one so a retry
                // has a valid session and an honest countdown, rather than silently
                // reusing a released sessionId.
                setSessionId(null);
                attemptReservation();
              });
          },
          onClose: () => {
            setIsLoading(false);
            showToast("Info", "Payment was cancelled");

            // If the hold expired while the payment sheet was open, trigger session expired now
            if (expiresAtRef.current && expiresAtRef.current <= Date.now()) {
              triggerSessionExpired(true);
              return;
            }

            handleReleaseReservation()
              .catch((err) =>
                console.warn("[Checkout] Failed to release reservation after payment close:", err)
              )
              .finally(() => {
                setSessionId(null);
                attemptReservation();
              });
          },
        });

      } else {
        // ── FREE FLOW (unchanged) ───────────────────────────────────────────
        const bookingData = {
          tickets: cartItems.map((item) => ({
            ticketTypeId: item.ticket.id,
            quantity: item.quantity,
            unitPrice: calculateEffectivePrice(
              item.ticket,
              event.pricing_rules,
              item.quantity
            ).effectivePrice,
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
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Booking error:", error);

      // Fix 3: Stop silent auto-retry on dead session errors
      if (isDeadSessionError(error)) {
        handleReleaseReservation().catch(() => {});
        setSessionId(null);
        expiresAtRef.current = null;
        hasExpiredRef.current = true;
        setTimeLeft(0);
        const title = error?.code === "price_mismatch" ? "Price Updated" : "Session Expired";
        const msg =
          error?.message ||
          "Your booking session has expired. Please select your tickets again.";
        showAlert({
          title,
          message: msg,
          icon: error?.code === "price_mismatch" ? Tag : Hourglass,
          iconColor: error?.code === "price_mismatch" ? COLORS.primary : WARNING_COLOR,
          primaryAction: { text: "OK", onPress: () => navigation.popToTop() },
          showClose: false,
        });
        return;
      }

      showAlert({
        title: "Booking Failed",
        message: error.message || "Something went wrong. Please try again.",
        icon: TriangleAlert,
        iconColor: COLORS.error,
        primaryAction: { text: "OK", onPress: hideAlert },
      });
      // Only release on pre-payment failures (e.g. createPaymentOrder threw,
      // or the free-registration call threw). If payment already succeeded
      // and only verifyPayment failed, isConfirmed is true and this is a
      // safe no-op — the hold has already been consumed by the webhook.
      handleReleaseReservation()
        .catch((err) =>
          console.warn("[Checkout] Failed to release reservation after booking error:", err)
        )
        .finally(() => {
          setSessionId(null);
          attemptReservation();
        });
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
        data={{
          title: event?.title || "Grand Theft Auto Premier",
          coverImage: event?.cover_image_url,
          ticketTier: cartItems?.[0]?.ticket?.name || "Standard Access",
          ticketCount:
            cartItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) ||
            1,
          orderId: confirmedOrderId
            ? `#${confirmedOrderId.replace(/^order_/, "").slice(-8).toUpperCase()}`
            : "#GTA-9042-X",
        }}
      />
      {RazorpayUI}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={hideAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
        showClose={alertConfig.showClose !== false}
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

      {/* Timer Banner */}
      <View style={styles.timerBar}>
        <Animated.View style={{ transform: [{ rotate: hourglassRotation }], marginRight: 6 }}>
          <Hourglass size={14} color={WARNING_COLOR} strokeWidth={2.5} />
        </Animated.View>
        <Text style={styles.timerText}>
          Complete your booking in{" "}
          <Text style={styles.timerHighlight}>{formatTime(timeLeft)}</Text> mins
        </Text>
      </View>

      <KeyboardAwareScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={60}
      >
        {/* Main Event Ticket Card */}
        <View style={styles.eventTicketCard}>
            {/* Top Ticket Header: Badge + Mode + Serial Identifier */}
            <View style={styles.ticketTopRow}>
              <View style={styles.badgeGroup}>
                <View style={styles.ticketBadgePill}>
                  <Ticket size={12} color="#2563EB" strokeWidth={2.5} />
                  <Text style={styles.ticketBadgeText}>EVENT PASS</Text>
                </View>
                <View
                  style={[
                    styles.modeBadgePill,
                    eventMode.isVirtual
                      ? styles.modeBadgeVirtual
                      : eventMode.isHybrid
                      ? styles.modeBadgeHybrid
                      : styles.modeBadgeInPerson,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBadgeText,
                      eventMode.isVirtual
                        ? styles.modeTextVirtual
                        : eventMode.isHybrid
                        ? styles.modeTextHybrid
                        : styles.modeTextInPerson,
                    ]}
                  >
                    {eventMode.label.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.ticketSerialText}>
                {event.id ? `#EVT-${event.id}` : "#TKT-9921"}
              </Text>
            </View>

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
                <View style={styles.venueRow}>
                  <MapPin size={12} color={MUTED_TEXT} strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={styles.eventVenue} numberOfLines={1}>
                    {event.location_name || (event.location_url ? "Venue Event" : "Online Event")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.eventMeta}>
              <Clock size={13} color={MUTED_TEXT} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.eventMetaText}>
                {formatDate(displayDate)}  •  {formatTimeOnly(displayDate)}  •  {eventMode.label}
              </Text>
            </View>

            {/* Cart Line Items */}
            {cartItems.map((item, index) => {
              const pricing = calculateEffectivePrice(
                item.ticket,
                event.pricing_rules,
                item.quantity
              );
              const itemTotal = item.quantity * pricing.effectivePrice;

              return (
                <View key={index} style={styles.lineItem}>
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemText}>
                      {item.quantity} x {item.ticket.name}
                    </Text>
                    {Boolean(item.ticket?.description?.trim()) && (
                      <Text style={styles.ticketDescription} numberOfLines={2}>
                        {item.ticket.description.trim()}
                      </Text>
                    )}
                    {pricing.hasDiscount && (
                      <View style={styles.earlyBirdRow}>
                        <Tag
                          size={10}
                          color={pricing.ruleType === "group_discount" ? "#7C3AED" : "#D97706"}
                          strokeWidth={2.5}
                        />
                        <Text style={[
                          styles.lineItemDiscount,
                          pricing.ruleType === "group_discount" && { color: "#7C3AED" },
                        ]}>
                          {pricing.discountLabel} ({pricing.ruleType === "group_discount" ? "Group" : "Early Bird"})
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

            {/* Ticket Cutout Divider with Notches & Dashed Perforation */}
            <View style={styles.ticketCutoutDivider}>
              <View style={styles.notchLeft} />
              <View style={styles.cutoutLine} />
              <View style={styles.notchRight} />
            </View>

            {/* Ticket Stub Footer: M-Ticket + Minimal Barcode */}
            <View style={styles.ticketStubFooter}>
              <View style={styles.ticketStubInfo}>
                <QrCode size={16} color="#0F172A" strokeWidth={2} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stubHeading}>M-TICKET</Text>
                  <Text style={styles.stubSub}>Entry using QR code in your app</Text>
                </View>
              </View>
              <View style={styles.stubBarcode}>
                <Svg width={46} height={20} viewBox="0 0 46 20">
                  <Line x1={2} y1={0} x2={2} y2={20} stroke="#475569" strokeWidth={1.5} />
                  <Line x1={6} y1={0} x2={6} y2={20} stroke="#475569" strokeWidth={2.5} />
                  <Line x1={11} y1={0} x2={11} y2={20} stroke="#475569" strokeWidth={1} />
                  <Line x1={15} y1={0} x2={15} y2={20} stroke="#475569" strokeWidth={3} />
                  <Line x1={21} y1={0} x2={21} y2={20} stroke="#475569" strokeWidth={1.5} />
                  <Line x1={26} y1={0} x2={26} y2={20} stroke="#475569" strokeWidth={2.5} />
                  <Line x1={32} y1={0} x2={32} y2={20} stroke="#475569" strokeWidth={1} />
                  <Line x1={37} y1={0} x2={37} y2={20} stroke="#475569" strokeWidth={3} />
                  <Line x1={43} y1={0} x2={43} y2={20} stroke="#475569" strokeWidth={1.5} />
                </Svg>
              </View>
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
                onChangeText={(text) => {
                  setPromoCode(text);
                  if (appliedDiscount && text.toUpperCase().trim() !== appliedDiscount.code) {
                    setAppliedDiscount(null);
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleApplyPromo}
              />
              <TouchableOpacity
                style={styles.applyButtonWrapper}
                onPress={handleApplyPromo}
                disabled={(!promoCode.trim() && !appliedDiscount) || isValidatingPromo}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    (promoCode.trim().length > 0 || appliedDiscount) && !isValidatingPromo
                      ? ["#2563EB", "#1D4ED8"]
                      : ["#E2E8F0", "#E2E8F0"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.applyButtonGradient}
                >
                  <Text
                    style={[
                      styles.applyButtonText,
                      ((!promoCode.trim() && !appliedDiscount) || isValidatingPromo) && styles.applyButtonTextDisabled,
                    ]}
                  >
                    {isValidatingPromo ? "Checking..." : appliedDiscount ? "Applied" : "Apply"}
                  </Text>
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
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                ₹{pricingBreakdown.rawSubtotal.toLocaleString("en-IN")}
              </Text>
            </View>

            {Object.entries(pricingBreakdown.ruleDiscountsByName).map(
              ([ruleName, ruleDiscount]) =>
                ruleDiscount > 0 ? (
                  <View key={ruleName} style={styles.summaryRow}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        { color: SUCCESS_COLOR, fontFamily: "Manrope-SemiBold" },
                      ]}
                    >
                      {ruleName}
                    </Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: SUCCESS_COLOR, fontFamily: "Manrope-SemiBold" },
                      ]}
                    >
                      -₹{ruleDiscount.toLocaleString("en-IN")}
                    </Text>
                  </View>
                ) : null
            )}

            {discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: SUCCESS_COLOR, fontFamily: "Manrope-SemiBold" },
                  ]}
                >
                  Promo Discount
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: SUCCESS_COLOR, fontFamily: "Manrope-SemiBold" },
                  ]}
                >
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

        <View style={{ height: 20 }} />
      </KeyboardAwareScrollView>

      {/* Docked Bottom Bar: Stays at the bottom, non-floating, seamless background */}
      {!keyboardVisible && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
              ) : isConfirmed ? (
                <View style={styles.confirmedButtonContent}>
                  <Text style={styles.confirmButtonText}>
                    {finalAmount > 0 ? "Payment Received" : "Booking Confirmed"}
                  </Text>
                  <View style={styles.confirmedCheckBadge}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              ) : (
                <Text style={styles.confirmButtonText}>
                  {finalAmount > 0
                    ? `Pay ₹${finalAmount.toLocaleString("en-IN")}`
                    : "Confirm Booking"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    backgroundColor: "transparent",
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
  contentContainer: {
    paddingBottom: 32,
  },
  eventTicketCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeBadgeInPerson: {
    backgroundColor: "#F1F5F9",
  },
  modeBadgeVirtual: {
    backgroundColor: "#EFF6FF",
  },
  modeBadgeHybrid: {
    backgroundColor: "#F5F3FF",
  },
  modeBadgeText: {
    fontSize: 10,
    fontFamily: "Manrope-Bold",
    letterSpacing: 0.6,
  },
  modeTextInPerson: {
    color: "#475569",
  },
  modeTextVirtual: {
    color: "#2563EB",
  },
  modeTextHybrid: {
    color: "#7C3AED",
  },
  ticketBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  ticketBadgeText: {
    fontSize: 10,
    fontFamily: "Manrope-Bold",
    color: "#2563EB",
    letterSpacing: 0.6,
  },
  ticketSerialText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    letterSpacing: 0.5,
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
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
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
  ticketDescription: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    marginTop: 3,
    lineHeight: 16,
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
    color: "#D97706",
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
  ticketCutoutDivider: {
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    marginHorizontal: -16,
    marginTop: 14,
    marginBottom: 10,
    position: "relative",
  },
  notchLeft: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BACKGROUND_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginLeft: -9,
  },
  notchRight: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BACKGROUND_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginRight: -9,
  },
  cutoutLine: {
    flex: 1,
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: "#CBD5E1",
    borderStyle: "dashed",
    marginHorizontal: 8,
  },
  ticketStubFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  ticketStubInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  stubHeading: {
    fontSize: 11,
    fontFamily: "Manrope-Bold",
    color: TEXT_COLOR,
    letterSpacing: 0.6,
  },
  stubSub: {
    fontSize: 11,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    marginTop: 1,
  },
  stubBarcode: {
    opacity: 0.55,
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: TEXT_COLOR,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
  },
  applyButtonWrapper: {
    borderRadius: 24,
    overflow: "hidden",
  },
  applyButtonGradient: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
  applyButtonTextDisabled: {
    color: "#94A3B8",
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
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
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 0,
    // No position:absolute — stays in normal flex flow at the bottom of the column
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
  confirmedButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmedCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
