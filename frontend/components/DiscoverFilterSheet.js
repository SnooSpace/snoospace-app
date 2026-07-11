import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import SwipeableModal from "./modals/SwipeableModal";
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import HapticsService from "../services/HapticsService";
import {
  getInterestStyle,
  INTEREST_CATEGORIES,
} from "../screens/profile/member/EditProfileConstants";
import RangeSlider from "./RangeSlider";
import { getSystemSparks, searchSparks } from "../api/sparks";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Spark colour helper ───────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  professional: { bg: "#EFF6FF", text: "#1D4ED8" },
  social:       { bg: "#F0FDF4", text: "#15803D" },
  activity:     { bg: "#FFF7ED", text: "#C2410C" },
  learning:     { bg: "#F5F3FF", text: "#6D28D9" },
  travel:       { bg: "#E0F2FE", text: "#0369A1" },
  default:      { bg: "#F3F4F6", text: "#374151" },
};

const getSparkStyle = (category) =>
  CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

// ── Category display labels ───────────────────────────────────────────────────
const CATEGORY_LABELS = {
  professional: "Professional",
  social:       "Social",
  activity:     "Activity",
  learning:     "Learning",
  travel:       "Travel",
};

const GENDER_OPTIONS = ["Men", "Women", "Non-binary"];

const GENDER_STYLES = {
  Men:           { bg: "#E2E8F1", text: "#2F3A55" },
  Women:         { bg: "#F2E2E6", text: "#5A2F3C" },
  "Non-binary":  { bg: "#E2EFED", text: "#1F4E4A" },
  default:       { bg: "#F3F4F6", text: "#374151" },
};

const getGenderStyle = (gender) => GENDER_STYLES[gender] || GENDER_STYLES.default;

