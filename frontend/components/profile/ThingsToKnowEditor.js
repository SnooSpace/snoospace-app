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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SwipeableModal from "../modals/SwipeableModal";
import HapticsService from "../../services/HapticsService";
import {
  Users,
  TriangleAlert,
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
  CircleX,
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
  CircleCheck,
  Check,
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

import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import GradientButton from "../ui/GradientButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  TriangleAlert,
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
  CircleX,
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
  CircleCheck,
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
    { id: "18-plus", label: "18+ only", icon: "TriangleAlert" },
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
    { id: "no-refund", label: "No refunds", icon: "CircleX" },
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
  const [stagedPresets, setStagedPresets] = useState([]);
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
    { name: "TriangleAlert", label: "Warning" },
    { name: "Heart", label: "Heart" },
    { name: "Gift", label: "Gift" },
    { name: "Ticket", label: "Ticket" },
    { name: "Clock", label: "Time" },
    { name: "MapPin", label: "Location" },
    { name: "Users", label: "People" },
    { name: "Calendar", label: "Calendar" },
  ];

  const togglePresetItem = (preset) => {
    // If already added to the list, don't allow toggling
    if (items.some((item) => item.preset_id === preset.id)) {
      return;
    }

    HapticsService.triggerImpactLight();
    setStagedPresets((prev) => {
      const exists = prev.some((p) => p.id === preset.id);
      if (exists) {
        return prev.filter((p) => p.id !== preset.id);
      } else {
        return [...prev, preset];
      }
    });
  };

  const confirmStagedPresets = () => {
    if (stagedPresets.length === 0) return;
    HapticsService.triggerImpactMedium();

    const newItems = stagedPresets.map((preset, idx) => ({
      preset_id: preset.id,
      icon_name: preset.icon,
      label: preset.label,
      order: items.length + idx,
    }));

    onChange([...items, ...newItems]);
    setStagedPresets([]);
    setShowPresets(false);
  };

  const handleOpenPresets = () => {
    setStagedPresets([]);
    setShowPresets(true);
  };

  const handleClosePresets = () => {
    setStagedPresets([]);
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
                onPress={handleOpenPresets}
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
                onPress={handleOpenPresets}
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

      {/* Presets Screen */}
      <Modal
        visible={showPresets}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePresets}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select from Presets</Text>
            <TouchableOpacity
              onPress={handleClosePresets}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <X size={20} color={TOKENS.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.presetsContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.presetsContent}
              style={styles.presetsScrollView}
            >
              {Object.entries(PRESETS).map(([category, presets]) => (
                <View key={category} style={styles.category}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {presets.map((preset) => {
                    const isAdded = items.some(
                      (item) => item.preset_id === preset.id,
                    );
                    const isStaged = stagedPresets.some(
                      (p) => p.id === preset.id,
                    );
                    const IconCmp = ICON_MAP[preset.icon] || Info;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        style={[
                          styles.presetItem,
                          isAdded && styles.presetItemAdded,
                          isStaged && styles.presetItemStaged,
                        ]}
                        onPress={() => togglePresetItem(preset)}
                        disabled={isAdded}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.presetIconContainer,
                            isAdded && styles.presetIconContainerAdded,
                            isStaged && styles.presetIconContainerStaged,
                          ]}
                        >
                          <IconCmp
                            size={18}
                            color={
                              isAdded
                                ? TOKENS.textSecondary
                                : isStaged
                                ? "#2563EB"
                                : TOKENS.primary
                            }
                            strokeWidth={2}
                          />
                        </View>
                        <Text
                          style={[
                            styles.presetLabel,
                            isAdded && styles.presetLabelAdded,
                            isStaged && styles.presetLabelStaged,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        {isAdded ? (
                          <View style={styles.checkCircleAdded}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        ) : isStaged ? (
                          <View style={styles.checkCircleStaged}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {stagedPresets.length > 0 && (
              <TouchableOpacity
                style={styles.floatingPillButton}
                onPress={confirmStagedPresets}
                activeOpacity={0.88}
              >
                <Text style={styles.floatingPillTitle}>
                  Selected {stagedPresets.length}
                </Text>
                <Text style={styles.floatingPillSubtext}>Tap to confirm</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Custom Item Modal */}
      <SwipeableModal
        visible={showCustom}
        onClose={() => {
          setShowCustom(false);
          setShowIconPicker(false);
        }}
        onRequestClose={() => {
          setShowCustom(false);
          setShowIconPicker(false);
        }}
        sheetStyle={styles.customSheet}
        avoidKeyboard
        header={
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Item</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCustom(false);
                  setShowIconPicker(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
              >
                <X size={20} color={TOKENS.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        }
      >
        <SwipeableModal.ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.customSheetContent}
        >
          <Text style={styles.label}>Icon</Text>
          <TouchableOpacity
            style={styles.iconSelector}
            onPress={() => setShowIconPicker(!showIconPicker)}
            activeOpacity={0.7}
          >
            <View style={styles.selectedIconCircle}>
              {(() => {
                const SelectedIcon = ICON_MAP[customIcon] || Info;
                return (
                  <SelectedIcon
                    size={20}
                    color={TOKENS.primary}
                    strokeWidth={2}
                  />
                );
              })()}
            </View>
            <Text style={styles.iconSelectorText}>Tap to change icon</Text>
          </TouchableOpacity>

          {showIconPicker && (
            <View style={styles.iconGrid}>
              {popularIcons.map((iconConfig) => {
                const IconCmp = ICON_MAP[iconConfig.name] || Info;
                const isSelected = customIcon === iconConfig.name;
                return (
                  <TouchableOpacity
                    key={iconConfig.name}
                    style={[
                      styles.iconOption,
                      isSelected && styles.iconOptionSelected,
                    ]}
                    onPress={() => {
                      setCustomIcon(iconConfig.name);
                      setShowIconPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconCmp
                      size={22}
                      color={isSelected ? TOKENS.primary : TOKENS.textSecondary}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        isSelected && styles.iconLabelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {iconConfig.label}
                    </Text>
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
            returnKeyType="done"
            onSubmitEditing={addCustomItem}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={addCustomItem}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>Add Item</Text>
          </TouchableOpacity>
        </SwipeableModal.ScrollView>
      </SwipeableModal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  sheetHeader: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  modalTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 20,
    color: "#111827",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  presetsScrollView: {
    flex: 1,
    backgroundColor: "#F9F9F9",
  },
  presetsContainer: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    position: "relative",
  },
  presetsContent: {
    paddingBottom: Platform.OS === "ios" ? 110 : 96,
    backgroundColor: "#F9F9F9",
  },
  customSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: "hidden",
  },
  customSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  category: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  categoryTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 12,
    color: TOKENS.primary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  presetItemAdded: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    opacity: 0.7,
  },
  presetItemStaged: {
    backgroundColor: "#EEF4FF",
    borderColor: "#2563EB",
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
  presetIconContainerStaged: {
    backgroundColor: "#DBEAFE",
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
  presetLabelStaged: {
    color: "#1E3A8A",
    fontFamily: TOKENS.fonts.semibold,
  },
  checkCircleStaged: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleAdded: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingPillButton: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 24,
    right: 20,
    backgroundColor: TOKENS.primary,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  floatingPillTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 19,
  },
  floatingPillSubtext: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 14,
    marginTop: 1,
  },
  label: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  iconSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6ECF8",
  },
  selectedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.10)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconSelectorText: {
    marginLeft: 12,
    fontFamily: TOKENS.fonts.medium,
    fontSize: 14,
    color: TOKENS.textSecondary,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconOption: {
    width: "22.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 4,
  },
  iconOptionSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  iconLabel: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  iconLabelSelected: {
    color: TOKENS.primary,
    fontFamily: TOKENS.fonts.semibold,
  },
  input: {
    fontFamily: TOKENS.fonts.regular,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TOKENS.textPrimary,
    backgroundColor: "#F9FAFB",
  },
  saveButton: {
    backgroundColor: TOKENS.primary,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: TOKENS.fonts.semibold,
  },
});

export default ThingsToKnowEditor;
