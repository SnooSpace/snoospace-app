import React, { useState, useEffect } from "react";
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
  Platform,
  StatusBar,
  Keyboard,
  Animated,
} from "react-native";
import {
  Users,
  AlertTriangle,
  CreditCard,
  Smile,
  Gift,
  GraduationCap,
  Heart,
  Languages,
  Globe,
  Accessibility,
  Hand,
  Utensils,
  Wine,
  Coffee,
  Beer,
  Leaf,
  Car,
  Bus,
  Home,
  Sun,
  Umbrella,
  Droplets,
  Wifi,
  Smartphone,
  Shirt,
  XCircle,
  Clock,
  ArrowRightLeft,
  CameraOff,
  Dog,
  Ban,
  IdCard,
  ShieldCheck,
  BriefcaseMedical,
  Shield,
  Tag,
  Hourglass,
  Zap,
  Ticket,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Info,
  Plus,
  X,
  List,
  Trash2,
  PenLine,
  Edit2,
  RockingChair,
} from "lucide-react-native";

import { COLORS, FONTS, SHADOWS } from "../constants/theme";
import GradientButton from "./GradientButton";

// Typography constants
const TOKENS = {
  primary: "#3565F2",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  error: "#EF4444",
  success: "#10B981",
  fonts: {
    regular: "Manrope-Regular",
    medium: "Manrope-Medium",
    semibold: "Manrope-SemiBold",
    bold: "BasicCommercial-Bold",
  },
};

const ICON_MAP = {
  Users,
  AlertTriangle,
  CreditCard,
  Smile,
  Gift,
  GraduationCap,
  Heart,
  Languages,
  Globe,
  Accessibility,
  Hand,
  Utensils,
  Wine,
  Coffee,
  Beer,
  Leaf,
  Car,
  Bus,
  Home,
  Sun,
  Umbrella,
  Droplets,
  Wifi,
  Smartphone,
  Shirt,
  XCircle,
  Clock,
  ArrowRightLeft,
  CameraOff,
  Dog,
  Ban,
  IdCard,
  ShieldCheck,
  BriefcaseMedical,
  Shield,
  Tag,
  Hourglass,
  Zap,
  Ticket,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Info,
  Plus,
  X,
  List,
  Trash2,
  PenLine,
  Edit2,
  RockingChair,
};

