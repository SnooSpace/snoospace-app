import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const THUMB_SIZE = 26;
const HIT_SLOP = 44;
const TRACK_HEIGHT = 5;
const PADDING_X = 20; // Inset so thumbs & tooltips never bleed out at min/max limits
const TOOLTIP_WIDTH = 44;

const RangeSlider = ({
  min = 18,
  max = 99,
  initialMin = 18,
  initialMax = 30,
  onValueChange,
}) => {
  const [displayMin, setDisplayMin] = useState(initialMin);
  const [displayMax, setDisplayMax] = useState(initialMax);

  const containerWidth = useSharedValue(0);
  const leftX = useSharedValue(PADDING_X);
  const rightX = useSharedValue(PADDING_X + 100);
  const lastLeftVal = useSharedValue(initialMin);
  const lastRightVal = useSharedValue(initialMax);
  const startLeftX = useSharedValue(0);
  const startRightX = useSharedValue(0);

  // Tooltip micro-animations
  const leftTooltipOpacity = useSharedValue(0);
  const leftTooltipScale = useSharedValue(0.8);
  const leftTooltipTranslateY = useSharedValue(5);

  const rightTooltipOpacity = useSharedValue(0);
  const rightTooltipScale = useSharedValue(0.8);
  const rightTooltipTranslateY = useSharedValue(5);

  const range = max - min;

  const initializePositions = useCallback(
    (width) => {
      if (width <= 2 * PADDING_X) return;
      const usable = width - 2 * PADDING_X;
      leftX.value = PADDING_X + ((initialMin - min) / range) * usable;
      rightX.value = PADDING_X + ((initialMax - min) / range) * usable;
      lastLeftVal.value = initialMin;
      lastRightVal.value = initialMax;
      setDisplayMin(initialMin);
      setDisplayMax(initialMax);
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

  const notifyChange = (lVal, rVal) => {
    if (onValueChange) {
      onValueChange({ min: lVal, max: rVal });
    }
  };

  const triggerHaptic = () => {
    HapticsService.triggerImpactLight();
  };

  const leftGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startLeftX.value = leftX.value;
      leftTooltipOpacity.value = withTiming(1, { duration: 120 });
      leftTooltipScale.value = withSpring(1, { damping: 15 });
      leftTooltipTranslateY.value = withTiming(0, { duration: 120 });
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 2 * PADDING_X) return;
      const usable = w - 2 * PADDING_X;

      let nextX = startLeftX.value + e.translationX;
      const minGap = (1 / range) * usable;
      nextX = Math.max(PADDING_X, Math.min(nextX, rightX.value - minGap));
      leftX.value = nextX;

      const currentMin = Math.round(min + ((nextX - PADDING_X) / usable) * range);
      if (currentMin !== lastLeftVal.value) {
        lastLeftVal.value = currentMin;
        runOnJS(setDisplayMin)(currentMin);
        runOnJS(notifyChange)(currentMin, lastRightVal.value);
        runOnJS(triggerHaptic)();
      }
    })
    .onFinalize(() => {
      leftTooltipOpacity.value = withTiming(0, { duration: 150 });
      leftTooltipScale.value = withTiming(0.8, { duration: 150 });
      leftTooltipTranslateY.value = withTiming(5, { duration: 150 });
    });

  const rightGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startRightX.value = rightX.value;
      rightTooltipOpacity.value = withTiming(1, { duration: 120 });
      rightTooltipScale.value = withSpring(1, { damping: 15 });
      rightTooltipTranslateY.value = withTiming(0, { duration: 120 });
    })
    .onUpdate((e) => {
      const w = containerWidth.value;
      if (w <= 2 * PADDING_X) return;
      const usable = w - 2 * PADDING_X;

      let nextX = startRightX.value + e.translationX;
      const minGap = (1 / range) * usable;
      nextX = Math.max(leftX.value + minGap, Math.min(nextX, w - PADDING_X));
      rightX.value = nextX;

      const currentMax = Math.round(min + ((nextX - PADDING_X) / usable) * range);
      if (currentMax !== lastRightVal.value) {
        lastRightVal.value = currentMax;
        runOnJS(setDisplayMax)(currentMax);
        runOnJS(notifyChange)(lastLeftVal.value, currentMax);
        runOnJS(triggerHaptic)();
      }
    })
    .onFinalize(() => {
      rightTooltipOpacity.value = withTiming(0, { duration: 150 });
      rightTooltipScale.value = withTiming(0.8, { duration: 150 });
      rightTooltipTranslateY.value = withTiming(5, { duration: 150 });
    });

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftX.value - HIT_SLOP / 2 }],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightX.value - HIT_SLOP / 2 }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    left: leftX.value,
    width: Math.max(0, rightX.value - leftX.value),
  }));

  // Tooltips clamp translation so they never cut off on screen edges
  const leftTooltipStyle = useAnimatedStyle(() => {
    // If leftX is near left border, shift tooltip right
    const minCenter = TOOLTIP_WIDTH / 2 + 4;
    const shiftX = leftX.value < minCenter ? minCenter - leftX.value : 0;
    return {
      opacity: leftTooltipOpacity.value,
      transform: [
        { translateX: shiftX },
        { scale: leftTooltipScale.value },
        { translateY: leftTooltipTranslateY.value },
      ],
    };
  });

  const rightTooltipStyle = useAnimatedStyle(() => {
    // If rightX is near right border, shift tooltip left
    const w = containerWidth.value;
    const maxCenter = w - (TOOLTIP_WIDTH / 2 + 4);
    const shiftX = w > 0 && rightX.value > maxCenter ? maxCenter - rightX.value : 0;
    return {
      opacity: rightTooltipOpacity.value,
      transform: [
        { translateX: shiftX },
        { scale: rightTooltipScale.value },
        { translateY: rightTooltipTranslateY.value },
      ],
    };
  });

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.trackBackground} />
      <Animated.View style={[styles.trackActive, trackStyle]} />

      <GestureDetector gesture={leftGesture}>
        <Animated.View style={[styles.hitArea, leftStyle]}>
          <Animated.View style={[styles.tooltipContainer, leftTooltipStyle]} pointerEvents="none">
            <View style={styles.tooltipBubble}>
              <Text style={styles.tooltipText}>{displayMin}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>

          <View style={styles.thumb} />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={rightGesture}>
        <Animated.View style={[styles.hitArea, rightStyle]}>
          <Animated.View style={[styles.tooltipContainer, rightTooltipStyle]} pointerEvents="none">
            <View style={styles.tooltipBubble}>
              <Text style={styles.tooltipText}>{displayMax}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>

          <View style={styles.thumb} />
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
    backgroundColor: "#E2E8F0",
    borderRadius: TRACK_HEIGHT / 2,
    position: "absolute",
    left: PADDING_X,
    right: PADDING_X,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
  },
  tooltipContainer: {
    position: "absolute",
    top: -36,
    width: TOOLTIP_WIDTH,
    alignItems: "center",
    left: (HIT_SLOP - TOOLTIP_WIDTH) / 2,
  },
  tooltipBubble: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
