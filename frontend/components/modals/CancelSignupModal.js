/**
 * CancelSignupModal.js
 *
 * Confirmation modal when user wants to cancel creating a new account.
 * Shown when user taps Cancel button during signup flow.
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { COLORS, BORDER_RADIUS, FONTS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function CancelSignupModal({
  visible,
  onKeepEditing,
  onDiscard,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onKeepEditing}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <AlertTriangle size={32} color="#FF9500" strokeWidth={2} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Discard new account?</Text>

          {/* Description */}
          <Text style={styles.description}>
            Your progress will be lost. You can always start again later.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Keep Editing Button */}
            <TouchableOpacity
              style={styles.keepButton}
              onPress={onKeepEditing}
              activeOpacity={0.7}
            >
              <Text style={styles.keepText}>Keep editing</Text>
            </TouchableOpacity>

            {/* Discard Button */}
            <TouchableOpacity
              style={styles.discardButton}
              onPress={onDiscard}
              activeOpacity={0.8}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.xl,
    padding: 28,
    width: width - 48,
    maxWidth: 360,
    alignItems: "center",
    ...SHADOWS.large,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  keepButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  keepText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  discardButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: COLORS.error || "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
