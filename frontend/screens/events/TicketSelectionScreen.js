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
  MapPin,
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
  Rect,
} from "react-native-svg";
import TicketDetailsSheet from "../../components/modals/TicketDetailsSheet";
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
import {
  getSalesStatus,
  formatRegistrationCloseDate,
} from "../../utils/salesTiming";
import { useLocationName } from "../../utils/locationNameCache";

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

// Authentic Vintage Retail / Festival Stub Vertical Barcode Graphic
const BARCODE_LINES = [
  { y: 2, h: 2.2 },
  { y: 6.5, h: 1.2 },
  { y: 10, h: 3.2 },
  { y: 15.5, h: 1.2 },
  { y: 19, h: 2.5 },
  { y: 24, h: 4 },
  { y: 30.5, h: 1.2 },
  { y: 34, h: 2.2 },
  { y: 38.5, h: 1.5 },
  { y: 42, h: 3.2 },
  { y: 47.5, h: 1.2 },
  { y: 51, h: 2.2 },
  { y: 55.5, h: 3.5 },
  { y: 61, h: 1.2 },
  { y: 64.5, h: 2.2 },
  { y: 69, h: 1.5 },
  { y: 72.5, h: 3.2 },
  { y: 78, h: 1.2 },
  { y: 81.5, h: 2.5 },
];

const TicketBarcode = React.memo(({ color = "#1E3A8A", width = 46, height = 54 }) => (
  <Svg pointerEvents="none" width={width} height={height} viewBox="0 0 54 86">
    {BARCODE_LINES.map((bar, idx) => (
      <Rect
        key={idx}
        x={0}
        y={bar.y}
        width={54}
        height={bar.h}
        fill={color}
        opacity={0.88}
      />
    ))}
  </Svg>
));

