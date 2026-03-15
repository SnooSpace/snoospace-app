/**
 * TypeSelectWarningModal.js
 *
 * Shown when user presses Back from the first screen of their chosen
 * community type path (CommunityName for Individual/Organization,
 * CollegeSearch for College). Warns that going back will reset their
 * type selection and clear type-specific progress.
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
import { ArrowLeft } from "lucide-react-native";
import { COLORS, BORDER_RADIUS, FONTS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function TypeSelectWarningModal({
  visible,
  onStay,
  onGoBack,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onStay}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <ArrowLeft size={30} color={COLORS.primary} strokeWidth={2} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Change community type?</Text>

          {/* Description */}
          <Text style={styles.description}>
            Going back will reset your community type selection. Any progress for this type will be cleared and you'll need to start fresh.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Stay Button */}
            <TouchableOpacity
              style={styles.stayButton}
              onPress={onStay}
              activeOpacity={0.7}
            >
              <Text style={styles.stayText}>Stay here</Text>
            </TouchableOpacity>

            {/* Go Back Button */}
            <TouchableOpacity
              style={styles.goBackButton}
              onPress={onGoBack}
              activeOpacity={0.8}
            >
              <Text style={styles.goBackText}>Go back</Text>
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
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
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
  stayButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  stayText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  goBackButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  goBackText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