// ── Component ─────────────────────────────────────────────────────────────────
const DiscoverFilterSheet = React.memo(function DiscoverFilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) {
  const renderCount = useRef(0);
  useEffect(() => {
    console.log("[DiscoverFilterSheet] Mounted");
    return () => console.log("[DiscoverFilterSheet] Unmounted");
  }, []);
  console.log(
    `[DiscoverFilterSheet] Render #${++renderCount.current} (visible: ${visible})`,
  );

  // ── Sparks state ────────────────────────────────────────────────────────────
  const [sparksLoading, setSparksLoading] = useState(false);
  const [categories, setCategories] = useState([]); // [{ category, sparks: [...] }]
  const [sparkSearch, setSparkSearch] = useState("");
  const [sparkSearchResults, setSparkSearchResults] = useState([]);
  const [sparkSearchLoading, setSparkSearchLoading] = useState(false);
  const sparkSearchTimer = useRef(null);

  // selectedSparkIds tracks { id, label, category } objects (for display + apply)
  const [selectedSparks, setSelectedSparks] = useState(
    initialFilters.selectedSparks || [],
  );

  // ── Interests / gender / age state ─────────────────────────────────────────
  const [selectedInterests, setSelectedInterests] = useState(
    initialFilters.interests || [],
  );
  const [selectedGenders, setSelectedGenders] = useState(
    initialFilters.genders || [],
  );
  const [interestSearch, setInterestSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [ageMin, setAgeMin] = useState(initialFilters.ageMin || 18);
  const [ageMax, setAgeMax] = useState(initialFilters.ageMax || 30);

  // ── Load system sparks once on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSparksLoading(true);
      try {
        const data = await getSystemSparks();
        if (!cancelled) setCategories(data);
      } catch (e) {
        console.warn("[DiscoverFilterSheet] Failed to load sparks:", e.message);
      } finally {
        if (!cancelled) setSparksLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Re-sync when sheet opens ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setSelectedSparks(initialFilters.selectedSparks || []);
      setSelectedInterests(initialFilters.interests || []);
      setSelectedGenders(initialFilters.genders || []);
      setAgeMin(initialFilters.ageMin || 18);
      setAgeMax(initialFilters.ageMax || 30);
      setExpandedCategory(null);
      setInterestSearch("");
      setSparkSearch("");
      setSparkSearchResults([]);
    }
  }, [visible, initialFilters]);

  // ── Spark search (debounced) ────────────────────────────────────────────────
  useEffect(() => {
    if (sparkSearchTimer.current) clearTimeout(sparkSearchTimer.current);
    const q = sparkSearch.trim();
    if (q.length < 2) {
      setSparkSearchResults([]);
      return;
    }
    setSparkSearchLoading(true);
    sparkSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchSparks(q);
        setSparkSearchResults(results);
      } catch (e) {
        setSparkSearchResults([]);
      } finally {
        setSparkSearchLoading(false);
      }
    }, 300);
    return () => { if (sparkSearchTimer.current) clearTimeout(sparkSearchTimer.current); };
  }, [sparkSearch]);

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  const toggleSpark = useCallback((spark) => {
    HapticsService.triggerSelection();
    setSelectedSparks((prev) => {
      const exists = prev.some((s) => s.id === spark.id);
      return exists
        ? prev.filter((s) => s.id !== spark.id)
        : [...prev, { id: spark.id, label: spark.label, category: spark.category }];
    });
  }, []);

  const removeSpark = useCallback((sparkId) => {
    HapticsService.triggerSelection();
    setSelectedSparks((prev) => prev.filter((s) => s.id !== sparkId));
  }, []);

  const toggleInterest = useCallback((interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }, []);

  const toggleGender = useCallback((gender) => {
    HapticsService.triggerSelection();
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender],
    );
  }, []);

  const removeInterest = useCallback((interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) => prev.filter((i) => i !== interest));
  }, []);

  // ── Reset / Apply ──────────────────────────────────────────────────────────
  const handleReset = () => {
    HapticsService.triggerImpactLight();
    setSelectedSparks([]);
    setSelectedInterests([]);
    setSelectedGenders([]);
    setAgeMin(18);
    setAgeMax(30);
  };

  const handleApply = () => {
    HapticsService.triggerImpactMedium();
    const filters = {
      // Pass spark IDs for the API query param
      spark_ids: selectedSparks.length > 0 ? selectedSparks.map((s) => s.id) : null,
      // Keep selectedSparks objects so the sheet can restore them
      selectedSparks: selectedSparks.length > 0 ? selectedSparks : [],
      interests: selectedInterests.length > 0 ? selectedInterests : null,
      genders: selectedGenders.length > 0 ? selectedGenders : null,
      ageMin,
      ageMax,
    };
    onApply(filters);
    onClose();
  };

  const hasActiveFilters =
    selectedSparks.length > 0 ||
    selectedInterests.length > 0 ||
    selectedGenders.length > 0 ||
    ageMin !== 18 ||
    ageMax !== 30;

  // ── Render Sparks section ──────────────────────────────────────────────────
  const renderSparksSection = () => {
    const isSearching = sparkSearch.trim().length >= 2;

    // Show selected spark pills
    const selectedPills = selectedSparks.length > 0 && (
      <View style={styles.selectedWrapper}>
        {selectedSparks.map((spark) => {
          const style = getSparkStyle(spark.category);
          return (
            <TouchableOpacity
              key={`sel-${spark.id}`}
              style={[styles.selectedChip, { backgroundColor: style.bg }]}
              onPress={() => removeSpark(spark.id)}
            >
              <Text style={[styles.selectedChipText, { color: style.text }]}>
                {spark.label}
              </Text>
              <X size={14} color={style.text} />
            </TouchableOpacity>
          );
        })}
      </View>
    );

    // Search bar
    const searchBar = (
      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search sparks..."
          placeholderTextColor={COLORS.textSecondary}
          value={sparkSearch}
          onChangeText={setSparkSearch}
        />
        {sparkSearch.length > 0 && (
          <TouchableOpacity
            onPress={() => { HapticsService.triggerImpactLight(); setSparkSearch(""); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 8 }}
          >
            <X size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    );

    // Search results
    if (isSearching) {
      return (
        <View>
          {selectedPills}
          {searchBar}
          {sparkSearchLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
          ) : sparkSearchResults.length === 0 ? (
            <Text style={styles.emptySearchText}>No sparks found for "{sparkSearch}"</Text>
          ) : (
            <View style={styles.chipGrid}>
              {sparkSearchResults.map((spark) => {
                const style = getSparkStyle(spark.category);
                const isSelected = selectedSparks.some((s) => s.id === spark.id);
                return (
                  <TouchableOpacity
                    key={spark.id}
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: isSelected ? style.bg : "#FFFFFF",
                        borderColor: isSelected ? style.text : "#F3F4F6",
                      },
                    ]}
                    onPress={() => toggleSpark(spark)}
                  >
                    <Text
                      style={[
                        styles.goalChipText,
                        { color: isSelected ? style.text : COLORS.textPrimary },
                      ]}
                    >
                      {spark.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    }

    // Default: grouped by category
    if (sparksLoading) {
      return (
        <View>
          {selectedPills}
          {searchBar}
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 16 }} />
        </View>
      );
    }

    return (
      <View>
        {selectedPills}
        {searchBar}
        {categories.map(({ category, sparks }) => {
          const catStyle = getSparkStyle(category);
          const catLabel = CATEGORY_LABELS[category] || category;
          return (
            <View key={category} style={styles.sparkCategoryGroup}>
              <Text style={[styles.sparkCategoryLabel, { color: catStyle.text }]}>
                {catLabel}
              </Text>
              <View style={styles.chipGrid}>
                {sparks.map((spark) => {
                  const isSelected = selectedSparks.some((s) => s.id === spark.id);
                  return (
                    <TouchableOpacity
                      key={spark.id}
                      style={[
                        styles.goalChip,
                        {
                          backgroundColor: isSelected ? catStyle.bg : "#FFFFFF",
                          borderColor: isSelected ? catStyle.text : "#F3F4F6",
                        },
                      ]}
                      onPress={() => toggleSpark(spark)}
                    >
                      <Text
                        style={[
                          styles.goalChipText,
                          { color: isSelected ? catStyle.text : COLORS.textPrimary },
                        ]}
                      >
                        {spark.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Render categorized interests ───────────────────────────────────────────
  const renderInterests = () => {
    const query = interestSearch.toLowerCase().trim();
    const isSearching = query.length > 0;
    const interestCategories = Object.values(INTEREST_CATEGORIES).filter(
      (cat) => cat.keywords.length > 0,
    );

    if (isSearching) {
      return (
        <View style={styles.chipGrid}>
          {interestCategories
            .flatMap((cat) => cat.keywords)
            .filter((k) => k.toLowerCase().includes(query))
            .map((interest) => {
              const display = interest.charAt(0).toUpperCase() + interest.slice(1);
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
                  <Text style={[styles.interestChipText, { color: style.text }]}>
                    {display}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      );
    }

    return interestCategories.map((category) => {
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
              <View style={[styles.categoryIconContainer, { backgroundColor: category.bg }]}>
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
                      <Text style={[styles.interestChipText, { color: style.text }]}>
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

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      keyboardAvoiding={true}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      backdropColor="rgba(0,0,0,0.5)"
      header={
        <View collapsable={false} style={styles.sheetHeader}>
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
      }
    >
      <KeyboardAwareScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
        bottomOffset={Platform.OS === "ios" ? 40 : 20}
      >
        {/* SPARKS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sparks</Text>
          <Text style={styles.sectionSubtitle}>
            Find people with specific sparks
          </Text>
          {renderSparksSection()}
        </View>

        {/* INTERESTS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionSubtitle}>Find people with shared interests</Text>

          {selectedInterests.length > 0 && (
            <View style={styles.selectedWrapper}>
              {selectedInterests.map((interest) => {
                const style = getInterestStyle(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.selectedChip, { backgroundColor: style.bg }]}
                    onPress={() => removeInterest(interest)}
                  >
                    <Text style={[styles.selectedChipText, { color: style.text }]}>
                      {interest}
                    </Text>
                    <X size={14} color={style.text} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.searchContainer}>
            <Search size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search interests..."
              placeholderTextColor={COLORS.textSecondary}
              value={interestSearch}
              onChangeText={setInterestSearch}
            />
            {interestSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => { HapticsService.triggerImpactLight(); setInterestSearch(""); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginLeft: 8 }}
              >
                <X size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.categoriesWrapper}>{renderInterests()}</View>
        </View>

        {/* GENDER SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gender</Text>
          <Text style={styles.sectionSubtitle}>Filter by gender identity</Text>
          <View style={styles.chipGrid}>
            {GENDER_OPTIONS.map((gender) => {
              const isSelected = selectedGenders.includes(gender);
              const style = getGenderStyle(gender);
              return (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: isSelected ? style.bg : "#FFFFFF",
                      borderColor: isSelected ? style.bg : "#F3F4F6",
                    },
                  ]}
                  onPress={() => toggleGender(gender)}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      {
                        color: isSelected ? style.text : COLORS.textPrimary,
                        fontFamily: FONTS.semiBold,
                      },
                    ]}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            { backgroundColor: hasActiveFilters ? COLORS.primary : "#E5E7EB" },
          ]}
          onPress={handleApply}
          disabled={!hasActiveFilters}
        >
          <Text
            style={[
              styles.applyButtonText,
              { color: hasActiveFilters ? "#FFFFFF" : COLORS.textSecondary },
            ]}
          >
            Apply Filters
            {hasActiveFilters && (
              <Text>
                {" "}
                (
                {selectedSparks.length +
                  selectedInterests.length +
                  selectedGenders.length +
                  (ageMin !== 18 || ageMax !== 30 ? 1 : 0)}
                )
              </Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>
    </SwipeableModal>
  );
});

export default DiscoverFilterSheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingBottom: Platform.OS === "ios" ? 40 : 30,
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
    fontFamily: FONTS.primary,
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

  // ── Sparks ────────────────────────────────────────────────────────────────
  sparkCategoryGroup: {
    marginBottom: 16,
  },
  sparkCategoryLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptySearchText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },

  // Chip grid (shared by sparks + gender)
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  goalChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },

  // ── Selected pills ────────────────────────────────────────────────────────
  selectedWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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

  // ── Search bar ────────────────────────────────────────────────────────────
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

  // ── Interests accordion ───────────────────────────────────────────────────
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

  // ── Age ───────────────────────────────────────────────────────────────────
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

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  applyButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
  },
});
