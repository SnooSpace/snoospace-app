import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { COLORS } from "../constants/theme";

// Module-level flag to track if animation has played this session
let hasAnimatedThisSession = false;

/**
 * Get time-based greeting based on current hour
 * @param {number} [testHour] - Optional hour for testing (0-23)
 * @returns {string} Greeting text without emoji
 */
const getGreeting = (testHour) => {
  const hour = testHour !== undefined ? testHour : new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  } else {
    // 5PM to 4:59AM
    return "Good evening";
  }
};

/**
 * HomeGreetingHeader - A refined greeting header with animated emoji
 *
 * @param {Object} props
 * @param {string} props.name - User's full name
 * @param {number} [props.testHour] - Optional hour for testing time-based greeting
 */
export default function HomeGreetingHeader({ name, testHour }) {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only animate once per app session
    if (hasAnimatedThisSession) return;

    hasAnimatedThisSession = true;

    // Start animation after 300ms delay
    const timeout = setTimeout(() => {
      Animated.sequence([
        // Rotate to -8 degrees
        Animated.timing(waveAnim, {
          toValue: -8,
          duration: 150,
          useNativeDriver: true,
        }),
        // Rotate to +8 degrees
        Animated.timing(waveAnim, {
          toValue: 8,
          duration: 150,
          useNativeDriver: true,
        }),
        // Return to 0
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 300);

    return () => clearTimeout(timeout);
  }, [waveAnim]);

  const greeting = getGreeting(testHour);
  const displayName = name || "User";

  // Interpolate the rotation
  const rotate = waveAnim.interpolate({
    inputRange: [-8, 0, 8],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="header"
      accessibilityLabel={`${greeting}, ${displayName}`}
    >
      {/* Line 1: Greeting with animated emoji */}
      <View style={styles.greetingLine}>
        <Text style={styles.greetingText}>{greeting} </Text>
        <Animated.Text
          style={[styles.emoji, { transform: [{ rotate }] }]}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          👋
        </Animated.Text>
      </View>

      {/* Line 2: User's name (max 2 lines) */}
      <Text style={styles.nameText} numberOfLines={2}>
        {displayName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    // Fixed height to prevent layout shifts with different name lengths
    // Approximately: greeting line (24px) + name line (2 lines max ~70px) + spacing
    minHeight: 90,
  },
  greetingLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  emoji: {
    fontSize: 18,
    // Prevent emoji from causing layout shifts during animation
    textAlign: "center",
  },
  nameText: {
    fontSize: 28,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
});
