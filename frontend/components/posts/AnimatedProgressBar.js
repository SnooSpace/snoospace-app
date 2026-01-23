/**
 * AnimatedProgressBar
 * A reusable animated progress bar component using react-native-reanimated v2
 */

import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const AnimatedProgressBar = ({ percentage, isSelected }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(percentage, {
      duration: 400,
    });
  }, [percentage]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${width.value}%`,
    };
  });

  return (
    <Animated.View
      style={[
        styles.progressFill,
        animatedStyle,
        {
          backgroundColor: isSelected ? "#3665f3" : "#daecf8",
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
});

export default AnimatedProgressBar;
