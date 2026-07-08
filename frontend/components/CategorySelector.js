import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as LucideIcons from "lucide-react-native";
import {
  Tags,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Search,
} from "lucide-react-native";
import { COLORS } from "../constants/theme";
import { getDiscoverCategories } from "../api/categories";
import { EVENT_CATEGORIES_HIERARCHY } from "../constants/eventCategories";
import SnooLoader from "./ui/SnooLoader";

const TEXT_COLOR = "#1F2937";
const LIGHT_TEXT_COLOR = "#6B7280";
const BORDER_COLOR = "#E5E7EB";

/**
 * CategorySelector - Multi-select component for event categories using a modal overlay.
 *
 * Used in CreateEventModal and EditEventModal to select which categories
 * an event should appear in on the Discover feed.
 */
export default function CategorySelector({
  selectedCategories = [],
  onChange,
  maxCategories = 3,
  onExpand,
  setParentScrollEnabled,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);

  // Custom scrollbar content layout tracking
  const [contentHeight, setContentHeight] = useState(1);
  const [visibleHeight, setVisibleHeight] = useState(300);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Disable parent scroll while categories modal is visible
  useEffect(() => {
    setParentScrollEnabled?.(!expanded);
  }, [expanded, setParentScrollEnabled]);

  // Cleanup parent scroll lock on unmount
  useEffect(() => {
    return () => {
      setParentScrollEnabled?.(true);
    };
  }, []);

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

  // Convert kebab-case backend icon name to PascalCase Lucide icon component
  const getLucideIcon = (iconName) => {
    if (!iconName) return LucideIcons.Tags;

    const pascalName = iconName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

    return LucideIcons[pascalName] || LucideIcons.Tags;
  };

  // Resolve category icon color from its parent group theme
  const getCategoryIconColor = (categoryName, isSelected) => {
    if (isSelected) return COLORS.primary;

    const groupDef = EVENT_CATEGORIES_HIERARCHY.find((g) =>
      g.categories.some((c) => c.name.toLowerCase() === categoryName.toLowerCase().trim())
    );

    return groupDef ? groupDef.text : LIGHT_TEXT_COLOR;
  };

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

  // Get category details by ID
  const getCategoryDetails = (id) => {
    const category = categories.find((c) => c.id === id);
    return category || { name: "Unknown", icon_name: "tags" };
  };

  // Get list of category objects belonging to a hierarchy group
  const getCategoriesInGroup = (groupName) => {
    const groupDef = EVENT_CATEGORIES_HIERARCHY.find((g) => g.group === groupName);
    if (!groupDef) return [];
    return categories.filter((cat) =>
      groupDef.categories.some((c) => c.name.toLowerCase() === cat.name.toLowerCase().trim())
    );
  };

  // Filter categories matching search query
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Custom scrollbar calculation (handled natively via Animated interpolation)
  const isScrollable = contentHeight > visibleHeight;
  const thumbHeight = isScrollable
    ? Math.max(30, (visibleHeight / contentHeight) * visibleHeight)
    : 0;
  const maxScrollOffset = contentHeight - visibleHeight;

  const scrollRange = maxScrollOffset > 0 ? maxScrollOffset : 1;
  const thumbRange = visibleHeight - thumbHeight;
  const thumbTop = scrollY.interpolate({
    inputRange: [0, scrollRange],
    outputRange: [0, thumbRange > 0 ? thumbRange : 0],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Categories</Text>
        <View style={styles.loadingContainer}>
          <SnooLoader size="small" color={COLORS.primary} />
          <Text style={[styles.loadingText, { fontFamily: 'Manrope-Medium' }]}>Loading categories...</Text>
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
      <Text style={styles.hint}>
        Select up to {maxCategories} categories for your event to appear in the
        Discover feed
      </Text>

      <View style={styles.counterRow}>
        <Text style={styles.counter}>
          {selectedCategories.length} / {maxCategories} selected
        </Text>
      </View>

      {/* Selected Categories Preview */}
      {selectedCategories.length > 0 && (
        <View style={styles.selectedContainer}>
          {selectedCategories.map((categoryId) => {
            const cat = getCategoryDetails(categoryId);
            const Icon = getLucideIcon(cat.icon_name);
            return (
              <TouchableOpacity
                key={categoryId}
                style={styles.selectedChip}
                onPress={() => toggleCategory(categoryId)}
              >
                <Icon size={14} color={getCategoryIconColor(cat.name, false)} style={styles.selectedChipIcon} />
                <Text style={styles.selectedChipText}>
                  {cat.name}
                </Text>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            );
          })}
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

      {/* Categories Dropdown Modal Overlay */}
      <Modal
        visible={expanded}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableWithoutFeedback onPress={() => setExpanded(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Select Categories</Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedCategories.length} / {maxCategories} selected
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeButton}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBarContainer}>
                  <Search size={16} color="#94A3B8" style={styles.searchBarIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search event categories..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      if (text && expandedGroup) {
                        setExpandedGroup(null);
                      }
                    }}
                    autoCorrect={false}
                    clearButtonMode="never"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchIcon}>
                      <X size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* List Container with flexible layout */}
                <View style={{ flex: 1, position: "relative", minHeight: 180 }}>
                  <Animated.ScrollView
                    style={styles.categoryScroll}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                      { useNativeDriver: true }
                    )}
                    onContentSizeChange={(w, h) => {
                      setContentHeight(h);
                    }}
                    onLayout={(e) => {
                      setVisibleHeight(e.nativeEvent.layout.height);
                    }}
                  >
                    {searchQuery.trim().length > 0 ? (
                      /* Search Results view */
                      filteredCategories.length === 0 ? (
                        <View style={styles.noResultsContainer}>
                          <Text style={styles.noResultsText}>
                            No categories match "{searchQuery}"
                          </Text>
                        </View>
                      ) : (
                        filteredCategories.map((category) => {
                          const isSelected = selectedCategories.includes(category.id);
                          const isDisabled =
                            !isSelected && selectedCategories.length >= maxCategories;
                          const Icon = getLucideIcon(category.icon_name);

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
                              <Icon
                                size={18}
                                color={getCategoryIconColor(category.name, isSelected)}
                                style={styles.categoryIcon}
                              />
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
                                <CheckCircle2 size={20} color={COLORS.primary} style={styles.checkIcon} />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )
                    ) : (
                      /* Grouped Accordions view */
                      EVENT_CATEGORIES_HIERARCHY.map((group) => {
                        const groupCats = getCategoriesInGroup(group.group);
                        if (groupCats.length === 0) return null;
                        const isExpanded = expandedGroup === group.group;
                        const GroupIcon = getLucideIcon(group.iconName);

                        return (
                          <View key={group.group} style={styles.groupContainer}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setExpandedGroup(isExpanded ? null : group.group)}
                              style={[
                                styles.groupHeader,
                                isExpanded && styles.groupHeaderExpanded,
                                { backgroundColor: isExpanded ? group.bg : "transparent" },
                              ]}
                            >
                              <View style={styles.groupHeaderLeft}>
                                <View style={[styles.groupIconContainer, { backgroundColor: group.bg }]}>
                                  <GroupIcon size={14} color={group.text} />
                                </View>
                                <Text
                                  style={[
                                    styles.groupTitle,
                                    isExpanded && { color: group.text, fontFamily: "Manrope-SemiBold" },
                                  ]}
                                >
                                  {group.group}
                                </Text>
                              </View>
                              {isExpanded ? (
                                <ChevronDown size={18} color={LIGHT_TEXT_COLOR} style={styles.chevronIcon} />
                              ) : (
                                <ChevronRight size={18} color={LIGHT_TEXT_COLOR} style={styles.chevronIcon} />
                              )}
                            </TouchableOpacity>

                            {isExpanded && (
                              <View style={styles.groupContent}>
                                {groupCats.map((category) => {
                                  const isSelected = selectedCategories.includes(category.id);
                                  const isDisabled =
                                    !isSelected && selectedCategories.length >= maxCategories;
                                  const CatIcon = getLucideIcon(category.icon_name);

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
                                      <CatIcon
                                        size={18}
                                        color={getCategoryIconColor(category.name, isSelected)}
                                        style={styles.categoryIcon}
                                      />
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
                                        <CheckCircle2 size={20} color={COLORS.primary} style={styles.checkIcon} />
                                      )}
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </Animated.ScrollView>

                  {/* Custom Visual Scrollbar Track & Thumb */}
                  {isScrollable && (
                    <View style={styles.customScrollbarTrack}>
                      <Animated.View
                        style={[
                          styles.customScrollbarThumb,
                          { height: thumbHeight, transform: [{ translateY: thumbTop }] }
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Done Button */}
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setExpanded(false)}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  label: {
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
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
    marginBottom: 8,
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
    paddingLeft: 14,
    paddingRight: 10,
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF4",
    borderRadius: 16,
  },
  selectedChipIcon: {
    marginRight: 2,
  },
  selectedChipText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#1F2937",
    marginRight: 4,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Dark slate backdrop overlay
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "90%",
    height: "70%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: TEXT_COLOR,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#94A3B8",
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 16,
    height: 48,
    gap: 8,
    marginBottom: 16,
  },
  searchBarIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#1F2937",
    padding: 0,
  },
  clearSearchIcon: {
    padding: 4,
  },
  categoryScroll: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 28,
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
    fontFamily: "Manrope-Medium",
    color: TEXT_COLOR,
  },
  categoryNameSelected: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
  },
  categoryNameDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
  checkIcon: {
    marginLeft: 6,
  },
  groupContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 28,
  },
  groupHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  groupHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  groupIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#374151",
  },
  groupContent: {
    backgroundColor: "#FAFAFA",
    paddingLeft: 8,
  },
  chevronIcon: {
    marginLeft: 6,
  },
  noResultsContainer: {
    padding: 24,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: LIGHT_TEXT_COLOR,
  },
  customScrollbarTrack: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: "transparent",
  },
  customScrollbarThumb: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1", // Soft slate-300 scrollbar thumb
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
  },
});
