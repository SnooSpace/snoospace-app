import React from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  return (
    <KeyboardStickyView
      offset={{
        // When keyboard is closed: negative offset to push UP above home indicator
        closed: -insets.bottom,
        // When keyboard is open: no extra offset (sit right on keyboard)
        opened: 0,
      }}
      style={[styles.container, style]}
    >
      {children}
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
  },
});

export default KeyboardAwareToolbar;
