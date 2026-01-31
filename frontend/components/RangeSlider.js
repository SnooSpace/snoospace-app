import React, { useCallback, useEffect } from "react";
import { StyleSheet, View, TextInput } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  useDerivedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { COLORS } from "../constants/theme";

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 4;

const RangeSlider = ({
  min = 18,
  max = 99,
  initialMin = 18,
  initialMax = 30, // Default max 30 as requested
  onValueChange,
}) => {
  const [width, setWidth] = React.useState(0);

  // Normalized values (0 to 1)
  const leftHandlePos = useSharedValue(0);
  const rightHandlePos = useSharedValue(1);

  // Initialize values once we have width or just conceptually
  useEffect(() => {
    // Initial normalized positions
    const range = max - min;
    leftHandlePos.value = (initialMin - min) / range;
    rightHandlePos.value = (initialMax - min) / range;
  }, [min, max, initialMin, initialMax]);

  const onLayout = (e) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const updateValues = useCallback(
    (leftN, rightN) => {
      const range = max - min;
      const newMin = Math.round(min + leftN * range);
      const newMax = Math.round(min + rightN * range);
      if (onValueChange) {
        onValueChange({ min: newMin, max: newMax });
      }
    },
    [min, max, onValueChange],
  );

  const leftGesture = Gesture.Pan()
    .onChange((e) => {
      if (width === 0) return;
      const change = e.changeX / width;
      let newValue = leftHandlePos.value + change;
      // Constrain: 0 <= newValue <= rightHandlePos - buffer
      // Buffer of ~5% or just standard < right
      newValue = Math.max(0, Math.min(newValue, rightHandlePos.value - 0.05));
      leftHandlePos.value = newValue;
    })
    .onEnd(() => {
      runOnJS(updateValues)(leftHandlePos.value, rightHandlePos.value);
    });

  const rightGesture = Gesture.Pan()
    .onChange((e) => {
      if (width === 0) return;
      const change = e.changeX / width;
      let newValue = rightHandlePos.value + change;
      // Constrain: leftHandlePos + buffer <= newValue <= 1
      newValue = Math.max(leftHandlePos.value + 0.05, Math.min(newValue, 1));
      rightHandlePos.value = newValue;
    })
    .onEnd(() => {
      runOnJS(updateValues)(leftHandlePos.value, rightHandlePos.value);
    });

  const leftAnimatedStyle = useAnimatedStyle(() => ({
    left: `${leftHandlePos.value * 100}%`,
    transform: [{ translateX: -THUMB_SIZE / 2 }],
  }));

  const rightAnimatedStyle = useAnimatedStyle(() => ({
    left: `${rightHandlePos.value * 100}%`,
    transform: [{ translateX: -THUMB_SIZE / 2 }],
  }));

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    left: `${leftHandlePos.value * 100}%`,
    width: `${(rightHandlePos.value - leftHandlePos.value) * 100}%`,
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Background Track */}
      <View style={styles.trackBackground} />

      {/* Active Track */}
      <Animated.View style={[styles.trackActive, trackAnimatedStyle]} />

      {/* Left Thumb */}
      <GestureDetector gesture={leftGesture}>
        <Animated.View style={[styles.thumb, leftAnimatedStyle]}>
          <View style={styles.thumbInner} />
        </Animated.View>
      </GestureDetector>

      {/* Right Thumb */}
      <GestureDetector gesture={rightGesture}>
        <Animated.View style={[styles.thumb, rightAnimatedStyle]}>
          <View style={styles.thumbInner} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: "center",
    width: "100%",
  },
  trackBackground: {
    height: TRACK_HEIGHT,
    backgroundColor: "#E5E7EB",
    borderRadius: TRACK_HEIGHT / 2,
    position: "absolute",
    width: "100%",
  },
  trackActive: {
    height: TRACK_HEIGHT,
    backgroundColor: COLORS.primary,
    borderRadius: TRACK_HEIGHT / 2,
    position: "absolute",
  },
  thumb: {
    height: THUMB_SIZE,
    width: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  thumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
});

export default RangeSlider;
