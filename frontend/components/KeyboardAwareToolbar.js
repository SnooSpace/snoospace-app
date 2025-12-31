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
 * 3. Respects safe area via the bottom position
 */

const KeyboardAwareToolbar = ({ children, style }) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardStickyView
      offset={{
        closed: 0,
        opened: 0,
      }}
      style={[
        styles.container,
        {
          // Position above the home indicator when keyboard is closed
          bottom: insets.bottom,
        },
        style,
      ]}
    >
      {children}
    </KeyboardStickyView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
  },
});

export default KeyboardAwareToolbar;
