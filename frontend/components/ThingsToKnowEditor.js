import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, FONTS } from "../constants/theme";

// Local constants removed in favor of theme constants

// 40+ Presets across 7 categories
const PRESETS = {
  "Age & Entry": [
    { id: "all-ages", label: "All ages allowed", icon: "people-outline" },
    { id: "18-plus", label: "18+ only", icon: "warning-outline" },
    { id: "21-plus", label: "21+ only (ID required)", icon: "card-outline" },
    { id: "family-friendly", label: "Family-friendly", icon: "happy-outline" },
    { id: "kids-free", label: "Kids under 12 free", icon: "gift-outline" },
    {
      id: "student-discount",
      label: "Student discount available",
      icon: "school-outline",
    },
    {
      id: "senior-discount",
      label: "Senior discount available",
      icon: "heart-outline",
    },
  ],
  "Language & Accessibility": [
    { id: "english", label: "English language", icon: "language-outline" },
    {
      id: "multilingual",
      label: "Multilingual support",
      icon: "globe-outline",
    },
    {
      id: "wheelchair",
      label: "Wheelchair accessible",
      icon: "accessibility-outline",
    },
    {
      id: "sign-language",
      label: "Sign language interpreter",
      icon: "hand-left-outline",
    },
  ],
  "Food & Beverages": [
    { id: "food-included", label: "Food included", icon: "restaurant-outline" },
    { id: "drinks-included", label: "Drinks included", icon: "wine-outline" },
    {
      id: "food-available",
      label: "Food available for purchase",
      icon: "fast-food-outline",
    },
    { id: "byob", label: "BYOB allowed", icon: "beer-outline" },
    {
      id: "vegan-options",
      label: "Vegan options available",
      icon: "leaf-outline",
    },
  ],
  "Venue & Logistics": [
    { id: "parking-free", label: "Free parking", icon: "car-outline" },
    {
      id: "parking-paid",
      label: "Paid parking available",
      icon: "card-outline",
    },
    {
      id: "public-transit",
      label: "Public transit nearby",
      icon: "bus-outline",
    },
    { id: "indoor", label: "Indoor venue", icon: "home-outline" },
    { id: "outdoor", label: "Outdoor venue", icon: "sunny-outline" },
    { id: "covered", label: "Covered area", icon: "umbrella-outline" },
    { id: "restrooms", label: "Restrooms available", icon: "water-outline" },
    { id: "wifi", label: "WiFi available", icon: "wifi-outline" },
    {
      id: "charging",
      label: "Phone charging stations",
      icon: "phone-portrait-outline",
    },
    { id: "coat-check", label: "Coat check available", icon: "shirt-outline" },
  ],
  Policies: [
    { id: "no-refund", label: "No refunds", icon: "close-circle-outline" },
    {
      id: "refund-7days",
      label: "Refund up to 7 days before",
      icon: "time-outline",
    },
    {
      id: "transferable",
      label: "Tickets are transferable",
      icon: "swap-horizontal-outline",
    },
    {
      id: "no-recording",
      label: "No photo/video recording",
      icon: "camera-outline",
    },
    { id: "pets-allowed", label: "Pets allowed", icon: "paw-outline" },
    { id: "no-pets", label: "No pets allowed", icon: "paw-outline" },
    { id: "no-smoking", label: "No smoking", icon: "ban-outline" },
    { id: "dress-code", label: "Dress code enforced", icon: "shirt-outline" },
    { id: "bring-id", label: "Bring valid ID", icon: "id-card-outline" },
  ],
  "Safety & Health": [
    {
      id: "security",
      label: "Security present",
      icon: "shield-checkmark-outline",
    },
    { id: "first-aid", label: "First aid available", icon: "medical-outline" },
    {
      id: "sanitizer",
      label: "Hand sanitizer stations",
      icon: "hand-right-outline",
    },
    {
      id: "masks-recommended",
      label: "Masks recommended",
      icon: "bandage-outline",
    },
  ],
  Ticketing: [
    { id: "ticket-required", label: "Ticket required", icon: "ticket-outline" },
    { id: "free-entry", label: "Free entry", icon: "pricetag-outline" },
    {
      id: "limited-seats",
      label: "Limited seating",
      icon: "hourglass-outline",
    },
    { id: "early-bird", label: "Early bird pricing", icon: "flash-outline" },
    {
      id: "group-discount",
      label: "Group discounts available",
      icon: "people-outline",
    },
  ],
};

/**
 * ThingsToKnowEditor - Select presets or add custom items (min 3 required)
 */
