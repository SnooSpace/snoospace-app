/**
 * PromoEditor - Unified component for managing promo codes and early bird discounts
 * Consolidates DiscountCodesEditor + PricingRulesEditor into a single "Add Promo" modal
 * Used in CreateEventModal and EditEventModal
 */
import React, { useState, useImperativeHandle, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
  Dimensions,
} from "react-native";
import SwipeableModal from "../modals/SwipeableModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BadgePercent,
  Zap,
  Users,
  Infinity as InfinityIcon,
  ShoppingBag,
  Calendar,
  Layers,
  Clock,
  PlusCircle,
  X,
  Check,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  XCircle,
  TrendingUp,
  Sparkles,
  Lock,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import CustomDatePicker from "../../components/ui/CustomDatePicker";
import CustomTimePicker from "../../components/ui/CustomTimePicker";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

const OFFER_TYPES = [
  {
    value: "promo_code",
    label: "Promo Code",
    icon: "BadgePercent",
    color: "#10B981", // Emerald Green
    description: "Manual code entered by attendee",
  },
  {
    value: "early_bird",
    label: "Early Bird",
    icon: "Zap",
    color: "#F97316", // Vibrant Orange
    description: "Auto-applied by date or sales volume",
  },
  {
    value: "group_discount",
    label: "Group / Bulk",
    icon: "Users",
    color: "#8B5CF6", // Purple / Violet
    description: "Auto-applied when buying X+ tickets",
  },
];

const TRIGGER_TYPES = [
  {
    value: "by_date",
    label: "By Date",
    icon: "Clock",
    color: "#3B82F6", // Blue
    description: "Discount before a specific date",
  },
  {
    value: "by_sales",
    label: "By Sales",
    icon: "TrendingUp",
    color: "#3B82F6", // Reverted to Blue
    description: "Discount for first X tickets sold",
  },
];

const DEFAULT_PROMO = {
  offer_type: "promo_code",
  code: "",
  trigger: "by_date",
  discount_type: "percentage",
  discount_value: "",
  applies_to: "all",
  selected_tickets: [],
  max_uses: "",
  min_purchase: "",
  min_quantity: "2",
  stackable: false,
  valid_from: null,
  valid_until: null,
  quantity_threshold: "",
  is_active: true,
};

