import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { COLORS, BORDER_RADIUS } from "../constants/theme";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

// Blue/Cyan gradient for interests (consistent color)
const INTEREST_GRADIENT = ["#4facfe", "#00f2fe"]; // Blue to Cyan

const getGradientForString = (str) => {
  // Return the same gradient for all interests (consistent color)
  return INTEREST_GRADIENT;
};

export default function ChipSelector({
  selected = [],
  onSelectionChange,
  presets = [],
  allowCustom = false,
  maxSelections = 20,
  placeholder = "Select items or add custom",
  searchable = false,
  variant = "solid", // 'solid' | 'gradient-pastel' | 'glass'
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const filteredPresets = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return presets;
    }
    const query = searchQuery.toLowerCase().trim();
    return presets.filter((item) => {
      const label =
        typeof item === "string" ? item : item.label || item.name || "";
      return label.toLowerCase().includes(query);
    });
  }, [presets, searchQuery, searchable]);

  const handleToggle = (item) => {
    const value =
      typeof item === "string" ? item : item.label || item.name || item;
    const isSelected = selected.includes(value);

    if (isSelected) {
      onSelectionChange(selected.filter((s) => s !== value));
    } else {
      if (selected.length >= maxSelections) {
        return;
      }
      onSelectionChange([...selected, value]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (
      trimmed &&
      !selected.includes(trimmed) &&
      selected.length < maxSelections
    ) {
      onSelectionChange([...selected, trimmed]);
      setCustomInput("");
      setShowCustomInput(false);
    }
  };

  const handleRemove = (value) => {
    onSelectionChange(selected.filter((s) => s !== value));
  };

  const renderChip = (value, isSelected, onPress, isRemove = false) => {
    const isGradient = variant === "gradient-pastel";
    const isGlass = variant === "glass";

    // Default Solid Style
    let containerStyle = [styles.chip];
    let textStyle = [styles.chipText];
    let iconColor = isRemove ? TEXT_COLOR : "#FFFFFF";

    if (isRemove) {
      // Selected chips in the top list
      if (isGradient) {
        // Solid yellow background for selected chips
        return (
          <View
            style={[
              styles.chip,
              { backgroundColor: "#FFD700", borderWidth: 0 },
            ]}
          >
            <Text
              style={[styles.chipText, { color: "#000", fontWeight: "600" }]}
            >
              {value}
            </Text>
            <TouchableOpacity
              onPress={onPress}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Ionicons name="close-circle" size={16} color="rgba(0,0,0,0.5)" />
            </TouchableOpacity>
          </View>
        );
      } else if (isGlass) {
        return (
          <View style={[styles.chip, styles.glassChip]}>
            <Text style={[styles.chipText, styles.glassText]}>{value}</Text>
            <TouchableOpacity
              onPress={onPress}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Ionicons name="close-circle" size={16} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        );
      }
    } else {
      // Preset chips
      containerStyle = [
        styles.presetChip,
        selected.length >= maxSelections &&
          !isSelected &&
          styles.presetChipDisabled,
      ];
      textStyle = [styles.presetChipText];

      if (isSelected && isGradient) {
        // Just show green checkmark, no background color change
        return (
          <TouchableOpacity style={[styles.presetChip]} onPress={onPress}>
            <Text style={styles.presetChipText}>{value}</Text>
            <Ionicons
              name="checkmark"
              size={16}
              color="#22C55E"
              style={styles.checkIcon}
            />
          </TouchableOpacity>
        );
      }

      if (isSelected && isGlass) {
        return (
          <TouchableOpacity
            style={[styles.presetChip, styles.glassChipSelected]}
            onPress={onPress}
          >
            <Text style={[styles.presetChipText, styles.glassTextSelected]}>
              {value}
            </Text>
            <Ionicons
              name="checkmark"
              size={16}
              color={PRIMARY_COLOR}
              style={styles.checkIcon}
            />
          </TouchableOpacity>
        );
      }
    }

    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        disabled={!isRemove && selected.length >= maxSelections && !isSelected}
      >
        <Text style={textStyle}>{value}</Text>
        {isRemove ? (
          <Ionicons name="close-circle" size={16} color={TEXT_COLOR} />
        ) : (
          isSelected && (
            <Ionicons
              name="checkmark"
              size={16}
              color="#FFFFFF"
              style={styles.checkIcon}
            />
          )
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      {searchable && (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={LIGHT_TEXT_COLOR}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={LIGHT_TEXT_COLOR}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={LIGHT_TEXT_COLOR}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Selected Chips */}
      {selected.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>
            Selected ({selected.length}/{maxSelections}):
          </Text>
          <View style={styles.chipsContainer}>
            {selected.map((item, index) => {
              const value =
                typeof item === "string"
                  ? item
                  : item.label || item.name || item;
              return (
                <View key={index}>
                  {renderChip(value, true, () => handleRemove(value), true)}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Preset Options */}
      {filteredPresets.length > 0 && (
        <View style={styles.presetsContainer}>
          <Text style={styles.presetsLabel}>Options:</Text>
          <View style={styles.presetsGrid}>
            {filteredPresets.map((item, index) => {
              const value =
                typeof item === "string"
                  ? item
                  : item.label || item.name || item;
              const isSelected = selected.includes(value);
              return (
                <Animated.View
                  key={index}
                  entering={FadeInDown.delay(index * 30).springify()}
                >
                  {renderChip(
                    value,
                    isSelected,
                    () => handleToggle(item),
                    false
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
      )}

      {/* Custom Input */}
      {allowCustom && (
        <View style={styles.customContainer}>
          {!showCustomInput ? (
            <TouchableOpacity
              style={styles.addCustomButton}
              onPress={() => setShowCustomInput(true)}
              disabled={selected.length >= maxSelections}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={PRIMARY_COLOR}
              />
              <Text
                style={[
                  styles.addCustomText,
                  selected.length >= maxSelections &&
                    styles.addCustomTextDisabled,
                ]}
              >
                Add Custom
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.customInputContainer}>
              <TextInput
                style={styles.customInput}
                placeholder="Enter custom value"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={customInput}
                onChangeText={setCustomInput}
                autoCapitalize="words"
                onSubmitEditing={handleAddCustom}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddCustom}
                disabled={
                  !customInput.trim() || selected.length >= maxSelections
                }
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCustomInput(false);
                  setCustomInput("");
                }}
              >
                <Ionicons name="close" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  selectedContainer: {
    gap: 8,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
    gap: 6,
  },
  glassChip: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  glassChipSelected: {
    backgroundColor: "#F0F8FF", // Very light blue
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  glassText: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  glassTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  presetsContainer: {
    gap: 8,
  },
  presetsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  presetChipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetChipText: {
    color: TEXT_COLOR,
    fontSize: 14,
  },
  presetChipTextSelected: {
    color: "#FFFFFF",
  },
  checkIcon: {
    marginLeft: 2,
  },
  customContainer: {
    marginTop: 4,
  },
  addCustomButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  addCustomText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: "600",
  },
  addCustomTextDisabled: {
    color: LIGHT_TEXT_COLOR,
    opacity: 0.5,
  },
  customInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
