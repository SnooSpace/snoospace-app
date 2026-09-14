import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { COLORS } from "../../constants/theme";

/**
 * CelebrationCheckmarkHUD
 *
 * A brief, centered celebration checkmark HUD that displays in the center
 * of the screen for ~1 second when an item (like ticket or promo code) is updated.
 *
 * @param {boolean} visible - Whether the HUD is visible
 * @param {string} message - Caption text below the checkmark (e.g., "Ticket updated")
 * @param {number} duration - Total display duration before fade out (default: 1000ms)
 * @param {function} onDismiss - Callback when fade out animation completes
 */
export default function CelebrationCheckmarkHUD({
  visible,
  message = "Updated",
  duration = 1000,
  onDismiss,
}) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Trigger haptic feedback
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        // Haptics unavailable
      }

      // Spring entry animation
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 200,
        mass: 0.8,
      });
      opacity.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withSpring(0, {
        damping: 16,
        stiffness: 180,
      });

      // Auto dismiss after duration
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(
          0,
          {
            duration: 220,
            easing: Easing.in(Easing.cubic),
          },
          (finished) => {
            if (finished && onDismiss) {
              runOnJS(onDismiss)();
            }
          }
        );
        scale.value = withTiming(0.92, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        });
        translateY.value = withTiming(-8, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        });
      }, duration);
    } else {
      scale.value = 0.5;
      opacity.value = 0;
      translateY.value = 12;
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Decorative celebration accent dots */}
        <View style={[styles.particle, styles.particle1]} />
        <View style={[styles.particle, styles.particle2]} />
        <View style={[styles.particle, styles.particle3]} />
        <View style={[styles.particle, styles.particle4]} />

        {/* Soft-tinted circular icon container */}
        <View style={styles.iconCircle}>
          <Check size={28} color="#059669" strokeWidth={3} />
        </View>

        {/* Text Label */}
        {message ? (
          <Text style={styles.labelText} numberOfLines={1}>
            {message}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
  },
  card: {
    width: 126,
    height: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  labelText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#1D1D1F",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  // Celebration accent dots
  particle: {
    position: "absolute",
    borderRadius: 99,
  },
  particle1: {
    top: 14,
    right: 22,
    width: 6,
    height: 6,
    backgroundColor: "#F59E0B", // amber
  },
  particle2: {
    top: 24,
    left: 20,
    width: 5,
    height: 5,
    backgroundColor: "#10B981", // emerald
  },
  particle3: {
    bottom: 34,
    right: 18,
    width: 5,
    height: 5,
    backgroundColor: "#8B5CF6", // purple
  },
  particle4: {
    bottom: 38,
    left: 24,
    width: 4,
    height: 4,
    backgroundColor: "#EC4899", // pink
  },
});
