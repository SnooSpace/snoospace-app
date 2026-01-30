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
import { X, Plus, Check, Search } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { COLORS, BORDER_RADIUS } from "../constants/theme";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const BORDER_COLOR = COLORS.border;

// Blue/Cyan gradient for interests (consistent color)
const INTEREST_GRADIENT = ["#448AFF", "#2962FF"];

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
    // Top Section: Selected Chips (Removable)
    if (isRemove) {
      return (
        <View style={styles.selectedChip}>
          <Text style={styles.selectedChipText}>{value}</Text>
          <TouchableOpacity
            onPress={onPress}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <X size={14} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      );
    }

    // Bottom Section: Options (Selectable)
    if (isSelected) {
      // Selected Option -> Blue Border + Check
      return (
        <TouchableOpacity
          style={[styles.presetChip, styles.presetChipSelected]}
          onPress={onPress}
        >
          <Text style={styles.presetChipTextSelected}>{value}</Text>
          <Check size={14} color={PRIMARY_COLOR} strokeWidth={2.5} />
        </TouchableOpacity>
      );
    }

    // Default Option -> Grey Border
    return (
      <TouchableOpacity
        style={styles.presetChip}
        onPress={onPress}
        disabled={selected.length >= maxSelections}
      >
        <Text
          style={[
            styles.presetChipText,
            selected.length >= maxSelections && styles.presetChipTextDisabled,
          ]}
        >
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      {searchable && (
        <View style={styles.searchContainer}>
          <Search
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
              <X size={18} color={LIGHT_TEXT_COLOR} strokeWidth={2.5} />
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
                    false,
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
              <Plus size={18} color={PRIMARY_COLOR} strokeWidth={2.5} />
              <Text
                style={[
                  styles.addCustomText,
                  selected.length >= maxSelections &&
                    styles.addCustomTextDisabled,
                ]}
              >
                Add custom interest
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
                <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCustomInput(false);
                  setCustomInput("");
                }}
              >
                <X size={20} color={LIGHT_TEXT_COLOR} strokeWidth={2.5} />
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
    borderRadius: 12, // Updated
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB", // Updated
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15, // Updated
    color: TEXT_COLOR,
  },
  selectedContainer: {
    gap: 8,
    marginTop: 8,
  },
  selectedLabel: {
    fontSize: 13, // Updated
    fontWeight: "600",
    color: "#6B7280", // Updated
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
    gap: 6,
    // Subtle elevation
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedChipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  presetsContainer: {
    gap: 8,
    marginTop: 12,
  },
  presetsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
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
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  presetChipSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: PRIMARY_COLOR,
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetChipText: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontWeight: "400",
  },
  presetChipTextDisabled: {
    color: "#9CA3AF",
  },
  presetChipTextSelected: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: "600",
  },
  customContainer: {
    marginTop: 8,
  },
  addCustomButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 6,
  },
  addCustomText: {
    color: PRIMARY_COLOR,
    fontSize: 15,
    fontWeight: "500",
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
    borderColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_COLOR,
    backgroundColor: "#FFFFFF",
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
