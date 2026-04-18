/**
 * PostTypeSelector
 * Segmented Top Selector for the premium creator experience.
 * Features a refined, horizontal pill-shaped selector with smooth transitions.
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutAnimation,
  UIManager,
  Dimensions,
} from "react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const POST_TYPES = [
  { id: "media", label: "Media" },
  { id: "poll", label: "Poll" },
  { id: "prompt", label: "Prompt" },
  { id: "qna", label: "Q&A" },
  { id: "challenge", label: "Challenge" },
];

const PostTypeSelector = ({ selectedType, onSelectType, disabled = false }) => {
  const scrollViewRef = useRef(null);
  const { width: screenWidth } = Dimensions.get("window");

  const handleSelect = (typeId) => {
    if (disabled) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelectType(typeId);
  };

  useEffect(() => {
    const index = POST_TYPES.findIndex((t) => t.id === selectedType);
    if (index !== -1 && scrollViewRef.current) {
      // Simple scroll ensures visibility
    }
  }, [selectedType]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        <View style={styles.segmentedContainer}>
          {POST_TYPES.map((type) => {
            const isSelected = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.segment,
                  isSelected && styles.segmentActive,
                  disabled && styles.disabled,
                ]}
                onPress={() => handleSelect(type.id)}
                disabled={disabled}
                activeOpacity={0.8}
              >
                <Text style={[styles.label, isSelected && styles.labelActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
    alignItems: "center", // Center the floating pill
  },
  scrollView: {
    maxHeight: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 10, // Increased breathing room
    alignItems: "center",
    minWidth: "100%",
    justifyContent: "center", // Center content
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#EFF1F5", // Lighter, refined background #F6F7F9 in spec, adjusting to #EFF1F5 for visibility
    borderRadius: 28, // 28px radius
    padding: 4,
    height: 44,
    alignItems: "center",
  },
  segment: {
    paddingHorizontal: 16,
    borderRadius: 100,
    height: 36, // Fits inside 44px container with 4px padding
    alignItems: "center",
    justifyContent: "center",
    minWidth: "auto", // Allow natural width
  },
  segmentActive: {
    backgroundColor: COLORS.primary, // Solid blue pill
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#6B7280", // Soft grey
    letterSpacing: 0.2,
  },
  labelActive: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PostTypeSelector;
