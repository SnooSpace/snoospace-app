/**
 * TicketSelectionScreen - Choose tickets for an event
 * Shows list of ticket types with Add/quantity controls
 * Dynamic bottom bar with cart total and Checkout button
 * Dynamic vibrant ticket themes, distinct SVG cutouts, and robust gender-restriction handling
 */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Minus,
  Plus,
  ChevronRight,
  AlertCircle,
  Users,
  User,
  Crown,
  Video,
  Ticket,
  Zap,
  Sparkles,
  GraduationCap,
  Lock,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { getActiveAccount, getAuthToken } from "../../api/auth";
import { calculateEffectivePrice } from "../../utils/pricingUtils";
import { apiGet } from "../../api/client";
import DynamicStatusBar from "../../components/navigation/DynamicStatusBar";
import {
  TICKET_SHAPES,
  resolveEventTicketThemes,
  SEMANTIC_THEMES,
} from "../../utils/ticketVisuals";

// Premium Theme Colors
const BACKGROUND_COLOR = "#F8F9FA";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1E293B"; // Slate-800 matching the SVG design
const MUTED_TEXT = "#475569"; // Slate-600 matching SVG descriptions
const BORDER_COLOR = "#F2F2F7";
const PRIMARY_COLOR = COLORS.primary;

// Lucide Icon mapping for semantic categories
const ICON_MAP = {
  Crown,
  Video,
  Ticket,
  Zap,
  Users,
  User,
  Sparkles,
  GraduationCap,
  Lock,
};

// Static Helper Functions (Extracted outside components to prevent redeclaration on every render)
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

