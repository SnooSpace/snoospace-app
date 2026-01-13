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
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";

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
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="warning-outline" size={40} color="#FF9500" />
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.xl || 20,
    padding: 28,
    width: width - 48,
    maxWidth: 360,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFF5E6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary || "#1D1D1F",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary || "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  keepButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.m || 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  keepText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary || "#007AFF",
  },
  discardButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.m || 12,
    backgroundColor: "#FF3B30",
    alignItems: "center",
  },
  discardText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
