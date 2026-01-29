import React from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from "../constants/theme";

const GradientButton = ({
  onPress,
  title,
  loading = false,
  disabled = false,
  style,
  textStyle,
  gradientStyle,
  icon,
  colors,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={
          disabled
            ? ["#E5E5EA", "#E5E5EA"]
            : colors && colors.length > 1
              ? colors
              : COLORS.primaryGradient
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, gradientStyle]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.textInverted} size="small" />
        ) : (
          <>
            {icon && icon}
            <Text style={[styles.text, textStyle, icon && { marginLeft: 8 }]}>
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow, // Use the new colored shadow (Glow)
    overflow: "visible",
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.7,
    ...SHADOWS.sm, // Reduced shadow for disabled
  },
});

export default GradientButton;
