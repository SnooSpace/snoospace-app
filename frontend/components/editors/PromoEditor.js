/**
 * PromoEditor - Unified component for managing promo codes and early bird discounts
 * Consolidates DiscountCodesEditor + PricingRulesEditor into a single "Add Promo" modal
 * Used in CreateEventModal and EditEventModal
 */
import React, { useState, useImperativeHandle, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BadgePercent } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import CustomDatePicker from "../../components/ui/CustomDatePicker";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";

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
    icon: "flash",
    color: "#F59E0B", // Amber/Orange
    description: "Auto-applied by date or sales volume",
  },
];

const TRIGGER_TYPES = [
  {
    value: "by_date",
    label: "By Date",
    icon: "time-outline",
    color: "#3B82F6", // Blue
    description: "Discount before a specific date",
  },
  {
    value: "by_sales",
    label: "By Sales",
    icon: "trending-up-outline",
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
  stackable: false,
  valid_from: null,
  valid_until: null,
  quantity_threshold: "",
  is_active: true,
};

const PromoEditor = React.forwardRef(
  ({ promos = [], onChange, ticketTypes = [], eventStartDate }, ref) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);
    const [showValidityPicker, setShowValidityPicker] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [current, setCurrent] = useState({ ...DEFAULT_PROMO });

    const resetForm = () => {
      setCurrent({ ...DEFAULT_PROMO });
      setEditingIndex(null);
      setShowAdvanced(false);
    };

    const openAddModal = () => {
      resetForm();
      setShowModal(true);
    };

    const openEditModal = (index) => {
      const p = promos[index];
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
        max_uses: p.max_uses?.toString() || "",
        min_purchase: p.min_purchase?.toString() || "",
        stackable: p.stackable || false,
        valid_from: p.valid_from ? new Date(p.valid_from) : null,
        valid_until: p.valid_until ? new Date(p.valid_until) : null,
        quantity_threshold: p.quantity_threshold?.toString() || "",
        is_active: p.is_active !== false,
      });
      // Show advanced section if any advanced field has data
      if (
        p.max_uses ||
        p.min_purchase ||
        p.stackable ||
        p.valid_from ||
        p.valid_until
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
          // Quantity threshold required
          if (!current.quantity_threshold) return false;
        }
      }

      // Specific tickets: at least one must be selected
      if (
        current.applies_to === "specific" &&
        current.selected_tickets.length === 0
      )
        return false;

      return true;
    })();

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
        if (current.trigger === "by_sales" && !current.quantity_threshold) {
          Alert.alert("Required", "Please set the ticket quantity threshold");
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
        max_uses: current.max_uses ? parseInt(current.max_uses) : null,
        min_purchase: current.min_purchase
          ? parseFloat(current.min_purchase)
          : null,
        stackable: current.stackable,
        valid_from:
          current.offer_type === "promo_code" && current.valid_from
            ? current.valid_from.toISOString()
            : null,
        valid_until: current.valid_until
          ? current.valid_until.toISOString()
          : null,
        quantity_threshold:
          current.offer_type === "early_bird" &&
          current.trigger === "by_sales" &&
          current.quantity_threshold
            ? parseInt(current.quantity_threshold)
            : null,
        is_active: true,
      };

      if (editingIndex !== null) {
        const updated = [...promos];
        updated[editingIndex] = { ...updated[editingIndex], ...promoData };
        onChange(updated);
      } else {
        onChange([...promos, promoData]);
      }

      setShowModal(false);
      resetForm();
    };

    const handleDelete = (index) => {
      Alert.alert(
        "Delete Promo",
        "Are you sure you want to delete this offer?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const updated = promos.filter((_, i) => i !== index);
              onChange(updated);
            },
          },
        ],
      );
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
          name: p.trigger === "by_date" ? "time" : "trending-up",
          isLucide: false,
          colors: isActiveAndUsed
            ? ["#DCFCE7", "#BBF7D0"]
            : isActive
              ? ["#FFF7ED", "#FDE68A"]
              : ["#F3F6FB", "#F3F6FB"],
          iconColor: isActiveAndUsed
            ? "#166534"
            : isActive
              ? "#D97706"
              : "#64748B",
          hasBorder: isActiveAndUsed,
        };
      }
      return {
        name: "BadgePercent",
        isLucide: true,
        colors: isActiveAndUsed
          ? ["#DCFCE7", "#BBF7D0"]
          : isActive
            ? ["#F0FDF4", "#DCFCE7"]
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
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add Promo</Text>
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
                  {tile.isLucide ? (
                    <BadgePercent size={20} color={tile.iconColor} />
                  ) : (
                    <Ionicons
                      name={tile.name}
                      size={20}
                      color={tile.iconColor}
                    />
                  )}
                </LinearGradient>
              </View>
              <View style={styles.tileContent}>
                <View style={styles.tileHeader}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {p.offer_type === "promo_code"
                      ? p.name || "Promo Code"
                      : p.name || "Early Bird"}
                  </Text>
                </View>
                <Text style={styles.tilePrice}>{formatDiscount(p)}</Text>
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
        <Modal
          visible={showModal}
          animationType="slide"
          transparent
          statusBarTranslucent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.sheetHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingIndex !== null ? "Edit Promo" : "Add Promo"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={20} color={TEXT_COLOR} />
                </TouchableOpacity>
              </View>

              <KeyboardAwareScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
                bottomOffset={80}
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
                              // Keep valid_until only if it was set for promo validity
                            } else {
                              // Early bird — clear promo-specific fields
                              updates.code = "";
                              updates.valid_from = null;
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
                              />
                            ) : (
                              <Ionicons
                                name={type.icon}
                                size={20}
                                color={
                                  current.offer_type === type.value
                                    ? type.color
                                    : LIGHT_TEXT_COLOR
                                }
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
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={type.color}
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
                        <Ionicons
                          name="sparkles"
                          size={14}
                          color={COLORS.primary}
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
                            setCurrent({ ...current, trigger: type.value });
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={styles.offerTypeHeader}>
                              <Ionicons
                                name={type.icon}
                                size={20}
                                color={
                                  current.trigger === type.value
                                    ? type.color
                                    : LIGHT_TEXT_COLOR
                                }
                              />
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
                            <Ionicons
                              name="checkmark-circle"
                              size={22}
                              color={type.color}
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
                        <TouchableOpacity
                          style={styles.dateButton}
                          onPress={() => setShowValidUntilPicker(true)}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#94A3B8"
                          />
                          <Text
                            style={[
                              styles.dateButtonText,
                              !current.valid_until && { color: "#94A3B8" },
                            ]}
                          >
                            {current.valid_until
                              ? current.valid_until.toLocaleDateString()
                              : "Select end date"}
                          </Text>
                        </TouchableOpacity>
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
                              quantity_threshold: text,
                            })
                          }
                          placeholder="e.g., 100"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                        />
                      </>
                    )}
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
                                <Ionicons
                                  name="checkmark"
                                  size={13}
                                  color={COLORS.primary}
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
                  <Ionicons
                    name={showAdvanced ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.card}>
                    <Text style={styles.fieldLabel}>Max Uses (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={current.max_uses}
                      onChangeText={(text) =>
                        setCurrent({ ...current, max_uses: text })
                      }
                      placeholder="Leave empty for unlimited"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />

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
                            <Ionicons
                              name="calendar-outline"
                              size={15}
                              color={COLORS.primary}
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
                                <Ionicons
                                  name="close-circle"
                                  size={16}
                                  color="#94A3B8"
                                />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>

                          <Text style={styles.datePillArrow}>→</Text>

                          <TouchableOpacity
                            style={styles.datePillBtn}
                            onPress={() => setShowValidityPicker(true)}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={15}
                              color={COLORS.primary}
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
                                ? current.valid_until.toLocaleDateString(
                                    "en-IN",
                                    { day: "numeric", month: "short" },
                                  )
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
                                <Ionicons
                                  name="close-circle"
                                  size={16}
                                  color="#94A3B8"
                                />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        </View>

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
                            setCurrent({
                              ...current,
                              valid_from: startDate || null,
                              valid_until: endDate || null,
                            });
                            setShowValidityPicker(false);
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
                    setCurrent({ ...current, valid_until: startDate });
                    setShowValidUntilPicker(false);
                  }}
                  minDate={new Date()}
                />
              </KeyboardAwareScrollView>

              <KeyboardStickyView
                style={[
                  styles.floatingFooter,
                  { paddingBottom: Math.max(insets.bottom, 20) },
                ]}
                offset={{ closed: 0, opened: 8 }}
              >
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    !isFormValid && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!isFormValid}
                >
                  {isFormValid ? (
                    <LinearGradient
                      colors={COLORS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveButtonGradient}
                    >
                      <Text style={styles.saveButtonText}>
                        {editingIndex !== null ? "Update Promo" : "Add Promo"}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.saveButtonGradient}>
                      <Text
                        style={[
                          styles.saveButtonText,
                          styles.saveButtonTextDisabled,
                        ]}
                      >
                        {editingIndex !== null ? "Update Promo" : "Add Promo"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </KeyboardStickyView>
            </View>
          </View>
        </Modal>
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
  },
  addButtonText: {
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
    fontSize: 15,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    ...SHADOWS.sm,
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
    marginBottom: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#F7F9FC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
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
    fontFamily: "Manrope-Bold",
    fontSize: 20,
    color: "#0F172A",
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

  // ── FOOTER ──
  floatingFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  saveButton: { borderRadius: 16, overflow: "hidden" },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonGradient: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  saveButtonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 16,
  },
  saveButtonTextDisabled: {
    color: "#9CA3AF",
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
