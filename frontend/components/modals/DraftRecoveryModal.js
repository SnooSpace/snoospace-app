/**
 * DraftRecoveryModal.js
 *
 * Shown on app launch when an incomplete signup draft exists.
 * Gives user explicit choice to continue or discard.
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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function DraftRecoveryModal({
  visible,
  draftEmail,
  onContinue,
  onDiscard,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent dismiss on back button
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="person-add-outline"
              size={48}
              color={COLORS.primary}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Continue creating account?</Text>

          {/* Description */}
          <Text style={styles.description}>
            You were setting up a new account
            {draftEmail ? ` for ${draftEmail}` : ""}. Would you like to continue
            or discard it?
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Discard Button */}
            <TouchableOpacity
              style={styles.discardButton}
              onPress={onDiscard}
              activeOpacity={0.7}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={onContinue}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueGradient}
              >
                <Text style={styles.continueText}>Continue</Text>
              </LinearGradient>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
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
  discardButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.m || 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  discardText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary || "#8E8E93",
  },
  continueButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.m || 12,
    overflow: "hidden",
  },
  continueGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  continueText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
