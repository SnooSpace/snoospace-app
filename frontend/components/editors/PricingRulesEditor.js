/**
 * PricingRulesEditor - Component for managing early bird and auto-discount rules
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

const RULE_TYPES = [
  {
    value: "early_bird_time",
    label: "Early Bird (by date)",
    icon: "time-outline",
    description: "Discount before a specific date",
  },
  {
    value: "early_bird_quantity",
    label: "Early Bird (by sales)",
    icon: "trending-up-outline",
    description: "Discount for first X tickets",
  },
];

const PricingRulesEditor = React.forwardRef(
  ({ pricingRules = [], onChange, ticketTypes = [], eventStartDate }, ref) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showValidUntilPicker, setShowValidUntilPicker] = useState(false);

    const [currentRule, setCurrentRule] = useState({
      name: "",
      rule_type: "early_bird_time",
      discount_type: "percentage",
      discount_value: "",
      valid_until: null,
      quantity_threshold: "",
    });

    const resetForm = () => {
      setCurrentRule({
        name: "",
        rule_type: "early_bird_time",
        discount_type: "percentage",
        discount_value: "",
        valid_until: null,
        quantity_threshold: "",
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
      const rule = pricingRules[index];
      setCurrentRule({
        name: rule.name || "",
        rule_type: rule.rule_type || "early_bird_time",
        discount_type: rule.discount_type || "percentage",
        discount_value: rule.discount_value?.toString() || "",
        valid_until: rule.valid_until ? new Date(rule.valid_until) : null,
        quantity_threshold: rule.quantity_threshold?.toString() || "",
      });
      setEditingIndex(index);
      setShowModal(true);
    };

    const handleSave = () => {
      if (!currentRule.name.trim()) {
        Alert.alert("Required", "Please enter a rule name");
        return;
      }
      if (
        !currentRule.discount_value ||
        parseFloat(currentRule.discount_value) <= 0
      ) {
        Alert.alert("Required", "Please enter a valid discount value");
        return;
      }

      if (
        currentRule.rule_type === "early_bird_time" &&
        !currentRule.valid_until
      ) {
        Alert.alert(
          "Required",
          "Please set an end date for time-based early bird",
        );
        return;
      }
      if (
        currentRule.rule_type === "early_bird_quantity" &&
        !currentRule.quantity_threshold
      ) {
        Alert.alert("Required", "Please set a quantity threshold");
        return;
      }

      const ruleData = {
        name: currentRule.name.trim(),
        rule_type: currentRule.rule_type,
        discount_type: currentRule.discount_type,
        discount_value: parseFloat(currentRule.discount_value),
        valid_until: currentRule.valid_until?.toISOString() || null,
        quantity_threshold: currentRule.quantity_threshold
          ? parseInt(currentRule.quantity_threshold)
          : null,
        is_active: true,
      };

      if (editingIndex !== null) {
        const updated = [...pricingRules];
        updated[editingIndex] = { ...updated[editingIndex], ...ruleData };
        onChange(updated);
      } else {
        onChange([...pricingRules, ruleData]);
      }

      setShowModal(false);
      resetForm();
    };

    const handleDelete = (index) => {
      Alert.alert(
        "Delete Pricing Rule",
        "Are you sure you want to delete this rule?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const updated = pricingRules.filter((_, i) => i !== index);
              onChange(updated);
            },
          },
        ],
      );
    };

    const formatDiscount = (rule) => {
      if (rule.discount_type === "percentage") {
        return `${rule.discount_value}% OFF`;
      }
      return `₹${rule.discount_value} OFF`;
    };

    const formatCondition = (rule) => {
      if (rule.rule_type === "early_bird_time" && rule.valid_until) {
        return `Until ${new Date(rule.valid_until).toLocaleDateString()}`;
      }
      if (rule.rule_type === "early_bird_quantity" && rule.quantity_threshold) {
        return `First ${rule.quantity_threshold} tickets`;
      }
      return "";
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>Early Bird Pricing</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add Rule</Text>
          </TouchableOpacity>
        </View>

        {pricingRules.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconGradient}
              >
                <Ionicons name="flash-outline" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>No early bird pricing</Text>
            <Text style={styles.emptySubtext}>Add auto-applied discounts</Text>
          </View>
        )}

        {pricingRules.map((rule, index) => (
          <View key={index} style={styles.ticketTile}>
            {/* Left Tile Icon */}
            <View style={styles.tileIconContainer}>
              <LinearGradient
                colors={["#FFF7ED", "#FDE68A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tileIconCircle}
              >
                <Ionicons
                  name={
                    rule.rule_type === "early_bird_time"
                      ? "time"
                      : "trending-up"
                  }
                  size={20}
                  color="#D97706"
                />
              </LinearGradient>
            </View>

            {/* Right Content */}
            <View style={styles.tileContent}>
              <View style={styles.tileHeader}>
                <Text style={styles.tileName} numberOfLines={1}>
                  {rule.name}
                </Text>
                <View style={styles.tileBadge}>
                  <Text style={styles.tileBadgeText}>ACTIVE</Text>
                </View>
              </View>

              <Text style={styles.tilePrice}>{formatDiscount(rule)}</Text>

              <View style={styles.progressSection}>
                <Text style={styles.progressText}>
                  {formatCondition(rule) || "No conditions set"}
                </Text>
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
        ))}

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
                    ? "Edit Early Bird Rule"
                    : "Add Early Bird Rule"}
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
                {/* Ticket Linking Label */}
                {ticketTypes.length > 0 ? (
                  <View style={styles.linkingBadge}>
                    <Ionicons name="ticket" size={14} color={COLORS.primary} />
                    <Text style={styles.linkingBadgeText}>
                      Applies to: {ticketTypes.map((t) => t.name).join(", ")}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.linkingBadge,
                      { borderColor: "#FEF3C7", backgroundColor: "#FFFBEB" },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                    <Text
                      style={[styles.linkingBadgeText, { color: "#92400E" }]}
                    >
                      No tickets created yet
                    </Text>
                  </View>
                )}

                {/* Enhanced Preview Block */}
                {currentRule.discount_value
                  ? (() => {
                      const samplePrice =
                        ticketTypes.length > 0
                          ? parseFloat(ticketTypes[0].base_price) || 1000
                          : 1000;
                      const val = parseFloat(currentRule.discount_value) || 0;
                      const discounted =
                        currentRule.discount_type === "percentage"
                          ? samplePrice - (samplePrice * val) / 100
                          : Math.max(0, samplePrice - val);
                      const savings =
                        samplePrice > 0
                          ? Math.round(
                              ((samplePrice - discounted) / samplePrice) * 100,
                            )
                          : 0;
                      return (
                        <View style={styles.previewBlock}>
                          <Text style={styles.previewTitle}>
                            {ticketTypes.length > 0
                              ? `Preview (${ticketTypes[0].name})`
                              : "Example Preview (₹1,000 ticket)"}
                          </Text>
                          <View style={styles.previewPriceRow}>
                            <Text style={styles.previewOldPrice}>
                              ₹{samplePrice.toLocaleString("en-IN")}
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={14}
                              color={LIGHT_TEXT_COLOR}
                              style={{ marginHorizontal: 6 }}
                            />
                            <Text style={styles.previewNewPrice}>
                              ₹
                              {Math.max(
                                0,
                                Math.round(discounted),
                              ).toLocaleString("en-IN")}
                            </Text>
                          </View>
                          <Text style={styles.previewSavings}>
                            You save {savings}%
                          </Text>
                        </View>
                      );
                    })()
                  : null}

                {/* Rule Name */}
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>
                  Rule Name *
                </Text>
                <TextInput
                  style={styles.input}
                  value={currentRule.name}
                  onChangeText={(text) =>
                    setCurrentRule({ ...currentRule, name: text })
                  }
                  placeholder="e.g., Early Bird Special"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                />

                {/* Rule Type */}
                <Text style={styles.fieldLabel}>Rule Type</Text>
                <View style={styles.typeOptions}>
                  {RULE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.ruleTypeOption,
                        currentRule.rule_type === type.value &&
                          styles.ruleTypeOptionActive,
                      ]}
                      onPress={() =>
                        setCurrentRule({
                          ...currentRule,
                          rule_type: type.value,
                        })
                      }
                    >
                      <View style={styles.ruleTypeHeader}>
                        <Ionicons
                          name={type.icon}
                          size={20}
                          color={
                            currentRule.rule_type === type.value
                              ? COLORS.primary
                              : LIGHT_TEXT_COLOR
                          }
                        />
                        <Text
                          style={[
                            styles.ruleTypeLabel,
                            currentRule.rule_type === type.value &&
                              styles.ruleTypeLabelActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </View>
                      <Text style={styles.ruleTypeDesc}>
                        {type.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Discount Type */}
                <Text style={styles.fieldLabel}>Discount Type</Text>
                <View style={styles.pillContainer}>
                  {["percentage", "flat"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pillOption,
                        currentRule.discount_type === type &&
                          styles.pillOptionActive,
                      ]}
                      onPress={() =>
                        setCurrentRule({ ...currentRule, discount_type: type })
                      }
                    >
                      <Text
                        style={[
                          styles.pillOptionText,
                          currentRule.discount_type === type &&
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
                  {currentRule.discount_type === "percentage" ? "(%)" : "(₹)"} *
                </Text>
                <TextInput
                  style={styles.input}
                  value={currentRule.discount_value}
                  onChangeText={(text) =>
                    setCurrentRule({ ...currentRule, discount_value: text })
                  }
                  placeholder={
                    currentRule.discount_type === "percentage" ? "20" : "500"
                  }
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  keyboardType="numeric"
                />

                {/* Condition based on rule type */}
                {currentRule.rule_type === "early_bird_time" && (
                  <>
                    <Text style={styles.fieldLabel}>Early Bird Ends On *</Text>
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
                        {currentRule.valid_until
                          ? currentRule.valid_until.toLocaleDateString()
                          : "Select end date"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>
                      Must end before event start
                    </Text>
                    {currentRule.valid_until &&
                      eventStartDate &&
                      currentRule.valid_until > new Date(eventStartDate) && (
                        <Text style={styles.validationError}>
                          Early bird end date must be before event start date
                        </Text>
                      )}
                  </>
                )}

                {currentRule.rule_type === "early_bird_quantity" && (
                  <>
                    <Text style={styles.fieldLabel}>
                      Apply to First X Tickets *
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={currentRule.quantity_threshold}
                      onChangeText={(text) =>
                        setCurrentRule({
                          ...currentRule,
                          quantity_threshold: text,
                        })
                      }
                      placeholder="e.g., 100"
                      placeholderTextColor={LIGHT_TEXT_COLOR}
                      keyboardType="numeric"
                    />
                  </>
                )}

                {showValidUntilPicker && (
                  <DateTimePicker
                    value={currentRule.valid_until || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      setShowValidUntilPicker(false);
                      if (date)
                        setCurrentRule({ ...currentRule, valid_until: date });
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
                      {editingIndex !== null ? "Update Rule" : "Add Rule"}
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

PricingRulesEditor.displayName = "PricingRulesEditor";

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
  // --- TICKET TILE (PRICING RULE VERSION) ---
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
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 8,
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

  // --- MODAL & FORMS ---
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
  typeOptions: {
    gap: 8,
  },
  ruleTypeOption: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
  },
  ruleTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  ruleTypeLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
  },
  ruleTypeLabelActive: {
    color: COLORS.primary,
  },
  ruleTypeDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    marginLeft: 28,
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
  previewBlock: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewOldPrice: {
    fontSize: 18,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  previewNewPrice: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: "700",
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
  // --- Linking Badge ---
  linkingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    marginBottom: 16,
  },
  linkingBadgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.primary,
    flex: 1,
  },
  // --- Preview Savings ---
  previewSavings: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
    marginTop: 4,
  },
  // --- Helper & Validation ---
  helperText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 6,
    fontWeight: "400",
  },
  validationError: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 6,
    fontWeight: "500",
  },
});

export default PricingRulesEditor;