// Streamlined Retro Festival Stub Ticket Card
const TicketCard = React.memo(({
  ticket,
  index,
  available,
  isSoldOut,
  price,
  theme,
  displayDate,
  pricingRules,
  salesStatus,
  eventLocation,
  eventMode,
  virtualPlatform,
  onPress,
  onLockedPress,
}) => {
  const gradId = `grad-${ticket.id || index}`;
  const borderId = `border-${ticket.id || index}`;

  const shape = TICKET_SHAPES[theme?.shapeVariant] || TICKET_SHAPES.classic;
  const IconComponent = theme?.iconName ? ICON_MAP[theme.iconName] || Ticket : Ticket;

  // Determine if this card has dark background (e.g. electric cobalt VIP)
  const isDark = theme?.textColor === "#FFFFFF" || theme?.bgColor === "#2563EB";

  // Disallow Men/Women pass tags and redundant tags that duplicate ticket name
  const isMenOrWomenTag = (tag) => {
    if (!tag) return false;
    const t = tag.toLowerCase().trim();
    return (
      t.includes("men") ||
      t.includes("women") ||
      t.includes("male") ||
      t.includes("female") ||
      t.includes("boy") ||
      t.includes("girl") ||
      t.includes("stag") ||
      t.includes("ladies") ||
      t.includes("gents")
    );
  };

  const isRedundantTag = (tag, ticketName) => {
    if (!tag || !ticketName) return false;
    const t = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
    const n = ticketName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return n.includes(t) || t.includes(n);
  };

  const shouldShowTag = Boolean(
    theme?.tag &&
    !isMenOrWomenTag(theme.tag) &&
    !isRedundantTag(theme.tag, ticket.name)
  );

  // Access mode label and icon
  const mode = ticket.access_mode || eventMode || "in_person";
  const isVirtual = mode === "virtual";
  const isBoth = mode === "both" || mode === "hybrid";
  let modeLabel = "In-Person";
  if (isVirtual) {
    modeLabel = "Virtual";
  } else if (isBoth) {
    modeLabel = "Hybrid";
  }

  // Stock urgency tiers
  const totalQty = ticket.total_quantity || 0;
  const soldCount = (ticket.sold_count || 0) + (ticket.reserved_count || 0);
  const isCriticalStock = totalQty > 0
    ? (soldCount > 0 && available <= 3)
    : (available > 0 && available <= 3);

  // Pricing calculation
  const pricing = useMemo(() => {
    return calculateEffectivePrice(ticket, pricingRules, 1);
  }, [ticket, pricingRules]);

  const handleCardPress = useCallback(() => {
    if (ticket.isLocked) {
      onLockedPress?.(ticket);
      return;
    }
    onPress?.(ticket);
  }, [ticket, onLockedPress, onPress]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleCardPress}
      style={[
        styles.ticketCard,
        (isSoldOut || ticket.isLocked) && styles.ticketCardDisabled,
      ]}
    >
      {/* SVG Background - Authentic Solid Retro Duotone Ticket Vector */}
      <Svg
        pointerEvents="none"
        viewBox="0 0 600 240"
        style={StyleSheet.absoluteFillObject}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="600" y2="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={theme?.bgColorStart || theme?.bgColor || "#D5F0EE"} />
            <Stop offset="100%" stopColor={theme?.bgColorEnd || theme?.bgColor || "#C5EBE9"} />
          </SvgLinearGradient>
          <SvgLinearGradient id={borderId} x1="0" y1="0" x2="600" y2="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={theme?.borderColorStart || theme?.borderColor || theme?.color || "#AEE2E0"} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={theme?.borderColorEnd || theme?.borderColor || theme?.color || "#0891B2"} stopOpacity={0.9} />
          </SvgLinearGradient>
        </Defs>

        {/* Dynamic ticket shape with top/bottom perforation notches & serrated deckled right edge */}
        <Path
          d={shape.path}
          fill={`url(#${gradId})`}
          stroke={`url(#${borderId})`}
          strokeWidth={2}
        />

        {/* Perforation vertical dashed line */}
        <Line
          x1="460"
          y1={18}
          x2="460"
          y2={222}
          stroke={theme?.barcodeColor || theme?.textColor || "#1E3A8A"}
          strokeWidth={1.8}
          strokeDasharray="5 5"
          strokeLinecap="round"
          opacity={0.35}
        />
      </Svg>

      {/* Card Content Layout */}
      <View style={styles.cardContent} pointerEvents="none">
        {/* Left Section (Main Body) */}
        <View style={styles.leftStub}>
          {/* Header Row: Title & Circular Icon Badge */}
          <View style={styles.leftHeaderRow}>
            <View style={styles.titleCol}>
              {shouldShowTag && (
                <View
                  style={[
                    styles.headerTagPill,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.06)" },
                  ]}
                >
                  <Text style={[styles.headerTagText, { color: theme?.textColor || "#0F172A" }]}>
                    {theme.tag.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={[styles.ticketTitle, { color: theme?.textColor || "#0F172A" }]}
                numberOfLines={1}
              >
                {ticket.name}
              </Text>
            </View>

            {/* Circular Tinted Icon Container (PART 3 Rule 4) */}
            <View
              style={[
                styles.cardIconContainer,
                { backgroundColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.05)" },
              ]}
            >
              <IconComponent size={18} color={theme?.textColor || "#0F172A"} strokeWidth={2.2} />
            </View>
          </View>

          {/* Date & Access Mode line - Manrope-Medium (Metadata Rule) */}
          <View style={styles.metaRow}>
            <Calendar size={13} color={theme?.mutedTextColor || "#475569"} strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text
              style={[styles.metaText, { color: theme?.mutedTextColor || "#475569" }]}
              numberOfLines={1}
            >
              {formatDate(displayDate)}  •  {formatTime(displayDate)}  •  {modeLabel}
            </Text>
          </View>

          {/* Bottom Row: Urgency / Scarcity / Lock Status & "Select ->" Action */}
          <View style={styles.statusFooterRow}>
            <View style={styles.statusLeft}>
              {ticket.isLocked ? (
                <View style={styles.lockRow}>
                  <Lock size={12} color={theme?.textColor || "#EA580C"} strokeWidth={2.2} />
                  <Text style={[styles.lockText, { color: theme?.textColor || "#EA580C" }]} numberOfLines={1}>
                    {ticket.lockReason}
                  </Text>
                </View>
              ) : salesStatus?.status === "closed" ? (
                <View style={styles.closedPill}>
                  <Text style={styles.closedPillText}>Sales Closed</Text>
                </View>
              ) : salesStatus?.status === "upcoming" ? (
                <View style={styles.upcomingPill}>
                  <Text style={styles.upcomingPillText}>{salesStatus.label}</Text>
                </View>
              ) : isSoldOut ? (
                <View style={styles.soldOutPill}>
                  <Text style={styles.soldOutPillText}>Sold Out</Text>
                </View>
              ) : isCriticalStock ? (
                <View style={styles.criticalPill}>
                  <Text style={styles.criticalPillText}>
                    Only {available} {available === 1 ? "pass" : "passes"} left
                  </Text>
                </View>
              ) : (
                <Text style={[styles.availText, { color: theme?.mutedTextColor || "#475569" }]}>
                  {available > 0 && available < 50 ? `${available} passes left` : "Available"}
                </Text>
              )}
            </View>

            {/* Select Action Indicator - Functional UI Rule (Manrope SemiBold) */}
            {!isSoldOut && !ticket.isLocked && salesStatus?.status !== "closed" && (
              <View
                style={[
                  styles.selectActionPill,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)" },
                ]}
              >
                <Text style={[styles.selectActionText, { color: theme?.textColor || "#0F172A" }]}>
                  Select →
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Section (Vintage Barcode Stub) */}
        <View style={styles.rightStub}>
          {/* Price Container - BasicCommercial-Bold (Structural Rule) */}
          <View style={styles.stubPriceContainer}>
            {pricing.hasDiscount ? (
              <>
                <Text style={[styles.ticketPriceOriginal, { color: theme?.mutedTextColor || "#94A3B8" }]}>
                  ₹{pricing.originalPrice}
                </Text>
                <Text style={[styles.ticketPrice, { color: theme?.textColor || "#0F172A" }]}>
                  ₹{pricing.effectivePrice}
                </Text>
              </>
            ) : (
              <Text style={[styles.ticketPrice, { color: theme?.textColor || "#0F172A" }]}>
                {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}
              </Text>
            )}
          </View>

          {/* Authentic Vertical Barcode Graphic */}
          <View style={styles.barcodeWrap}>
            <TicketBarcode
              color={theme?.barcodeColor || theme?.textColor || "#1E3A8A"}
              width={44}
              height={58}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
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

  // Detailed non-reserving preview sheet state
  const [selectedTicketForSheet, setSelectedTicketForSheet] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

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

  // Live ticker for sales window countdowns (matches CheckoutScreen setInterval pattern)
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Find soonest ending ticket among all event tickets for the urgency banner
  const urgencyInfo = useMemo(() => {
    if (!event?.ticket_types || event.ticket_types.length === 0) return null;
    const now = new Date(tick);
    let soonest = null;

    for (const t of event.ticket_types) {
      const status = getSalesStatus(t, event, now);
      if (status.status === "ending_soon") {
        if (!soonest || (status.msRemaining !== null && status.msRemaining < soonest.msRemaining)) {
          soonest = status;
        }
      }
    }
    return soonest;
  }, [event, tick]);

  // Stable handlers
  const handleAdd = useCallback((ticket) => {
    if (ticket.isLocked) return;
    const sales = getSalesStatus(ticket, event, new Date(Date.now()));
    if (sales.status === "closed" || sales.status === "upcoming") return;

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
  }, [event]);

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

  const handleTicketPress = useCallback((ticket) => {
    setSelectedTicketForSheet(ticket);
    setSheetVisible(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handleProceedToCheckoutFromSheet = useCallback(
    ({ ticket, quantity, totalAmount: sheetTotal }) => {
      setSheetVisible(false);
      navigation.navigate("Checkout", {
        event,
        cartItems: [{ ticket, quantity }],
        totalAmount: sheetTotal,
      });
    },
    [event, navigation]
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const displayDate = event.start_datetime || event.event_date;

  // Resolve location name with fallback
  const decodedLocationName = useLocationName(event?.location_url, {
    fallback: event?.venue_name || "",
  });
  const displayLocationName =
    event?.location_name || decodedLocationName || event?.venue_name || "";

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
          {displayLocationName ? (
            <View style={styles.headerLocationRow}>
              <MapPin size={12} color={MUTED_TEXT} strokeWidth={2} />
              <Text style={styles.headerLocationText} numberOfLines={1}>
                {displayLocationName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Floating Urgency Banner if any ticket is ending soon */}
      {urgencyInfo && (
        <View style={styles.urgencyBanner}>
          <Clock size={15} color="#D97706" strokeWidth={2} style={{ marginRight: 8 }} />
          <Text style={styles.urgencyBannerText} numberOfLines={2}>
            {urgencyInfo.effectiveEnd
              ? `Registrations close ${formatRegistrationCloseDate(urgencyInfo.effectiveEnd)}`
              : `Ticket sales closing soon • ${urgencyInfo.label}`}
          </Text>
        </View>
      )}

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
          const available = ticket.total_quantity
            ? Math.max(0, ticket.total_quantity - (ticket.sold_count || 0) - (ticket.reserved_count || 0))
            : Infinity;
          const isSoldOut = ticket.total_quantity && available <= 0;
          const price = parseFloat(ticket.base_price) || 0;
          const theme = ticket.theme;
          const salesStatus = getSalesStatus(ticket, event, new Date(tick));

          return (
            <TicketCard
              key={key}
              ticket={ticket}
              index={index}
              available={available}
              isSoldOut={isSoldOut}
              price={price}
              theme={theme}
              displayDate={displayDate}
              pricingRules={event.pricing_rules}
              salesStatus={salesStatus}
              eventLocation={displayLocationName}
              eventMode={event?.mode}
              virtualPlatform={event?.virtual_platform}
              onPress={handleTicketPress}
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

      {/* Non-Reserving Ticket Details Slide-up Sheet */}
      <TicketDetailsSheet
        visible={sheetVisible}
        ticket={selectedTicketForSheet}
        event={event}
        theme={selectedTicketForSheet?.theme}
        pricingRules={event.pricing_rules}
        initialQty={
          selectedTicketForSheet
            ? cart[selectedTicketForSheet.id?.toString() || selectedTicketForSheet.name] || 1
            : 1
        }
        onClose={handleCloseSheet}
        onProceedToCheckout={handleProceedToCheckoutFromSheet}
      />
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
  headerLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  headerLocationText: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
    marginLeft: 6,
    flex: 1,
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
    position: "relative",
    marginBottom: 16,
    minHeight: 140,
    backgroundColor: "transparent",
    borderWidth: 0,
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {},
    }),
  },
  ticketCardDisabled: {
    opacity: 0.65,
  },
  cardContent: {
    flexDirection: "row",
    minHeight: 140,
    width: "100%",
  },
  leftStub: {
    flex: 4.6, // matches SVG split ratio (460/600)
    paddingLeft: 24, // safely clears the scooped corner notch
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    justifyContent: "space-between",
  },
  leftHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  headerTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  headerTagText: {
    fontSize: 9.5,
    fontFamily: "Manrope-Bold",
    letterSpacing: 0.8,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketTitle: {
    fontSize: 18.5,
    fontFamily: "BasicCommercial-Bold",
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    flex: 1,
  },
  statusFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  selectActionPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  selectActionText: {
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
    letterSpacing: 0.2,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  closedPill: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  closedPillText: {
    color: "#DC2626",
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  upcomingPill: {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upcomingPillText: {
    color: "#2563EB",
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  soldOutPill: {
    backgroundColor: "rgba(225, 29, 72, 0.1)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soldOutPillText: {
    color: "#E11D48",
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  criticalPill: {
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  criticalPillText: {
    color: "#EA580C",
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  availText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
  },
  rightStub: {
    flex: 1.4, // matches SVG split ratio (140/600)
    paddingVertical: 14,
    paddingHorizontal: 6,
    paddingRight: 14,
    alignItems: "center",
    justifyContent: "space-around",
  },
  stubPriceContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  ticketPrice: {
    fontSize: 19,
    fontFamily: "BasicCommercial-Bold",
    textAlign: "center",
  },
  ticketPriceOriginal: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    textDecorationLine: "line-through",
    marginBottom: -2,
  },
  barcodeWrap: {
    alignItems: "center",
    justifyContent: "center",
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
  // Floating Urgency Banner
  urgencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  urgencyBannerText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#D97706",
    flex: 1,
    lineHeight: 18,
  },
  // Per-card sales timing badges
  salesBadgeClosed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  salesBadgeClosedText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#DC2626",
    marginLeft: 4,
  },
  salesBadgeUpcoming: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  salesBadgeUpcomingText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#2563EB",
    marginLeft: 4,
  },
  salesBadgeEndingSoon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  salesBadgeEndingSoonText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#D97706",
    marginLeft: 4,
  },
  // Access mode badges
  accessBadgeInPerson: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  accessBadgeInPersonText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11.5,
    color: "#4B5563",
    marginLeft: 4,
  },
  accessBadgeVirtual: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  accessBadgeVirtualText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11.5,
    color: "#7C3AED",
    marginLeft: 4,
  },
  accessBadgeBoth: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  accessBadgeBothText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11.5,
    color: "#0D9488",
    marginLeft: 4,
  },
  // Action stub badges when disabled
  closedActionBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closedActionBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#9CA3AF",
  },
  upcomingActionBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingActionBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#3B82F6",
  },
});
