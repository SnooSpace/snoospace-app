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
import {
  Tags,
  XCircle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react-native";
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
          <AlertCircle size={20} color="#EF4444" />
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
          {selectedCategories.length} / {maxCategories} selected
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
              <Text style={styles.selectedChipText}>
                {getCategoryName(categoryId)}
              </Text>
              <X size={16} color="#64748B" />
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
        <Tags size={20} color="#64748B" />
        <Text style={styles.selectorButtonText}>
          {selectedCategories.length === 0
            ? "Select categories"
            : "Change categories"}
        </Text>
        <ChevronDown
          size={20}
          color="#94A3B8"
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
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
                    <CheckCircle2 size={22} color={COLORS.primary} />
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
    padding: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F2F5",
    marginTop: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  counter: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#94A3B8",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginBottom: 20,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
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
    fontFamily: "Manrope-Regular",
    color: "#EF4444",
  },
  selectedContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 16,
    marginBottom: 16,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 16,
  },
  selectedChipText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#1F2937",
  },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    gap: 10,
  },
  selectorButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#64748B",
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
