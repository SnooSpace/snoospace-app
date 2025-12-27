import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS } from "../constants/theme";
import { getDiscoverCategories } from "../api/categories";

const TEXT_COLOR = "#1F2937";
const LIGHT_TEXT_COLOR = "#6B7280";
const BORDER_COLOR = "#E5E7EB";

/**
 * CategorySelector - Multi-select component for event categories
 *
 * Used in CreateEventModal and EditEventModal to select which categories
 * an event should appear in on the Discover feed.
 */
export default function CategorySelector({
  selectedCategories = [],
  onChange,
  maxCategories = 3,
  onExpand,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await getDiscoverCategories();
        if (response?.categories) {
          setCategories(response.categories);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setError("Failed to load categories");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Toggle category selection
  const toggleCategory = (categoryId) => {
    const isSelected = selectedCategories.includes(categoryId);

    if (isSelected) {
      // Remove category
      onChange(selectedCategories.filter((id) => id !== categoryId));
    } else {
      // Add category (if not at max)
      if (selectedCategories.length < maxCategories) {
        onChange([...selectedCategories, categoryId]);
      }
    }
  };

  // Get category name by ID
  const getCategoryName = (id) => {
    const category = categories.find((c) => c.id === id);
    return category?.name || "Unknown";
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Categories</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Categories</Text>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Categories</Text>
        <Text style={styles.counter}>
          {selectedCategories.length}/{maxCategories}
        </Text>
      </View>

      <Text style={styles.hint}>
        Select up to {maxCategories} categories for your event to appear in the
        Discover feed
      </Text>

      {/* Selected Categories Preview */}
      {selectedCategories.length > 0 && (
        <View style={styles.selectedContainer}>
          {selectedCategories.map((categoryId) => (
            <TouchableOpacity
              key={categoryId}
              style={styles.selectedChip}
              onPress={() => toggleCategory(categoryId)}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.selectedChipGradient}
              >
                <Text style={styles.selectedChipText}>
                  {getCategoryName(categoryId)}
                </Text>
                <Ionicons name="close-circle" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Category Selector Button */}
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          if (newExpanded && onExpand) {
            onExpand();
          }
        }}
      >
        <Ionicons name="pricetags-outline" size={20} color={COLORS.primary} />
        <Text style={styles.selectorButtonText}>
          {selectedCategories.length === 0
            ? "Select categories"
            : "Change categories"}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={LIGHT_TEXT_COLOR}
        />
      </TouchableOpacity>

      {/* Expanded Category List */}
      {expanded && (
        <View style={styles.categoryList}>
          <ScrollView style={styles.categoryScroll} nestedScrollEnabled={true}>
            {categories.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              const isDisabled =
                !isSelected && selectedCategories.length >= maxCategories;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                    isDisabled && styles.categoryItemDisabled,
                  ]}
                  onPress={() => toggleCategory(category.id)}
                  disabled={isDisabled}
                >
                  {category.icon_name && (
                    <Ionicons
                      name={category.icon_name}
                      size={20}
                      color={isSelected ? COLORS.primary : LIGHT_TEXT_COLOR}
                      style={styles.categoryIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.categoryName,
                      isSelected && styles.categoryNameSelected,
                      isDisabled && styles.categoryNameDisabled,
                    ]}
                  >
                    {category.name}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  counter: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 10,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
  },
  selectedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectedChip: {
    borderRadius: 20,
    overflow: "hidden",
  },
  selectedChipGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    gap: 10,
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  categoryList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    maxHeight: 250,
    overflow: "hidden",
  },
  categoryScroll: {
    maxHeight: 250,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryItemSelected: {
    backgroundColor: "#F0F9FF",
  },
  categoryItemDisabled: {
    opacity: 0.5,
  },
  categoryIcon: {
    marginRight: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  categoryNameSelected: {
    fontWeight: "600",
    color: COLORS.primary,
  },
  categoryNameDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
});