const PromoEditor = React.forwardRef(
  ({ promos = [], onChange, ticketTypes = [], eventStartDate, onPromoUpdated }, ref) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [initialPromoSnapshot, setInitialPromoSnapshot] = useState(null);
    const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);
    const [showValidUntilTimePicker, setShowValidUntilTimePicker] = useState(false);
    const [showValidityPicker, setShowValidityPicker] = useState(false);
    const [showValidFromTimePicker, setShowValidFromTimePicker] = useState(false);
    const [showValidityEndTimePicker, setShowValidityEndTimePicker] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [alertConfig, setAlertConfig] = useState(null);

    const [current, setCurrent] = useState({ ...DEFAULT_PROMO });

    const resetForm = () => {
      setCurrent({ ...DEFAULT_PROMO });
      setEditingIndex(null);
      setShowAdvanced(false);
      setInitialPromoSnapshot(null);
    };

    const handleCloseModal = () => {
      setShowModal(false);
      resetForm();
    };

    const openAddModal = () => {
      resetForm();
      setShowModal(true);
    };

    const isBySales =
      current.offer_type === "early_bird" && current.trigger === "by_sales";

    const openEditModal = (index) => {
      const p = promos[index];
      const effectiveMinPurchase =
        p.min_purchase !== undefined && p.min_purchase !== null && p.min_purchase !== ""
          ? p.min_purchase
          : p.min_cart_value;

      const isEditBySales =
        (p.offer_type || "promo_code") === "early_bird" &&
        p.trigger === "by_sales";

      setCurrent({
        offer_type: p.offer_type || "promo_code",
        name: p.name || "",
        code: p.code || "",
        trigger: p.trigger || "by_date",
        discount_type: p.discount_type || "percentage",
        discount_value: p.discount_value?.toString() || "",
        applies_to: p.applies_to || "all",
        // Filter out stale ticket names (ticket type may have been deleted)
        selected_tickets: (p.selected_tickets || []).filter((name) =>
          ticketTypes.some((t) => t.name === name),
        ),
        max_uses: isEditBySales ? "" : p.max_uses?.toString() || "",
        min_purchase:
          effectiveMinPurchase !== undefined && effectiveMinPurchase !== null
            ? effectiveMinPurchase.toString()
            : "",
        stackable: Boolean(p.stackable),
        valid_from: p.valid_from ? new Date(p.valid_from) : null,
        valid_until: isEditBySales ? null : p.valid_until ? new Date(p.valid_until) : null,
        quantity_threshold: p.quantity_threshold?.toString() || "",
        min_quantity: p.min_quantity?.toString() || "2",
        is_active: p.is_active !== false,
      });

      // Snapshot for change detection
      setInitialPromoSnapshot({
        offer_type: p.offer_type || "promo_code",
        code: (p.code || "").trim(),
        trigger: p.trigger || "by_date",
        discount_type: p.discount_type || "percentage",
        discount_value:
          p.discount_value !== undefined && p.discount_value !== null && p.discount_value !== ""
            ? parseFloat(p.discount_value)
            : "",
        applies_to: p.applies_to || "all",
        selected_tickets: (p.selected_tickets || [])
          .filter((name) => ticketTypes.some((t) => t.name === name))
          .sort(),
        max_uses:
          isEditBySales
            ? null
            : p.max_uses !== undefined && p.max_uses !== null && p.max_uses !== ""
            ? parseInt(p.max_uses, 10)
            : null,
        min_purchase:
          effectiveMinPurchase !== undefined && effectiveMinPurchase !== null && effectiveMinPurchase !== ""
            ? parseFloat(effectiveMinPurchase)
            : null,
        min_quantity:
          p.min_quantity !== undefined && p.min_quantity !== null && p.min_quantity !== ""
            ? parseInt(p.min_quantity, 10)
            : null,
        stackable: Boolean(p.stackable),
        valid_from: p.valid_from ? new Date(p.valid_from).getTime() : null,
        valid_until: isEditBySales ? null : p.valid_until ? new Date(p.valid_until).getTime() : null,
        quantity_threshold:
          p.quantity_threshold !== undefined && p.quantity_threshold !== null && p.quantity_threshold !== ""
            ? parseInt(p.quantity_threshold, 10)
            : null,
      });

      // Show advanced section if any advanced field has data (excluding governed max_uses for by_sales)
      const hasEffectiveMaxUses = !isEditBySales && Boolean(p.max_uses);
      const hasEffectiveValidUntil = !isEditBySales && Boolean(p.valid_until);
      if (
        hasEffectiveMaxUses ||
        effectiveMinPurchase ||
        p.stackable ||
        p.valid_from ||
        hasEffectiveValidUntil
      ) {
        setShowAdvanced(true);
      }
      setEditingIndex(index);
      setShowModal(true);
    };

    useImperativeHandle(ref, () => ({
      openAddModal,
      openEditModal,
    }));

    // Auto-generate promo code
    const generateCode = useCallback(() => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code;
      const existingCodes = promos
        .filter((p) => p.offer_type === "promo_code")
        .map((p) => p.code?.toUpperCase());
      do {
        code = Array.from(
          { length: 8 },
          () => chars[Math.floor(Math.random() * chars.length)],
        ).join("");
      } while (existingCodes.includes(code));
      setCurrent((prev) => ({ ...prev, code }));
    }, [promos]);

    // Preview computation — shows ALL applicable tickets
    const getPreviewPrices = useCallback(() => {
      const val = parseFloat(current.discount_value) || 0;
      if (val <= 0) return [];

      // Determine which tickets to preview
      let previewTickets = [];
      if (
        current.applies_to === "specific" &&
        current.selected_tickets.length > 0
      ) {
        previewTickets = ticketTypes.filter((t) =>
          current.selected_tickets.includes(t.name),
        );
      } else {
        // "all" — preview every ticket
        previewTickets = ticketTypes;
      }

      // If no tickets exist yet, show a sample
      if (previewTickets.length === 0) {
        const samplePrice = 1000;
        const discounted =
          current.discount_type === "percentage"
            ? samplePrice - (samplePrice * Math.min(val, 100)) / 100
            : Math.max(0, samplePrice - val);
        return [
          {
            original: samplePrice,
            discounted: Math.round(discounted),
            ticketName: null,
            exceeded:
              current.discount_type === "percentage"
                ? val > 100
                : val > samplePrice,
          },
        ];
      }

      return previewTickets.map((t) => {
        const price = parseFloat(t.base_price) || 0;
        const discounted =
          current.discount_type === "percentage"
            ? price - (price * Math.min(val, 100)) / 100
            : Math.max(0, price - val);
        return {
          original: price,
          discounted: Math.round(discounted),
          ticketName: t.name,
          exceeded:
            current.discount_type === "percentage" ? val > 100 : val > price,
          isFree: price === 0,
        };
      });
    }, [
      current.discount_type,
      current.discount_value,
      current.applies_to,
      current.selected_tickets,
      ticketTypes,
    ]);

    // Toggle ticket selection
    const toggleTicketSelection = useCallback((ticketName) => {
      setCurrent((prev) => {
        const selected = prev.selected_tickets.includes(ticketName)
          ? prev.selected_tickets.filter((t) => t !== ticketName)
          : [...prev.selected_tickets, ticketName];
        return { ...prev, selected_tickets: selected };
      });
    }, []);

    // Computed validation — mirrors handleSave required checks
    const isFormValid = (() => {
      // Discount value is always required
      if (!current.discount_value || parseFloat(current.discount_value) <= 0)
        return false;

      if (current.offer_type === "promo_code") {
        // Promo code string required
        if (!current.code.trim()) return false;
      }

      if (current.offer_type === "early_bird") {
        if (current.trigger === "by_date") {
          // End date required
          if (!current.valid_until) return false;
          // End date must be before event start
          if (eventStartDate && current.valid_until > new Date(eventStartDate))
            return false;
        }
        if (current.trigger === "by_sales") {
          // Quantity threshold required and must be at least 1
          const qVal = parseInt(current.quantity_threshold, 10);
          if (!qVal || qVal < 1) return false;
        }
      }

      if (current.offer_type === "group_discount") {
        if (!current.min_quantity || parseInt(current.min_quantity, 10) < 2)
          return false;
      }

      // Specific tickets: at least one must be selected
      if (
        current.applies_to === "specific" &&
        current.selected_tickets.length === 0
      )
        return false;

      return true;
    })();

    // Change detection: compare current form state to initial snapshot when editing
    const isPromoDirty = useMemo(() => {
      if (editingIndex === null || !initialPromoSnapshot) return true;

      if (current.offer_type !== initialPromoSnapshot.offer_type) return true;

      if (current.offer_type === "promo_code") {
        if (
          (current.code || "").trim().toUpperCase() !==
          (initialPromoSnapshot.code || "").trim().toUpperCase()
        )
          return true;
      }

      if (current.offer_type === "early_bird") {
        if (current.trigger !== initialPromoSnapshot.trigger) return true;
        if (current.trigger === "by_sales") {
          const curThreshold = current.quantity_threshold
            ? parseInt(current.quantity_threshold, 10)
            : null;
          if (curThreshold !== initialPromoSnapshot.quantity_threshold)
            return true;
        }
      }

      if (current.offer_type === "group_discount") {
        const curMinQ = current.min_quantity
          ? parseInt(current.min_quantity, 10)
          : null;
        if (curMinQ !== initialPromoSnapshot.min_quantity) return true;
      }

      if (current.discount_type !== initialPromoSnapshot.discount_type)
        return true;
      const curDiscountVal = current.discount_value
        ? parseFloat(current.discount_value)
        : null;
      const initDiscountVal =
        initialPromoSnapshot.discount_value !== ""
          ? parseFloat(initialPromoSnapshot.discount_value)
          : null;
      if (curDiscountVal !== initDiscountVal) return true;

      if (current.applies_to !== initialPromoSnapshot.applies_to) return true;
      if (current.applies_to === "specific") {
        const curSelected = [...(current.selected_tickets || [])].sort();
        const initSelected = [
          ...(initialPromoSnapshot.selected_tickets || []),
        ].sort();
        if (curSelected.length !== initSelected.length) return true;
        for (let i = 0; i < curSelected.length; i++) {
          if (curSelected[i] !== initSelected[i]) return true;
        }
      }

      if (!isBySales) {
        const curMaxUses = current.max_uses
          ? parseInt(current.max_uses, 10)
          : null;
        if (curMaxUses !== initialPromoSnapshot.max_uses) return true;
      }

      const curMinPurchase = current.min_purchase
        ? parseFloat(current.min_purchase)
        : null;
      if (curMinPurchase !== initialPromoSnapshot.min_purchase) return true;

      if (Boolean(current.stackable) !== Boolean(initialPromoSnapshot.stackable))
        return true;

      const curValidFrom = current.valid_from
        ? new Date(current.valid_from).getTime()
        : null;
      if (curValidFrom !== initialPromoSnapshot.valid_from) return true;

      if (!isBySales) {
        const curValidUntil = current.valid_until
          ? new Date(current.valid_until).getTime()
          : null;
        if (curValidUntil !== initialPromoSnapshot.valid_until) return true;
      }

      return false;
    }, [current, editingIndex, initialPromoSnapshot]);

    const isSavePromoDisabled =
      editingIndex !== null ? !isFormValid || !isPromoDirty : !isFormValid;

    // Validation & Save
    const handleSave = () => {
      if (current.offer_type === "promo_code" && !current.code.trim()) {
        Alert.alert("Required", "Please enter a promo code");
        return;
      }
      if (!current.discount_value || parseFloat(current.discount_value) <= 0) {
        Alert.alert("Required", "Please enter a valid discount value");
        return;
      }
      if (current.offer_type === "early_bird") {
        if (current.trigger === "by_date" && !current.valid_until) {
          Alert.alert("Required", "Please set an end date for early bird");
          return;
        }
        if (
          current.trigger === "by_date" &&
          current.valid_until &&
          eventStartDate &&
          current.valid_until > new Date(eventStartDate)
        ) {
          Alert.alert(
            "Invalid Date",
            "Early bird end date must be before the event start date.",
          );
          return;
        }
        if (current.trigger === "by_sales") {
          const threshold = parseInt(current.quantity_threshold, 10);
          if (!threshold || threshold <= 0) {
            Alert.alert(
              "Required",
              "Please enter a valid ticket quantity of at least 1.",
            );
            return;
          }
        }
      }

      if (current.offer_type === "group_discount") {
        const minQ = parseInt(current.min_quantity, 10);
        if (!minQ || minQ < 2) {
          Alert.alert("Required", "Please enter a minimum ticket quantity of at least 2.");
          return;
        }
      }

      // Duplicate code check for promo codes
      if (current.offer_type === "promo_code") {
        const codeUpper = current.code.trim().toUpperCase();
        const isDuplicate = promos.some(
          (p, idx) =>
            idx !== editingIndex &&
            p.offer_type === "promo_code" &&
            p.code?.toUpperCase() === codeUpper,
        );
        if (isDuplicate) {
          Alert.alert(
            "Duplicate Code",
            `Promo code "${codeUpper}" already exists.`,
          );
          return;
        }
      }

      // Specific tickets validation — must select at least one
      if (
        current.applies_to === "specific" &&
        current.selected_tickets.length === 0
      ) {
        Alert.alert(
          "Required",
          "Please select at least one ticket type this promo applies to.",
        );
        return;
      }

      // Percentage cap validation
      if (
        current.discount_type === "percentage" &&
        parseFloat(current.discount_value) > 100
      ) {
        Alert.alert("Invalid Value", "Percentage discount cannot exceed 100%.");
        return;
      }

      // Auto-derive name from context
      const autoName =
        current.offer_type === "promo_code"
          ? current.code.trim().toUpperCase()
          : current.offer_type === "group_discount"
          ? `Group (${current.min_quantity || 2}+ Tickets)`
          : "Early Bird";

      const promoData = {
        offer_type: current.offer_type,
        name: autoName,
        code:
          current.offer_type === "promo_code"
            ? current.code.trim().toUpperCase()
            : "",
        trigger: current.offer_type === "early_bird" ? current.trigger : null,
        discount_type: current.discount_type,
        discount_value: parseFloat(current.discount_value),
        applies_to: current.applies_to,
        selected_tickets:
          current.applies_to === "specific" ? current.selected_tickets : [],
        max_uses:
          isBySales
            ? null
            : current.max_uses
            ? parseInt(current.max_uses, 10)
            : null,
        min_purchase: current.min_purchase
          ? parseFloat(current.min_purchase)
          : null,
        min_quantity:
          current.offer_type === "group_discount" && current.min_quantity
            ? parseInt(current.min_quantity, 10)
            : null,
        stackable: current.stackable,
        valid_from:
          current.offer_type === "promo_code" && current.valid_from
            ? current.valid_from.toISOString()
            : null,
        valid_until:
          isBySales
            ? null
            : current.valid_until
            ? current.valid_until.toISOString()
            : null,
        quantity_threshold:
          isBySales && current.quantity_threshold
            ? parseInt(current.quantity_threshold, 10)
            : null,
        is_active: true,
      };

      if (editingIndex !== null) {
        const updated = [...promos];
        updated[editingIndex] = { ...updated[editingIndex], ...promoData };
        onChange(updated);
        onPromoUpdated?.();
      } else {
        onChange([...promos, promoData]);
      }

      setShowModal(false);
      resetForm();
    };

    const handleDelete = (index) => {
      setAlertConfig({
        visible: true,
        title: "Delete Promo",
        message: "Are you sure you want to delete this offer?",
        secondaryAction: {
          text: "Cancel",
          onPress: () => setAlertConfig(null),
        },
        primaryAction: {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updated = promos.filter((_, i) => i !== index);
            onChange(updated);
            setAlertConfig(null);
          },
        },
      });
    };

    const formatShortDate = (d) => {
      if (!d) return "";
      try {
        const dateObj = typeof d === "string" ? new Date(d) : d;
        return dateObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });
      } catch (e) {
        return "";
      }
    };

    const formatShortDateTime = (d) => {
      if (!d) return "";
      try {
        const dateObj = typeof d === "string" ? new Date(d) : d;
        const dateStr = dateObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });
        const timeStr = dateObj.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `${dateStr}, ${timeStr}`;
      } catch (e) {
        return "";
      }
    };

    const formatDiscount = (p) => {
      if (p.discount_type === "percentage") return `${p.discount_value}% OFF`;
      return `₹${p.discount_value} OFF`;
    };

    const formatCondition = (p) => {
      if (p.offer_type === "promo_code") {
        if (p.max_uses) return `${p.current_uses || 0} of ${p.max_uses} uses`;
        return "Unlimited uses";
      }
      if (p.offer_type === "group_discount") {
        return `Min ${p.min_quantity || 2} tickets`;
      }
      if (p.trigger === "by_date" && p.valid_until) {
        return `Until ${new Date(p.valid_until).toLocaleDateString()}`;
      }
      if (p.trigger === "by_sales" && p.quantity_threshold) {
        return `First ${p.quantity_threshold} tickets`;
      }
      return "";
    };

    const getTileIcon = (p) => {
      const isUsed = (p.current_uses || p.sold_count) > 0;
      const isActiveAndUsed = p.is_active !== false && isUsed;
      const isActive = p.is_active !== false;

      if (p.offer_type === "early_bird") {
        return {
          name: "Zap",
          isLucide: true,
          colors: isActiveAndUsed
            ? ["#DCFCE7", "#DCFCE7"]
            : isActive
              ? ["#FFF7ED", "#FFF7ED"]
              : ["#F3F6FB", "#F3F6FB"],
          iconColor: isActiveAndUsed
            ? "#166534"
            : isActive
              ? "#EA580C"
              : "#64748B",
          hasBorder: isActiveAndUsed,
        };
      }
      if (p.offer_type === "group_discount") {
        return {
          name: "Users",
          isLucide: true,
          colors: isActiveAndUsed
            ? ["#DCFCE7", "#DCFCE7"]
            : isActive
              ? ["#F5F3FF", "#F5F3FF"]
              : ["#F3F6FB", "#F3F6FB"],
          iconColor: isActiveAndUsed
            ? "#166534"
            : isActive
              ? "#8B5CF6"
              : "#64748B",
          hasBorder: isActiveAndUsed,
        };
      }
      return {
        name: "BadgePercent",
        isLucide: true,
        colors: isActiveAndUsed
          ? ["#DCFCE7", "#DCFCE7"]
          : isActive
            ? ["#F0FDF4", "#F0FDF4"]
            : ["#F3F6FB", "#F3F6FB"],
        iconColor: isActiveAndUsed
          ? "#166534"
          : isActive
            ? "#16A34A"
            : "#64748B",
        hasBorder: isActiveAndUsed,
      };
    };

    // ─── RENDER ────────────────────────────────────────────────────────

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>Promos & Discounts</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <PlusCircle size={20} color={COLORS.primary} strokeWidth={1.75} />
            <Text style={styles.addButtonText} numberOfLines={1}>Add</Text>
          </TouchableOpacity>
        </View>

        {promos.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconGradient}
              >
                <BadgePercent size={32} color="#FFFFFF" strokeWidth={1.5} />
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>No promos yet</Text>
            <Text style={styles.emptySubtext}>
              Add promo codes or early bird discounts
            </Text>
          </View>
        )}

        {/* ── LIST TILES ── */}
        {promos.map((p, index) => {
          const tile = getTileIcon(p);
          return (
            <View key={index} style={styles.ticketTile}>
              <View style={styles.tileIconContainer}>
                <LinearGradient
                  colors={tile.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.tileIconCircle,
                    tile.hasBorder && {
                      borderWidth: 1,
                      borderColor: "#86EFAC",
                    },
                  ]}
                >
                  {tile.name === "Zap" ? (
                    <Zap
                      size={20}
                      color={tile.iconColor}
                      fill={tile.iconColor}
                      strokeWidth={1.75}
                    />
                  ) : tile.name === "Users" ? (
                    <Users size={20} color={tile.iconColor} strokeWidth={1.75} />
                  ) : (
                    <BadgePercent size={20} color={tile.iconColor} strokeWidth={1.75} />
                  )}
                </LinearGradient>
              </View>
              <View style={styles.tileContent}>
                <View style={styles.tileHeader}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {p.offer_type === "promo_code"
                      ? p.name || "Promo Code"
                      : p.offer_type === "group_discount"
                      ? p.name || "Group Discount"
                      : p.name || "Early Bird"}
                  </Text>
                </View>
                <Text style={styles.tilePrice}>{formatDiscount(p)}</Text>
                {/* Additional Options & Conditions */}
                <View style={styles.tileChipsRow}>
                  {p.max_uses && !(p.offer_type === "early_bird" && p.trigger === "by_sales") ? (
                    <View style={styles.tileChip}>
                      <Users size={12} color="#475569" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        {p.current_uses
                          ? `${p.current_uses} / ${p.max_uses} uses`
                          : `Max ${p.max_uses} uses`}
                      </Text>
                    </View>
                  ) : p.offer_type === "promo_code" ? (
                    <View style={styles.tileChip}>
                      <InfinityIcon size={12} color="#64748B" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>Unlimited uses</Text>
                    </View>
                  ) : null}

                  {p.min_purchase && parseFloat(p.min_purchase) > 0 ? (
                    <View style={styles.tileChip}>
                      <ShoppingBag size={12} color="#475569" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        Min ₹{parseFloat(p.min_purchase).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  ) : null}

                  {(p.valid_from || p.valid_until) ? (
                    <View style={styles.tileChip}>
                      <Calendar size={12} color="#475569" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        {p.valid_from && p.valid_until
                          ? `${formatShortDate(p.valid_from)} – ${formatShortDate(p.valid_until)}`
                          : p.valid_until
                          ? `Until ${formatShortDate(p.valid_until)}`
                          : `From ${formatShortDate(p.valid_from)}`}
                      </Text>
                    </View>
                  ) : null}

                  {p.stackable ? (
                    <View style={styles.tileChip}>
                      <Layers size={12} color="#475569" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>Stackable</Text>
                    </View>
                  ) : null}

                  {p.offer_type === "early_bird" &&
                  p.trigger === "by_sales" &&
                  p.quantity_threshold ? (
                    <View style={styles.tileChip}>
                      <Zap size={12} color="#EA580C" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        First {p.quantity_threshold} tickets
                      </Text>
                    </View>
                  ) : null}

                  {p.offer_type === "early_bird" &&
                  p.trigger === "by_date" &&
                  p.valid_until ? (
                    <View style={styles.tileChip}>
                      <Clock size={12} color="#EA580C" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        Until {formatShortDateTime(p.valid_until)}
                      </Text>
                    </View>
                  ) : null}

                  {p.offer_type === "group_discount" && p.min_quantity ? (
                    <View style={styles.tileChip}>
                      <Users size={12} color="#8B5CF6" strokeWidth={1.75} />
                      <Text style={styles.tileChipText}>
                        Min {p.min_quantity} tickets
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Applies To info */}
                <Text style={styles.tileAppliesTo}>
                  {p.applies_to === "all"
                    ? "All Tickets"
                    : p.selected_tickets?.length > 0
                      ? p.selected_tickets.join(", ")
                      : "No tickets selected"}
                </Text>
                <View style={styles.tileActions}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(index)}
                  >
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(index)}
                  >
                    <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* ── ADD / EDIT MODAL ── */}
        <SwipeableModal
          visible={showModal}
          onClose={handleCloseModal}
          sheetStyle={styles.modalSheet}
          avoidKeyboard={false}
          header={
            <View collapsable={false} style={styles.modalHeaderContainer}>
              <View style={styles.sheetHandle} />

              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingIndex !== null ? "Edit Promo" : "Add Promo"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {editingIndex !== null
                      ? "Update promo discount details"
                      : "Create a new promo code or discount"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseModal}
                  style={styles.closeButton}
                >
                  <X size={20} color={TEXT_COLOR} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          }
        >
          <SwipeableModal.KeyboardAwareScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
            bottomOffset={80}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── CARD 1: Offer Type ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Offer Type</Text>
              <View style={styles.typeOptions}>
                {OFFER_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.offerTypeOption,
                      current.offer_type === type.value &&
                        styles.offerTypeOptionActive,
                    ]}
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                      setCurrent((prev) => {
                        const updates = { ...prev, offer_type: type.value };
                        // Clear type-specific fields to prevent stale data
                        if (type.value === "promo_code") {
                          updates.trigger = "by_date";
                          updates.quantity_threshold = "";
                          updates.min_quantity = "";
                        } else if (type.value === "group_discount") {
                          updates.code = "";
                          updates.valid_from = null;
                          updates.valid_until = null;
                          updates.quantity_threshold = "";
                          updates.min_quantity = prev.min_quantity || "2";
                        } else {
                          // Early bird — clear promo-specific fields
                          updates.code = "";
                          updates.valid_from = null;
                          updates.min_quantity = "";
                          if (updates.trigger === "by_sales") {
                            updates.max_uses = "";
                            updates.valid_until = null;
                          }
                        }
                        return updates;
                      });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.offerTypeHeader}>
                        {type.icon === "BadgePercent" ? (
                          <BadgePercent
                            size={20}
                            color={
                              current.offer_type === type.value
                                ? type.color
                                : LIGHT_TEXT_COLOR
                            }
                            strokeWidth={1.75}
                          />
                        ) : type.icon === "Zap" ? (
                          <Zap
                            size={20}
                            color={
                              current.offer_type === type.value
                                ? type.color
                                : LIGHT_TEXT_COLOR
                            }
                            fill={
                              current.offer_type === type.value
                                ? type.color
                                : "transparent"
                            }
                            strokeWidth={1.75}
                          />
                        ) : (
                          <Users
                            size={20}
                            color={
                              current.offer_type === type.value
                                ? type.color
                                : LIGHT_TEXT_COLOR
                            }
                            strokeWidth={1.75}
                          />
                        )}
                        <Text
                          style={[
                            styles.offerTypeLabel,
                            current.offer_type === type.value &&
                              styles.offerTypeLabelActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </View>
                      <Text style={styles.offerTypeDesc}>
                        {type.description}
                      </Text>
                    </View>
                    {current.offer_type === type.value ? (
                      <CheckCircle2
                        size={22}
                        color={type.color}
                        strokeWidth={2}
                      />
                    ) : (
                      <View style={styles.radioPlaceholder} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

                {/* ── CARD 2: Promo Code Details (conditional) ── */}
                {current.offer_type === "promo_code" && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Promo Code</Text>
                    <Text style={styles.fieldLabel}>Code *</Text>
                    <View style={styles.codeInputRow}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        value={current.code}
                        onChangeText={(text) =>
                          setCurrent({
                            ...current,
                            code: text.toUpperCase(),
                          })
                        }
                        placeholder="e.g., EARLYBIRD20, VIP50"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                      />
                      <View style={styles.dotSeparator} />
                      <TouchableOpacity
                        style={styles.generateBtn}
                        onPress={generateCode}
                      >
                        <Sparkles
                          size={14}
                          color={COLORS.primary}
                          strokeWidth={2}
                        />
                        <Text style={styles.generateBtnText}>Generate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── CARD 3: Early Bird Trigger (conditional) ── */}
                {current.offer_type === "early_bird" && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Trigger</Text>

                    <Text style={styles.fieldLabel}>Trigger Type *</Text>
                    <View style={styles.typeOptions}>
                      {TRIGGER_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type.value}
                          style={[
                            styles.offerTypeOption,
                            current.trigger === type.value &&
                              styles.offerTypeOptionActive,
                          ]}
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            if (type.value === "by_sales") {
                              setCurrent({
                                ...current,
                                trigger: "by_sales",
                                valid_until: null,
                                max_uses: "",
                              });
                            } else {
                              setCurrent({
                                ...current,
                                trigger: "by_date",
                                quantity_threshold: "",
                              });
                            }
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.offerTypeHeader}>
                              {type.value === "by_date" ? (
                                <Clock
                                  size={20}
                                  color={
                                    current.trigger === type.value
                                      ? type.color
                                      : LIGHT_TEXT_COLOR
                                  }
                                  strokeWidth={1.75}
                                />
                              ) : (
                                <TrendingUp
                                  size={20}
                                  color={
                                    current.trigger === type.value
                                      ? type.color
                                      : LIGHT_TEXT_COLOR
                                  }
                                  strokeWidth={1.75}
                                />
                              )}
                              <Text
                                style={[
                                  styles.offerTypeLabel,
                                  current.trigger === type.value &&
                                    styles.offerTypeLabelActive,
                                ]}
                              >
                                {type.label}
                              </Text>
                            </View>
                            <Text style={styles.offerTypeDesc}>
                              {type.description}
                            </Text>
                          </View>
                          {current.trigger === type.value ? (
                            <CheckCircle2
                              size={22}
                              color={type.color}
                              strokeWidth={2}
                            />
                          ) : (
                            <View style={styles.radioPlaceholder} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>

                    {current.trigger === "by_date" && (
                      <>
                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                          Early Bird Ends On *
                        </Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <TouchableOpacity
                            style={[styles.dateButton, { flex: 1 }]}
                            onPress={() => setShowValidUntilPicker(true)}
                          >
                            <Calendar
                              size={18}
                              color="#94A3B8"
                              strokeWidth={1.75}
                            />
                            <Text
                              style={[
                                styles.dateButtonText,
                                !current.valid_until && { color: "#94A3B8" },
                              ]}
                              numberOfLines={1}
                            >
                              {current.valid_until
                                ? current.valid_until.toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : "Select date"}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.dateButton, { flex: 1 }]}
                            onPress={() => setShowValidUntilTimePicker(true)}
                          >
                            <Clock
                              size={18}
                              color="#94A3B8"
                              strokeWidth={1.75}
                            />
                            <Text
                              style={[
                                styles.dateButtonText,
                                !current.valid_until && { color: "#94A3B8" },
                              ]}
                              numberOfLines={1}
                            >
                              {current.valid_until
                                ? current.valid_until.toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "11:59 PM"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {eventStartDate ? (
                          <Text style={styles.eventDateHint}>
                            Event starts on{" "}
                            {new Date(eventStartDate).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        ) : (
                          <Text style={styles.helperText}>
                            Must end before event start
                          </Text>
                        )}
                        {current.valid_until &&
                          eventStartDate &&
                          current.valid_until > new Date(eventStartDate) && (
                            <Text style={styles.validationError}>
                              Early bird end date must be before event start
                              date
                            </Text>
                          )}
                      </>
                    )}

                    {current.trigger === "by_sales" && (
                      <>
                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                          Apply discount to first X tickets sold *
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={current.quantity_threshold}
                          onChangeText={(text) =>
                            setCurrent({
                              ...current,
                              quantity_threshold: text.replace(/[^0-9]/g, ""),
                              max_uses: "",
                            })
                          }
                          placeholder="e.g., 100"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                        <Text style={styles.helperText}>
                          Discount applies automatically until this sales volume is reached.
                        </Text>
                      </>
                    )}
                  </View>
                )}

                {/* ── CARD 3B: Group / Bulk Minimum Quantity (conditional) ── */}
                {current.offer_type === "group_discount" && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Group Discount Trigger</Text>
                    <Text style={styles.fieldLabel}>
                      Minimum Tickets Required *
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={current.min_quantity}
                      onChangeText={(text) =>
                        setCurrent({
                          ...current,
                          min_quantity: text.replace(/[^0-9]/g, ""),
                        })
                      }
                      placeholder="e.g., 2, 3, 5"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helperText}>
                      Discount applies automatically when attendees select this many tickets (or more) in their cart.
                    </Text>
                  </View>
                )}

                {/* ── CARD 4: Discount Configuration ── */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Discount</Text>

                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.segContainer}>
                    {["percentage", "flat"].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.segBtn,
                          current.discount_type === type && styles.segBtnActive,
                        ]}
                        onPress={() =>
                          setCurrent({ ...current, discount_type: type })
                        }
                      >
                        <Text
                          style={[
                            styles.segBtnText,
                            current.discount_type === type &&
                              styles.segBtnTextActive,
                          ]}
                        >
                          {type === "percentage"
                            ? "Percentage (%)"
                            : "Flat Amount (₹)"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                    Value{" "}
                    {current.discount_type === "percentage" ? "(%)" : "(₹)"} *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={current.discount_value}
                    onChangeText={(text) =>
                      setCurrent({ ...current, discount_value: text })
                    }
                    placeholder={
                      current.discount_type === "percentage" ? "20" : "500"
                    }
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />

                  {/* Preview — multi-ticket */}
                  {(() => {
                    const previews = getPreviewPrices();
                    if (previews.length === 0) return null;
                    const hasAnyExceeded = previews.some((p) => p.exceeded);
                    return (
                      <View style={styles.previewCard}>
                        <Text style={styles.previewLabel}>PREVIEW</Text>
                        {previews.map((preview, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.previewTicketRow,
                              idx > 0 && styles.previewTicketRowBorder,
                            ]}
                          >
                            <Text
                              style={styles.previewTicketName}
                              numberOfLines={1}
                            >
                              {preview.ticketName || "Sample Ticket"}
                            </Text>
                            {preview.isFree ? (
                              <Text style={styles.previewFreeLabel}>FREE</Text>
                            ) : (
                              <View style={styles.previewPriceRow}>
                                <Text style={styles.previewOriginalPrice}>
                                  ₹{preview.original.toLocaleString("en-IN")}
                                </Text>
                                <Text style={styles.previewArrow}>→</Text>
                                <Text style={styles.previewDiscountedPrice}>
                                  ₹
                                  {Math.max(
                                    0,
                                    preview.discounted,
                                  ).toLocaleString("en-IN")}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                        {hasAnyExceeded && (
                          <Text style={styles.validationWarning}>
                            Discount exceeds ticket price for some tickets
                          </Text>
                        )}

                        {/* Offer Rules & Limits Live Preview */}
                        <View style={styles.previewDivider} />
                        <View style={styles.previewChipsRow}>
                          {current.max_uses && !isBySales ? (
                            <View style={styles.previewChip}>
                              <Users size={12} color="#475569" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                Max {current.max_uses} uses
                              </Text>
                            </View>
                          ) : current.offer_type === "promo_code" ? (
                            <View style={styles.previewChip}>
                              <InfinityIcon size={12} color="#64748B" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>Unlimited uses</Text>
                            </View>
                          ) : null}

                          {current.min_purchase && parseFloat(current.min_purchase) > 0 ? (
                            <View style={styles.previewChip}>
                              <ShoppingBag size={12} color="#475569" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                Min order ₹{parseFloat(current.min_purchase).toLocaleString("en-IN")}
                              </Text>
                            </View>
                          ) : null}

                          {(current.valid_from || current.valid_until) ? (
                            <View style={styles.previewChip}>
                              <Calendar size={12} color="#475569" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                {current.valid_from && current.valid_until
                                  ? `${formatShortDate(current.valid_from)} – ${formatShortDate(current.valid_until)}`
                                  : current.valid_until
                                  ? `Until ${formatShortDate(current.valid_until)}`
                                  : `From ${formatShortDate(current.valid_from)}`}
                              </Text>
                            </View>
                          ) : null}

                          {current.stackable ? (
                            <View style={styles.previewChip}>
                              <Layers size={12} color="#475569" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>Stackable</Text>
                            </View>
                          ) : null}

                          {current.offer_type === "early_bird" &&
                          current.trigger === "by_sales" &&
                          current.quantity_threshold ? (
                            <View style={styles.previewChip}>
                              <Zap size={12} color="#EA580C" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                First {current.quantity_threshold} tickets
                              </Text>
                            </View>
                          ) : null}

                          {current.offer_type === "early_bird" &&
                          current.trigger === "by_date" &&
                          current.valid_until ? (
                            <View style={styles.previewChip}>
                              <Clock size={12} color="#EA580C" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                Until {formatShortDateTime(current.valid_until)}
                              </Text>
                            </View>
                          ) : null}

                          {current.offer_type === "group_discount" ? (
                            <View style={styles.previewChip}>
                              <Users size={12} color="#8B5CF6" strokeWidth={1.75} />
                              <Text style={styles.previewChipText}>
                                Min {current.min_quantity || 2} tickets
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {/* ── CARD 5: Applies To ── */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Applies To</Text>

                  <View style={styles.segContainer}>
                    {["all", "specific"].map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.segBtn,
                          current.applies_to === opt && styles.segBtnActive,
                          opt === "specific" &&
                            ticketTypes.length === 0 && { opacity: 0.4 },
                        ]}
                        disabled={
                          opt === "specific" && ticketTypes.length === 0
                        }
                        onPress={() =>
                          setCurrent({ ...current, applies_to: opt })
                        }
                      >
                        <Text
                          style={[
                            styles.segBtnText,
                            current.applies_to === opt &&
                              styles.segBtnTextActive,
                          ]}
                        >
                          {opt === "all" ? "All Tickets" : "Specific Tickets"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {ticketTypes.length === 0 && (
                    <Text style={styles.helperText}>
                      Create tickets first to select specific ones
                    </Text>
                  )}

                  {current.applies_to === "specific" &&
                    ticketTypes.length > 0 && (
                      <View style={styles.chipGrid}>
                        {ticketTypes.map((t, idx) => {
                          const selected = current.selected_tickets.includes(
                            t.name,
                          );
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.ticketChip,
                                selected && styles.ticketChipSelected,
                              ]}
                              onPress={() => toggleTicketSelection(t.name)}
                            >
                              {selected && (
                                <Check
                                  size={13}
                                  color={COLORS.primary}
                                  strokeWidth={2.5}
                                />
                              )}
                              <Text
                                style={[
                                  styles.ticketChipText,
                                  selected && styles.ticketChipTextSelected,
                                ]}
                              >
                                {t.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                </View>

                {/* ── CARD 6: Advanced Options (collapsible) ── */}
                <TouchableOpacity
                  style={styles.advancedToggle}
                  onPress={() => {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    );
                    setShowAdvanced(!showAdvanced);
                  }}
                >
                  <Text style={styles.advancedToggleText}>
                    Advanced Options
                  </Text>
                  {showAdvanced ? (
                    <ChevronUp size={18} color="#64748B" strokeWidth={2} />
                  ) : (
                    <ChevronDown size={18} color="#64748B" strokeWidth={2} />
                  )}
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.card}>
                    {isBySales ? (
                      <View style={styles.lockedFieldWrapper}>
                        <View style={styles.lockedFieldHeaderRow}>
                          <Text style={styles.fieldLabel}>Max Uses</Text>
                          <View style={styles.lockedBadge}>
                            <TrendingUp size={12} color="#2563EB" strokeWidth={2} />
                            <Text style={styles.lockedBadgeText}>
                              Governed by Sales Limit
                            </Text>
                          </View>
                        </View>
                        <View style={styles.lockedInputRow}>
                          <Text
                            style={[
                              styles.lockedInputText,
                              !current.quantity_threshold &&
                                styles.lockedInputPlaceholder,
                            ]}
                          >
                            {current.quantity_threshold
                              ? `First ${current.quantity_threshold} tickets sold`
                              : "Set above in Trigger (First X tickets)"}
                          </Text>
                          <Lock size={15} color="#94A3B8" strokeWidth={2} />
                        </View>
                        <Text style={styles.helperText}>
                          Because this offer triggers by sales volume, maximum usage is strictly limited to the first {current.quantity_threshold ? `${current.quantity_threshold} tickets` : "X tickets"} configured in the Trigger section.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.fieldLabel}>Max Uses (Optional)</Text>
                        <TextInput
                          style={styles.input}
                          value={current.max_uses}
                          onChangeText={(text) =>
                            setCurrent({
                              ...current,
                              max_uses: text.replace(/[^0-9]/g, ""),
                            })
                          }
                          placeholder="Leave empty for unlimited"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                      </>
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                      Minimum Purchase Amount (Optional)
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={current.min_purchase}
                      onChangeText={(text) =>
                        setCurrent({ ...current, min_purchase: text })
                      }
                      placeholder="₹0 (no minimum)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />

                    {/* Stackable Toggle */}
                    <View style={styles.toggleContainer}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.toggleTitle}>Stackable</Text>
                        <Text style={styles.toggleSubtitle}>
                          Can this offer combine with other active offers?
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.toggleTrack,
                          current.stackable && styles.toggleTrackActive,
                        ]}
                        onPress={() =>
                          setCurrent({
                            ...current,
                            stackable: !current.stackable,
                          })
                        }
                      >
                        <View
                          style={[
                            styles.toggleThumb,
                            current.stackable && styles.toggleThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Validity Window — only for promo codes */}
                    {current.offer_type === "promo_code" && (
                      <>
                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                          Validity Window
                        </Text>
                        <View style={styles.datePillRow}>
                          <TouchableOpacity
                            style={styles.datePillBtn}
                            onPress={() => setShowValidityPicker(true)}
                          >
                            <Calendar
                              size={15}
                              color={COLORS.primary}
                              strokeWidth={1.75}
                            />
                            <Text
                              style={[
                                styles.datePillText,
                                !current.valid_from &&
                                  styles.datePillPlaceholder,
                              ]}
                              numberOfLines={1}
                            >
                              {current.valid_from
                                ? current.valid_from.toLocaleDateString(
                                    "en-IN",
                                    { day: "numeric", month: "short" },
                                  )
                                : "From date"}
                            </Text>
                            {current.valid_from && (
                              <TouchableOpacity
                                onPress={() =>
                                  setCurrent({
                                    ...current,
                                    valid_from: null,
                                  })
                                }
                              >
                                <XCircle
                                  size={16}
                                  color="#94A3B8"
                                  strokeWidth={1.75}
                                />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>

                          <Text style={styles.datePillArrow}>→</Text>

                          <TouchableOpacity
                            style={styles.datePillBtn}
                            onPress={() => setShowValidityPicker(true)}
                          >
                            <Calendar
                              size={15}
                              color={COLORS.primary}
                              strokeWidth={1.75}
                            />
                            <Text
                              style={[
                                styles.datePillText,
                                !current.valid_until &&
                                  styles.datePillPlaceholder,
                              ]}
                              numberOfLines={1}
                            >
                              {current.valid_until
                                ? formatShortDateTime(current.valid_until)
                                : "Until date"}
                            </Text>
                            {current.valid_until && (
                              <TouchableOpacity
                                onPress={() =>
                                  setCurrent({
                                    ...current,
                                    valid_until: null,
                                  })
                                }
                              >
                                <XCircle
                                  size={16}
                                  color="#94A3B8"
                                  strokeWidth={1.75}
                                />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        </View>

                        {(current.valid_from || current.valid_until) && (
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                            <TouchableOpacity
                              style={[styles.datePillBtn, { flex: 1 }]}
                              onPress={() => setShowValidFromTimePicker(true)}
                            >
                              <Clock size={15} color={COLORS.primary} strokeWidth={1.75} />
                              <Text style={styles.datePillText} numberOfLines={1}>
                                {current.valid_from
                                  ? new Date(current.valid_from).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "12:00 AM"}
                              </Text>
                            </TouchableOpacity>

                            <Text style={styles.datePillArrow}>→</Text>

                            <TouchableOpacity
                              style={[styles.datePillBtn, { flex: 1 }]}
                              onPress={() => setShowValidityEndTimePicker(true)}
                            >
                              <Clock size={15} color={COLORS.primary} strokeWidth={1.75} />
                              <Text style={styles.datePillText} numberOfLines={1}>
                                {current.valid_until
                                  ? new Date(current.valid_until).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "11:59 PM"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {eventStartDate && (
                          <Text style={styles.eventDateHint}>
                            Event starts on{" "}
                            {new Date(eventStartDate).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        )}

                        <CustomDatePicker
                          visible={showValidityPicker}
                          onClose={() => setShowValidityPicker(false)}
                          startDate={current.valid_from || undefined}
                          endDate={current.valid_until || undefined}
                          maxDate={
                            eventStartDate
                              ? new Date(eventStartDate)
                              : undefined
                          }
                          onConfirm={({ startDate, endDate }) => {
                            let newStart = null;
                            if (startDate) {
                              newStart = new Date(startDate);
                              if (current.valid_from) {
                                newStart.setHours(
                                  current.valid_from.getHours(),
                                  current.valid_from.getMinutes(),
                                  0,
                                  0,
                                );
                              } else {
                                newStart.setHours(0, 0, 0, 0);
                              }
                            }

                            let newEnd = null;
                            if (endDate) {
                              newEnd = new Date(endDate);
                              if (
                                current.valid_until &&
                                (current.valid_until.getHours() !== 0 ||
                                  current.valid_until.getMinutes() !== 0)
                              ) {
                                newEnd.setHours(
                                  current.valid_until.getHours(),
                                  current.valid_until.getMinutes(),
                                  0,
                                  0,
                                );
                              } else {
                                newEnd.setHours(23, 59, 0, 0);
                              }
                            }

                            setCurrent((prev) => ({
                              ...prev,
                              valid_from: newStart,
                              valid_until: newEnd,
                            }));
                            setShowValidityPicker(false);
                          }}
                        />

                        {/* Validity From Time Picker */}
                        <CustomTimePicker
                          visible={showValidFromTimePicker}
                          onClose={() => setShowValidFromTimePicker(false)}
                          time={
                            current.valid_from ||
                            new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          onChange={(newTime) => {
                            const base = current.valid_from
                              ? new Date(current.valid_from)
                              : new Date();
                            base.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
                            setCurrent((prev) => ({
                              ...prev,
                              valid_from: base,
                            }));
                          }}
                        />

                        {/* Validity Until Time Picker */}
                        <CustomTimePicker
                          visible={showValidityEndTimePicker}
                          onClose={() => setShowValidityEndTimePicker(false)}
                          time={
                            current.valid_until ||
                            new Date(new Date().setHours(23, 59, 0, 0))
                          }
                          onChange={(newTime) => {
                            const base = current.valid_until
                              ? new Date(current.valid_until)
                              : new Date();
                            base.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
                            setCurrent((prev) => ({
                              ...prev,
                              valid_until: base,
                            }));
                          }}
                        />
                      </>
                    )}
                  </View>
                )}

                {/* Early Bird date picker (custom) */}
                <CustomDatePicker
                  visible={showValidUntilPicker}
                  onClose={() => setShowValidUntilPicker(false)}
                  startDate={current.valid_until || undefined}
                  singleMode={true}
                  maxDate={
                    eventStartDate ? new Date(eventStartDate) : undefined
                  }
                  onConfirm={({ startDate }) => {
                    if (startDate) {
                      const d = new Date(startDate);
                      if (
                        current.valid_until &&
                        (current.valid_until.getHours() !== 0 ||
                          current.valid_until.getMinutes() !== 0)
                      ) {
                        d.setHours(
                          current.valid_until.getHours(),
                          current.valid_until.getMinutes(),
                          0,
                          0,
                        );
                      } else {
                        d.setHours(23, 59, 0, 0);
                      }
                      setCurrent((prev) => ({ ...prev, valid_until: d }));
                    }
                    setShowValidUntilPicker(false);
                  }}
                  minDate={new Date()}
                />

                {/* Early Bird time picker */}
                <CustomTimePicker
                  visible={showValidUntilTimePicker}
                  onClose={() => setShowValidUntilTimePicker(false)}
                  time={
                    current.valid_until ||
                    new Date(new Date().setHours(23, 59, 0, 0))
                  }
                  onChange={(newTime) => {
                    const base = current.valid_until
                      ? new Date(current.valid_until)
                      : new Date();
                    base.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
                    setCurrent((prev) => ({ ...prev, valid_until: base }));
                  }}
                />
              </SwipeableModal.KeyboardAwareScrollView>

              {/* FOOTER CTA WITH BLUR */}
              <View style={styles.stickyFooterContainer}>
                <View style={styles.stickyFooterBlur}>
                  <View
                    style={[
                      styles.stickyFooterContent,
                      { paddingBottom: Math.max(insets.bottom, 20) },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.ghostCancelButton}
                      onPress={handleCloseModal}
                    >
                      <Text style={styles.ghostCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.premiumCreateButton,
                        isSavePromoDisabled && styles.premiumCreateButtonDisabled,
                      ]}
                      onPress={handleSave}
                      disabled={isSavePromoDisabled}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.premiumCreateButtonText,
                          isSavePromoDisabled && styles.premiumCreateButtonTextDisabled,
                        ]}
                      >
                        {editingIndex !== null ? "Update Promo" : "Add Promo"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
        </SwipeableModal>

        {/* ── CUSTOM ALERT MODAL ── */}
        {alertConfig && (
          <CustomAlertModal
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={() => setAlertConfig(null)}
            primaryAction={alertConfig.primaryAction}
            secondaryAction={alertConfig.secondaryAction}
          />
        )}
      </View>
    );
  },
);

PromoEditor.displayName = "PromoEditor";

// ─── STYLES ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { marginTop: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: TEXT_COLOR,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5EAF2",
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    overflow: "hidden",
  },
  addButtonText: {
    fontFamily: "Manrope-SemiBold",
    color: "#111827",
    fontSize: 15,
    includeFontPadding: false,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  emptyIconWrapper: { marginBottom: 12 },
  emptyIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 16, color: TEXT_COLOR, fontWeight: "500" },
  emptySubtext: { fontSize: 14, color: LIGHT_TEXT_COLOR, marginTop: 4 },

  // ── TILE ──
  ticketTile: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    padding: 20,
    gap: 16,
  },
  tileIconContainer: { paddingTop: 4 },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tileContent: { flex: 1 },
  tileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tileName: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 8,
  },
  tileCode: {
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    color: "#111827",
    marginBottom: 4,
  },
  tilePrice: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#111827",
    marginBottom: 6,
  },
  tileChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  tileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  tileChipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#475569",
  },
  tileAppliesTo: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
  },
  progressSection: { marginBottom: 16 },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  tileActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  actionBtn: {
    paddingVertical: 4,
    marginLeft: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#4B5563",
  },

  // ── MODAL ──
  modalSheet: {
    backgroundColor: "#F7F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.9,
  },
  modalHeaderContainer: {
    backgroundColor: "#F7F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  modalTitle: {
    fontFamily: FONTS.primary,
    fontSize: 22,
    color: "#0F172A",
  },
  modalSubtitle: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: { paddingHorizontal: 16 },

  // ── CARD ──
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F0F2F5",
    marginTop: 8,
  },
  cardTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F6F8FB",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#EAEEF4",
  },

  // ── OFFER TYPE TILES ──
  typeOptions: { gap: 8 },
  offerTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    backgroundColor: "#F6F8FB",
    marginBottom: 8,
  },
  offerTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFFFFF",
    ...SHADOWS.sm,
  },
  offerTypeHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  offerTypeLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#4B5563",
  },
  offerTypeLabelActive: { color: "#0F172A" },
  offerTypeDesc: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#8A94A6",
    marginTop: 4,
    marginLeft: 28,
  },
  radioPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },

  // ── CODE INPUT ──
  codeInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
  },
  generateBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  dotSeparator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94A3B8",
  },

  // ── SEGMENTED CONTROL ──
  segContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F6FB",
    borderRadius: 14,
    padding: 4,
    height: 44,
  },
  segBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  segBtnActive: { backgroundColor: "#FFFFFF" },
  segBtnText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "rgba(100,116,139,0.8)",
  },
  segBtnTextActive: { fontFamily: "Manrope-SemiBold", color: "#0F172A" },

  // ── DATE BUTTON ──
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 14,
    backgroundColor: "#F6F8FB",
    gap: 10,
  },
  dateButtonText: {
    fontFamily: "Manrope-Regular",
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },

  // ── PREVIEW ──
  previewCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E8ECF4",
  },
  previewLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  previewPriceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  previewOriginalPrice: {
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  previewArrow: {
    fontFamily: "Manrope-Regular",
    fontSize: 16,
    color: "#CBD5E1",
  },
  previewDiscountedPrice: {
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    color: "#0F172A",
  },
  previewTicketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  previewTicketRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  previewTicketName: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#64748B",
    flex: 1,
    marginRight: 12,
  },
  previewFreeLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#22C55E",
  },
  previewDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  previewChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  previewChipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#475569",
  },

  // ── CHIPS ──
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  ticketChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    backgroundColor: "#F6F8FB",
  },
  ticketChipSelected: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ticketChipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#64748B",
  },
  ticketChipTextSelected: { fontFamily: "Manrope-SemiBold", color: "#0F172A" },

  // ── LOCKED FIELD ──
  lockedFieldWrapper: {
    marginBottom: 4,
  },
  lockedFieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#2563EB",
  },
  lockedInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  lockedInputText: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#334155",
  },
  lockedInputPlaceholder: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#94A3B8",
  },

  // ── ADVANCED TOGGLE ──
  advancedToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0F2F5",
    marginBottom: 8,
    marginTop: 4,
  },
  advancedToggleText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#64748B",
  },

  // ── TOGGLE ──
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EAEEF4",
  },

  // ── EVENT DATE HINT ──
  eventDateHint: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  toggleTitle: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#1C1F26",
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: { backgroundColor: COLORS.primary },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleThumbActive: { transform: [{ translateX: 20 }] },

  // ── DATE PILL ROW ──
  datePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  datePillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F0F5FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  datePillText: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#1E3A8A",
  },
  datePillPlaceholder: { color: "#94A3B8", fontFamily: "Manrope-Regular" },
  datePillArrow: {
    fontFamily: "Manrope-Regular",
    fontSize: 16,
    color: "#94A3B8",
  },

  // ── STICKY FOOTER WITH BLUR ──
  stickyFooterContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  stickyFooterBlur: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(229, 231, 235, 0.6)",
  },
  stickyFooterContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ghostCancelButton: {
    flex: 1,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 26,
  },
  ghostCancelButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#4B5563",
  },
  premiumCreateButton: {
    flex: 2,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumCreateButtonDisabled: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  premiumCreateButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  premiumCreateButtonTextDisabled: {
    color: "#94A3B8",
  },

  // ── HELPER & VALIDATION ──
  helperText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
  },
  validationError: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 6,
    fontWeight: "500",
  },
  validationWarning: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 8,
  },
});

export default PromoEditor;
