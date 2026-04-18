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
import { UserPlus, Users } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, FONTS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function DraftRecoveryModal({
  visible,
  draftEmail,
  draftType = "Member", // "Member" or "Community"
  isPeopleProfile = false, // true when draft is a People profile from community flow
  onContinue,
  onDiscard,
}) {
  const isCommunity = draftType === "Community";

  const title = isPeopleProfile
    ? "Continue People profile setup?"
    : `Continue ${draftType} signup?`;

  const description = isPeopleProfile
    ? "You were in the middle of setting up your People profile. Pick up where you left off?"
    : `You were setting up a new ${draftType.toLowerCase()} account${draftEmail ? ` for ${draftEmail}` : ""}. Would you like to continue or discard it?`;
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent dismiss on back button
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            {isCommunity ? (
              <Users size={36} color={COLORS.primary} strokeWidth={2} />
            ) : (
              <UserPlus size={36} color={COLORS.primary} strokeWidth={2} />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Description */}
          <Text style={styles.description}>{description}</Text>

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
    backgroundColor: "rgba(41, 98, 255, 0.08)",
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
    letterSpacing: -0.3,
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
  discardButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  discardText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  continueButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
  },
  continueGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
