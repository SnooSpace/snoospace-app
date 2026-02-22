/**
 * DiscountCodesEditor - Component for managing event discount codes
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
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import CustomDatePicker from "../../components/ui/CustomDatePicker";
import { COLORS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

const DiscountCodesEditor = React.forwardRef(
  ({ discountCodes = [], onChange, ticketTypes = [] }, ref) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showValidityPicker, setShowValidityPicker] = useState(false);

    const [currentCode, setCurrentCode] = useState({
      code: "",
      discount_type: "percentage",
      discount_value: "",
      max_uses: "",
      valid_from: null,
      valid_until: null,
      applies_to: "all",
      selected_tickets: [],
      stackable: false,
      min_purchase: "",
    });

    const resetForm = () => {
      setCurrentCode({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        max_uses: "",
        valid_from: null,
        valid_until: null,
        applies_to: "all",
        selected_tickets: [],
        stackable: false,
        min_purchase: "",
      });
      setEditingIndex(null);
    };

    const openAddModal = () => {
      resetForm();
      setShowModal(true);
    };

    useImperativeHandle(ref, () => ({
      openAddModal,
      openEditModal,
    }));

    const openEditModal = (index) => {
      const dc = discountCodes[index];
      setCurrentCode({
        code: dc.code || "",
        discount_type: dc.discount_type || "percentage",
        discount_value: dc.discount_value?.toString() || "",
        max_uses: dc.max_uses?.toString() || "",
        valid_from: dc.valid_from ? new Date(dc.valid_from) : null,
        valid_until: dc.valid_until ? new Date(dc.valid_until) : null,
        applies_to: dc.applies_to || "all",
        selected_tickets: dc.selected_tickets || [],
        stackable: dc.stackable || false,
        min_purchase: dc.min_purchase?.toString() || "",
      });
      setEditingIndex(index);
      setShowModal(true);
    };

    const handleSave = () => {
      if (!currentCode.code.trim()) {
        Alert.alert("Required", "Please enter a discount code");
        return;
      }
      if (
        !currentCode.discount_value ||
        parseFloat(currentCode.discount_value) <= 0
      ) {
        Alert.alert("Required", "Please enter a valid discount value");
        return;
      }

      // Duplicate code check
      const codeUpper = currentCode.code.trim().toUpperCase();
      const isDuplicate = discountCodes.some(
        (dc, idx) =>
          idx !== editingIndex && dc.code?.toUpperCase() === codeUpper,
      );
      if (isDuplicate) {
        Alert.alert(
          "Duplicate Code",
          `Promo code "${codeUpper}" already exists.`,
        );
        return;
      }

      const codeData = {
        code: currentCode.code.trim().toUpperCase(),
        discount_type: currentCode.discount_type,
        discount_value: parseFloat(currentCode.discount_value),
        max_uses: currentCode.max_uses ? parseInt(currentCode.max_uses) : null,
        valid_from: currentCode.valid_from?.toISOString() || null,
        valid_until: currentCode.valid_until?.toISOString() || null,
        applies_to: currentCode.applies_to,
        selected_tickets:
          currentCode.applies_to === "specific"
            ? currentCode.selected_tickets
            : [],
        stackable: currentCode.stackable,
        min_purchase: currentCode.min_purchase
          ? parseFloat(currentCode.min_purchase)
          : null,
        is_active: true,
      };

      if (editingIndex !== null) {
        const updated = [...discountCodes];
        updated[editingIndex] = { ...updated[editingIndex], ...codeData };
        onChange(updated);
      } else {
        onChange([...discountCodes, codeData]);
      }

      setShowModal(false);
      resetForm();
    };

    const handleDelete = (index) => {
      Alert.alert(
        "Delete Discount Code",
        "Are you sure you want to delete this code?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const updated = discountCodes.filter((_, i) => i !== index);
              onChange(updated);
            },
          },
        ],
      );
    };

    const formatDiscount = (dc) => {
      if (dc.discount_type === "percentage") {
        return `${dc.discount_value}% OFF`;
      }
      return `₹${dc.discount_value} OFF`;
    };

    // Auto-generate code
    const generateCode = useCallback(() => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code;
      const existingCodes = discountCodes.map((dc) => dc.code?.toUpperCase());
      do {
        code = Array.from(
          { length: 8 },
          () => chars[Math.floor(Math.random() * chars.length)],
        ).join("");
      } while (existingCodes.includes(code));
      setCurrentCode((prev) => ({ ...prev, code }));
    }, [discountCodes]);

    // Discount preview computation
    const getPreviewPrice = useCallback(() => {
      const val = parseFloat(currentCode.discount_value) || 0;
      if (val <= 0) return null;
      const samplePrice =
        ticketTypes.length > 0
          ? parseFloat(ticketTypes[0].base_price) || 1000
          : 1000;
      let discounted;
      if (currentCode.discount_type === "percentage") {
        discounted = samplePrice - (samplePrice * val) / 100;
      } else {
        discounted = Math.max(0, samplePrice - val);
      }
      return { original: samplePrice, discounted: Math.round(discounted) };
    }, [currentCode.discount_type, currentCode.discount_value, ticketTypes]);

    // Toggle ticket in selected_tickets
    const toggleTicketSelection = useCallback((ticketName) => {
      setCurrentCode((prev) => {
        const selected = prev.selected_tickets.includes(ticketName)
          ? prev.selected_tickets.filter((t) => t !== ticketName)
          : [...prev.selected_tickets, ticketName];
        return { ...prev, selected_tickets: selected };
      });
    }, []);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>Discount Codes</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add Code</Text>
          </TouchableOpacity>
        </View>

        {discountCodes.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconGradient}
              >
                <Ionicons name="pricetag-outline" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>No discount codes</Text>
            <Text style={styles.emptySubtext}>
              Add promo codes for your event
            </Text>
          </View>
        )}

        {discountCodes.map((dc, index) => {
          return (
            <View key={index} style={styles.ticketTile}>
              {/* Left Tile Icon */}
              <View style={styles.tileIconContainer}>
                <LinearGradient
                  colors={["#F0FDF4", "#BBF7D0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tileIconCircle}
                >
                  <Ionicons name="pricetag" size={20} color="#16A34A" />
                </LinearGradient>
              </View>

              {/* Right Content */}
              <View style={styles.tileContent}>
                <View style={styles.tileHeader}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {dc.code}
                  </Text>
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>ACTIVE</Text>
                  </View>
                </View>

                <Text style={styles.tilePrice}>{formatDiscount(dc)}</Text>

                <View style={styles.progressSection}>
                  <Text style={styles.progressText}>
                    {dc.max_uses
                      ? `${dc.current_uses || 0} of ${dc.max_uses} uses limit`
                      : "Unlimited uses"}
                  </Text>
                  {dc.valid_from || dc.valid_until ? (
                    <Text style={styles.progressText}>
                      {dc.valid_until
                        ? `Valid until ${new Date(dc.valid_until).toLocaleDateString()}`
                        : `Valid from ${new Date(dc.valid_from).toLocaleDateString()}`}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.tileActions}>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(index)}
                  >
                    <Ionicons name="pencil" size={14} color="#6B7280" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(index)}
                  >
                    <Ionicons name="trash" size={14} color="#EF4444" />
                    <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Add/Edit Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent
          statusBarTranslucent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalContent}>
              <View style={styles.sheetHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingIndex !== null
                    ? "Edit Discount Code"
                    : "Add Discount Code"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={20} color={TEXT_COLOR} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
              >
                {/* ── CARD 1: Code Details ── */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Code Details</Text>

                  <Text style={styles.fieldLabel}>Promo Code *</Text>
                  <View style={styles.codeInputRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={currentCode.code}
                      onChangeText={(text) =>
                        setCurrentCode({
                          ...currentCode,
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

                {/* ── CARD 2: Discount Configuration ── */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Discount Configuration</Text>

                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.segContainer}>
                    {["percentage", "flat"].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.segBtn,
                          currentCode.discount_type === type &&
                            styles.segBtnActive,
                        ]}
                        onPress={() =>
                          setCurrentCode({
                            ...currentCode,
                            discount_type: type,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.segBtnText,
                            currentCode.discount_type === type &&
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
                    {currentCode.discount_type === "percentage" ? "(%)" : "(₹)"}{" "}
                    *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={currentCode.discount_value}
                    onChangeText={(text) =>
                      setCurrentCode({ ...currentCode, discount_value: text })
                    }
                    placeholder={
                      currentCode.discount_type === "percentage" ? "20" : "500"
                    }
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />

                  {/* Preview Box */}
                  {(() => {
                    const preview = getPreviewPrice();
                    if (!preview) return null;
                    const exceeded =
                      currentCode.discount_type === "percentage"
                        ? parseFloat(currentCode.discount_value) > 100
                        : (parseFloat(currentCode.discount_value) || 0) >
                          preview.original;
                    return (
                      <View style={styles.previewCard}>
                        <Text style={styles.previewLabel}>
                          {ticketTypes.length > 0
                            ? `PREVIEW — ${ticketTypes[0].name.toUpperCase()}`
                            : "PREVIEW — EXAMPLE TICKET"}
                        </Text>
                        <View style={styles.previewPriceRow}>
                          <Text style={styles.previewOriginalPrice}>
                            ₹{preview.original.toLocaleString("en-IN")}
                          </Text>
                          <Text style={styles.previewArrow}>→</Text>
                          <Text style={styles.previewDiscountedPrice}>
                            ₹
                            {Math.max(0, preview.discounted).toLocaleString(
                              "en-IN",
                            )}
                          </Text>
                        </View>
                        {exceeded && (
                          <Text style={styles.validationWarning}>
                            Discount exceeds ticket price
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* ── CARD 3: Conditions ── */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Conditions</Text>

                  <Text style={styles.fieldLabel}>Max Uses (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={currentCode.max_uses}
                    onChangeText={(text) =>
                      setCurrentCode({ ...currentCode, max_uses: text })
                    }
                    placeholder="Leave empty for unlimited"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                    Applies To
                  </Text>
                  <View style={styles.segContainer}>
                    {["all", "specific"].map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.segBtn,
                          currentCode.applies_to === opt && styles.segBtnActive,
                          opt === "specific" &&
                            ticketTypes.length === 0 && { opacity: 0.4 },
                        ]}
                        disabled={
                          opt === "specific" && ticketTypes.length === 0
                        }
                        onPress={() =>
                          setCurrentCode({ ...currentCode, applies_to: opt })
                        }
                      >
                        <Text
                          style={[
                            styles.segBtnText,
                            currentCode.applies_to === opt &&
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

                  {currentCode.applies_to === "specific" &&
                    ticketTypes.length > 0 && (
                      <View style={styles.chipGrid}>
                        {ticketTypes.map((t, idx) => {
                          const selected =
                            currentCode.selected_tickets.includes(t.name);
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

                  {/* Combine Toggle */}
                  <View style={styles.toggleContainer}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleTitle}>
                        Combine with other discounts
                      </Text>
                      <Text style={styles.toggleSubtitle}>
                        When off, this code cannot stack with early bird pricing
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.toggleTrack,
                        currentCode.stackable && styles.toggleTrackActive,
                      ]}
                      onPress={() =>
                        setCurrentCode({
                          ...currentCode,
                          stackable: !currentCode.stackable,
                        })
                      }
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          currentCode.stackable && styles.toggleThumbActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                    Minimum Purchase Amount (Optional)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={currentCode.min_purchase}
                    onChangeText={(text) =>
                      setCurrentCode({ ...currentCode, min_purchase: text })
                    }
                    placeholder="₹0 (no minimum)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />

                  {/* Valid From */}
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
                          !currentCode.valid_from && styles.datePillPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {currentCode.valid_from
                          ? currentCode.valid_from.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : "From date"}
                      </Text>
                      {currentCode.valid_from && (
                        <TouchableOpacity
                          onPress={() =>
                            setCurrentCode({ ...currentCode, valid_from: null })
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
                          !currentCode.valid_until &&
                            styles.datePillPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {currentCode.valid_until
                          ? currentCode.valid_until.toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                              },
                            )
                          : "Until date"}
                      </Text>
                      {currentCode.valid_until && (
                        <TouchableOpacity
                          onPress={() =>
                            setCurrentCode({
                              ...currentCode,
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

                  <CustomDatePicker
                    visible={showValidityPicker}
                    onClose={() => setShowValidityPicker(false)}
                    startDate={currentCode.valid_from || undefined}
                    endDate={currentCode.valid_until || undefined}
                    onConfirm={({ startDate, endDate }) => {
                      setCurrentCode({
                        ...currentCode,
                        valid_from: startDate || null,
                        valid_until: endDate || null,
                      });
                      setShowValidityPicker(false);
                    }}
                  />
                </View>
              </ScrollView>

              <View
                style={[
                  styles.floatingFooter,
                  { paddingBottom: Math.max(insets.bottom, 20) },
                ]}
              >
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButtonGradient}
                  >
                    <Text style={styles.saveButtonText}>
                      {editingIndex !== null ? "Update Code" : "Add Code"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  },
);

DiscountCodesEditor.displayName = "DiscountCodesEditor";

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
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
  emptyIconWrapper: {
    marginBottom: 12,
  },
  emptyIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_COLOR,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },

  // --- TICKET TILE (DISCOUNT CODE VERSION) ---
  ticketTile: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  tileIconContainer: {
    paddingTop: 4,
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tileContent: {
    flex: 1,
  },
  tileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tileName: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 8,
    fontFamily: "monospace",
  },
  tileBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tilePrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 12,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  tileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  // --- MODAL ---
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
  modalBody: {
    paddingHorizontal: 16,
  },
  // --- CARD ---
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
  // --- CODE INPUT ROW ---
  codeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
  // --- SEGMENTED CONTROL ---
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
  segBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  segBtnText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "rgba(100,116,139,0.8)",
  },
  segBtnTextActive: {
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
  },
  // --- PREVIEW CARD ---
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
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
    fontSize: 20,
    color: "#0F172A",
  },
  // --- CHIP GRID (Applies To) ---
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
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
  ticketChipTextSelected: {
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
  },
  // --- TOGGLE ROW ---
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
    backgroundColor: "#E2E8F0", // Off state background
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: COLORS.primary, // On state background
  },
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
  toggleThumbActive: {
    transform: [{ translateX: 20 }], // Slide to the right
  },
  // --- DATE PILL ROW ---
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
  datePillPlaceholder: {
    color: "#94A3B8",
    fontFamily: "Manrope-Regular",
  },
  datePillArrow: {
    fontFamily: "Manrope-Regular",
    fontSize: 16,
    color: "#94A3B8",
  },
  // --- FOOTER ---
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
  saveButton: {
    borderRadius: 30,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
    fontSize: 16,
  },
  // --- HELPER & VALIDATION ---
  helperText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
  },
  validationWarning: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 8,
  },
});

export default DiscountCodesEditor;
