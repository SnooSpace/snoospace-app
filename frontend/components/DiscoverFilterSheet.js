import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react-native";
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import HapticsService from "../services/HapticsService";
import {
  getInterestStyle,
  INTEREST_CATEGORIES,
} from "../screens/profile/member/EditProfileConstants";
import RangeSlider from "./RangeSlider";

// Goal Badge Color Logic (Semantic Grouping)
const GOAL_COLORS = {
  "looking for study partners": { bg: "#E0F2FE", text: "#075985" }, // Blue
  "new to the city": { bg: "#ECFDF5", text: "#065F46" }, // Mint
  "exploring opportunities": { bg: "#FFF7ED", text: "#9A3412" }, // Orange
  "seeking mentorship": { bg: "#F3E5F5", text: "#7B1FA2" }, // Purple
  "looking for a co-founder": { bg: "#E0F7FA", text: "#006064" }, // Cyan
  default: { bg: "#F3F4F6", text: "#374151" }, // Neutral
};

const getGoalStyle = (goal) => {
  const lower = goal?.toLowerCase() || "";
  for (const key in GOAL_COLORS) {
    if (lower.includes(key)) return GOAL_COLORS[key];
  }
  return GOAL_COLORS.default;
};

// Goal Badge Presets
const GOAL_BADGE_PRESETS = [
  "Looking for a co-founder",
  "Seeking mentorship",
  "Open to collaborations",
  "Exploring opportunities",
  "Open to friendships",
  "New to the city",
  "Wants to play sports",
  "Looking for study partners",
  "Here to learn",
  "Just curious",
  "Looking for teammates",
];

