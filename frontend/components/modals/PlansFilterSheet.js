import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import {
  Cake,
  Users,
  Wallet,
  Check,
  X,
  RotateCcw,
} from "lucide-react-native";
import SwipeableModal from "./SwipeableModal";
import { COLORS, SPACING, BORDER_RADIUS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import RangeSlider from "../ui/RangeSlider";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const AGE_FILTER_PRESETS = [
  { key: "any", label: "Any Age", min: null, max: null },
  { key: "my_age", label: "My Age", min: "my_age", max: "my_age" },
  { key: "18-24", label: "18–24", min: 18, max: 24 },
  { key: "21-29", label: "21–29", min: 21, max: 29 },
  { key: "25-35", label: "25–35", min: 25, max: 35 },
  { key: "30+", label: "30+", min: 30, max: 99 },
];

const GENDER_FILTER_OPTS = [
  { id: "all", label: "Everyone" },
  { id: "Female", label: "Women only" },
  { id: "Male", label: "Men only" },
];

const COST_FILTER_OPTS = [
  { id: "all", label: "All Costs" },
  { id: "free", label: "Free" },
  { id: "self_pay", label: "Self-pay" },
  { id: "split", label: "Split" },
  { id: "entry_fee", label: "Entry fee" },
];

export default function PlansFilterSheet({
  visible,
  onClose,
  onApply,
  initialFilters = {},
  viewerAge = null,
}) {
  const [ageMin, setAgeMin] = useState(initialFilters.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState(initialFilters.ageMax ?? 99);
  const [isAgeFilterActive, setIsAgeFilterActive] = useState(
    initialFilters.ageMin != null || initialFilters.ageMax != null
  );
  const [activeAgePreset, setActiveAgePreset] = useState("any");
  const [genderPreference, setGenderPreference] = useState(
    initialFilters.genderPreference || "all"
  );
  const [costType, setCostType] = useState(initialFilters.costType || "all");

  // Sync with initialFilters whenever sheet opens
  useEffect(() => {
    if (!visible) return;
    const hasMin = initialFilters.ageMin != null;
    const hasMax = initialFilters.ageMax != null;
    if (hasMin || hasMax) {
      const min = initialFilters.ageMin ?? 18;
      const max = initialFilters.ageMax ?? 99;
      setAgeMin(min);
      setAgeMax(max);
      setIsAgeFilterActive(true);

      if (viewerAge != null && min === viewerAge && max === viewerAge) {
        setActiveAgePreset("my_age");
      } else if (min === 18 && max === 24) {
        setActiveAgePreset("18-24");
      } else if (min === 21 && max === 29) {
        setActiveAgePreset("21-29");
      } else if (min === 25 && max === 35) {
        setActiveAgePreset("25-35");
      } else if (min === 30 && max === 99) {
        setActiveAgePreset("30+");
      } else {
        setActiveAgePreset("custom");
      }
    } else {
      setAgeMin(18);
      setAgeMax(99);
      setIsAgeFilterActive(false);
      setActiveAgePreset("any");
    }
    setGenderPreference(initialFilters.genderPreference || "all");
    setCostType(initialFilters.costType || "all");
  }, [visible, initialFilters, viewerAge]);

  const hasAnyActiveFilters =
    isAgeFilterActive ||
    (genderPreference && genderPreference !== "all") ||
    (costType && costType !== "all");

  const handleReset = () => {
    HapticsService.triggerImpactLight();
    setAgeMin(18);
    setAgeMax(99);
    setIsAgeFilterActive(false);
    setActiveAgePreset("any");
    setGenderPreference("all");
    setCostType("all");
  };

  const handleApply = () => {
    HapticsService.triggerImpactMedium();
    onApply({
      ageMin: isAgeFilterActive ? ageMin : null,
      ageMax: isAgeFilterActive ? ageMax : null,
      genderPreference: genderPreference !== "all" ? genderPreference : null,
      costType: costType !== "all" ? costType : null,
    });
    onClose();
  };

  const handlePresetSelect = (preset) => {
    HapticsService.triggerImpactLight();
    setActiveAgePreset(preset.key);
    if (preset.key === "any") {
      setIsAgeFilterActive(false);
      setAgeMin(18);
      setAgeMax(99);
    } else if (preset.key === "my_age") {
      setIsAgeFilterActive(true);
      const targetAge = viewerAge || 25;
      setAgeMin(targetAge);
      setAgeMax(targetAge);
    } else {
      setIsAgeFilterActive(true);
      setAgeMin(preset.min);
      setAgeMax(preset.max);
    }
  };

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
            <Text style={styles.sheetTitle}>Filter Plans</Text>
            {hasAnyActiveFilters && (
              <TouchableOpacity
                onPress={handleReset}
                activeOpacity={0.7}
                style={styles.resetBtn}
                hitSlop={8}
              >
                <RotateCcw size={14} color={COLORS.primary} strokeWidth={2.2} />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Age Range Section ────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: "#EEF2FF" }]}>
                <Cake size={18} color={COLORS.primary} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Age Range</Text>
                <Text style={styles.cardSubtitle}>Find plans matching an age group</Text>
              </View>
            </View>
            {isAgeFilterActive && (
              <View style={styles.ageBadge}>
                <Text style={styles.ageBadgeText}>
                  {ageMin === ageMax ? `${ageMin} yrs` : `${ageMin} – ${ageMax} yrs`}
                </Text>
              </View>
            )}
          </View>

          {/* Preset Chips */}
          <View style={styles.presetsRow}>
            {AGE_FILTER_PRESETS.map((preset) => {
              if (preset.key === "my_age" && viewerAge == null) return null;
              const isSelected = activeAgePreset === preset.key;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {preset.key === "my_age" ? `My Age (${viewerAge})` : preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interactive RangeSlider */}
          <View style={styles.sliderContainer}>
            <RangeSlider
              min={18}
              max={99}
              initialMin={ageMin}
              initialMax={ageMax}
              onValueChange={({ min, max }) => {
                setAgeMin(min);
                setAgeMax(max);
                setIsAgeFilterActive(true);
                setActiveAgePreset("custom");
              }}
            />
          </View>
        </View>

        {/* ── Gender Preference Section ─────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: "#FCE4EC" }]}>
                <Users size={18} color="#C2185B" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Gender Preference</Text>
                <Text style={styles.cardSubtitle}>Host audience preference</Text>
              </View>
            </View>
          </View>

          <View style={styles.chipsRow}>
            {GENDER_FILTER_OPTS.map((opt) => {
              const isSelected = genderPreference === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setGenderPreference(opt.id);
                  }}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <Check size={14} color={COLORS.primary} strokeWidth={2.5} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Cost Type Section ─────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: "#E0F2FE" }]}>
                <Wallet size={18} color="#0284C7" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Cost</Text>
                <Text style={styles.cardSubtitle}>Free or paid plan activities</Text>
              </View>
            </View>
          </View>

          <View style={styles.chipsRow}>
            {COST_FILTER_OPTS.map((opt) => {
              const isSelected = costType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setCostType(opt.id);
                  }}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <Check size={14} color={COLORS.primary} strokeWidth={2.5} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      isSelected ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Footer Actions ────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={handleApply}
          activeOpacity={0.85}
        >
          <Text style={styles.applyBtnText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  sheetHeader: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 22,
    color: "#0F172A",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  resetText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sectionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#64748B",
  },
  ageBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  ageBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: COLORS.primary,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: COLORS.primary,
  },
  chipInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
  },
  chipText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },
  chipTextActive: {
    color: COLORS.primary,
  },
  chipTextInactive: {
    color: "#475569",
  },
  sliderContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
