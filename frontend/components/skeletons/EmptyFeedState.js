import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { MoveRight } from "lucide-react-native";
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

const EMPTY_FEED_ILLUSTRATION = require("../../assets/Illustrations/New_Feed_Empty.webp");

function EmptyFeedState() {
  const navigation = useNavigation();
  const translateY = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [translateY]);

  const floatAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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
          <Image
            source={EMPTY_FEED_ILLUSTRATION}
            style={styles.illustrationImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
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
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>Explore</Text>
            <MoveRight size={18} color={COLORS.primary || "#2962FF"} strokeWidth={2} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export default React.memo(EmptyFeedState);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  illustrationContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  floatingWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  illustrationImage: {
    width: 250,
    height: 250,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: FONTS.semiBold,
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
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.primary || "#2962FF",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary || "#2962FF",
    fontSize: 16,
    textAlign: "center",
  },
});
