import React from "react";
import { StyleSheet, View } from "react-native";
import {
  KeyboardStickyView,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

/**
 * KeyboardAwareToolbar
 *
 * Uses KeyboardStickyView from react-native-keyboard-controller for
 * reliable keyboard tracking. This component:
 * 1. Sticks to the top of the keyboard when it's open
 * 2. Returns to the bottom of the screen when keyboard closes
 * 3. Respects safe area via the offset prop when keyboard is closed
 */

const KeyboardAwareToolbar = ({ children, style }) => {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useSharedValue(0);

  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onMove: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
  });

  const animatedWrapperStyle = useAnimatedStyle(() => {
    // As the keyboard opens (height goes from 0 to Positive),
    // we want to reduce the paddingBottom from insets.bottom to 0.
    const padding = interpolate(
      keyboardHeight.value,
      [0, insets.bottom || 1], // Transition over the safe area distance
      [insets.bottom, 0],
      Extrapolate.CLAMP,
    );

    return {
      paddingBottom: padding,
    };
  });

  return (
    <KeyboardStickyView
      offset={{
        // Set to 0 so the container overlaps the safe area/bottom gap
        closed: 0,
        opened: 0,
      }}
      style={[styles.container, style]}
    >
      <Animated.View style={animatedWrapperStyle}>{children}</Animated.View>
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default KeyboardAwareToolbar;
