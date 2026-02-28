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
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS, FONTS } from "../constants/theme";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

/**
 * HighlightsEditor - Add/edit highlight cards (0-5)
 * Each highlight has: icon, title, description
 */
const HighlightsEditor = ({ highlights = [], onChange, maxHighlights = 5 }) => {
  const [showModal, setShowModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentHighlight, setCurrentHighlight] = useState({
    icon_name: "star-outline",
    title: "",
    description: "",
    order: 0,
  });

  const descriptionWords = currentHighlight.description
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const slideAnim = useRef(new Animated.Value(10)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  // Popular event-related icons
  const popularIcons = [
    { name: "star-outline", label: "Star" },
    { name: "trophy-outline", label: "Trophy" },
    { name: "musical-notes-outline", label: "Music" },
    { name: "restaurant-outline", label: "Food" },
    { name: "gift-outline", label: "Gift" },
    { name: "people-outline", label: "People" },
    { name: "heart-outline", label: "Heart" },
    { name: "sparkles-outline", label: "Sparkles" },
    { name: "ticket-outline", label: "Ticket" },
    { name: "ribbon-outline", label: "Ribbon" },
    { name: "megaphone-outline", label: "Megaphone" },
    { name: "flash-outline", label: "Flash" },
  ];

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
      icon_name: "star-outline",
      title: "",
      description: "",
      order: highlights.length,
    });
    setShowModal(true); // Open the modal
  };

  const editHighlight = (index) => {
    setEditingIndex(index);
    setCurrentHighlight({ ...highlights[index] });
    setShowModal(true); // Open the modal
  };

  const saveHighlight = () => {
    if (!currentHighlight.title.trim()) {
      Alert.alert("Required", "Please enter a title for the highlight.");
      return;
    }

    if (editingIndex !== null) {
      // Update existing
      const updated = [...highlights];
      updated[editingIndex] = currentHighlight;
      onChange(updated);
    } else {
      // Add new
      onChange([...highlights, currentHighlight]);
    }

    setCurrentHighlight({
      icon_name: "star-outline",
      title: "",
      description: "",
      order: 0,
    });
    setEditingIndex(null);
    setShowModal(false); // Close the modal
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
            // Update orders
            const reordered = updated.map((h, i) => ({ ...h, order: i }));
            onChange(reordered);
          },
        },
      ],
    );
  };

  const renderHighlightCard = ({ item, index }) => (
    <View style={styles.highlightCard}>
      <View style={styles.highlightHeader}>
        <View style={styles.iconTitleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon_name} size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.highlightTitle}>{item.title}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => editHighlight(index)}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteHighlight(index)}
            style={{ marginLeft: 12 }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      {item.description && (
        <Text style={styles.highlightDescription}>{item.description}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Highlights (Optional)</Text>
        <Text style={styles.subtitle}>
          {highlights.length}/{maxHighlights} highlights • Showcase what makes
          your event special
        </Text>
      </View>

      {highlights.length > 0 && (
        <FlatList
          data={highlights}
          renderItem={renderHighlightCard}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
        />
      )}

      {highlights.length < maxHighlights && (
        <TouchableOpacity style={styles.addButton} onPress={addHighlight}>
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={COLORS.primary}
          />
          <Text style={styles.addButtonText}>Add Highlight</Text>
        </TouchableOpacity>
      )}

      {/* Edit/Add Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? "Edit Highlight" : "Add Highlight"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrentHighlight({
                    icon_name: "star-outline",
                    title: "",
                    description: "",
                    order: 0,
                  });
                  setEditingIndex(null);
                  setShowIconPicker(false);
                  setShowModal(false); // Close the modal
                }}
              >
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            {/* Icon Picker */}
            <Text style={styles.label}>Icon</Text>
            <TouchableOpacity
              style={styles.iconSelector}
              onPress={() => setShowIconPicker(!showIconPicker)}
            >
              <Ionicons
                name={currentHighlight.icon_name}
                size={32}
                color={COLORS.primary}
              />
              <Text style={styles.iconSelectorText}>Tap to change icon</Text>
            </TouchableOpacity>

            {showIconPicker && (
              <View style={styles.iconGrid}>
                {popularIcons.map((icon) => (
                  <TouchableOpacity
                    key={icon.name}
                    style={[
                      styles.iconOption,
                      currentHighlight.icon_name === icon.name &&
                        styles.iconOptionSelected,
                    ]}
                    onPress={() => {
                      setCurrentHighlight({
                        ...currentHighlight,
                        icon_name: icon.name,
                      });
                      setShowIconPicker(false);
                    }}
                  >
                    <Ionicons
                      name={icon.name}
                      size={28}
                      color={COLORS.primary}
                    />
                    <Text style={styles.iconLabel}>{icon.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Title Input */}
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={currentHighlight.title}
              onChangeText={(text) =>
                setCurrentHighlight({ ...currentHighlight, title: text })
              }
              placeholder="Why this event stands out"
              placeholderTextColor="#9CA3AF"
              maxLength={50}
            />

            {/* Description Input */}
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={currentHighlight.description}
              onChangeText={(text) =>
                setCurrentHighlight({ ...currentHighlight, description: text })
              }
              placeholder="Brief explanation..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={500}
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
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.validText}>Description looks good!</Text>
            </Animated.View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={saveHighlight}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>
                  {editingIndex !== null ? "Update" : "Add"} Highlight
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
    marginVertical: 15,
  },
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  highlightCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BBDEFB",
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
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
  },
  highlightDescription: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
    marginLeft: 52,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: LIGHT_TEXT_COLOR,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  addButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 15,
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
    color: LIGHT_TEXT_COLOR,
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
    backgroundColor: "#E3F2FD",
  },
  iconLabel: {
    fontSize: 10,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
    textAlign: "center",
  },
  input: {
    fontFamily: FONTS.regular,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    color: TEXT_COLOR,
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 20,
  },
  saveButtonGradient: {
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  animatedCheckmarkContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4", // Very faint green background
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  iconCircleCustom: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  validText: {
    fontSize: 13,
    color: "#166534", // Dark premium green
    fontFamily: "Manrope-SemiBold",
  },
});

export default HighlightsEditor;