// Memoized TicketCard Subcomponent
const TicketCard = React.memo(({
  ticket,
  index,
  qty,
  available,
  isSoldOut,
  price,
  addDisabled,
  theme,
  displayDate,
  pricingRules,
  onAdd,
  onRemove,
  onLockedPress,
}) => {
  const gradId = `grad-${ticket.id || index}`;
  const borderId = `border-${ticket.id || index}`;

  const handleAddPress = useCallback(() => {
    onAdd(ticket);
  }, [onAdd, ticket]);

  const handleRemovePress = useCallback(() => {
    onRemove(ticket);
  }, [onRemove, ticket]);

  const handleLockedPress = useCallback(() => {
    onLockedPress?.(ticket);
  }, [onLockedPress, ticket]);

  const shape = TICKET_SHAPES[theme?.shapeVariant] || TICKET_SHAPES.classic;
  const IconComponent = theme?.iconName ? ICON_MAP[theme.iconName] : null;

  return (
    <View
      style={[
        styles.ticketCard,
        (isSoldOut || ticket.isLocked) && styles.ticketCardDisabled,
      ]}
    >
      {/* SVG Background - Dynamic Clean Ticket Vector with Distinct Cutout Shape */}
      <Svg
        viewBox="0 0 600 240"
        style={StyleSheet.absoluteFillObject}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="600" y2="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={theme.bgColorStart} />
            <Stop offset="100%" stopColor={theme.bgColorEnd} />
          </SvgLinearGradient>
          <SvgLinearGradient id={borderId} x1="0" y1="0" x2="600" y2="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={theme.borderColorStart} stopOpacity={1} />
            <Stop offset="50%" stopColor={theme.borderColorEnd} stopOpacity={0.85} />
            <Stop offset="100%" stopColor={theme.borderColorStart} stopOpacity={1} />
          </SvgLinearGradient>
        </Defs>

        {/* Dynamic ticket shape based on category and allocation */}
        <Path
          d={shape.path}
          fill={`url(#${gradId})`}
          stroke={`url(#${borderId})`}
          strokeWidth={2.5}
        />

        {/* Perforation vertical line with shape-matched dash style */}
        <Line
          x1="460"
          y1={16}
          x2="460"
          y2={224}
          stroke={theme.borderColorEnd}
          strokeWidth={2}
          strokeDasharray={shape.dashArray}
          strokeLinecap={shape.dashCap}
          opacity={0.6}
        />
      </Svg>

      {/* Content Overlay Layout */}
      <View style={styles.cardContent}>
        {/* Left Section (Main Info) */}
        <View style={styles.leftStub}>
          {theme.tag ? (
            <View
              style={[
                styles.headerTagPill,
                { backgroundColor: theme.tagBg || "rgba(0,0,0,0.05)" },
              ]}
            >
              {IconComponent && (
                <IconComponent
                  size={11}
                  color={theme.tagColor || theme.color}
                  strokeWidth={2.4}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.headerTagText,
                  { color: theme.tagColor || theme.color },
                ]}
              >
                {theme.tag.toUpperCase()}
              </Text>
            </View>
          ) : null}
          
          <Text style={styles.ticketTitle} numberOfLines={1}>
            {ticket.name}
          </Text>

          {/* Dynamic Date Row */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date: </Text>
            <Text style={styles.metaValue}>
              {formatDate(displayDate)}  •  {formatTime(displayDate)}
            </Text>
          </View>

          {/* Gender restriction lock reason if locked */}
          {ticket.isLocked && ticket.lockReason ? (
            <View style={styles.genderLockRow}>
              <ShieldAlert size={12} color="#EA580C" strokeWidth={2.2} />
              <Text style={styles.genderLockText}>{ticket.lockReason}</Text>
            </View>
          ) : null}

          {/* Stock counter warning */}
          {ticket.total_quantity && available > 0 && available <= 10 && (
            <View style={styles.stockRow}>
              <Clock size={12} color="#EA580C" strokeWidth={2.5} />
              <Text style={styles.remainingBadge}>
                Only {available} passes left
              </Text>
            </View>
          )}

          {/* Group / Bulk discount hint row */}
          {(() => {
            const pricing = calculateEffectivePrice(ticket, pricingRules, qty);
            if (pricing.groupDiscountHint && !pricing.hasDiscount) {
              return (
                <View style={styles.bulkOfferRow}>
                  <Users size={12} color="#7C3AED" strokeWidth={2.2} />
                  <Text style={styles.bulkOfferText}>
                    {pricing.groupDiscountHint.text}
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          {/* Custom Description text */}
          {ticket.description && (
            <View style={styles.descBlock}>
              <Text style={styles.descLine} numberOfLines={2}>
                {ticket.description.replace(/^[-•]\s*/, "")}
              </Text>
            </View>
          )}
        </View>

        {/* Right Section (Stub) */}
        <View style={styles.rightStub}>
          {/* Pricing and Action controls */}
          <View style={styles.foregroundStub}>
            {/* Dedicated Price Container */}
            <View style={styles.priceContainer}>
              {(() => {
                const pricing = calculateEffectivePrice(
                  ticket,
                  pricingRules,
                  qty
                );
                if (pricing.hasDiscount) {
                  return (
                    <View style={styles.priceCol}>
                      <Text
                        style={[
                          styles.ticketPriceDiscounted,
                          pricing.ruleType === "group_discount" && styles.ticketPriceGroup,
                        ]}
                      >
                        ₹{pricing.effectivePrice}
                      </Text>
                      <Text style={styles.ticketPriceOriginal}>
                        ₹{pricing.originalPrice}
                      </Text>
                      <View
                        style={[
                          styles.discountBadge,
                          pricing.ruleType === "group_discount" && styles.groupDiscountBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.discountBadgeText,
                            pricing.ruleType === "group_discount" && styles.groupDiscountBadgeText,
                          ]}
                        >
                          {pricing.discountLabel}
                        </Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View style={styles.priceCol}>
                    <Text style={styles.ticketPrice}>
                      {price === 0
                        ? "Free"
                        : `₹${price.toLocaleString("en-IN")}`}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Dedicated Action Container */}
            <View style={styles.actionContainer}>
              {ticket.isLocked ? (
                <TouchableOpacity
                  style={[styles.lockedBadge, { borderColor: theme.borderColorStart }]}
                  onPress={handleLockedPress}
                  activeOpacity={0.7}
                >
                  <Lock size={12} color={theme.color} strokeWidth={2.4} style={{ marginRight: 3 }} />
                  <Text style={[styles.lockedBadgeText, { color: theme.color }]}>Locked</Text>
                </TouchableOpacity>
              ) : !isSoldOut ? (
                qty === 0 ? (
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.color }]}
                    onPress={handleAddPress}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.quantityControl, { backgroundColor: theme.color, borderColor: theme.color }]}>
                    <TouchableOpacity
                      onPress={handleRemovePress}
                      style={styles.qtyButton}
                      activeOpacity={0.7}
                    >
                      <Minus size={13} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{qty}</Text>
                    <TouchableOpacity
                      onPress={handleAddPress}
                      style={[
                        styles.qtyButton,
                        addDisabled && styles.qtyButtonDisabled,
                      ]}
                      disabled={addDisabled}
                      activeOpacity={0.7}
                    >
                      <Plus
                        size={13}
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
        </View>
      </View>
    </View>
  );
});

export default function TicketSelectionScreen({ route, navigation }) {
  const { event } = route.params;
  const insets = useSafeAreaInsets();

  // Cart state: { ticketId: quantity }
  const [cart, setCart] = useState({});
  const [userGender, setUserGender] = useState(null);
  // accountType is used to skip gender filter for non-member accounts (e.g. community)
  const [accountType, setAccountType] = useState(null);
  const [genderLoading, setGenderLoading] = useState(true);

  // Load user's gender by calling the member profile API
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

  // Check if event has gender-restricted tickets
  const hasGenderRestrictedTickets = useMemo(() => {
    if (!event?.ticket_types) return false;
    return event.ticket_types.some((t) => {
      const r = (t.gender_restriction || "all").toLowerCase().trim();
      return r === "male" || r === "female";
    });
  }, [event?.ticket_types]);

  // Is user's profile gender missing when event requires it?
  const isProfileGenderMissing = !genderLoading && accountType === "member" && !userGender && hasGenderRestrictedTickets;

  // Resolve themes for all tickets in the event using the 2-pass allocation engine
  const ticketThemes = useMemo(() => {
    return resolveEventTicketThemes(event?.ticket_types || []);
  }, [event?.ticket_types]);

  // Filter and prepare displayed tickets with eligibility status
  const displayedTickets = useMemo(() => {
    if (!event?.ticket_types) return [];
    if (genderLoading) return [];

    const memberGender = (userGender || "").toLowerCase().trim();

    return event.ticket_types
      .map((ticket) => {
        const key = ticket.id?.toString() || ticket.name;
        const theme = ticketThemes[key] || SEMANTIC_THEMES.general;
        const restriction = (ticket.gender_restriction || "all").toLowerCase().trim();

        let isLocked = false;
        let lockReason = null;

        if (restriction !== "all") {
          if (accountType && accountType !== "member") {
            isLocked = true;
            lockReason = "Member accounts only";
          } else if (!memberGender) {
            isLocked = true;
            lockReason = "Profile gender needed";
          } else if (restriction !== memberGender) {
            isLocked = true;
            lockReason = restriction === "male" ? "Men only" : "Women only";
          }
        }

        return {
          ...ticket,
          theme,
          isLocked,
          lockReason,
        };
      })
      .filter((ticket) => {
        const restriction = (ticket.gender_restriction || "all").toLowerCase().trim();
        // Unrestricted passes are always visible
        if (restriction === "all") return true;

        // If user has no gender set in profile, do NOT hide them silently!
        // Show them with locked status so the user knows they exist and can update profile.
        if (!memberGender) return true;

        // Non-member accounts: show so organizers/communities can preview tiers
        if (accountType && accountType !== "member") return true;

        // If gender matches, show
        if (restriction === memberGender) return true;

        // If ticket is for opposite gender, only show locked if ALL tickets in the event are for the other gender
        const hasMatchingTickets = event.ticket_types.some((t) => {
          const r = (t.gender_restriction || "all").toLowerCase().trim();
          return r === "all" || r === memberGender;
        });

        return !hasMatchingTickets;
      });
  }, [event?.ticket_types, ticketThemes, userGender, accountType, genderLoading]);

  // Calculate cart totals using effective prices
  const { totalItems, totalAmount } = useMemo(() => {
    let items = 0;
    let amount = 0;

    Object.entries(cart).forEach(([ticketId, qty]) => {
      if (qty > 0) {
        const ticket = displayedTickets.find(
          (t) => t.id?.toString() === ticketId || t.name === ticketId
        );
        if (ticket) {
          items += qty;
          const pricing = calculateEffectivePrice(ticket, event.pricing_rules, qty);
          amount += qty * pricing.effectivePrice;
        }
      }
    });

    return { totalItems: items, totalAmount: amount };
  }, [cart, displayedTickets, event.pricing_rules]);

  // Stable handlers
  const handleAdd = useCallback((ticket) => {
    if (ticket.isLocked) return;
    const key = ticket.id?.toString() || ticket.name;
    setCart((prev) => {
      const currentQty = prev[key] || 0;
      // Calculate available tickets
      const available = ticket.total_quantity
        ? Math.max(0, ticket.total_quantity - (ticket.sold_count || 0) - (ticket.reserved_count || 0))
        : Infinity;
      const maxAllowed = Math.min(ticket.max_per_order || 10, available);

      if (currentQty >= maxAllowed) return prev;
      return {
        ...prev,
        [key]: currentQty + 1,
      };
    });
  }, []);

  const handleRemove = useCallback((ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    setCart((prev) => {
      const newQty = (prev[key] || 0) - 1;
      if (newQty <= 0) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newQty };
    });
  }, []);

  const handleLockedPress = useCallback((ticket) => {
    if (ticket.lockReason === "Profile gender needed") {
      Alert.alert(
        "Profile Gender Needed",
        `To purchase "${ticket.name}", please update your gender in your Profile Settings.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit Profile",
            onPress: () => navigation.navigate("EditProfile"),
          },
        ]
      );
    } else if (ticket.lockReason === "Member accounts only") {
      Alert.alert(
        "Member Pass",
        `"${ticket.name}" can only be purchased by individual member accounts.`
      );
    } else {
      Alert.alert(
        "Pass Restricted",
        `"${ticket.name}" is restricted: ${ticket.lockReason}.`
      );
    }
  }, [navigation]);

  const handleCheckout = useCallback(() => {
    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, qty]) => {
        const ticket = displayedTickets.find(
          (t) => t.id?.toString() === ticketId || t.name === ticketId
        );
        return { ticket, quantity: qty };
      });

    navigation.navigate("Checkout", {
      event,
      cartItems,
      totalAmount,
    });
  }, [cart, displayedTickets, event, totalAmount, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const displayDate = event.start_datetime || event.event_date;

  return (
    <View style={styles.container}>
      {/* Dynamic Status Bar */}
      <DynamicStatusBar style="dark-content" />

      {/* Navigation Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={handleBack}
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
        {/* Section Title - Authority Rule: BasicCommercialBlack used once */}
        <Text style={styles.sectionTitle}>Choose tickets</Text>

        {/* Profile Gender Missing Informative Banner */}
        {isProfileGenderMissing && (
          <TouchableOpacity
            style={styles.genderWarningCard}
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.85}
          >
            <View style={styles.genderWarningIconWrap}>
              <TriangleAlert size={18} color="#D97706" strokeWidth={2.2} />
            </View>
            <View style={styles.genderWarningTextWrap}>
              <Text style={styles.genderWarningTitle}>Profile Gender Needed</Text>
              <Text style={styles.genderWarningDesc}>
                Some passes for this event require gender verification. Tap to update your profile.
              </Text>
            </View>
            <ChevronRight size={16} color="#D97706" strokeWidth={2.2} />
          </TouchableOpacity>
        )}

        {/* Loading state */}
        {genderLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading available tickets…</Text>
          </View>
        )}

        {/* No eligible tickets */}
        {!genderLoading && displayedTickets.length === 0 && (
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

        {displayedTickets.map((ticket, index) => {
          const key = ticket.id?.toString() || ticket.name;
          const qty = cart[key] || 0;
          const available = ticket.total_quantity
            ? Math.max(0, ticket.total_quantity - (ticket.sold_count || 0) - (ticket.reserved_count || 0))
            : Infinity;
          const isSoldOut = ticket.total_quantity && available <= 0;
          const price = parseFloat(ticket.base_price) || 0;
          const maxAllowed = Math.min(ticket.max_per_order || 10, available);
          const addDisabled = qty >= maxAllowed;
          const theme = ticket.theme;

          return (
            <TicketCard
              key={key}
              ticket={ticket}
              index={index}
              qty={qty}
              available={available}
              isSoldOut={isSoldOut}
              price={price}
              addDisabled={addDisabled}
              theme={theme}
              displayDate={displayDate}
              pricingRules={event.pricing_rules}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onLockedPress={handleLockedPress}
            />
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
    fontFamily: "Manrope-SemiBold",
    color: MUTED_TEXT,
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Black",
    color: TEXT_COLOR,
    marginTop: 24,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  genderWarningCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  genderWarningIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  genderWarningTextWrap: {
    flex: 1,
  },
  genderWarningTitle: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#92400E",
    marginBottom: 2,
  },
  genderWarningDesc: {
    fontSize: 11.5,
    fontFamily: "Manrope-Regular",
    color: "#B45309",
    lineHeight: 15,
  },
  ticketCard: {
    flexDirection: "row",
    marginBottom: 16,
    minHeight: 144, // 2.5 aspect ratio support
    position: "relative",
    backgroundColor: "transparent",
    borderWidth: 0,
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {},
    }),
  },
  ticketCardDisabled: {
    opacity: 0.65,
  },
  cardContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  leftStub: {
    flex: 4.6, // matches SVG split ratio (460/600)
    paddingLeft: 24,
    paddingRight: 16,
    paddingVertical: 16,
    justifyContent: "center",
  },
  headerTagPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  headerTagText: {
    fontSize: 10,
    fontFamily: "Manrope-Bold",
    letterSpacing: 1,
  },
  ticketTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#0F172A",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: MUTED_TEXT,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  genderLockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  genderLockText: {
    fontSize: 11,
    color: "#EA580C",
    fontFamily: "Manrope-Medium",
  },
  rightStub: {
    flex: 1.4, // matches SVG split ratio (140/600)
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  foregroundStub: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  priceContainer: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  priceCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  ticketPrice: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#0F172A",
    lineHeight: 24,
  },
  ticketPriceDiscounted: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#EA580C",
    lineHeight: 22,
  },
  ticketPriceGroup: {
    color: "#7C3AED",
  },
  ticketPriceOriginal: {
    fontSize: 11.5,
    fontFamily: "Manrope-Medium",
    color: "#94A3B8",
    textDecorationLine: "line-through",
    lineHeight: 14,
    marginTop: 1,
  },
  discountBadge: {
    backgroundColor: "#FEF08A",
    borderWidth: 1,
    borderColor: "#FACC15",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 3,
  },
  discountBadgeText: {
    fontSize: 9.5,
    fontFamily: "Manrope-Bold",
    color: "#854D0E",
    letterSpacing: 0.2,
  },
  groupDiscountBadge: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
    borderWidth: 1,
  },
  groupDiscountBadgeText: {
    color: "#6D28D9",
  },
  bulkOfferRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  bulkOfferText: {
    fontSize: 10.5,
    color: "#7C3AED",
    fontFamily: "Manrope-Bold",
  },
  actionContainer: {
    height: 34,
    width: 78,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    height: 34,
    width: 78,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  addButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
    includeFontPadding: false,
  },
  lockedBadge: {
    height: 34,
    width: 78,
    borderRadius: 17,
    borderWidth: 1.5,
    backgroundColor: "rgba(0,0,0,0.03)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
  },
  quantityControl: {
    height: 34,
    width: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  qtyButton: {
    width: 26,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonDisabled: {
    opacity: 0.35,
  },
  qtyValue: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
    minWidth: 18,
    includeFontPadding: false,
  },
  soldOutBadge: {
    height: 34,
    width: 78,
    backgroundColor: "rgba(225,29,72,0.08)",
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  soldOutText: {
    color: "#E11D48",
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  remainingBadge: {
    fontSize: 11,
    color: "#EA580C",
    fontFamily: "Manrope-SemiBold",
  },
  descBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
    borderStyle: "dashed",
  },
  descLine: {
    fontSize: 12.5,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
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
    fontFamily: "Manrope-SemiBold",
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
    fontFamily: "Manrope-SemiBold",
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