const ThingsToKnowEditor = ({ items = [], onChange, minItems = 3 }) => {
  const [showPresets, setShowPresets] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("information-circle-outline");

  // Popular icons for custom items
  const popularIcons = [
    { name: "information-circle-outline", label: "Info" },
    { name: "checkmark-circle-outline", label: "Check" },
    { name: "warning-outline", label: "Warning" },
    { name: "alert-circle-outline", label: "Alert" },
    { name: "star-outline", label: "Star" },
    { name: "heart-outline", label: "Heart" },
    { name: "gift-outline", label: "Gift" },
    { name: "ticket-outline", label: "Ticket" },
    { name: "time-outline", label: "Time" },
    { name: "location-outline", label: "Location" },
    { name: "people-outline", label: "People" },
    { name: "calendar-outline", label: "Calendar" },
  ];

  const addPresetItem = (preset, category) => {
    // Check if already added
    if (items.some((item) => item.preset_id === preset.id)) {
      Alert.alert("Already Added", "This item is already in your list.");
      return;
    }

    const newItem = {
      preset_id: preset.id,
      icon_name: preset.icon,
      label: preset.label,
      order: items.length,
    };

    onChange([...items, newItem]);
    setShowPresets(false);
  };

  const addCustomItem = () => {
    if (!customLabel.trim()) {
      Alert.alert("Required", "Please enter a label for your custom item.");
      return;
    }

    const newItem = {
      preset_id: null,
      icon_name: customIcon,
      label: customLabel.trim(),
      order: items.length,
    };

    onChange([...items, newItem]);
    setCustomLabel("");
    setCustomIcon("information-circle-outline");
    setShowIconPicker(false);
    setShowCustom(false);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    const reordered = updated.map((item, i) => ({ ...item, order: i }));
    onChange(reordered);
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <Ionicons name={item.icon_name} size={20} color={COLORS.primary} />
        <Text style={styles.itemLabel}>{item.label}</Text>
      </View>
      <TouchableOpacity onPress={() => removeItem(index)}>
        <Ionicons name="close-circle" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  const isValid = items.length >= minItems;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Things to Know *</Text>
        <Text style={[styles.subtitle, !isValid && styles.subtitleInvalid]}>
          {items.length} items • Min {minItems} required
        </Text>
      </View>

      {/* Items List */}
      {items.length > 0 && (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          style={styles.list}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowPresets(true)}
        >
          <Ionicons name="list-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionButtonText}>Browse Presets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowCustom(true)}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.actionButtonText}>Add Custom</Text>
        </TouchableOpacity>
      </View>

      {!isValid && (
        <Text style={styles.helperText}>
          Add at least {minItems - items.length} more item
          {minItems - items.length > 1 ? "s" : ""}
        </Text>
      )}

      {/* Presets Modal */}
      <Modal
        visible={showPresets}
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select from Presets</Text>
            <TouchableOpacity onPress={() => setShowPresets(false)}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {Object.entries(PRESETS).map(([category, presets]) => (
              <View key={category} style={styles.category}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {presets.map((preset) => {
                  const isAdded = items.some(
                    (item) => item.preset_id === preset.id,
                  );
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetItem,
                        isAdded && styles.presetItemAdded,
                      ]}
                      onPress={() =>
                        !isAdded && addPresetItem(preset, category)
                      }
                      disabled={isAdded}
                    >
                      <Ionicons
                        name={preset.icon}
                        size={20}
                        color={isAdded ? COLORS.textSecondary : COLORS.primary}
                      />
                      <Text
                        style={[
                          styles.presetLabel,
                          isAdded && styles.presetLabelAdded,
                        ]}
                      >
                        {preset.label}
                      </Text>
                      {isAdded && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#34C759"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Custom Item Modal */}
      <Modal
        visible={showCustom}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Item</Text>
              <TouchableOpacity onPress={() => setShowCustom(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icon</Text>
            <TouchableOpacity
              style={styles.iconSelector}
              onPress={() => setShowIconPicker(!showIconPicker)}
            >
              <Ionicons name={customIcon} size={32} color={COLORS.primary} />
              <Text style={styles.iconSelectorText}>Tap to change icon</Text>
            </TouchableOpacity>

            {showIconPicker && (
              <View style={styles.iconGrid}>
                {popularIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon.name}
                    style={[
                      styles.iconOption,
                      customIcon === icon.name && styles.iconOptionSelected,
                    ]}
                    onPress={() => {
                      setCustomIcon(icon.name);
                      setShowIconPicker(false);
                    }}
                  >
                    <Ionicons
                      name={icon.name}
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.iconLabel}>{icon.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Label *</Text>
            <TextInput
              style={styles.input}
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="e.g., 'Bring your own chair'"
              placeholderTextColor="#9CA3AF"
              maxLength={60}
            />

            <TouchableOpacity style={styles.saveButton} onPress={addCustomItem}>
              <Text style={styles.saveButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  subtitleInvalid: {
    color: "#FF3B30",
  },
  list: {
    marginBottom: 15,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F5FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DBFF",
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 10,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: "#F8F5FF",
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  helperText: {
    fontSize: 12,
    color: "#FF3B30",
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
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
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  category: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8F5FF",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5DBFF",
  },
  presetItemAdded: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E5E5EA",
  },
  presetLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginLeft: 10,
    flex: 1,
  },
  presetLabelAdded: {
    color: COLORS.textSecondary,
  },
  customModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: 15,
    marginBottom: 8,
  },
  iconPreview: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
  },
  iconSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  iconSelectorText: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 10,
  },
  iconOption: {
    width: "22%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F8F5FF",
  },
  iconLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ThingsToKnowEditor;