const PRESETS = {
  "Age & Entry": [
    { id: "all-ages", label: "All ages allowed", icon: "Users" },
    { id: "18-plus", label: "18+ only", icon: "AlertTriangle" },
    { id: "21-plus", label: "21+ only (ID required)", icon: "CreditCard" },
    { id: "family-friendly", label: "Family-friendly", icon: "Smile" },
    { id: "kids-free", label: "Kids under 12 free", icon: "Gift" },
    {
      id: "student-discount",
      label: "Student discount available",
      icon: "GraduationCap",
    },
    {
      id: "senior-discount",
      label: "Senior discount available",
      icon: "Heart",
    },
  ],
  "Language & Accessibility": [
    { id: "english", label: "English language", icon: "Languages" },
    { id: "multilingual", label: "Multilingual support", icon: "Globe" },
    { id: "wheelchair", label: "Wheelchair accessible", icon: "Accessibility" },
    { id: "sign-language", label: "Sign language interpreter", icon: "Hand" },
  ],
  "Food & Beverages": [
    { id: "food-included", label: "Food included", icon: "Utensils" },
    { id: "drinks-included", label: "Drinks included", icon: "Wine" },
    {
      id: "food-available",
      label: "Food available for purchase",
      icon: "Coffee",
    },
    { id: "byob", label: "BYOB allowed", icon: "Beer" },
    { id: "vegan-options", label: "Vegan options available", icon: "Leaf" },
  ],
  "Venue & Logistics": [
    { id: "parking-free", label: "Free parking", icon: "Car" },
    { id: "parking-paid", label: "Paid parking available", icon: "CreditCard" },
    { id: "public-transit", label: "Public transit nearby", icon: "Bus" },
    { id: "indoor", label: "Indoor venue", icon: "Home" },
    { id: "outdoor", label: "Outdoor venue", icon: "Sun" },
    { id: "covered", label: "Covered area", icon: "Umbrella" },
    { id: "restrooms", label: "Restrooms available", icon: "Droplets" },
    { id: "wifi", label: "WiFi available", icon: "Wifi" },
    { id: "charging", label: "Phone charging stations", icon: "Smartphone" },
    { id: "coat-check", label: "Coat check available", icon: "Shirt" },
  ],
  Policies: [
    { id: "no-refund", label: "No refunds", icon: "XCircle" },
    { id: "refund-7days", label: "Refund up to 7 days before", icon: "Clock" },
    {
      id: "transferable",
      label: "Tickets are transferable",
      icon: "ArrowRightLeft",
    },
    {
      id: "no-recording",
      label: "No photo/video recording",
      icon: "CameraOff",
    },
    { id: "pets-allowed", label: "Pets allowed", icon: "Dog" },
    { id: "no-pets", label: "No pets allowed", icon: "Ban" },
    { id: "no-smoking", label: "No smoking", icon: "Ban" },
    { id: "dress-code", label: "Dress code enforced", icon: "Shirt" },
    { id: "bring-id", label: "Bring valid ID", icon: "IdCard" },
  ],
  "Safety & Health": [
    { id: "security", label: "Security present", icon: "ShieldCheck" },
    { id: "first-aid", label: "First aid available", icon: "BriefcaseMedical" },
    { id: "sanitizer", label: "Hand sanitizer stations", icon: "Droplets" },
    { id: "masks-recommended", label: "Masks recommended", icon: "Shield" },
  ],
  Ticketing: [
    { id: "ticket-required", label: "Ticket required", icon: "Ticket" },
    { id: "free-entry", label: "Free entry", icon: "Tag" },
    { id: "limited-seats", label: "Limited seating", icon: "Hourglass" },
    { id: "early-bird", label: "Early bird pricing", icon: "Zap" },
    { id: "group-discount", label: "Group discounts available", icon: "Users" },
  ],
};