export default function DiscoverFilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) {
  const [selectedBadges, setSelectedBadges] = useState(
    initialFilters.badges || [],
  );

  // Interests now stored as simple array of strings, same as before
  const [selectedInterests, setSelectedInterests] = useState(
    initialFilters.interests || [],
  );

  const [interestSearch, setInterestSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Age states for slider
  const [ageMin, setAgeMin] = useState(initialFilters.ageMin || 18);
  const [ageMax, setAgeMax] = useState(initialFilters.ageMax || 30);

  useEffect(() => {
    if (visible) {
      setSelectedBadges(initialFilters.badges || []);
      setSelectedInterests(initialFilters.interests || []);
      setAgeMin(initialFilters.ageMin || 18);
      setAgeMax(initialFilters.ageMax || 30);
      setExpandedCategory(null);
      setInterestSearch("");
    }
  }, [visible, initialFilters]);

  const toggleBadge = (badge) => {
    HapticsService.triggerSelection();
    setSelectedBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  };

  const toggleInterest = (interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const removeInterest = (interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) => prev.filter((i) => i !== interest));
  };

  const handleReset = () => {
    HapticsService.triggerImpactLight();
    setSelectedBadges([]);
    setSelectedInterests([]);
    setAgeMin(18);
    setAgeMax(30);
  };

  const handleApply = () => {
    HapticsService.triggerImpactMedium();
    const filters = {
      badges: selectedBadges.length > 0 ? selectedBadges : null,
      interests: selectedInterests.length > 0 ? selectedInterests : null,
      ageMin: ageMin,
      ageMax: ageMax,
    };
    onApply(filters);
    onClose();
  };

  const hasActiveFilters =
    selectedBadges.length > 0 ||
    selectedInterests.length > 0 ||
    ageMin !== 18 ||
    ageMax !== 30;

  // Render Categorized Interests
  const renderInterests = () => {
    const query = interestSearch.toLowerCase().trim();
    const isSearching = query.length > 0;

    // Convert INTEREST_CATEGORIES object to array
    const categories = Object.values(INTEREST_CATEGORIES).filter(
      (cat) => cat.keywords.length > 0,
    );

    // If searching, show flattened results or filtered list
    if (isSearching) {
      return (
        <View style={styles.chipGrid}>
          {categories
            .flatMap((cat) => cat.keywords)
            .filter((k) => k.toLowerCase().includes(query))
            .map((interest) => {
              // Capitalize
              const display =
                interest.charAt(0).toUpperCase() + interest.slice(1);
              const style = getInterestStyle(display);
              const isSelected = selectedInterests.includes(display);
              return (
                <TouchableOpacity
                  key={display}
                  style={[
                    styles.interestChip,
                    {
                      backgroundColor: style.bg,
                      borderColor: isSelected ? style.text : "transparent",
                    },
                    isSelected && styles.interestChipSelected,
                  ]}
                  onPress={() => toggleInterest(display)}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      { color: style.text },
                      isSelected && styles.interestChipTextSelected,
                    ]}
                  >
                    {display}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      );
    }

    // Default Accordion View
    return categories.map((category) => {
      const isExpanded = expandedCategory === category.label;
      const Icon = category.icon;

      return (
        <View key={category.label} style={styles.categoryWrapper}>
          <TouchableOpacity
            style={styles.categoryHeader}
            onPress={() => {
              HapticsService.triggerSelection();
              setExpandedCategory(isExpanded ? null : category.label);
            }}
          >
            <View style={styles.categoryHeaderLeft}>
              {/* Category Icon */}
              <View
                style={[
                  styles.categoryIconContainer,
                  { backgroundColor: category.bg },
                ]}
              >
                {Icon && <Icon size={18} color={category.text} />}
              </View>
              <Text style={styles.categoryTitle}>{category.label}</Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={20} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={20} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.categoryContent}>
              <View style={styles.chipGrid}>
                {category.keywords.map((k) => {
                  const display = k.charAt(0).toUpperCase() + k.slice(1);
                  const style = getInterestStyle(display);
                  const isSelected = selectedInterests.includes(display);
                  return (
                    <TouchableOpacity
                      key={display}
                      style={[
                        styles.interestChip,
                        {
                          backgroundColor: style.bg,
                          borderColor: isSelected ? style.text : "transparent",
                        },
                        isSelected && styles.interestChipSelected,
                      ]}
                      onPress={() => toggleInterest(display)}
                    >
                      <Text
                        style={[
                          styles.interestChipText,
                          { color: style.text },
                          // Removed conditional fontFamily/fontWeight for layout stability
                        ]}
                      >
                        {display}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>Filter Profiles</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleReset}>
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* GOALS SECTION */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Goals</Text>
              <Text style={styles.sectionSubtitle}>
                Find people with specific intentions
              </Text>
              <View style={styles.chipGrid}>
                {GOAL_BADGE_PRESETS.map((badge) => {
                  const goalStyle = getGoalStyle(badge);
                  const isSelected = selectedBadges.includes(badge);
                  return (
                    <TouchableOpacity
                      key={badge}
                      style={[
                        styles.goalChip,
                        {
                          backgroundColor: isSelected
                            ? goalStyle.bg
                            : "#FFFFFF",
                          borderColor: isSelected ? goalStyle.text : "#F3F4F6", // Constant border color visual or unselected
                        },
                      ]}
                      onPress={() => toggleBadge(badge)}
                    >
                      <Text
                        style={[
                          styles.goalChipText,
                          {
                            color: isSelected
                              ? goalStyle.text
                              : COLORS.textPrimary,
                            fontFamily: FONTS.semiBold, // Unified weight to prevent shift
                          },
                        ]}
                      >
                        {badge}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* INTERESTS SECTION */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <Text style={styles.sectionSubtitle}>
                Find people with shared interests
              </Text>

              {/* Selected Interests Display */}
              {selectedInterests.length > 0 && (
                <View style={styles.selectedWrapper}>
                  {selectedInterests.map((interest) => {
                    const style = getInterestStyle(interest);
                    return (
                      <TouchableOpacity
                        key={interest}
                        style={[
                          styles.selectedChip,
                          { backgroundColor: style.bg },
                        ]}
                        onPress={() => removeInterest(interest)}
                      >
                        <Text
                          style={[
                            styles.selectedChipText,
                            { color: style.text },
                          ]}
                        >
                          {interest}
                        </Text>
                        <X size={14} color={style.text} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Search
                  size={18}
                  color={COLORS.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search interests..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={interestSearch}
                  onChangeText={setInterestSearch}
                />
              </View>

              {/* Categorized List */}
              <View style={styles.categoriesWrapper}>{renderInterests()}</View>
            </View>

            {/* AGE SECTION */}
            <View style={styles.section}>
              <View style={styles.ageHeaderRow}>
                <Text style={styles.sectionTitle}>Age Range</Text>
                <Text style={styles.ageValueText}>
                  {ageMin} - {ageMax}
                </Text>
              </View>

              <View style={styles.sliderContainer}>
                <RangeSlider
                  min={18}
                  max={99}
                  initialMin={ageMin}
                  initialMax={ageMax}
                  onValueChange={({ min, max }) => {
                    setAgeMin(min);
                    setAgeMax(max);
                  }}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>
                Apply Filters
                {hasActiveFilters && (
                  <Text>
                    {" "}
                    (
                    {selectedBadges.length +
                      selectedInterests.length +
                      (ageMin !== 18 || ageMax !== 30 ? 1 : 0)}
                    )
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  handle: {
    width: 32,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  resetText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },

  // Goals
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    height: 38, // Slightly taller
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2, // Constant border width to prevent jumping
  },
  goalChipText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },

  // Interests
  selectedWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  selectedChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  categoriesWrapper: {
    gap: 0,
  },
  categoryWrapper: {
    marginBottom: 0,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  categoryContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  interestChip: {
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  interestChipSelected: {
    borderWidth: 2,
    opacity: 1,
  },
  interestChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },

  // Age
  ageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  ageValueText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
  },
  sliderContainer: {
    paddingHorizontal: 10,
    height: 60,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  applyButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 16,
  },
});
