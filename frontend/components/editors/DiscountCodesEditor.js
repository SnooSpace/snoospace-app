/**
 * DiscountCodesEditor - Component for managing event discount codes
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

const DiscountCodesEditor = ({ discountCodes = [], onChange }) => {
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
  });

  const resetForm = () => {
    setCurrentCode({
      code: "",
      discount_type: "percentage",
      discount_value: "",
      max_uses: "",
      valid_from: null,
      valid_until: null,
    });
    setEditingIndex(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (index) => {
    const dc = discountCodes[index];
    setCurrentCode({
      code: dc.code || "",
      discount_type: dc.discount_type || "percentage",
      discount_value: dc.discount_value?.toString() || "",
      max_uses: dc.max_uses?.toString() || "",
      valid_from: dc.valid_from ? new Date(dc.valid_from) : null,
      valid_until: dc.valid_until ? new Date(dc.valid_until) : null,
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

    const codeData = {
      code: currentCode.code.trim().toUpperCase(),
      discount_type: currentCode.discount_type,
      discount_value: parseFloat(currentCode.discount_value),
      max_uses: currentCode.max_uses ? parseInt(currentCode.max_uses) : null,
      valid_from: currentCode.valid_from?.toISOString() || null,
      valid_until: currentCode.valid_until?.toISOString() || null,
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
      ]
    );
  };

  const formatDiscount = (dc) => {
    if (dc.discount_type === "percentage") {
      return `${dc.discount_value}% OFF`;
    }
    return `₹${dc.discount_value} OFF`;
  };

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

      {discountCodes.map((dc, index) => (
        <TouchableOpacity
          key={index}
          style={styles.codeCard}
          onPress={() => openEditModal(index)}
        >
          <View style={styles.codeInfo}>
            <Text style={styles.codeName}>{dc.code}</Text>
            <Text style={styles.codeDiscount}>{formatDiscount(dc)}</Text>
            {dc.max_uses && (
              <Text style={styles.codeLimit}>
                {dc.current_uses || 0}/{dc.max_uses} uses
              </Text>
            )}
          </View>
          <View style={styles.codeActions}>
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
                  ? "Edit Discount Code"
                  : "Add Discount Code"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Code */}
              <Text style={styles.fieldLabel}>Promo Code *</Text>
              <TextInput
                style={styles.input}
                value={currentCode.code}
                onChangeText={(text) =>
                  setCurrentCode({ ...currentCode, code: text.toUpperCase() })
                }
                placeholder="e.g., EARLYBIRD20, VIP50"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                autoCapitalize="characters"
              />

              {/* Discount Type */}
              <Text style={styles.fieldLabel}>Discount Type</Text>
              <View style={styles.typeOptions}>
                {["percentage", "flat"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      currentCode.discount_type === type &&
                        styles.typeOptionActive,
                    ]}
                    onPress={() =>
                      setCurrentCode({ ...currentCode, discount_type: type })
                    }
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        currentCode.discount_type === type &&
                          styles.typeOptionTextActive,
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

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
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
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  codeInfo: {
    flex: 1,
  },
  codeName: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
    fontFamily: "monospace",
  },
  codeDiscount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 4,
  },
  codeLimit: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  codeActions: {
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
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
  },
  typeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  typeOptionText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  typeOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
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

export default DiscountCodesEditor;
