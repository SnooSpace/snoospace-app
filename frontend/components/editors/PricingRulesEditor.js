/**
 * PricingRulesEditor - Component for managing early bird and auto-discount rules
 * Used in CreateEventModal and EditEventModal
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
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

const PricingRulesEditor = ({ pricingRules = [], onChange }) => {
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
        "Please set an end date for time-based early bird"
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
      ]
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
        <TouchableOpacity
          key={index}
          style={styles.ruleCard}
          onPress={() => openEditModal(index)}
        >
          <View style={styles.ruleInfo}>
            <Text style={styles.ruleName}>{rule.name}</Text>
            <Text style={styles.ruleDiscount}>{formatDiscount(rule)}</Text>
            <Text style={styles.ruleCondition}>{formatCondition(rule)}</Text>
          </View>
          <View style={styles.ruleActions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(index)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={LIGHT_TEXT_COLOR}
            />
          </View>
        </TouchableOpacity>
      ))}

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null
                  ? "Edit Early Bird Rule"
                  : "Add Early Bird Rule"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Rule Name */}
              <Text style={styles.fieldLabel}>Rule Name *</Text>
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
                      setCurrentRule({ ...currentRule, rule_type: type.value })
                    }
                  >
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
                    <Text style={styles.ruleTypeDesc}>{type.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Discount Type */}
              <Text style={styles.fieldLabel}>Discount Type</Text>
              <View style={styles.discountTypeRow}>
                {["percentage", "flat"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.discountTypeOption,
                      currentRule.discount_type === type &&
                        styles.discountTypeOptionActive,
                    ]}
                    onPress={() =>
                      setCurrentRule({ ...currentRule, discount_type: type })
                    }
                  >
                    <Text
                      style={[
                        styles.discountTypeText,
                        currentRule.discount_type === type &&
                          styles.discountTypeTextActive,
                      ]}
                    >
                      {type === "percentage" ? "%" : "₹"}
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

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
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
      </Modal>
    </View>
  );
};

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
  ruleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  ruleDiscount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 4,
  },
  ruleCondition: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  ruleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#FAFAFA",
  },
  typeOptions: {
    gap: 8,
  },
  ruleTypeOption: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FAFAFA",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  ruleTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  ruleTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
  },
  ruleTypeLabelActive: {
    color: COLORS.primary,
  },
  ruleTypeDesc: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    width: "100%",
    marginTop: 4,
  },
  discountTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  discountTypeOption: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },
  discountTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  discountTypeText: {
    fontSize: 18,
    fontWeight: "700",
    color: LIGHT_TEXT_COLOR,
  },
  discountTypeTextActive: {
    color: COLORS.primary,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    gap: 10,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  saveButton: {
    margin: 20,
    marginTop: 10,
    borderRadius: 30,
    overflow: "hidden",
    ...SHADOWS.primaryGlow,
  },
  saveButtonGradient: {
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default PricingRulesEditor;
