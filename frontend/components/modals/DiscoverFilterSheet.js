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
  LayoutAnimation,
  UIManager,
} from "react-native";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Plus,
  Sparkles,
  Briefcase,
  Users,
  Dumbbell,
  BookOpen,
  Compass,
  Palette,
  Cake,
} from "lucide-react-native";
import SwipeableModal from "./SwipeableModal";
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import {
  getInterestStyle,
  INTEREST_CATEGORIES,
} from "../../screens/profile/member/EditProfileConstants";
import RangeSlider from "../ui/RangeSlider";
import { getSystemSparks, searchSparks } from "../../api/sparks";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Sparks Category Configuration ──────────────────────────────────────────
const SPARK_CATEGORIES_CONFIG = {
  professional: {
    label: "Professional",
    icon: Briefcase,
    bg: "#EFF6FF",
    text: "#1D4ED8",
  },
  social: {
    label: "Social",
    icon: Users,
    bg: "#F0FDF4",
    text: "#15803D",
  },
  activity: {
    label: "Activity",
    icon: Dumbbell,
    bg: "#FFF7ED",
    text: "#C2410C",
  },
  learning: {
    label: "Learning",
    icon: BookOpen,
    bg: "#F5F3FF",
    text: "#6D28D9",
  },
  travel: {
    label: "Travel",
    icon: Compass,
    bg: "#E0F2FE",
    text: "#0369A1",
  },
  default: {
    label: "Other",
    icon: Sparkles,
    bg: "#F3F4F6",
    text: "#374151",
  },
};

const getSparkStyle = (category) =>
  SPARK_CATEGORIES_CONFIG[category] || SPARK_CATEGORIES_CONFIG.default;

