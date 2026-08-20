import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Svg, { Circle, Rect, Path, G, Ellipse } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

function EmptyFeedState() {
  const navigation = useNavigation();
  const translateY = useSharedValue(0);
  const sparkleOpacity = useSharedValue(1);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    sparkleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [translateY, sparkleOpacity]);

  const floatAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleExplore = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("Search");
  };

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper (100% UI-thread Reanimated worklet) */}
        <Animated.View style={[styles.floatingWrapper, floatAnimatedStyle]}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            {/* Soft Brand Glow */}
            <Circle cx="120" cy="120" r="90" fill="#2563EB" fillOpacity={0.06} />

            {/* Home/Feed Container (Smartphone + House Silhouette) */}
            <Path
              d="M60 70C60 58.9543 68.9543 50 80 50H160C171.046 50 180 58.9543 180 70V170C180 181.046 171.046 190 160 190H80C68.9543 190 60 181.046 60 170V70Z"
              fill="white"
              stroke="#0F172A"
              strokeWidth="4"
            />

            {/* Roof Shape inside the "Screen" */}
            <Path
              d="M85 90L120 65L155 90V120H85V90Z"
              fill="#F0F9FF"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Blank Feed Rows (Abstract placeholders) */}
            <Rect x="85" y="135" width="70" height="8" rx="4" fill="#2563EB" fillOpacity={0.1} />
            <Rect x="85" y="150" width="50" height="8" rx="4" fill="#22D3EE" fillOpacity={0.1} />

            {/* Discovery Compass / Navigation element */}
            <G transform="translate(145, 160)">
              <Circle cx="0" cy="0" r="22" fill="white" stroke="#0F172A" strokeWidth="3" />
              <Path d="M0 -10L4 0L0 10L-4 0L0 -10Z" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
              <Path d="M-10 0L0 -4L10 0L0 4L-10 0Z" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
            </G>

            {/* Bottom Interface Bar */}
            <Rect x="100" y="180" width="40" height="4" rx="2" fill="#0F172A" fillOpacity={0.2} />
          </Svg>

          {/* Floating Sparkles Overlay using Reanimated View */}
          <Animated.View style={[StyleSheet.absoluteFill, sparkleAnimatedStyle]} pointerEvents="none">
            <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
              <Path
                d="M190 90L193 96L199 99L193 102L190 108L187 102L181 99L187 96L190 90Z"
                fill="#2563EB"
                stroke="#0F172A"
                strokeWidth="1.5"
              />
              <Circle cx="50" cy="100" r="4" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* Static shadow on the floor */}
        <View style={styles.shadowContainer}>
          <Svg width="144" height="8" viewBox="0 0 144 8" fill="none">
            <Ellipse cx="72" cy="4" rx="72" ry="4" fill="rgba(30, 58, 138, 0.05)" />
          </Svg>
        </View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>Your feed is empty</Text>
        <Text style={styles.subtitle}>
          Follow people or communities to see posts and find upcoming events to fill your home screen with things you love.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <Animated.View style={[{ width: "100%" }, buttonAnimatedStyle]}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleExplore}
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed ? 0.95 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>Explore discovery</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export default React.memo(EmptyFeedState);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  illustrationContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 32,
  },
  floatingWrapper: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    width: "100%",
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
});
