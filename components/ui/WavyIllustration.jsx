import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

/**
 * WavyIllustration — Concentric wavy S-hook stripe illustration
 * with 3D depth effect: BlurView + low opacity + oversized canvas.
 *
 * Props:
 *  position    — "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center"
 *  direction   — "vertical" | "horizontal" (default "vertical")
 *  stripeCount — number of stripes (default 7, max 7)
 *  scale       — overall scale multiplier (default 1.0)
 *  animated    — subtle breathing/drift animation (default false)
 *  colorShift  — optional tint override for all stripes
 *  opacity     — illustration opacity (default 0.25)
 *  blurIntensity — expo-blur intensity 0-100 (default 18)
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Color palette: outermost (darkest) → innermost (lightest)
const DEFAULT_COLORS = [
  "#5a9de0",
  "#74adf2",
  "#90c4f5",
  "#a8d4f8",
  "#bcdafa",
  "#d4ecfd",
  "#eef7ff",
];

// Reference canvas sizes
const CANVAS_V = 380;
const CANVAS_H = 800;

/**
 * Build a beautifully smooth, continuous, flowing S-curve stripe.
 * Uses C (Cubic Bezier) and S (Symmetric/Smooth Cubic Bezier) for perfect continuity.
 */
function buildStripePath(offset) {
  const o = offset;

  // Start well off-screen top-left
  const startX = -60 + o * 0.7;
  const startY = -40 + o * 1.5;

  // First curve: Sweeps horizontally towards the center-right, then down
  const cp1X = 260 + o * 0.9;
  const cp1Y = 20 + o * 0.8;
  const cp2X = 380 + o * 1.0;
  const cp2Y = 420 + o * 1.1; // Pulled even further down
  const midX = 80 + o * 0.8; // Pulled more left to hug the edge
  const midY = 750 + o * 1.0; // Pulled MUCH lower (deep below the card)

  // Second curve (Blue path): Drops straight down below the card, 
  // then hooks dramatically out to the bottom right
  const cp4X = 60 + o * 0.5;    // Keep it sweeping down the left side
  const cp4Y = 950 + o * 0.9;   // Dropped extra low to clear the card with space
  const endX = 800 + o * 0.6;   // Escape further to the right
  const endY = 850 + o * 1.0;   // Sweep rightwards and slightly up

  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${midX} ${midY} S ${cp4X} ${cp4Y}, ${endX} ${endY}`;
}

/**
 * Build a horizontal flowing wave for the Landing Screen.
 * Traces a long S-curve sweeping from center-left, dipping down, and rising to the center-right.
 */
function buildHorizontalStripePath(offset) {
  const o = offset;

  // Start well off-screen middle-left (moved down to middle of screen)
  const startX = -100 + o * 0.8;
  const startY = 450 + o * 1.2;

  // First curve: Sweeps slightly down and into the center
  const cp1X = 150 + o * 0.9;
  const cp1Y = 500 + o * 0.8;
  const cp2X = 300 + o * 1.1;
  const cp2Y = 650 + o * 1.1; // Deep dip into the middle
  const midX = 450 + o * 1.0; 
  const midY = 550 + o * 1.0;

  // Second curve: Sweeps back up and out to the right
  const cp4X = 600 + o * 0.8;
  const cp4Y = 450 + o * 0.9;
  const endX = 950 + o * 0.9;
  const endY = 350 + o * 1.2; // Exits middle-right, sweeping up

  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${midX} ${midY} S ${cp4X} ${cp4Y}, ${endX} ${endY}`;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export default function WavyIllustration({
  position = "topLeft",
  direction = "vertical",
  stripeCount = 7,
  scale = 1.0,
  animated = false,
  colorShift,
  customColors,
  opacity = 0.25,
  blurIntensity = 18,
}) {
  const count = Math.min(Math.max(stripeCount, 1), 7);
  let colors = DEFAULT_COLORS;
  
  if (customColors && customColors.length > 0) {
    colors = customColors;
  } else if (colorShift) {
    colors = DEFAULT_COLORS.map(() => colorShift);
  }

  // Thicknesses (outermost → innermost)
  const STROKE_WIDTHS = [58, 52, 46, 40, 34, 28, 24];
  // Concentric offsets
  const OFFSETS = [0, 18, 36, 54, 72, 90, 108];

  // --- Optional breathing animation ---
  const driftY = useSharedValue(0);
  const driftOpacity = useSharedValue(opacity);

  useEffect(() => {
    if (animated) {
      driftY.value = withRepeat(
        withTiming(14, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      driftOpacity.value = withRepeat(
        withTiming(opacity * 0.7, {
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      );
    }
  }, [animated, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: animated ? [{ translateY: driftY.value }] : [],
    opacity: animated ? driftOpacity.value : opacity,
  }));

  // --- Flip transforms for mirrored positions ---
  const flipX = position === "topRight" || position === "bottomRight";
  const flipY = position === "bottomLeft" || position === "bottomRight";

  const isHorizontal = direction === "horizontal";
  const baseCanvasW = isHorizontal ? CANVAS_H : CANVAS_V;

  // Sizing dimensions
  const svgWidth = isHorizontal
    ? SCREEN_WIDTH * 1.5 * scale
    : SCREEN_WIDTH * 1.15 * scale;
  const svgHeight = isHorizontal
    ? SCREEN_HEIGHT * 0.8 * scale
    : SCREEN_HEIGHT * 1.0 * scale;

  // viewBox maps to the CANVAS coordinate space
  const viewBoxH = isHorizontal
    ? (baseCanvasW * svgHeight) / svgWidth
    : (baseCanvasW * 2 * svgHeight) / svgWidth;

  const containerStyle = [
    StyleSheet.absoluteFill,
    {
      overflow: "hidden",
      zIndex: 0,
    },
    position === "center" && {
      justifyContent: "center",
      alignItems: "center",
    },
  ];

  return (
    <View style={containerStyle} pointerEvents="none">
      <AnimatedView style={animatedStyle}>
        {/* Slight anchor nudge for right-side positions */}
        <View
          style={[
            styles.svgWrapper,
            position === "topRight" && { alignSelf: "flex-end" },
            position === "bottomRight" && {
              alignSelf: "flex-end",
              position: "absolute",
              bottom: 0,
            },
            position === "bottomLeft" && {
              position: "absolute",
              bottom: 0,
            },
          ]}
        >
          <Svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${baseCanvasW} ${viewBoxH}`}
            style={{
              transform: [
                { scaleX: flipX ? -1 : 1 },
                { scaleY: flipY ? -1 : 1 },
              ],
            }}
          >
            {Array.from({ length: count }).map((_, i) => (
              <Path
                key={i}
                d={isHorizontal ? buildHorizontalStripePath(OFFSETS[i]) : buildStripePath(OFFSETS[i])}
                stroke={colors[i]}
                strokeWidth={STROKE_WIDTHS[i]}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </AnimatedView>

      {/* BlurView layered on top of the SVG — creates depth/frosted-glass feel */}
      <BlurView
        intensity={blurIntensity}
        tint="light"
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  svgWrapper: {
    // No overflow hidden here — clipping handled by outer container
  },
});
