import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  Animated,
  Platform,
  Keyboard,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Star,
  Trophy,
  Music,
  Utensils,
  Gift,
  Users,
  Heart,
  Sparkles,
  Ticket,
  Ribbon,
  Megaphone,
  Zap,
  Check,
  X,
  Plus,
  PlusCircle,
  Trash2,
  Pencil,
  CircleStar,
} from "lucide-react-native";

// Local mirroring of MODAL_TOKENS for consistency
const TOKENS = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  surface: "#F5F8FF",
  background: "#FFFFFF",
  border: "#E6ECF8",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  error: "#EF4444",
  success: "#10B981",
  radius: { xs: 8, sm: 12, md: 14, lg: 16, xl: 24 },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
  },
  fonts: {
    regular: "Manrope-Regular",
    medium: "Manrope-Medium",
    semibold: "Manrope-SemiBold",
    bold: "BasicCommercial-Bold",
  },
};

const popularIcons = [
  { name: "Star", icon: Star, label: "Star" },
  { name: "Trophy", icon: Trophy, label: "Trophy" },
  { name: "Music", icon: Music, label: "Music" },
  { name: "Utensils", icon: Utensils, label: "Food" },
  { name: "Gift", icon: Gift, label: "Gift" },
  { name: "Users", icon: Users, label: "People" },
  { name: "Heart", icon: Heart, label: "Heart" },
  { name: "Sparkles", icon: Sparkles, label: "Sparkles" },
  { name: "Ticket", icon: Ticket, label: "Ticket" },
  { name: "Ribbon", icon: Ribbon, label: "Ribbon" },
  { name: "Megaphone", icon: Megaphone, label: "Megaphone" },
  { name: "Zap", icon: Zap, label: "Flash" },
];

const getIconComponent = (iconName) => {
  const mapping = {
    "star-outline": Star,
    Star: Star,
    "trophy-outline": Trophy,
    Trophy: Trophy,
    "musical-notes-outline": Music,
    Music: Music,
    "restaurant-outline": Utensils,
    Utensils: Utensils,
    "gift-outline": Gift,
    Gift: Gift,
    "people-outline": Users,
    Users: Users,
    "heart-outline": Heart,
    Heart: Heart,
    "sparkles-outline": Sparkles,
    Sparkles: Sparkles,
    "ticket-outline": Ticket,
    Ticket: Ticket,
    "ribbon-outline": Ribbon,
    Ribbon: Ribbon,
    "megaphone-outline": Megaphone,
    Megaphone: Megaphone,
    "flash-outline": Zap,
    Zap: Zap,
  };
  return mapping[iconName] || Star;
};

