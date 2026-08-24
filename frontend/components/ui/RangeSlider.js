import React, { useCallback, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const THUMB_SIZE = 28; // Standard comfortable touch target size
const HIT_SLOP = 44;
const TRACK_HEIGHT = 6; // Thicker, modern track pill

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
  const startLeftX = useSharedValue(0);
  const startRightX = useSharedValue(0);

  // Tooltip micro-animations
  const leftTooltipOpacity = useSharedValue(0);
  const leftTooltipScale = useSharedValue(0);
  const leftTooltipTranslateY = useSharedValue(5);

  const rightTooltipOpacity = useSharedValue(0);
  const rightTooltipScale = useSharedValue(0);
  const rightTooltipTranslateY = useSharedValue(5);

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

  const triggerHaptic = () => {
    HapticsService.triggerImpactLight();
  };

  const leftGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startLeftX.value = leftX.value;
      leftTooltipOpacity.value = 1;
      leftTooltipScale.value = 1;
      leftTooltipTranslateY.value = 0;
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 0) return;

      let nextX = startLeftX.value + e.translationX;
      const minPointsGap = (2 / range) * w;
      nextX = Math.max(0, Math.min(nextX, rightX.value - minPointsGap));
      leftX.value = nextX;

      const currentMin = Math.round(min + (nextX / w) * range);
      if (currentMin !== lastLeftVal.value) {
        lastLeftVal.value = currentMin;
        runOnJS(notifyChange)(nextX, rightX.value, w);
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      leftTooltipOpacity.value = 0;
      leftTooltipScale.value = 0;
      leftTooltipTranslateY.value = 5;
    });

  const rightGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startRightX.value = rightX.value;
      rightTooltipOpacity.value = 1;
      rightTooltipScale.value = 1;
      rightTooltipTranslateY.value = 0;
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 0) return;

      let nextX = startRightX.value + e.translationX;
      const minPointsGap = (2 / range) * w;
      nextX = Math.max(leftX.value + minPointsGap, Math.min(nextX, w));
      rightX.value = nextX;

      const currentMax = Math.round(min + (nextX / w) * range);
      if (currentMax !== lastRightVal.value) {
        lastRightVal.value = currentMax;
        runOnJS(notifyChange)(leftX.value, nextX, w);
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      rightTooltipOpacity.value = 0;
      rightTooltipScale.value = 0;
      rightTooltipTranslateY.value = 5;
    });

  const leftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: leftX.value - HIT_SLOP / 2 },
    ],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rightX.value - HIT_SLOP / 2 },
    ],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    left: leftX.value,
    width: rightX.value - leftX.value,
  }));

  const leftTooltipStyle = useAnimatedStyle(() => ({
    opacity: leftTooltipOpacity.value,
    transform: [
      { scale: leftTooltipScale.value },
      { translateY: leftTooltipTranslateY.value },
    ],
  }));

  const rightTooltipStyle = useAnimatedStyle(() => ({
    opacity: rightTooltipOpacity.value,
    transform: [
      { scale: rightTooltipScale.value },
      { translateY: rightTooltipTranslateY.value },
    ],
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.trackBackground} />
      <Animated.View style={[styles.trackActive, trackStyle]} />

      <GestureDetector gesture={leftGesture}>
        <Animated.View style={[styles.hitArea, leftStyle]}>
          <Animated.View style={[styles.tooltipContainer, leftTooltipStyle]}>
            <View style={styles.tooltipBubble}>
              <Text style={styles.tooltipText}>{initialMin}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>

          <View style={styles.thumb}>
            <Text style={styles.thumbEmoji}>🧒</Text>
          </View>
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={rightGesture}>
        <Animated.View style={[styles.hitArea, rightStyle]}>
          <Animated.View style={[styles.tooltipContainer, rightTooltipStyle]}>
            <View style={styles.tooltipBubble}>
              <Text style={styles.tooltipText}>{initialMax}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>

          <View style={styles.thumb}>
            <Text style={styles.thumbEmoji}>🧔</Text>
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
  hitArea: {
    width: HIT_SLOP,
    height: HIT_SLOP,
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  thumb: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  thumbEmoji: {
    fontSize: 16,
    textAlign: "center",
  },
  tooltipContainer: {
    position: "absolute",
    top: -38,
    width: 60,
    alignItems: "center",
    left: -8,
  },
  tooltipBubble: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontFamily: FONTS.medium,
    fontSize: 12,
    textAlign: "center",
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: COLORS.primary,
    marginTop: -1,
  },
});

export default RangeSlider;