const ThingsToKnowEditor = ({ items = [], onChange, minItems = 3 }) => {
  const [showPresets, setShowPresets] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("Info");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Popular icons for custom items
  const popularIcons = [
    { name: "Info", label: "Info" },
    { name: "RockingChair", label: "Seating" },
    { name: "Shirt", label: "Dress Code" },
    { name: "AlertTriangle", label: "Warning" },
    { name: "Heart", label: "Heart" },
    { name: "Gift", label: "Gift" },
    { name: "Ticket", label: "Ticket" },
    { name: "Clock", label: "Time" },
    { name: "MapPin", label: "Location" },
    { name: "Users", label: "People" },
    { name: "Calendar", label: "Calendar" },
  ];

  const addPresetItem = (preset) => {
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
    setCustomIcon("Info");
    setShowIconPicker(false);
    setShowCustom(false);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    const reordered = updated.map((item, i) => ({ ...item, order: i }));
    onChange(reordered);
  };

  // Render Card Item
  const renderItem = ({ item, index }) => {
    const IconCmp = ICON_MAP[item.icon_name] || Info;
    return (
      <View style={styles.cardItem}>
        <View style={styles.cardItemLeft}>
          <View style={styles.cardIconContainer}>
            <IconCmp size={16} color={TOKENS.primary} strokeWidth={2} />
          </View>
          <Text style={styles.cardItemLabel}>{item.label}</Text>
        </View>
        <TouchableOpacity
          style={styles.cardItemAction}
          onPress={() => removeItem(index)}
        >
          <Trash2 size={18} color={TOKENS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const isValid = items.length >= minItems;

  return (
    <View style={styles.container}>
      <View style={styles.softContainer}>
        {items.length === 0 ? (
          // Empty State
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconContainer}>
              <Info size={28} color={TOKENS.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyStateTitle}>
              Add important details for attendees
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Dress code, age limits, arrival instructions, etc.
            </Text>

            <View
              style={{
                flexDirection: "column",
                gap: 10,
                width: "100%",
                marginBottom: 12,
              }}
            >
              <GradientButton
                title="Browse Presets"
                onPress={() => setShowPresets(true)}
                style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}
                gradientStyle={{ borderRadius: 16, paddingVertical: 14 }}
                textStyle={{ fontFamily: TOKENS.fonts.semibold }}
              />
              <GradientButton
                title="Add Custom"
                onPress={() => setShowCustom(true)}
                style={{
                  width: "100%",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(68, 138, 255, 0.2)",
                  backgroundColor: "rgba(68, 138, 255, 0.12)",
                  shadowColor: "transparent",
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  elevation: 0,
                  overflow: "hidden",
                }}
                gradientStyle={{
                  borderRadius: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
                colors={["transparent", "transparent"]}
                textStyle={{
                  fontFamily: TOKENS.fonts.medium,
                  color: "#2962FF",
                }}
              />
            </View>
          </View>
        ) : (
          // Populated State
          <View style={styles.populatedState}>
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
              style={styles.list}
            />
            <View style={{ flexDirection: "column", gap: 10, width: "100%" }}>
              <GradientButton
                title="Browse Presets"
                icon={<List size={18} color="#FFFFFF" strokeWidth={2.5} />}
                onPress={() => setShowPresets(true)}
                style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}
                gradientStyle={{
                  borderRadius: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 14,
                }}
                textStyle={{ fontFamily: TOKENS.fonts.semibold, fontSize: 14 }}
              />
              <GradientButton
                title="Add Custom"
                icon={<Plus size={18} color="#2962FF" strokeWidth={2.5} />}
                onPress={() => setShowCustom(true)}
                style={{
                  width: "100%",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(68, 138, 255, 0.2)",
                  backgroundColor: "rgba(68, 138, 255, 0.12)",
                  shadowColor: "transparent",
                  shadowOpacity: 0,
                  shadowRadius: 0,
                  elevation: 0,
                  overflow: "hidden",
                }}
                gradientStyle={{
                  borderRadius: 0,
                  paddingHorizontal: 10,
                  paddingVertical: 14,
                }}
                colors={["transparent", "transparent"]}
                textStyle={{
                  fontFamily: TOKENS.fonts.medium,
                  color: "#2962FF",
                  fontSize: 14,
                }}
              />
            </View>
          </View>
        )}

        {/* Requirement Note below the content, inside container or outside? 
            User Spec: "Requirement note at bottom of container in small caption." */}
        <View style={styles.requirementContainer}>
          <Text style={styles.requirementText}>
            {isValid
              ? `${items.length} items added`
              : `Add at least ${minItems - items.length} item${minItems - items.length > 1 ? "s" : ""} to continue`}
          </Text>
        </View>
      </View>

      {/* Presets Modal */}
      <Modal
        visible={showPresets}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPresets(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select from Presets</Text>
            <TouchableOpacity onPress={() => setShowPresets(false)}>
              <X size={28} color={TOKENS.textPrimary} strokeWidth={2} />
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
                  const IconCmp = ICON_MAP[preset.icon] || Info;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetItem,
                        isAdded && styles.presetItemAdded,
                      ]}
                      onPress={() => !isAdded && addPresetItem(preset)}
                      disabled={isAdded}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.presetIconContainer,
                          isAdded && styles.presetIconContainerAdded,
                        ]}
                      >
                        <IconCmp
                          size={18}
                          color={
                            isAdded ? TOKENS.textSecondary : TOKENS.primary
                          }
                          strokeWidth={2}
                        />
                      </View>
                      <Text
                        style={[
                          styles.presetLabel,
                          isAdded && styles.presetLabelAdded,
                        ]}
                      >
                        {preset.label}
                      </Text>
                      {isAdded && (
                        <CheckCircle
                          size={20}
                          color={TOKENS.success}
                          strokeWidth={2}
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
        onRequestClose={() => setShowCustom(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.customModal,
              {
                paddingBottom:
                  Platform.OS === "ios"
                    ? keyboardHeight + 40
                    : keyboardHeight + 24,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Item</Text>
              <TouchableOpacity onPress={() => setShowCustom(false)}>
                <X size={24} color={TOKENS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icon</Text>
            <TouchableOpacity
              style={styles.iconSelector}
              onPress={() => setShowIconPicker(!showIconPicker)}
            >
              {(() => {
                const SelectedIcon = ICON_MAP[customIcon] || Info;
                return (
                  <SelectedIcon
                    size={24}
                    color={TOKENS.primary}
                    strokeWidth={2}
                  />
                );
              })()}
              <Text style={styles.iconSelectorText}>Tap to change icon</Text>
            </TouchableOpacity>

            {showIconPicker && (
              <View style={styles.iconGrid}>
                {popularIcons.map((iconConfig) => {
                  const IconCmp = ICON_MAP[iconConfig.name] || Info;
                  return (
                    <TouchableOpacity
                      key={iconConfig.name}
                      style={[
                        styles.iconOption,
                        customIcon === iconConfig.name &&
                          styles.iconOptionSelected,
                      ]}
                      onPress={() => {
                        setCustomIcon(iconConfig.name);
                        setShowIconPicker(false);
                      }}
                    >
                      <IconCmp
                        size={24}
                        color={TOKENS.primary}
                        strokeWidth={2}
                      />
                      <Text style={styles.iconLabel}>{iconConfig.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.label}>Label</Text>
            <TextInput
              style={styles.input}
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="e.g., 'Bring your own chair'"
              placeholderTextColor={TOKENS.textMuted}
              maxLength={60}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={addCustomItem}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Add Item</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  softContainer: {
    backgroundColor: "#F4F6FA",
    borderRadius: 24,
    padding: 20,
    marginTop: 10,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 10,
  },
  emptyStateIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E6ECF8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 16,
    color: TOKENS.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: TOKENS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  populatedState: {
    flex: 1,
    marginTop: 8,
  },
  list: {
    marginBottom: 16,
  },
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F6FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardItemLabel: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 15,
    color: TOKENS.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  cardItemAction: {
    padding: 6,
  },
  requirementContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  requirementText: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: "center",
  },
  requirementInvalid: {
    color: TOKENS.error,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  customModal: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 20,
    color: "#111827",
  },
  category: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 13,
    color: TOKENS.primary,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E6ECF8",
  },
  presetItemAdded: {
    backgroundColor: "#F9FAFB",
    borderColor: "#F3F4F6",
    opacity: 0.7,
  },
  presetIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F6FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  presetIconContainerAdded: {
    backgroundColor: "#E5E7EB",
  },
  presetLabel: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 15,
    color: TOKENS.textPrimary,
    flex: 1,
  },
  presetLabelAdded: {
    color: TOKENS.textSecondary,
  },
  label: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#374151",
    marginTop: 20,
    marginBottom: 8,
  },
  iconSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6ECF8",
  },
  iconSelectorText: {
    marginLeft: 12,
    fontFamily: TOKENS.fonts.medium,
    fontSize: 15,
    color: TOKENS.textSecondary,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  iconOption: {
    width: "22%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconOptionSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: "#F4F6FA",
  },
  iconLabel: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  input: {
    fontFamily: TOKENS.fonts.regular,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: TOKENS.textPrimary,
    backgroundColor: "#F9FAFB",
  },
  saveButton: {
    backgroundColor: TOKENS.primary,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 28,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: TOKENS.fonts.semibold,
  },
});

export default ThingsToKnowEditor;
