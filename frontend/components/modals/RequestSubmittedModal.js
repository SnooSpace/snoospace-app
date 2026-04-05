/**
 * RequestSubmittedModal.js
 *
 * Shown when a user requests a new college/campus. 
 * Confirms the request is received and allows them to continue.
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Check } from "lucide-react-native";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function RequestSubmittedModal({
  visible,
  onContinue,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onContinue}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Check size={36} color="#10B981" strokeWidth={3} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Request Submitted</Text>

          {/* Description */}
          <Text style={styles.description}>
            Thanks! We'll add this college shortly. You can continue setting up your profile in the meantime.
          </Text>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
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
    borderRadius: 32,
    padding: 32,
    width: width - 48,
    maxWidth: 360,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  continueButton: {
    width: "100%",
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
