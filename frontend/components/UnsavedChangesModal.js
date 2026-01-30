import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { COLORS, FONTS, SHADOWS } from "../constants/theme";

const PRIMARY_BLUE = "#3B82F6"; // Brand Blue
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = COLORS.textPrimary || "#1D1D1F";
const TEXT_SECONDARY = COLORS.textSecondary || "#8E8E93";
const MODAL_OVERLAY = "rgba(0, 0, 0, 0.4)";

export default function UnsavedChangesModal({
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
      <TouchableWithoutFeedback onPress={onKeepEditing}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Drag Handle */}
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.body}>
                <Text style={styles.title}>Unsaved changes</Text>
                <Text style={styles.message}>
                  You have unsaved edits. Do you want to leave without saving?
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onKeepEditing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Keep editing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onDiscard}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>
                    Discard changes
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: MODAL_OVERLAY,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24, // Push up from bottom
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 24, // Full rounded for floating look
    paddingBottom: 16,
    width: "100%",
    ...SHADOWS.medium,
  },
  dragHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
  },
  body: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.primary, // Manrope Semibold/Bold equivalent
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 15, // Manrope Regular
    fontFamily: FONTS.regular,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  secondaryButtonText: {
    color: TEXT_SECONDARY, // Gray text, non-destructive
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
});
