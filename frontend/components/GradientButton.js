import React from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Pressable as GHPressable } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

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
  useGHPressable = false,
}) => {
  const ButtonComponent = useGHPressable ? GHPressable : TouchableOpacity;
  
  const getStyle = (state) => {
    const isPressed = typeof state === "object" ? state.pressed : false;
    const base = [styles.container, disabled && styles.disabled, style];
    if (useGHPressable) {
      return [...base, isPressed && { opacity: 0.8 }];
    }
    return base;
  };

  const pressProps = useGHPressable
    ? {
        onPress,
        disabled: disabled || loading,
        style: getStyle,
      }
    : {
        activeOpacity: 0.8,
        onPress,
        disabled: disabled || loading,
        style: getStyle(),
      };

  return (
    <ButtonComponent {...pressProps}>
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
          <SnooLoader color={COLORS.textInverted} size="small" />
        ) : (
          <>
            {icon && icon}
            <Text style={[styles.text, textStyle, icon && { marginLeft: 8 }]}>
              {title}
            </Text>
          </>
        )}
      </LinearGradient>
    </ButtonComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow, // Use the new colored shadow (Glow)
    overflow: "visible",
  },
  gradient: {
    width: "100%", // Ensure gradient fills the container
    alignSelf: "stretch",
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
