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

const KeyboardAwareToolbar = ({ children, style, onLayout }) => {
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

  const flattenedStyle = StyleSheet.flatten(style || {});
  const {
    backgroundColor,
    borderTopWidth,
    borderTopColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderWidth,
    borderColor,
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,
    ...containerStyle
  } = flattenedStyle;

  const animatedWrapperStyle = useAnimatedStyle(() => {
    // Translate the content down by insets.bottom as the keyboard opens,
    // to offset the static paddingBottom of insets.bottom.
    const translateY = interpolate(
      keyboardHeight.value,
      [0, insets.bottom || 1],
      [0, insets.bottom],
      Extrapolate.CLAMP,
    );

    return {
      transform: [{ translateY }],
    };
  });

  return (
    <KeyboardStickyView
      offset={{
        // Set to 0 so the container overlaps the safe area/bottom gap
        closed: 0,
        opened: 0,
      }}
      style={[styles.container, containerStyle]}
    >
      <Animated.View
        onLayout={onLayout}
        style={[
          animatedWrapperStyle,
          {
            paddingBottom: insets.bottom,
            backgroundColor,
            borderTopWidth,
            borderTopColor,
            borderTopLeftRadius,
            borderTopRightRadius,
            borderWidth,
            borderColor,
            shadowColor,
            shadowOffset,
            shadowOpacity,
            shadowRadius,
            elevation,
          },
        ]}
      >
        {children}
      </Animated.View>
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
