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
import { BlurView } from "expo-blur";
import GlassBackButton from "./GlassBackButton";
import { COLORS, BORDER_RADIUS } from "../constants/theme";

/**
 * SignupHeader - Reusable header component for signup and auth screens
 *
 * @param {function} onBack - Required. Callback when back button is pressed
 * @param {function} onCancel - Optional. Callback when cancel button is pressed. If provided, shows cancel button
 * @param {boolean} showCancel - Optional. Force show/hide cancel button (default: true if onCancel provided)
 * @param {string} cancelText - Optional. Custom text for cancel button (default: "Cancel")
 * @param {string} role - Optional. Displays a role badge (e.g., "Community" or "People") in the center
 */
const SignupHeader = ({
  onBack,
  onCancel,
  showCancel = true,
  cancelText = "Cancel",
  role,
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
      <View style={styles.leftColumn}>
        <GlassBackButton onPress={onBack} />
      </View>

      <View style={styles.centerColumn}>
        {role && (
          <BlurView intensity={70} tint="light" style={styles.roleBadgeContainer}>
            <View style={styles.roleBadgeInner}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          </BlurView>
        )}
      </View>

      <View style={styles.rightColumn}>
        {showCancelButton ? (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{cancelText}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
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
    minHeight: 60,
  },
  leftColumn: {
    flex: 1,
    alignItems: "flex-start",
  },
  centerColumn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rightColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
  },
  placeholder: {
    width: 44,
  },
  roleBadgeContainer: {
    borderRadius: BORDER_RADIUS.pill,
    overflow: "hidden", // Ensures blur doesn't bleed outside the pill shape
    // Premium shadow for the entire glassy pill
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  roleBadgeInner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.4)", // White tint to make the text readable over dark waves
    alignItems: "center",
    justifyContent: "center",
  },
  roleText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
});

export default SignupHeader;
