import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

/**
 * PremiumHeader - Scroll-reactive header with platform-specific depth cues
 *
 * Creates a premium header experience where:
 * - Base state (scrollY = 0): Clean, no shadow, seamless integration
 * - Elevated state (scrollY > threshold): Platform-specific depth cues
 *   - iOS: Subtle blur + translucency
 *   - Android: Soft diffused shadow
 *
 * @param {object} scrollY - Reanimated shared value from scroll handler
 * @param {React.ReactNode} children - Header content (logo, icons, etc.)
 * @param {object} style - Additional styles for customization
 */

// Header dimensions
const HEADER_CONTENT_HEIGHT = 50;
const SCROLL_THRESHOLD = 20; // Pixels to scroll before elevation kicks in

const PremiumHeader = ({ scrollY, children, style }) => {
  const insets = useSafeAreaInsets();
  const totalHeight = HEADER_CONTENT_HEIGHT + insets.top;

  // Animated opacity for elevation effects (blur, shadow, separator)
  const elevationOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Animated background opacity - transparent at rest, solid when scrolled
  const backgroundStyle = useAnimatedStyle(() => {
    // From 0 (transparent) to 0.98 (nearly solid) when scrolled
    // This allows seamless blending with the content below at rest
    const bgOpacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [0, Platform.OS === "ios" ? 0.95 : 0.98],
      Extrapolation.CLAMP,
    );

    return {
      backgroundColor: `rgba(250, 249, 247, ${bgOpacity})`, // COLORS.background with opacity
    };
  });

  return (
    <View style={[styles.container, { height: totalHeight }, style]}>
      {/* iOS Blur Layer - only visible when scrolled */}
      {Platform.OS === "ios" && (
        <Animated.View style={[StyleSheet.absoluteFill, elevationOpacity]}>
          <BlurView
            intensity={20}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* Background Layer */}
      <Animated.View style={[styles.backgroundLayer, backgroundStyle]} />

      {/* Content Container */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {children}
      </View>

      {/* Bottom Separator - fades in on scroll */}
      <Animated.View style={[styles.separator, elevationOpacity]} />

      {/* Android Shadow Layer - appears on scroll */}
      {Platform.OS === "android" && (
        <Animated.View style={[styles.androidShadow, elevationOpacity]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  separator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)", // Very subtle separator
  },
  androidShadow: {
    position: "absolute",
    bottom: -8,
    left: 0,
    right: 0,
    height: 8,
    // Soft gradient shadow effect via elevation + shadow props
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
});

// Export constants for external use
export const PREMIUM_HEADER_HEIGHT = HEADER_CONTENT_HEIGHT;
export const getPremiumHeaderTotalHeight = (insets) =>
  HEADER_CONTENT_HEIGHT + insets.top;

export default PremiumHeader;
