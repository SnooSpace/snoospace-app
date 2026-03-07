import React, { useEffect } from "react";
import { StyleSheet, View, Animated, Dimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Path, Ellipse } from 'react-native-svg';

const IconLight = ({ width, height }) => (
  <Svg width={width} height={height} viewBox="0 0 200 200" fill="none">
    <Path d="M66.667 0.5C103.181 0.500189 132.833 31.9995 132.833 70.9219C132.833 109.844 103.181 141.344 66.667 141.344C30.1528 141.344 0.5 109.844 0.5 70.9219C0.500058 31.9993 30.1529 0.5 66.667 0.5Z" fill="#3565F2" stroke="#3D79F2"/>
    <Ellipse cx="133.333" cy="129.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
    <Path d="M132.257 58.1671C132.963 62.3048 133.334 66.5674 133.334 70.9219C133.334 109.709 104.065 141.222 67.7419 141.833C67.0355 137.695 66.6667 133.433 66.6667 129.078C66.6667 90.2916 95.9342 58.779 132.257 58.1671Z" fill="#6BB3F2"/>
  </Svg>
);

// Prevent native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore error if it's already hiding
});

export default function AnimatedSplashScreen({ onAnimationComplete }) {
  const { width, height } = Dimensions.get("window");
  
  // Animation values
  const scale = new Animated.Value(1);
  const opacity = new Animated.Value(1);

  useEffect(() => {
    // Hide native splash screen immediately, this component takes over visually
    SplashScreen.hideAsync().catch(() => {});

    // Start our premium animation
    Animated.sequence([
      Animated.delay(800), // Hold for a moment
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 2.5, // Scale up
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, // Fade out
          duration: 500,
          delay: 100, // slightly delay fade out compared to scale
          useNativeDriver: true,
        })
      ])
    ]).start(() => {
      onAnimationComplete();
    });
  }, [scale, opacity, onAnimationComplete]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {/* We use the SVG here directly if possible. Note: if react-native-svg is used, it might not support Animated without Animated.createAnimatedComponent */}
        <IconLight width={120} height={120} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999, // Ensure it's on top of everything
  },
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
});
