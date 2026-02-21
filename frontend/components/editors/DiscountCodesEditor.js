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
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

const DiscountCodesEditor = React.forwardRef(
  ({ discountCodes = [], onChange, ticketTypes = [] }, ref) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showValidFromPicker, setShowValidFromPicker] = useState(false);
    const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);

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
                contentContainerStyle={{ paddingBottom: 120 }}
              >
                {/* Code */}
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>
                  Promo Code *
                </Text>
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
                    placeholderTextColor={LIGHT_TEXT_COLOR}
                    autoCapitalize="characters"
                  />
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

                {/* Discount Type */}
                <Text style={styles.fieldLabel}>Discount Type</Text>
                <View style={styles.pillContainer}>
                  {["percentage", "flat"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pillOption,
                        currentCode.discount_type === type &&
                          styles.pillOptionActive,
                      ]}
                      onPress={() =>
                        setCurrentCode({ ...currentCode, discount_type: type })
                      }
                    >
                      <Text
                        style={[
                          styles.pillOptionText,
                          currentCode.discount_type === type &&
                            styles.pillOptionTextActive,
                        ]}
                      >
                        {type === "percentage"
                          ? "Percentage (%)"
                          : "Flat Amount (₹)"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Discount Value */}
                <Text style={styles.fieldLabel}>
                  Discount Value{" "}
                  {currentCode.discount_type === "percentage" ? "(%)" : "(₹)"} *
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
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  keyboardType="numeric"
                />

                {/* Discount Preview */}
                {(() => {
                  const preview = getPreviewPrice();
                  if (!preview) return null;
                  const exceeded =
                    currentCode.discount_type === "percentage"
                      ? parseFloat(currentCode.discount_value) > 100
                      : (parseFloat(currentCode.discount_value) || 0) >
                        preview.original;
                  return (
                    <View style={styles.previewBlock}>
                      <Text style={styles.previewTitle}>
                        {ticketTypes.length > 0
                          ? `Preview (${ticketTypes[0].name})`
                          : "Example Preview (₹1,000 ticket)"}
                      </Text>
                      <View style={styles.previewPriceRow}>
                        <Text style={styles.previewOldPrice}>
                          ₹{preview.original.toLocaleString("en-IN")}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={LIGHT_TEXT_COLOR}
                          style={{ marginHorizontal: 6 }}
                        />
                        <Text style={styles.previewNewPrice}>
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

                {/* Max Uses */}
                <Text style={styles.fieldLabel}>Max Uses (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={currentCode.max_uses}
                  onChangeText={(text) =>
                    setCurrentCode({ ...currentCode, max_uses: text })
                  }
                  placeholder="Leave empty for unlimited"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  keyboardType="numeric"
                />

                {/* Applies To */}
                <Text style={styles.fieldLabel}>Applies To</Text>
                <View style={styles.pillContainer}>
                  {["all", "specific"].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.pillOption,
                        currentCode.applies_to === opt &&
                          styles.pillOptionActive,
                        opt === "specific" &&
                          ticketTypes.length === 0 && { opacity: 0.5 },
                      ]}
                      disabled={opt === "specific" && ticketTypes.length === 0}
                      onPress={() =>
                        setCurrentCode({ ...currentCode, applies_to: opt })
                      }
                    >
                      <Text
                        style={[
                          styles.pillOptionText,
                          currentCode.applies_to === opt &&
                            styles.pillOptionTextActive,
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
                    <View style={styles.ticketChipContainer}>
                      {ticketTypes.map((t, idx) => {
                        const selected = currentCode.selected_tickets.includes(
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
                            <Ionicons
                              name={
                                selected
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={16}
                              color={
                                selected ? COLORS.primary : LIGHT_TEXT_COLOR
                              }
                            />
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

                {/* Stacking Rule */}
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      Can combine with other discounts
                    </Text>
                    <Text style={styles.helperText}>
                      When off, this code cannot stack with early bird pricing
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleSwitch,
                      currentCode.stackable && styles.toggleSwitchActive,
                    ]}
                    onPress={() =>
                      setCurrentCode({
                        ...currentCode,
                        stackable: !currentCode.stackable,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.toggleSwitchText,
                        currentCode.stackable && styles.toggleSwitchTextActive,
                      ]}
                    >
                      {currentCode.stackable ? "Yes" : "No"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Minimum Purchase */}
                <Text style={styles.fieldLabel}>
                  Minimum Purchase Amount (Optional)
                </Text>
                <TextInput
                  style={styles.input}
                  value={currentCode.min_purchase}
                  onChangeText={(text) =>
                    setCurrentCode({ ...currentCode, min_purchase: text })
                  }
                  placeholder="₹0 (no minimum)"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  keyboardType="numeric"
                />

                {/* Valid From */}
                <Text style={styles.fieldLabel}>Valid From (Optional)</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowValidFromPicker(true)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.dateButtonText}>
                    {currentCode.valid_from
                      ? currentCode.valid_from.toLocaleDateString()
                      : "Set start date"}
                  </Text>
                  {currentCode.valid_from && (
                    <TouchableOpacity
                      onPress={() =>
                        setCurrentCode({ ...currentCode, valid_from: null })
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={LIGHT_TEXT_COLOR}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Valid Until */}
                <Text style={styles.fieldLabel}>Valid Until (Optional)</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowValidUntilPicker(true)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.dateButtonText}>
                    {currentCode.valid_until
                      ? currentCode.valid_until.toLocaleDateString()
                      : "Set expiry date"}
                  </Text>
                  {currentCode.valid_until && (
                    <TouchableOpacity
                      onPress={() =>
                        setCurrentCode({ ...currentCode, valid_until: null })
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={LIGHT_TEXT_COLOR}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {showValidFromPicker && (
                  <DateTimePicker
                    value={currentCode.valid_from || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowValidFromPicker(false);
                      if (date)
                        setCurrentCode({ ...currentCode, valid_from: date });
                    }}
                  />
                )}

                {showValidUntilPicker && (
                  <DateTimePicker
                    value={currentCode.valid_until || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowValidUntilPicker(false);
                      if (date)
                        setCurrentCode({ ...currentCode, valid_until: date });
                    }}
                  />
                )}
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
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
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
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#F9FAFB",
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    gap: 6,
  },
  pillOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  pillOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  pillOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    gap: 10,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  floatingFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  saveButton: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    ...SHADOWS.primaryGlow,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // --- Code Input & Generate ---
  codeInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  generateBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  // --- Preview ---
  previewBlock: {
    backgroundColor: "#F0F9FF",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0369A1",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewOldPrice: {
    fontSize: 16,
    fontWeight: "500",
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  previewNewPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#059669",
  },
  // --- Ticket Chips ---
  ticketChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  ticketChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  ticketChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  ticketChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  ticketChipTextSelected: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  // --- Toggle ---
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  toggleSwitch: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  toggleSwitchActive: {
    borderColor: "#059669",
    backgroundColor: "#ECFDF5",
  },
  toggleSwitchText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleSwitchTextActive: {
    color: "#059669",
  },
  // --- Helper & Validation ---
  helperText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
    fontWeight: "400",
  },
  validationWarning: {
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 6,
    fontWeight: "500",
  },
});

export default DiscountCodesEditor;
