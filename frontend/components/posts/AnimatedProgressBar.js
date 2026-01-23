/**
 * AnimatedProgressBar
 * A reusable animated progress bar component using React Native Animated API
 * (Using RN Animated instead of Reanimated to avoid worklet conflicts)
 */

import React, { useEffect, useRef, memo } from "react";
import { Animated, StyleSheet } from "react-native";

const AnimatedProgressBar = memo(({ percentage, isSelected }) => {
  const widthAnim = useRef(new Animated.Value(percentage)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 400,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [percentage, widthAnim]);

  return (
    <Animated.View
      style={[
        styles.progressFill,
        {
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
          backgroundColor: isSelected ? "#3665f3" : "#daecf8",
        },
      ]}
    />
  );
});

AnimatedProgressBar.displayName = "AnimatedProgressBar";

const styles = StyleSheet.create({
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
});

export default AnimatedProgressBar;
