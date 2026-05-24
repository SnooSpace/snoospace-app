/**
 * TicketSelectionScreen - Choose tickets for an event
 * Shows list of ticket types with Add/quantity controls
 * Dynamic bottom bar with cart total and Checkout button
 * Filters tickets by user's gender (from profile)
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Ticket,
  User,
  Users,
  Minus,
  Plus,
  ChevronRight,
  Info,
  Lock,
  Tag,
  AlertCircle,
  CheckCircle,
  Sparkles,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { getActiveAccount, getAuthToken } from "../../api/auth";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import { apiGet } from "../../api/client";

// Premium Theme Colors
const BACKGROUND_COLOR = "#F8F9FA";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1D1D1F";
const MUTED_TEXT = "#86868B";
const BORDER_COLOR = "#F2F2F7";
const PRIMARY_COLOR = COLORS.primary;

export default function TicketSelectionScreen({ route, navigation }) {
  const { event } = route.params;
  const insets = useSafeAreaInsets();

  // Cart state: { ticketId: quantity }
  const [cart, setCart] = useState({});
  const [userGender, setUserGender] = useState(null);
  // accountType is used to skip gender filter for non-member accounts (e.g. community)
  const [accountType, setAccountType] = useState(null);
  const [genderLoading, setGenderLoading] = useState(true);

  // Load user's gender by calling the actual member profile API
  useEffect(() => {
    const loadUserGender = async () => {
      try {
        const account = await getActiveAccount();
        const type = account?.type || "member";
        setAccountType(type);

        if (type !== "member") {
          setGenderLoading(false);
          return;
        }

        // Fetch the actual member profile to get the gender field
        const token = await getAuthToken();
        const profile = await apiGet("/members/profile", 10000, token);
        const gender = profile?.profile?.gender || null;
        console.log("[TicketSelection] Loaded user gender:", gender);
        setUserGender(gender);
      } catch (error) {
        console.log("[TicketSelection] Could not load user gender:", error);
        setUserGender(null);
      } finally {
        setGenderLoading(false);
      }
    };
    loadUserGender();
  }, []);

  // Filter tickets by user's gender (CASE-INSENSITIVE COMPARISON)
  const filteredTickets = useMemo(() => {
    if (!event.ticket_types) return [];
    if (genderLoading) return [];

    return event.ticket_types.filter((ticket) => {
      const restriction = (ticket.gender_restriction || "all").toLowerCase().trim();
      if (restriction === "all") return true;
      if (accountType && accountType !== "member") return false;
      
      const memberGender = (userGender || "").toLowerCase().trim();
      return restriction === memberGender;
    });
  }, [event.ticket_types, userGender, accountType, genderLoading]);

  // Calculate cart totals using effective prices
  const { totalItems, totalAmount } = useMemo(() => {
    let items = 0;
    let amount = 0;

    Object.entries(cart).forEach(([ticketId, qty]) => {
      if (qty > 0) {
        const ticket = filteredTickets.find(
          (t) => t.id?.toString() === ticketId || t.name === ticketId
        );
        if (ticket) {
          items += qty;
          const pricing = calculateEffectivePrice(ticket, event.pricing_rules);
          amount += qty * pricing.effectivePrice;
        }
      }
    });

    return { totalItems: items, totalAmount: amount };
  }, [cart, filteredTickets, event.pricing_rules]);

  // Calculate available tickets for a ticket type
  const getAvailable = (ticket) => {
    if (!ticket.total_quantity) return Infinity;
    return Math.max(
      0,
      ticket.total_quantity -
        (ticket.sold_count || 0) -
        (ticket.reserved_count || 0)
    );
  };

  const isAddDisabled = (ticket) => {
    const qty = getQuantity(ticket);
    const available = getAvailable(ticket);
    const maxAllowed = Math.min(ticket.max_per_order || 10, available);
    return qty >= maxAllowed;
  };

  const handleAdd = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    const currentQty = cart[key] || 0;
    const available = getAvailable(ticket);
    const maxAllowed = Math.min(ticket.max_per_order || 10, available);

    if (currentQty >= maxAllowed) return;

    setCart((prev) => ({
      ...prev,
      [key]: currentQty + 1,
    }));
  };

  const handleRemove = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    setCart((prev) => {
      const newQty = (prev[key] || 0) - 1;
      if (newQty <= 0) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newQty };
    });
  };

  const getQuantity = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    return cart[key] || 0;
  };

  const handleCheckout = () => {
    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, qty]) => {
        const ticket = event.ticket_types.find(
          (t) => t.id?.toString() === ticketId || t.name === ticketId
        );
        return { ticket, quantity: qty };
      });

    navigation.navigate("Checkout", {
      event,
      cartItems,
      totalAmount,
    });
  };

  const displayDate = event.start_datetime || event.event_date;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper to resolve customizable ticket cards aesthetics INSPIRED BY THE WATERMARK TICKET SAMPLES
  const getTicketTheme = (ticket) => {
    const name = (ticket.name || "").toLowerCase();
    const restriction = (ticket.gender_restriction || "all").toLowerCase();

    if (name.includes("couple") || restriction === "couple") {
      return {
        color: "#D97706", // Amber/Gold
        bgTint: "#FFFDF2", // Soft gold paper tint
        badgeBg: "rgba(217, 119, 6, 0.12)",
        watermark: "ADMIT ONE",
        label: "VIP Admission • Couple",
      };
    }
    if (restriction === "female" || name.includes("vixen") || name.includes("girls") || name.includes("female") || name.includes("ladies")) {
      return {
        color: "#E11D48", // Rose Red
        bgTint: "#FFF5F6", // Soft rose pink paper tint
        badgeBg: "rgba(225, 29, 72, 0.12)",
        watermark: "ENTRY PASS",
        label: "Ladies Special Event",
      };
    }
    if (restriction === "male" || name.includes("stag") || name.includes("men") || name.includes("male")) {
      return {
        color: "#2563EB", // Royal Blue
        bgTint: "#F0F6FF", // Soft gentlemen sky blue tint
        badgeBg: "rgba(37, 99, 235, 0.12)",
        watermark: "VIP PASS",
        label: "Gentlemen's Evening",
      };
    }
    return {
      color: PRIMARY_COLOR,
      bgTint: "#F9FAFB",
      badgeBg: "rgba(98, 0, 238, 0.12)",
      watermark: "ADMIT ONE",
      label: "General Admission",
    };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Premium Navigation Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.headerMetaRow}>
            <Calendar size={12} color={MUTED_TEXT} strokeWidth={2} />
            <Text style={styles.headerSubtitle}>
              {formatDate(displayDate)}  •  {formatTime(displayDate)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Choose tickets</Text>

        {/* Loading state */}
        {genderLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading available tickets…</Text>
          </View>
        )}

        {/* No eligible tickets */}
        {!genderLoading && filteredTickets.length === 0 && (
          <View style={styles.emptyContainer}>
            <AlertCircle size={40} color={MUTED_TEXT} strokeWidth={2} />
            <Text style={styles.emptyTitle}>No tickets available</Text>
            <Text style={styles.emptySubtitle}>
              {accountType !== "member"
                ? "Only member accounts can purchase tickets for this event."
                : "There are no tickets available matching your profile restrictions."}
            </Text>
          </View>
        )}

        {filteredTickets.map((ticket, index) => {
          const qty = getQuantity(ticket);
          const available = getAvailable(ticket);
          const isSoldOut = ticket.total_quantity && available <= 0;
          const price = parseFloat(ticket.base_price) || 0;
          const addDisabled = isAddDisabled(ticket);
          const theme = getTicketTheme(ticket);

          return (
            <View
              key={index}
              style={[
                styles.ticketCard,
                isSoldOut && styles.ticketCardDisabled,
                {
                  borderColor: theme.color,
                  backgroundColor: theme.bgTint,
                },
              ]}
            >
              {/* Left Edge Semicircular Notch */}
              <View style={styles.notchLeft} />

              {/* Left Stub - Content */}
              <View style={styles.leftStub}>
                {/* Header Tag / Category */}
                <Text style={[styles.headerTag, { color: theme.color }]}>
                  {theme.label.toUpperCase()}
                </Text>

                {/* Ticket Title (Empower Slate Blue Style) */}
                <Text style={styles.ticketTitle} numberOfLines={1}>
                  {ticket.name}
                </Text>

                {/* Date & Subtitle */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date: </Text>
                  <Text style={styles.metaValue}>
                    {formatDate(displayDate)}  {formatTime(displayDate)}
                  </Text>
                </View>

                {/* Remaining alert */}
                {ticket.total_quantity && available > 0 && available <= 10 && (
                  <View style={styles.stockRow}>
                    <Clock size={11} color="#D97706" strokeWidth={2.5} />
                    <Text style={styles.remainingBadge}>
                      Only {available} passes left
                    </Text>
                  </View>
                )}

                {/* Bullet Descriptions */}
                {ticket.description && (
                  <View style={styles.descBlock}>
                    {ticket.description.split("\n").map((line, i) => (
                      <View key={i} style={styles.descLineRow}>
                        <View style={[styles.bulletPoint, { backgroundColor: theme.color }]} />
                        <Text style={styles.descLine}>
                          {line.replace(/^[-•]\s*/, "")}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Perforation Line Container */}
              <View style={styles.perforationLineContainer}>
                <View style={styles.dashedDivider} />
              </View>

              {/* Right Stub - Tear-off Scannable Coupon */}
              <View style={styles.rightStub}>
                {/* Vertical faint watermark text in background (Exactly like the Admit One watermarks) */}
                <View style={styles.watermarkContainer}>
                  <Text style={styles.watermarkText} numberOfLines={1}>
                    {theme.watermark}
                  </Text>
                </View>

                {/* Solid Foreground Content */}
                <View style={styles.foregroundStub}>
                  {/* Pricing */}
                  {(() => {
                    const pricing = calculateEffectivePrice(
                      ticket,
                      event.pricing_rules
                    );
                    if (pricing.hasDiscount) {
                      return (
                        <View style={styles.priceCol}>
                          <Text style={styles.ticketPriceDiscounted}>
                            ₹{pricing.effectivePrice}
                          </Text>
                          <Text style={styles.ticketPriceOriginal}>
                            ₹{pricing.originalPrice}
                          </Text>
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>
                              {pricing.discountLabel}
                            </Text>
                          </View>
                        </View>
                      );
                    }
                    return (
                      <Text style={styles.ticketPrice}>
                        {price === 0
                          ? "Free"
                          : `₹${price.toLocaleString("en-IN")}`}
                      </Text>
                    );
                  })()}

                  <View style={{ height: 12 }} />

                  {/* Quantity selector / Add CTA */}
                  {!isSoldOut ? (
                    qty === 0 ? (
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: theme.color }]}
                        onPress={() => handleAdd(ticket)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.addButtonText}>Add</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.quantityControl, { borderColor: theme.color }]}>
                        <TouchableOpacity
                          onPress={() => handleRemove(ticket)}
                          style={styles.qtyButton}
                          activeOpacity={0.7}
                        >
                          <Minus size={12} color="#FFFFFF" strokeWidth={3} />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          onPress={() => handleAdd(ticket)}
                          style={[
                            styles.qtyButton,
                            addDisabled && styles.qtyButtonDisabled,
                          ]}
                          disabled={addDisabled}
                          activeOpacity={0.7}
                        >
                          <Plus
                            size={12}
                            color="#FFFFFF"
                            strokeWidth={3}
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    <View style={styles.soldOutBadge}>
                      <Text style={styles.soldOutText}>Sold Out</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right Edge Semicircular Notch */}
              <View style={styles.notchRight} />
            </View>
          );
        })}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Dynamic Cinematic Bottom Panel */}
      {totalItems > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>
              {totalItems} Ticket{totalItems > 1 ? "s" : ""} Selected
            </Text>
            <Text style={styles.cartTotal}>
              ₹{totalAmount.toLocaleString("en-IN")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutButtonWrapper}
            onPress={handleCheckout}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkoutButtonGradient}
            >
              <Text style={styles.checkoutButtonText}>Checkout</Text>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
    marginLeft: -6,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    marginTop: 24,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  ticketCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    minHeight: 140,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  ticketCardDisabled: {
    opacity: 0.65,
  },
  // Real notch bites on the far left and right edges
  notchLeft: {
    position: "absolute",
    left: -10,
    top: "50%",
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR, // blends with screen background to clip card border
    zIndex: 10,
  },
  notchRight: {
    position: "absolute",
    right: -10,
    top: "50%",
    marginTop: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR,
    zIndex: 10,
  },
  leftStub: {
    flex: 2.6,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center",
  },
  headerTag: {
    fontSize: 10,
    fontFamily: "Manrope-SemiBold",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  ticketTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold", // Slate Blue Large Title
    color: "#1A2D4A",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12.5,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
  },
  metaValue: {
    fontSize: 12.5,
    fontFamily: "Manrope-Regular",
    color: TEXT_COLOR,
  },
  // Perforation Divider
  perforationLineContainer: {
    width: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  dashedDivider: {
    flex: 1,
    width: 1,
    borderWidth: 1,
    borderColor: "rgba(26, 45, 74, 0.08)",
    borderStyle: "dashed",
    marginVertical: 12,
  },
  // Right Stub - scannable admit coupon
  rightStub: {
    flex: 1.3,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    padding: 10,
  },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    opacity: 0.04,
  },
  watermarkText: {
    fontSize: 24,
    fontFamily: "BasicCommercial-Bold",
    color: "#000000",
    transform: [{ rotate: "-90deg" }],
    textAlign: "center",
    width: 130,
  },
  foregroundStub: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCol: {
    alignItems: "center",
  },
  ticketPrice: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#1A2D4A",
  },
  ticketPriceDiscounted: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#059669",
  },
  ticketPriceOriginal: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    textDecorationLine: "line-through",
    marginTop: 1,
  },
  discountBadge: {
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
  },
  discountBadgeText: {
    fontSize: 9,
    fontFamily: "Manrope-SemiBold",
    color: "#059669",
  },
  addButton: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: "#1A2D4A", // Premium slate dark counter control block
    padding: 2,
  },
  qtyButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  qtyButtonDisabled: {
    opacity: 0.3,
  },
  qtyValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    paddingHorizontal: 4,
    minWidth: 16,
    textAlign: "center",
  },
  soldOutBadge: {
    backgroundColor: "rgba(225,29,72,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  soldOutText: {
    color: "#E11D48",
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  remainingBadge: {
    fontSize: 11,
    color: "#D97706",
    fontFamily: "Manrope-SemiBold",
  },
  descBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
    borderStyle: "dashed",
  },
  descLineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  bulletPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
    opacity: 0.8,
  },
  descLine: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    flex: 1,
    lineHeight: 16,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: CARD_BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  cartInfo: {
    flex: 1,
  },
  cartItems: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
  },
  cartTotal: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    marginTop: 2,
  },
  checkoutButtonWrapper: {
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
  checkoutButtonGradient: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    textAlign: "center",
    lineHeight: 20,
  },
});
