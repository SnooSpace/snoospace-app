import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { COLORS } from "../constants/theme";
import HapticsService from "../services/HapticsService";

const THUMB_SIZE = 28;
const HIT_SLOP = 44;
const TRACK_HEIGHT = 4;

const RangeSlider = ({
  min = 18,
  max = 99,
  initialMin = 18,
  initialMax = 30,
  onValueChange,
}) => {
  const containerWidth = useSharedValue(0);
  const leftX = useSharedValue(0);
  const rightX = useSharedValue(0);
  const lastLeftVal = useSharedValue(initialMin);
  const lastRightVal = useSharedValue(initialMax);
  const leftScale = useSharedValue(1);
  const rightScale = useSharedValue(1);

  const range = max - min;

  const initializePositions = useCallback(
    (width) => {
      if (width <= 0) return;
      leftX.value = ((initialMin - min) / range) * width;
      rightX.value = ((initialMax - min) / range) * width;
      lastLeftVal.value = initialMin;
      lastRightVal.value = initialMax;
    },
    [min, max, initialMin, initialMax, range],
  );

  useEffect(() => {
    if (containerWidth.value > 0) {
      initializePositions(containerWidth.value);
    }
  }, [initialMin, initialMax, min, max, initializePositions]);

  const onLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    containerWidth.value = w;
    initializePositions(w);
  };

  const notifyChange = (lX, rX, w) => {
    if (w <= 0) return;
    const lValue = Math.round(min + (lX / w) * range);
    const rValue = Math.round(min + (rX / w) * range);
    if (onValueChange) {
      onValueChange({ min: lValue, max: rValue });
    }
  };

  const leftGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Prioritize horizontal movement
    .onStart(() => {
      leftScale.value = withSpring(1.15);
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 0) return;

      let nextX = leftX.value + e.changeX;
      const minPointsGap = (2 / range) * w;
      nextX = Math.max(0, Math.min(nextX, rightX.value - minPointsGap));
      leftX.value = nextX;

      const currentMin = Math.round(min + (nextX / w) * range);
      if (currentMin !== lastLeftVal.value) {
        lastLeftVal.value = currentMin;
        runOnJS(notifyChange)(nextX, rightX.value, w);
        runOnJS(HapticsService.triggerImpactLight)();
      }
    })
    .onEnd(() => {
      leftScale.value = withSpring(1);
    });

  const rightGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      rightScale.value = withSpring(1.15);
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 0) return;

      let nextX = rightX.value + e.changeX;
      const minPointsGap = (2 / range) * w;
      nextX = Math.max(leftX.value + minPointsGap, Math.min(nextX, w));
      rightX.value = nextX;

      const currentMax = Math.round(min + (nextX / w) * range);
      if (currentMax !== lastRightVal.value) {
        lastRightVal.value = currentMax;
        runOnJS(notifyChange)(leftX.value, nextX, w);
        runOnJS(HapticsService.triggerImpactLight)();
      }
    })
    .onEnd(() => {
      rightScale.value = withSpring(1);
    });

  const leftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: leftX.value - HIT_SLOP / 2 },
      { scale: leftScale.value },
    ],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rightX.value - HIT_SLOP / 2 },
      { scale: rightScale.value },
    ],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    left: leftX.value,
    width: rightX.value - leftX.value,
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.trackBackground} />
      <Animated.View style={[styles.trackActive, trackStyle]} />

      <GestureDetector gesture={leftGesture}>
        <Animated.View style={[styles.hitArea, leftStyle]}>
          <View style={styles.thumb}>
            <View style={styles.thumbInner} />
          </View>
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={rightGesture}>
        <Animated.View style={[styles.hitArea, rightStyle]}>
          <View style={styles.thumb}>
            <View style={styles.thumbInner} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: HIT_SLOP,
    justifyContent: "center",
    width: "100%",
  },
  trackBackground: {
    height: TRACK_HEIGHT,
    backgroundColor: "#F3F4F6",
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
  hitArea: {
    width: HIT_SLOP,
    height: HIT_SLOP,
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  thumb: {
    height: THUMB_SIZE,
    width: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
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