const GENDER_OPTIONS = [
  { id: "Men", label: "Men", symbol: "♂", bg: "#EFF6FF", text: "#1D4ED8", border: "#60A5FA" },
  { id: "Women", label: "Women", symbol: "♀", bg: "#FDF2F8", text: "#BE185D", border: "#F472B6" },
  { id: "Non-binary", label: "Non-binary", symbol: "⚧", bg: "#F0FDF4", text: "#15803D", border: "#4ADE80" },
];

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
    `[DiscoverFilterSheet] Render #${++renderCount.current} (visible: ${visible})`
  );

  // ── Sparks state ────────────────────────────────────────────────────────────
  const [sparksLoading, setSparksLoading] = useState(false);
  const [sparkCategories, setSparkCategories] = useState([]);
  const [sparkSearch, setSparkSearch] = useState("");
  const [sparkSearchResults, setSparkSearchResults] = useState([]);
  const [sparkSearchLoading, setSparkSearchLoading] = useState(false);
  const [expandedSparkCategory, setExpandedSparkCategory] = useState(null);
  const sparkSearchTimer = useRef(null);

  // selectedSparks: array of { id, label, category }
  const [selectedSparks, setSelectedSparks] = useState(
    initialFilters.selectedSparks || []
  );

  // ── Interests / gender / age state ─────────────────────────────────────────
  const [selectedInterests, setSelectedInterests] = useState(
    initialFilters.interests || []
  );
  const [selectedGenders, setSelectedGenders] = useState(
    initialFilters.genders || []
  );
  const [interestSearch, setInterestSearch] = useState("");
  const [expandedInterestCategory, setExpandedInterestCategory] = useState(null);
  const [ageMin, setAgeMin] = useState(initialFilters.ageMin || 18);
  const [ageMax, setAgeMax] = useState(initialFilters.ageMax || 30);

  // ── Load system sparks once on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSparksLoading(true);
      try {
        const data = await getSystemSparks();
        if (!cancelled) setSparkCategories(data || []);
      } catch (e) {
        console.warn("[DiscoverFilterSheet] Failed to load sparks:", e.message);
      } finally {
        if (!cancelled) setSparksLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Re-sync when sheet opens ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setSelectedSparks(initialFilters.selectedSparks || []);
      setSelectedInterests(initialFilters.interests || []);
      setSelectedGenders(initialFilters.genders || []);
      setAgeMin(initialFilters.ageMin || 18);
      setAgeMax(initialFilters.ageMax || 30);
      setExpandedSparkCategory(null);
      setExpandedInterestCategory(null);
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
        setSparkSearchResults(results || []);
      } catch (e) {
        setSparkSearchResults([]);
      } finally {
        setSparkSearchLoading(false);
      }
    }, 300);
    return () => {
      if (sparkSearchTimer.current) clearTimeout(sparkSearchTimer.current);
    };
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
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }, []);

  const removeInterest = useCallback((interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) => prev.filter((i) => i !== interest));
  }, []);

  const toggleGender = useCallback((gender) => {
    HapticsService.triggerSelection();
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  }, []);

  // ── Reset / Apply ──────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    HapticsService.triggerImpactLight();
    setSelectedSparks([]);
    setSelectedInterests([]);
    setSelectedGenders([]);
    setAgeMin(18);
    setAgeMax(30);
  }, []);

  const handleApply = useCallback(() => {
    HapticsService.triggerImpactMedium();
    const filters = {
      spark_ids: selectedSparks.length > 0 ? selectedSparks.map((s) => s.id) : null,
      selectedSparks: selectedSparks.length > 0 ? selectedSparks : [],
      interests: selectedInterests.length > 0 ? selectedInterests : null,
      genders: selectedGenders.length > 0 ? selectedGenders : null,
      ageMin,
      ageMax,
    };
    onApply(filters);
    onClose();
  }, [selectedSparks, selectedInterests, selectedGenders, ageMin, ageMax, onApply, onClose]);

  const hasActiveFilters =
    selectedSparks.length > 0 ||
    selectedInterests.length > 0 ||
    selectedGenders.length > 0 ||
    ageMin !== 18 ||
    ageMax !== 30;

  const totalActiveCount =
    selectedSparks.length +
    selectedInterests.length +
    selectedGenders.length +
    (ageMin !== 18 || ageMax !== 30 ? 1 : 0);

  // ── Render Sparks section ──────────────────────────────────────────────────
  const renderSparksSection = () => {
    const isSearching = sparkSearch.trim().length >= 2;

    return (
      <View style={styles.sectionCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.sectionIconContainer, { backgroundColor: "#FFF7ED" }]}>
              <Sparkles size={18} color="#EA580C" strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Sparks</Text>
              <Text style={styles.cardSubtitle}>Filter people by specific goals & sparks</Text>
            </View>
          </View>
        </View>

        {/* 1. Pinned Selected Sparks */}
        {selectedSparks.length > 0 && (
          <View style={styles.selectedVibesSection}>
            <View style={styles.vibesContainer}>
              {selectedSparks.map((spark) => {
                const catStyle = getSparkStyle(spark.category);
                const Icon = catStyle.icon || Sparkles;
                return (
                  <TouchableOpacity
                    key={`sel-${spark.id}`}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => removeSpark(spark.id)}
                    style={[
                      styles.vibeChip,
                      { backgroundColor: catStyle.bg, borderColor: catStyle.text },
                    ]}
                  >
                    <View style={styles.vibeContent}>
                      <Icon size={13} color={catStyle.text} strokeWidth={2.2} />
                      <Text style={[styles.vibeText, { color: catStyle.text }]}>
                        {spark.label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.removeIconContainer,
                        { backgroundColor: "rgba(255, 255, 255, 0.85)" },
                      ]}
                    >
                      <X size={11} color={catStyle.text} strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.cardDivider} />
          </View>
        )}

        {/* 2. Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={16} color="#64748B" strokeWidth={2.2} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sparks..."
            placeholderTextColor="#94A3B8"
            value={sparkSearch}
            onChangeText={(text) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSparkSearch(text);
              if (text) setExpandedSparkCategory(null);
            }}
          />
          {sparkSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSparkSearch("");
                setSparkSearchResults([]);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Search Results or Categories Accordion */}
        <View style={styles.categoriesContainer}>
          {isSearching ? (
            sparkSearchLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2962FF" style={{ marginRight: 8 }} />
                <Text style={styles.loadingText}>Searching sparks...</Text>
              </View>
            ) : sparkSearchResults.length === 0 ? (
              <Text style={styles.emptySearchText}>No sparks found for "{sparkSearch}"</Text>
            ) : (
              <View style={styles.vibesContainer}>
                {sparkSearchResults.map((spark) => {
                  const isSelected = selectedSparks.some((s) => s.id === spark.id);
                  const catStyle = getSparkStyle(spark.category);
                  return (
                    <TouchableOpacity
                      key={spark.id}
                      onPress={() => toggleSpark(spark)}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      style={[
                        styles.optionChip,
                        isSelected && {
                          backgroundColor: catStyle.bg,
                          borderColor: catStyle.text,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && {
                            color: catStyle.text,
                            fontFamily: FONTS.semiBold,
                          },
                        ]}
                      >
                        {spark.label}
                      </Text>
                      {isSelected ? (
                        <Check size={13} color={catStyle.text} strokeWidth={2.5} />
                      ) : (
                        <Plus size={13} color="#64748B" strokeWidth={2.2} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : sparksLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2962FF" style={{ marginRight: 8 }} />
              <Text style={styles.loadingText}>Loading sparks...</Text>
            </View>
          ) : (
            sparkCategories.map(({ category, sparks }) => {
              const catConfig = getSparkStyle(category);
              const isExpanded = expandedSparkCategory === category;
              const Icon = catConfig.icon || Sparkles;

              return (
                <View key={category} style={styles.categoryRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedSparkCategory(isExpanded ? null : category);
                      HapticsService.triggerSelection();
                    }}
                    style={[
                      styles.categoryHeader,
                      isExpanded && {
                        backgroundColor: catConfig.bg,
                      },
                    ]}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <View style={[styles.categoryIconBox, { backgroundColor: catConfig.bg }]}>
                        <Icon size={14} color={catConfig.text} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.categoryTitle}>{catConfig.label || category}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronDown size={16} color="#64748B" strokeWidth={2.2} />
                    ) : (
                      <ChevronRight size={16} color="#64748B" strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.categoryContent}>
                      <View style={styles.vibesContainer}>
                        {(sparks || []).map((spark) => {
                          const isSelected = selectedSparks.some((s) => s.id === spark.id);
                          return (
                            <TouchableOpacity
                              key={spark.id}
                              onPress={() => toggleSpark(spark)}
                              activeOpacity={0.7}
                              delayPressIn={0}
                              style={[
                                styles.optionChip,
                                isSelected && {
                                  backgroundColor: catConfig.bg,
                                  borderColor: catConfig.text,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.optionText,
                                  isSelected && {
                                    color: catConfig.text,
                                    fontFamily: FONTS.semiBold,
                                  },
                                ]}
                              >
                                {spark.label}
                              </Text>
                              {isSelected ? (
                                <Check size={13} color={catConfig.text} strokeWidth={2.5} />
                              ) : (
                                <Plus size={13} color="#64748B" strokeWidth={2.2} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  // ── Render Interests section ───────────────────────────────────────────────
  const renderInterestsSection = () => {
    const query = interestSearch.toLowerCase().trim();
    const isSearching = query.length > 0;
    const interestCategories = Object.values(INTEREST_CATEGORIES).filter(
      (cat) => cat.keywords && cat.keywords.length > 0
    );

    return (
      <View style={styles.sectionCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.sectionIconContainer, { backgroundColor: "#F3E8FF" }]}>
              <Palette size={18} color="#9333EA" strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Interests</Text>
              <Text style={styles.cardSubtitle}>Find people with shared passions</Text>
            </View>
          </View>
        </View>

        {/* 1. Pinned Selected Interests */}
        {selectedInterests.length > 0 && (
          <View style={styles.selectedVibesSection}>
            <View style={styles.vibesContainer}>
              {selectedInterests.map((interest) => {
                const style = getInterestStyle(interest);
                const Icon = style.icon;
                return (
                  <TouchableOpacity
                    key={`sel-int-${interest}`}
                    activeOpacity={0.7}
                    delayPressIn={0}
                    onPress={() => removeInterest(interest)}
                    style={[
                      styles.vibeChip,
                      { backgroundColor: style.bg, borderColor: style.text },
                    ]}
                  >
                    <View style={styles.vibeContent}>
                      {Icon && <Icon size={13} color={style.text} strokeWidth={2.2} />}
                      <Text style={[styles.vibeText, { color: style.text }]}>
                        {interest}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.removeIconContainer,
                        { backgroundColor: "rgba(255, 255, 255, 0.85)" },
                      ]}
                    >
                      <X size={11} color={style.text} strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.cardDivider} />
          </View>
        )}

        {/* 2. Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={16} color="#64748B" strokeWidth={2.2} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search interests..."
            placeholderTextColor="#94A3B8"
            value={interestSearch}
            onChangeText={(text) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setInterestSearch(text);
              if (text) setExpandedInterestCategory(null);
            }}
          />
          {interestSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setInterestSearch("");
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Search Results or Categories Accordion */}
        <View style={styles.categoriesContainer}>
          {isSearching ? (
            <View style={styles.vibesContainer}>
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
                        styles.optionChip,
                        isSelected && {
                          backgroundColor: style.bg,
                          borderColor: style.text,
                        },
                      ]}
                      onPress={() => toggleInterest(display)}
                      activeOpacity={0.7}
                      delayPressIn={0}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && {
                            color: style.text,
                            fontFamily: FONTS.semiBold,
                          },
                        ]}
                      >
                        {display}
                      </Text>
                      {isSelected ? (
                        <Check size={13} color={style.text} strokeWidth={2.5} />
                      ) : (
                        <Plus size={13} color="#64748B" strokeWidth={2.2} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ) : (
            interestCategories.map((category) => {
              const isExpanded = expandedInterestCategory === category.label;
              const Icon = category.icon;
              return (
                <View key={category.label} style={styles.categoryRow}>
                  <TouchableOpacity
                    style={[
                      styles.categoryHeader,
                      isExpanded && {
                        backgroundColor: category.bg,
                      },
                    ]}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedInterestCategory(isExpanded ? null : category.label);
                      HapticsService.triggerSelection();
                    }}
                    activeOpacity={0.7}
                    delayPressIn={0}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <View style={[styles.categoryIconBox, { backgroundColor: category.bg }]}>
                        {Icon && <Icon size={14} color={category.text} strokeWidth={2.2} />}
                      </View>
                      <Text style={styles.categoryTitle}>{category.label}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronDown size={16} color="#64748B" strokeWidth={2.2} />
                    ) : (
                      <ChevronRight size={16} color="#64748B" strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.categoryContent}>
                      <View style={styles.vibesContainer}>
                        {category.keywords.map((k) => {
                          const display = k.charAt(0).toUpperCase() + k.slice(1);
                          const style = getInterestStyle(display);
                          const isSelected = selectedInterests.includes(display);
                          return (
                            <TouchableOpacity
                              key={display}
                              style={[
                                styles.optionChip,
                                isSelected && {
                                  backgroundColor: style.bg,
                                  borderColor: style.text,
                                },
                              ]}
                              onPress={() => toggleInterest(display)}
                              activeOpacity={0.7}
                              delayPressIn={0}
                            >
                              <Text
                                style={[
                                  styles.optionText,
                                  isSelected && {
                                    color: style.text,
                                    fontFamily: FONTS.semiBold,
                                  },
                                ]}
                              >
                                {display}
                              </Text>
                              {isSelected ? (
                                <Check size={13} color={style.text} strokeWidth={2.5} />
                              ) : (
                                <Plus size={13} color="#64748B" strokeWidth={2.2} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  // ── Render Gender section ──────────────────────────────────────────────────
  const renderGenderSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.sectionIconContainer, { backgroundColor: "#FDF2F8" }]}>
            <Users size={18} color="#BE185D" strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Gender Identity</Text>
            <Text style={styles.cardSubtitle}>Filter by attendee gender</Text>
          </View>
        </View>
      </View>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((g) => {
          const isSelected = selectedGenders.includes(g.id);
          return (
            <TouchableOpacity
              key={g.id}
              style={[
                styles.genderChip,
                {
                  borderColor: isSelected ? g.text : g.border,
                  backgroundColor: isSelected ? g.bg : "#FFFFFF",
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => toggleGender(g.id)}
              activeOpacity={0.7}
              delayPressIn={0}
            >
              <Text style={[styles.genderSymbol, { color: g.text }]}>
                {g.symbol}
              </Text>
              <Text
                style={[
                  styles.genderText,
                  {
                    color: isSelected ? g.text : "#1E293B",
                    fontFamily: isSelected ? FONTS.semiBold : FONTS.medium,
                  },
                ]}
                numberOfLines={1}
              >
                {g.label}
              </Text>
              {isSelected ? (
                <Check size={12} color={g.text} strokeWidth={2.5} />
              ) : (
                <Plus size={12} color={g.text} strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Render Age section ─────────────────────────────────────────────────────
  const renderAgeSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.sectionIconContainer, { backgroundColor: "#FEF3C7" }]}>
            <Cake size={18} color="#D97706" strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Age Range</Text>
            <Text style={styles.cardSubtitle}>Filter by attendee age</Text>
          </View>
        </View>
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>
            {ageMin} – {ageMax} yrs
          </Text>
        </View>
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
  );

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      keyboardAvoiding={true}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      backdropColor="rgba(15, 23, 42, 0.5)"
      header={
        <View collapsable={false} style={styles.sheetHeader}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.sheetTitle}>Filter Profiles</Text>
            <TouchableOpacity
              onPress={handleReset}
              activeOpacity={0.7}
              delayPressIn={0}
              style={[
                styles.resetBtn,
                !hasActiveFilters && styles.resetBtnHidden,
              ]}
              disabled={!hasActiveFilters}
            >
              <Text style={styles.resetText}>Reset All</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <SwipeableModal.ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {renderSparksSection()}
        {renderInterestsSection()}
        {renderGenderSection()}
        {renderAgeSection()}

        {/* CTA Button placed cleanly at bottom of scroll content */}
        <TouchableOpacity
          style={[
            styles.applyButton,
            { backgroundColor: hasActiveFilters ? "#2962FF" : "#94A3B8" },
          ]}
          onPress={handleApply}
          activeOpacity={0.88}
        >
          <Text style={styles.applyButtonText}>
            {hasActiveFilters
              ? `Apply Filters (${totalActiveCount})`
              : "Apply Filters"}
          </Text>
        </TouchableOpacity>
      </SwipeableModal.ScrollView>
    </SwipeableModal>
  );
});

export default DiscoverFilterSheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    overflow: "hidden",
  },
  sheetHeader: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 36,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 20,
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  resetBtnHidden: {
    opacity: 0,
  },
  resetText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#EF4444",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // ── Seamless Card Section ─────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  cardTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 17,
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular, // Manrope Regular
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginTop: 12,
    marginBottom: 14,
  },

  // ── Selected Pinned Chips ─────────────────────────────────────────────────
  selectedVibesSection: {
    marginBottom: 2,
  },
  vibesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  vibeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 6,
  },
  vibeText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  removeIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Search Bar ────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#0F172A",
  },

  // ── Categories & Accordions ───────────────────────────────────────────────
  categoriesContainer: {
    gap: 4,
  },
  categoryRow: {
    marginBottom: 2,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: "#334155",
  },
  categoryContent: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },

  // ── Option Chips ──────────────────────────────────────────────────────────
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  optionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#334155",
  },

  // ── Gender Row & Chips ────────────────────────────────────────────────────
  genderRow: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
  },
  genderChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  genderText: {
    fontSize: 12.5,
  },
  genderSymbol: {
    fontSize: 14,
    fontWeight: "700",
  },

  // ── States & Loading ──────────────────────────────────────────────────────
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#64748B",
  },
  emptySearchText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 12,
  },

  // ── Age Range ─────────────────────────────────────────────────────────────
  ageBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  ageBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#2563EB",
  },
  sliderContainer: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },

  // ── Apply Button ──────────────────────────────────────────────────────────
  applyButton: {
    height: 52,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  applyButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
