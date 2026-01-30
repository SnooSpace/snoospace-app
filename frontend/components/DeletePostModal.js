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
import { Trash2 } from "lucide-react-native";

const DESTRUCTIVE_RED = "#DC2626"; // Restrained Red (Tailwind Red 600)
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = COLORS.textPrimary || "#1D1D1F";
const TEXT_SECONDARY = COLORS.textSecondary || "#8E8E93";
const MODAL_OVERLAY = "rgba(0, 0, 0, 0.4)";

export default function DeletePostModal({ visible, onCancel, onDelete }) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Drag Handle */}
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.body}>
                <View style={styles.iconContainer}>
                  <Trash2 size={32} color={DESTRUCTIVE_RED} />
                </View>

                <Text style={styles.title}>Delete Post</Text>
                <Text style={styles.message}>
                  Are you sure you want to delete this post? This action cannot
                  be undone.
                </Text>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={onDelete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
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
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingBottom: 16,
    width: "100%",
    ...SHADOWS.medium,
  },
  dragHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12, // Reduced padding as we have icon below
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
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF2F2", // Very light red
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteButton: {
    backgroundColor: DESTRUCTIVE_RED,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  cancelButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
});
