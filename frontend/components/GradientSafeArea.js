import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

/**
 * GradientSafeArea - Premium gradient overlay for status bar area
 *
 * Creates a soft gradient from brand color to transparent, providing
 * natural contrast for white status bar icons on white backgrounds.
 *
 * @param {string} variant - Color variant: 'primary', 'secondary', or 'neutral'
 * @param {number} height - Total gradient height (default: auto based on safe area)
 * @param {object} style - Additional styles
 */
const GradientSafeArea = ({ variant = "primary", height, style, children }) => {
  const insets = useSafeAreaInsets();

  // Get gradient colors based on variant
  const getGradientColors = () => {
    switch (variant) {
      case "primary":
        return (
          COLORS.statusBarGradients?.primary || [
            "rgba(25, 118, 210, 0.15)",
            "rgba(25, 118, 210, 0)",
          ]
        );
      case "secondary":
        return (
          COLORS.statusBarGradients?.secondary || [
            "rgba(66, 133, 244, 0.12)",
            "rgba(66, 133, 244, 0)",
          ]
        );
      case "neutral":
        return (
          COLORS.statusBarGradients?.neutral || [
            "rgba(0, 0, 0, 0.05)",
            "rgba(0, 0, 0, 0)",
          ]
        );
      default:
        return ["rgba(25, 118, 210, 0.15)", "rgba(25, 118, 210, 0)"];
    }
  };

  const gradientHeight = height || insets.top + 80; // Default extends beyond status bar

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradient, { height: gradientHeight }]}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  gradient: {
    width: "100%",
  },
});

export default GradientSafeArea;
