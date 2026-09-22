import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import {
  X,
  Plus,
  Minus,
  MapPin,
  Video,
  Sparkles,
  ShieldAlert,
  Clock,
  Ticket,
  Tag,
  ShieldCheck,
  Calendar,
  Lock,
} from "lucide-react-native";
import SwipeableModal from "./SwipeableModal";
import { COLORS } from "../../constants/theme";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import hapticsService from "../../services/HapticsService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PRIMARY_COLOR = COLORS.primary || "#2563EB";

/**
 * TicketDetailsSheet
 * Non-reserving detailed sheet that slides up when a user taps a ticket card.
 * Lets users review all pass details, description, perks, refund rules, and adjust quantity
 * before committing to checkout.
 */
export default function TicketDetailsSheet({
  visible,
  ticket,
  event,
  theme,
  pricingRules,
  initialQty = 1,
  onClose,
  onProceedToCheckout,
}) {
  // Quantity State (defaults to min_per_order or initialQty or 1)
  const minQty = Math.max(1, ticket?.min_per_order || 1);
  const available = ticket?.total_quantity
    ? Math.max(0, ticket.total_quantity - (ticket.sold_count || 0) - (ticket.reserved_count || 0))
    : 99;
  const maxAllowed = Math.min(ticket?.max_per_order || 10, available);

  const [quantity, setQuantity] = useState(initialQty);

  // Sync initial quantity when ticket changes
  useEffect(() => {
    if (visible && ticket) {
      const startQty = Math.min(Math.max(initialQty, minQty), maxAllowed > 0 ? maxAllowed : 1);
      setQuantity(startQty);
    }
  }, [visible, ticket?.id, initialQty, minQty, maxAllowed]);

  // Pricing Calculation
  const pricing = useMemo(() => {
    if (!ticket) return { effectivePrice: 0, originalPrice: 0, hasDiscount: false };
    return calculateEffectivePrice(ticket, pricingRules || event?.pricing_rules, quantity);
  }, [ticket, pricingRules, event?.pricing_rules, quantity]);

  const unitPrice = pricing.effectivePrice || 0;
  const totalAmount = unitPrice * quantity;
  const originalTotal = (pricing.originalPrice || unitPrice) * quantity;
  const hasSavings = pricing.hasDiscount && originalTotal > totalAmount;
  const savingsAmount = originalTotal - totalAmount;

  // Handlers
  const handleIncrement = useCallback(() => {
    if (quantity < maxAllowed) {
      hapticsService.triggerImpactLight();
      setQuantity((prev) => prev + 1);
    }
  }, [quantity, maxAllowed]);

  const handleDecrement = useCallback(() => {
    if (quantity > minQty) {
      hapticsService.triggerImpactLight();
      setQuantity((prev) => prev - 1);
    }
  }, [quantity, minQty]);

  const handleProceed = useCallback(() => {
    if (!ticket) return;
    hapticsService.triggerImpactMedium();
    if (onProceedToCheckout) {
      onProceedToCheckout({
        ticket,
        quantity,
        totalAmount,
      });
    }
  }, [ticket, quantity, totalAmount, onProceedToCheckout]);

  // Access mode details
  const mode = ticket?.access_mode || event?.event_type || "in_person";
  const isVirtual = mode === "virtual";
  const isBoth = mode === "both" || mode === "hybrid";

  let ModeIcon = MapPin;
  let modeLabel = "In-Person Event";
  let modeColor = "#4B5563";
  let modeBg = "#F3F4F6";

  if (isVirtual) {
    ModeIcon = Video;
    modeLabel = "Virtual / Online Event";
    modeColor = "#0284C7";
    modeBg = "#E0F2FE";
  } else if (isBoth) {
    ModeIcon = Sparkles;
    modeLabel = "In-Person + Virtual Access";
    modeColor = "#0D9488";
    modeBg = "#CCFBF1";
  }

  // Smart location / access line: avoids placing physical venue on a purely virtual ticket
  const accessDetailText = useMemo(() => {
    if (isVirtual) {
      if (event?.meeting_platform) {
        return `Via ${event.meeting_platform}`;
      }
      return "Online access link provided upon booking";
    }

    const venue = event?.location_name || event?.venue_name || "";
    if (isBoth) {
      return venue ? `${venue} + Online Stream` : "Online & In-Person";
    }
    return venue || "Venue TBA";
  }, [isVirtual, isBoth, event?.meeting_platform, event?.location_name, event?.venue_name]);

  // Real database refund policy parsing (JSONB or string)
  const parsedRefundPolicy = useMemo(() => {
    let rp = ticket?.refund_policy;
    if (typeof rp === "string") {
      try {
        rp = JSON.parse(rp);
      } catch {
        // Fallback for legacy string values
        if (rp === "flexible") {
          return {
            allowed: true,
            percentage: 100,
            deadline_hours_before: 24,
            description: "Full refund available if requested up to 24 hours before the event.",
          };
        }
        if (rp === "moderate") {
          return {
            allowed: true,
            percentage: 50,
            deadline_hours_before: 48,
            description: "50% refund available if requested up to 48 hours before the event.",
          };
        }
        return {
          allowed: false,
          percentage: 0,
          deadline_hours_before: 0,
          description: "Tickets are non-refundable once booked, unless cancelled by the organizer.",
        };
      }
    }

    if (rp && typeof rp === "object" && rp.allowed) {
      const pct = Number(rp.percentage) || 100;
      const hours = Number(rp.deadline_hours_before) || 24;
      return {
        allowed: true,
        percentage: pct,
        deadline_hours_before: hours,
        description: `${pct}% refund available if requested up to ${hours} hours before the event.`,
      };
    }

    return {
      allowed: false,
      percentage: 0,
      deadline_hours_before: 0,
      description: "Tickets are non-refundable once booked, unless cancelled by the organizer.",
    };
  }, [ticket?.refund_policy]);

  // Formatting date
  const displayDateStr = event?.start_datetime || event?.event_date;
  const formattedDate = displayDateStr
    ? new Date(displayDateStr).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const formattedTime = displayDateStr
    ? new Date(displayDateStr).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  const headerContent = (
    <View collapsable={false} style={styles.sheetHeader}>
      <View style={styles.handleBar} />
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.ticketThemeBadge,
              { backgroundColor: theme?.bgColor || "#EFF6FF" },
            ]}
          >
            <Ticket size={13} color={theme?.textColor || PRIMARY_COLOR} strokeWidth={2.4} />
            <Text
              style={[
                styles.ticketThemeBadgeText,
                { color: theme?.textColor || PRIMARY_COLOR },
              ]}
              numberOfLines={1}
            >
              PASS DETAILS
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <X size={20} color="#64748B" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SwipeableModal
      visible={Boolean(visible && ticket && event)}
      onClose={onClose}
      sheetStyle={styles.sheet}
      header={headerContent}
    >
      {ticket && event ? (
        <View style={styles.container}>
          <SwipeableModal.ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Main Title & Price Spotlight */}
          <View style={styles.titleSection}>
            <Text style={styles.ticketTitle}>{ticket.name}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceValue}>
                {unitPrice === 0 ? "Free" : `₹${unitPrice.toLocaleString("en-IN")}`}
              </Text>
              {pricing.hasDiscount && (
                <>
                  <Text style={styles.originalPrice}>
                    ₹{pricing.originalPrice.toLocaleString("en-IN")}
                  </Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      {pricing.discountLabel || "Special Offer"}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Schedule & Location Pill Box */}
          <View style={styles.metaCard}>
            {/* Date & Time */}
            {displayDateStr && (
              <View style={styles.metaItem}>
                <Calendar size={15} color="#475569" strokeWidth={2} style={styles.metaIcon} />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Date & Time</Text>
                  <Text style={styles.metaValueText}>
                    {formattedDate} • {formattedTime}
                  </Text>
                </View>
              </View>
            )}

            {/* Mode & Location */}
            <View style={[styles.metaItem, { marginTop: 12 }]}>
              <ModeIcon size={15} color={modeColor} strokeWidth={2} style={styles.metaIcon} />
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Format & Access</Text>
                <Text style={styles.metaValueText}>
                  {modeLabel} • {accessDetailText}
                </Text>
              </View>
            </View>
          </View>

          {/* Pass Description & Inclusions */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>What's Included</Text>
            <Text style={styles.descriptionText}>
              {ticket.description || `General admission entry to ${event.title || "this event"}.`}
            </Text>
          </View>

          {/* Gender Restriction Alert if any */}
          {ticket.gender_restriction && ticket.gender_restriction !== "all" && (
            <View style={styles.restrictionCard}>
              <ShieldAlert size={16} color="#EA580C" strokeWidth={2} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictionTitle}>Gender Requirement</Text>
                <Text style={styles.restrictionDesc}>
                  This pass is strictly reserved for {ticket.gender_restriction.toUpperCase()} attendees. Valid ID verification required at entry.
                </Text>
              </View>
            </View>
          )}

          {/* Refund Policy Box */}
          <View
            style={[
              styles.policyCard,
              !parsedRefundPolicy.allowed && styles.policyCardNeutral,
            ]}
          >
            <ShieldCheck
              size={16}
              color={parsedRefundPolicy.allowed ? "#059669" : "#64748B"}
              strokeWidth={2}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.policyTitle,
                  !parsedRefundPolicy.allowed && styles.policyTitleNeutral,
                ]}
              >
                Cancellation & Refund Policy
              </Text>
              <Text
                style={[
                  styles.policyDesc,
                  !parsedRefundPolicy.allowed && styles.policyDescNeutral,
                ]}
              >
                {parsedRefundPolicy.description}
              </Text>
            </View>
          </View>

          {/* Quantity Selector Section */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityInfoCol}>
              <Text style={styles.quantityHeading}>Quantity</Text>
              <Text style={styles.quantitySub}>
                Max {ticket.max_per_order || 10} passes per booking
              </Text>
            </View>

            <View style={styles.counterRow}>
              <TouchableOpacity
                style={[
                  styles.counterBtn,
                  quantity <= minQty && styles.counterBtnDisabled,
                ]}
                onPress={handleDecrement}
                disabled={quantity <= minQty}
                activeOpacity={0.7}
              >
                <Minus
                  size={16}
                  color={quantity <= minQty ? "#CBD5E1" : "#1E293B"}
                  strokeWidth={2.4}
                />
              </TouchableOpacity>

              <Text style={styles.quantityCount}>{quantity}</Text>

              <TouchableOpacity
                style={[
                  styles.counterBtn,
                  quantity >= maxAllowed && styles.counterBtnDisabled,
                ]}
                onPress={handleIncrement}
                disabled={quantity >= maxAllowed}
                activeOpacity={0.7}
              >
                <Plus
                  size={16}
                  color={quantity >= maxAllowed ? "#CBD5E1" : "#1E293B"}
                  strokeWidth={2.4}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Group Discount Notice if applicable */}
          {hasSavings && (
            <View style={styles.savingsBanner}>
              <Tag size={13} color="#059669" strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={styles.savingsText}>
                You save ₹{savingsAmount.toLocaleString("en-IN")} on this selection!
              </Text>
            </View>
          )}
        </SwipeableModal.ScrollView>

        {/* Sticky Action Footer */}
        <View style={styles.actionFooter}>
          <View style={styles.footerPriceCol}>
            <Text style={styles.footerPriceLabel}>
              {quantity} {quantity === 1 ? "pass" : "passes"}
            </Text>
            <Text style={styles.footerPriceAmount}>
              {totalAmount === 0 ? "Free" : `₹${totalAmount.toLocaleString("en-IN")}`}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              { backgroundColor: PRIMARY_COLOR },
            ]}
            onPress={handleProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutBtnText}>
              {totalAmount === 0 ? "Register Pass" : "Proceed to Checkout"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      ) : null}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Math.round(SCREEN_HEIGHT * 0.85),
    maxHeight: Math.round(SCREEN_HEIGHT * 0.90),
    overflow: "hidden",
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleBar: {
    width: 38,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    marginBottom: 8,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  ticketThemeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  ticketThemeBadgeText: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  container: {
    flex: 1,
    height: "100%",
    justifyContent: "space-between",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  titleSection: {
    marginBottom: 16,
  },
  ticketTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#0F172A",
    lineHeight: 28,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceValue: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 22,
    color: "#0F172A",
  },
  originalPrice: {
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  discountBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 10,
  },
  discountBadgeText: {
    fontFamily: "Manrope-Bold",
    fontSize: 11,
    color: "#166534",
  },
  metaCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  metaIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  metaTextCol: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },
  metaValueText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13.5,
    color: "#1E293B",
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 8,
  },
  descriptionText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
  restrictionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  restrictionTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    color: "#C2410C",
    marginBottom: 2,
  },
  restrictionDesc: {
    fontFamily: "Manrope-Regular",
    fontSize: 12.5,
    color: "#9A3412",
    lineHeight: 18,
  },
  policyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  policyCardNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  policyTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 13,
    color: "#166534",
    marginBottom: 2,
  },
  policyTitleNeutral: {
    color: "#475569",
  },
  policyDesc: {
    fontFamily: "Manrope-Regular",
    fontSize: 12.5,
    color: "#15803D",
    lineHeight: 18,
  },
  policyDescNeutral: {
    color: "#64748B",
  },
  quantitySection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quantityInfoCol: {
    flex: 1,
  },
  quantityHeading: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 15,
    color: "#0F172A",
  },
  quantitySub: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 4,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  counterBtnDisabled: {
    opacity: 0.4,
  },
  quantityCount: {
    fontFamily: "Manrope-Bold",
    fontSize: 15,
    color: "#0F172A",
    paddingHorizontal: 14,
  },
  savingsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  savingsText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#166534",
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  footerPriceCol: {
    justifyContent: "center",
  },
  footerPriceLabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#64748B",
  },
  footerPriceAmount: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 20,
    color: "#0F172A",
    marginTop: 1,
  },
  checkoutBtn: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    marginLeft: 20,
  },
  checkoutBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