const HighlightsEditor = ({ highlights = [], onChange, maxHighlights = 5 }) => {
  const [showModal, setShowModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentHighlight, setCurrentHighlight] = useState({
    icon_name: "Star",
    title: "",
    description: "",
    order: 0,
  });
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Per-item entry animation refs
  const entryAnims = useRef({});

  const getEntryAnim = (index) => {
    if (!entryAnims.current[index]) {
      entryAnims.current[index] = {
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(12),
      };
    }
    return entryAnims.current[index];
  };

  useEffect(() => {
    // Animate new items in
    highlights.forEach((_, index) => {
      const anim = getEntryAnim(index);
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [highlights.length]);

  // Success animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

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

  const descriptionWords = currentHighlight.description
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  useEffect(() => {
    if (descriptionWords >= 50) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 10,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [descriptionWords, fadeAnim, slideAnim]);

  const addHighlight = () => {
    if (highlights.length >= maxHighlights) {
      Alert.alert(
        "Limit Reached",
        `You can add up to ${maxHighlights} highlights.`,
      );
      return;
    }
    setEditingIndex(null);
    setCurrentHighlight({
      icon_name: "Star",
      title: "",
      description: "",
      order: highlights.length,
    });
    setShowIconPicker(false);
    setShowModal(true);
  };

  const editHighlight = (index) => {
    setEditingIndex(index);
    setCurrentHighlight({ ...highlights[index] });
    setShowIconPicker(false);
    setShowModal(true);
  };

  const saveHighlight = () => {
    if (!currentHighlight.title.trim()) {
      Alert.alert("Required", "Please enter a title for the highlight.");
      return;
    }

    if (editingIndex !== null) {
      const updated = [...highlights];
      updated[editingIndex] = currentHighlight;
      onChange(updated);
    } else {
      onChange([...highlights, currentHighlight]);
    }

    setCurrentHighlight({
      icon_name: "Star",
      title: "",
      description: "",
      order: 0,
    });
    setEditingIndex(null);
    setShowModal(false);
  };

  const deleteHighlight = (index) => {
    Alert.alert(
      "Delete Highlight",
      "Are you sure you want to delete this highlight?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updated = highlights.filter((_, i) => i !== index);
            const reordered = updated.map((h, i) => ({ ...h, order: i }));
            onChange(reordered);
          },
        },
      ],
    );
  };

  const renderHighlightCard = ({ item, index }) => {
    const IconComp = getIconComponent(item.icon_name);
    const anim = getEntryAnim(index);
    return (
      <Animated.View
        style={[
          styles.highlightCard,
          {
            opacity: anim.opacity,
            transform: [{ translateY: anim.translateY }],
          },
        ]}
      >
        <View style={styles.highlightHeader}>
          <View style={styles.iconTitleRow}>
            <View style={styles.cardIconCircle}>
              <IconComp size={20} color={"#4B5563"} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.highlightTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.highlightDescription}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => editHighlight(index)}
              style={styles.actionIconButton}
            >
              <Pencil size={18} color={TOKENS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteHighlight(index)}
              style={styles.actionIconButton}
            >
              <Trash2 size={18} color={TOKENS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const CurrentIconComp = getIconComponent(currentHighlight.icon_name);

  return (
    <View style={styles.container}>
      {/* 2️⃣ Strengthen Section Header Hierarchy */}
      <View style={styles.sectionHeaderNew}>
        <View style={styles.sectionHeaderTitleRow}>
          <View style={styles.sectionHeaderIconContainer}>
            <CircleStar size={24} color={TOKENS.primary} strokeWidth={2} />
          </View>
          <Text style={styles.sectionHeaderTitle}>
            Highlights{" "}
            <Text style={styles.sectionHeaderOptional}>•(Optional)</Text>
          </Text>
        </View>
        <Text style={styles.sectionHeaderCounter}>
          {highlights.length} of {maxHighlights} added
        </Text>
        <Text style={styles.sectionHeaderHelper}>
          Showcase what makes your event special
        </Text>
      </View>

      {/* 3️⃣ Add Primary Surface Container */}
      <View style={styles.surfaceContainer}>
        {highlights.length > 0 && (
          <FlatList
            data={highlights}
            renderItem={renderHighlightCard}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
            contentContainerStyle={{
              gap: 12,
              paddingBottom: highlights.length < maxHighlights ? 16 : 0,
            }}
          />
        )}

        {/* 4️⃣ Elevated Action Tile */}
        {highlights.length < maxHighlights ? (
          <TouchableOpacity
            style={styles.actionTile}
            onPress={addHighlight}
            activeOpacity={0.8}
          >
            <Plus size={22} color={TOKENS.primary} strokeWidth={2.5} />
            <Text style={styles.actionTileTitle}>Add Highlight</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionTileDisabled}>
            <Text style={styles.actionTileDisabledText}>
              Maximum highlights reached
            </Text>
          </View>
        )}
      </View>

      {/* Edit/Add Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                paddingBottom:
                  Platform.OS === "ios"
                    ? keyboardHeight + 40
                    : keyboardHeight + 24,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? "Edit Highlight" : "Add Highlight"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setCurrentHighlight({
                    icon_name: "Star",
                    title: "",
                    description: "",
                    order: 0,
                  });
                  setEditingIndex(null);
                  setShowIconPicker(false);
                  setShowModal(false);
                }}
              >
                <X size={24} color={"#111827"} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Icon Picker */}
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {popularIcons.map((icon) => {
                  const IconComponent = icon.icon;
                  const isSelected = currentHighlight.icon_name === icon.name;
                  return (
                    <TouchableOpacity
                      key={icon.name}
                      style={[
                        styles.iconOption,
                        isSelected && styles.iconOptionSelected,
                      ]}
                      onPress={() => {
                        setCurrentHighlight({
                          ...currentHighlight,
                          icon_name: icon.name,
                        });
                        setShowIconPicker(false);
                      }}
                    >
                      <IconComponent
                        size={24}
                        color={isSelected ? "#FFFFFF" : TOKENS.textSecondary}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.iconLabel,
                          isSelected && styles.iconLabelSelected,
                        ]}
                      >
                        {icon.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <Text style={styles.label}>
                Title <Text style={{ color: TOKENS.textPrimary }}></Text>
              </Text>
              <TextInput
                style={styles.input}
                value={currentHighlight.title}
                onChangeText={(text) =>
                  setCurrentHighlight({ ...currentHighlight, title: text })
                }
                placeholder="Why this event stands out"
                placeholderTextColor={"#9CA3AF"}
                maxLength={50}
              />

              {/* Description Input */}
              <Text style={styles.label}>Description • Optional</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={currentHighlight.description}
                onChangeText={(text) =>
                  setCurrentHighlight({
                    ...currentHighlight,
                    description: text,
                  })
                }
                placeholder="Brief explanation..."
                placeholderTextColor={"#9CA3AF"}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Animated Success Message (Appears when word count >= 50) */}
              <Animated.View
                pointerEvents={descriptionWords >= 50 ? "auto" : "none"}
                style={[
                  styles.animatedCheckmarkContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                    height: descriptionWords >= 50 ? "auto" : 0,
                    overflow: "hidden",
                  },
                ]}
              >
                <View style={styles.iconCircleCustom}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
                <Text style={styles.validText}>Description looks good!</Text>
              </Animated.View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveHighlight}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.saveButtonGradient,
                    { backgroundColor: TOKENS.primary },
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {editingIndex !== null
                      ? "Update Highlight"
                      : "Add Highlight"}
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  sectionHeaderNew: {
    marginBottom: 0,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionHeaderIconContainer: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 22,
    color: TOKENS.textPrimary,
  },
  sectionHeaderOptional: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: "#9CA3AF",
  },
  sectionHeaderCounter: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 13,
    color: TOKENS.textPrimary,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeaderHelper: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  surfaceContainer: {
    backgroundColor: "#F4F7FB",
    borderRadius: 24,
    padding: 20,
    marginTop: 16,
  },
  highlightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  highlightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  highlightTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.textPrimary,
  },
  highlightDescription: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  actionTile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  actionTileTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.primary,
    marginLeft: 8,
  },
  actionTileDisabled: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  actionTileDisabledText: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 13,
    color: "#9CA3AF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  modalTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 22,
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  label: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
    marginTop: 20,
  },
  iconSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconSelectorText: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 15,
    color: "#9CA3AF",
    marginLeft: 12,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 10,
    justifyContent: "space-between",
  },
  iconOption: {
    width: "22%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconOptionSelected: {
    backgroundColor: "#4B5563",
    borderColor: "#1F2937",
    borderWidth: 1,
  },
  iconLabel: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginBottom: 8,
    height: 16,
    textAlign: "center",
  },
  iconLabelSelected: {
    color: "#FFFFFF",
    fontFamily: TOKENS.fonts.semibold,
  },
  input: {
    fontFamily: TOKENS.fonts.medium,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1F2937",
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    textAlignVertical: "top",
  },
  saveButton: {
    borderRadius: 16,
    marginTop: 36,
  },
  saveButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  saveButtonText: {
    fontFamily: TOKENS.fonts.semibold,
    color: "#FFFFFF",
    fontSize: 16,
  },
  animatedCheckmarkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: TOKENS.radius.xl,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  iconCircleCustom: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOKENS.success,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  validText: {
    fontSize: 13,
    color: "#166534",
    fontFamily: TOKENS.fonts.semibold,
  },
});

export default HighlightsEditor;
