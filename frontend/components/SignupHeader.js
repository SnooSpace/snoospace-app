import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBackButton from "./GlassBackButton";
import { COLORS } from "../constants/theme";

/**
 * SignupHeader - Reusable header component for signup and auth screens
 *
 * @param {function} onBack - Required. Callback when back button is pressed
 * @param {function} onCancel - Optional. Callback when cancel button is pressed. If provided, shows cancel button
 * @param {boolean} showCancel - Optional. Force show/hide cancel button (default: true if onCancel provided)
 * @param {string} cancelText - Optional. Custom text for cancel button (default: "Cancel")
 */
const SignupHeader = ({
  onBack,
  onCancel,
  showCancel = true,
  cancelText = "Cancel",
}) => {
  const insets = useSafeAreaInsets();
  const showCancelButton = showCancel && onCancel;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(
            insets.top,
            Platform.OS === "android" ? StatusBar.currentHeight : 0
          ),
        },
      ]}
    >
      <GlassBackButton onPress={onBack} />

      {showCancelButton ? (
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>{cancelText}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
  placeholder: {
    width: 44, // Same width as GlassBackButton for alignment
  },
});

export default SignupHeader;
