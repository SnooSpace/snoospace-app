import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "../constants/theme";

// Module-level flag to track if animation has played this session
let hasAnimatedThisSession = false;

/**
 * Get time-based greeting based on current hour
 * @param {number} [testHour] - Optional hour for testing (0-23)
 * @returns {{ text: string, emoji: string }} Greeting object
 */
const getGreetingData = (testHour) => {
  const hour = testHour !== undefined ? testHour : new Date().getHours();

  if (hour >= 0 && hour < 4) {
    return { text: "Our night owl is here", emoji: "🦉" };
  } else if (hour >= 4 && hour < 7) {
    return { text: "We got an Early Bird", emoji: "🐓" };
  } else if (hour >= 7 && hour < 12) {
    return { text: "Good morning", emoji: "👋" };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Good afternoon", emoji: "👋" };
  } else {
    // 5PM to 11:59PM
    return { text: "Good evening", emoji: "👋" };
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
  const waveAnim = useSharedValue(0);

  useEffect(() => {
    // Only animate once per app session
    if (hasAnimatedThisSession) return;

    hasAnimatedThisSession = true;

    // Start animation after 300ms delay
    const timeout = setTimeout(() => {
      waveAnim.value = withSequence(
        withTiming(-8, { duration: 150 }),
        withTiming(8, { duration: 150 }),
        withTiming(0, { duration: 200 })
      );
    }, 300);

    return () => clearTimeout(timeout);
  }, []);

  const { text: greetingText, emoji } = getGreetingData(testHour);
  const displayName = name || "User";

  // Animated style for the emoji rotation
  const animatedEmojiStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${waveAnim.value}deg` }],
    };
  });

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="header"
      accessibilityLabel={`${greetingText}, ${displayName}`}
    >
      {/* Line 1: Greeting with animated emoji */}
      <View style={styles.greetingLine}>
        <Text style={styles.greetingText}>{greetingText} </Text>
        <Animated.Text
          style={[styles.emoji, animatedEmojiStyle]}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          {emoji}
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
