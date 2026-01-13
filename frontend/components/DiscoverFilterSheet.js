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
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, BORDER_RADIUS } from "../constants/theme";
import HapticsService from "../services/HapticsService";

// Goal Badge Presets (same as EditDiscoverProfileScreen)
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

// Common interest categories for quick selection
const POPULAR_INTERESTS = [
  "Technology",
  "Startups",
  "Design",
  "Music",
  "Photography",
  "Fitness",
  "Travel",
  "Food",
  "Art",
  "Gaming",
];

export default function DiscoverFilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) {
  const [selectedBadges, setSelectedBadges] = useState(
    initialFilters.badges || []
  );
  const [selectedInterests, setSelectedInterests] = useState(
    initialFilters.interests || []
  );
  const [ageMin, setAgeMin] = useState(initialFilters.ageMin?.toString() || "");
  const [ageMax, setAgeMax] = useState(initialFilters.ageMax?.toString() || "");

  useEffect(() => {
    if (visible) {
      setSelectedBadges(initialFilters.badges || []);
      setSelectedInterests(initialFilters.interests || []);
      setAgeMin(initialFilters.ageMin?.toString() || "");
      setAgeMax(initialFilters.ageMax?.toString() || "");
    }
  }, [visible, initialFilters]);

  const toggleBadge = (badge) => {
    HapticsService.triggerSelection();
    setSelectedBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]
    );
  };

  const toggleInterest = (interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleReset = () => {
    HapticsService.triggerImpactLight();
    setSelectedBadges([]);
    setSelectedInterests([]);
    setAgeMin("");
    setAgeMax("");
  };

  const handleApply = () => {
    HapticsService.triggerImpactMedium();
    const filters = {
      badges: selectedBadges.length > 0 ? selectedBadges : null,
      interests: selectedInterests.length > 0 ? selectedInterests : null,
      ageMin: ageMin ? parseInt(ageMin) : null,
      ageMax: ageMax ? parseInt(ageMax) : null,
    };
    onApply(filters);
    onClose();
  };

  const hasActiveFilters =
    selectedBadges.length > 0 ||
    selectedInterests.length > 0 ||
    ageMin !== "" ||
    ageMax !== "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        {/* Backdrop - tap to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sheet content */}
        <View style={styles.sheet}>
          {/* Header */}
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
          >
            {/* Goal Badges Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Goals</Text>
              <Text style={styles.sectionSubtitle}>
                Find people with specific intentions
              </Text>
              <View style={styles.chipGrid}>
                {GOAL_BADGE_PRESETS.map((badge) => (
                  <TouchableOpacity
                    key={badge}
                    style={[
                      styles.chip,
                      selectedBadges.includes(badge) && styles.chipSelected,
                    ]}
                    onPress={() => toggleBadge(badge)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedBadges.includes(badge) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {badge}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Interests Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <Text style={styles.sectionSubtitle}>
                Find people with shared interests
              </Text>
              <View style={styles.chipGrid}>
                {POPULAR_INTERESTS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.chip,
                      selectedInterests.includes(interest) &&
                        styles.chipSelected,
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedInterests.includes(interest) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Age Range Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Age Range</Text>
              <View style={styles.ageRow}>
                <View style={styles.ageInputContainer}>
                  <Text style={styles.ageLabel}>Min</Text>
                  <TextInput
                    style={styles.ageInput}
                    value={ageMin}
                    onChangeText={setAgeMin}
                    keyboardType="number-pad"
                    placeholder="18"
                    placeholderTextColor={COLORS.textSecondary}
                    maxLength={2}
                  />
                </View>
                <Text style={styles.ageDash}>—</Text>
                <View style={styles.ageInputContainer}>
                  <Text style={styles.ageLabel}>Max</Text>
                  <TextInput
                    style={styles.ageInput}
                    value={ageMax}
                    onChangeText={setAgeMax}
                    keyboardType="number-pad"
                    placeholder="99"
                    placeholderTextColor={COLORS.textSecondary}
                    maxLength={2}
                  />
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Apply Button */}
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
                      (ageMin || ageMax ? 1 : 0)}
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
    maxHeight: "80%",
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
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
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  resetText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  ageInputContainer: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  ageInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  ageDash: {
    fontSize: 20,
    color: COLORS.textSecondary,
    marginTop: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
