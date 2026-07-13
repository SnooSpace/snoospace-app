import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { HelpCircle, XCircle, CheckCircle2, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

/**
 * Attendance confirmation modal
 * Can be blocking or dismissible if onClose callback is provided
 */
export default function AttendanceConfirmationModal({
  visible,
  eventTitle,
  onConfirmAttendance,
  loading = false,
  onClose,
}) {
  const [selectedOption, setSelectedOption] = useState(null);

  const handleConfirm = async (attended) => {
    setSelectedOption(attended ? "yes" : "no");
    await onConfirmAttendance(attended);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose ? onClose : () => {}} // Prevent back button dismiss if no onClose callback
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {onClose && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* Icon */}
          <View style={styles.iconContainer}>
            <HelpCircle size={56} color={COLORS.primary} strokeWidth={1.8} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Did you attend?</Text>

          {/* Event name */}
          <Text style={styles.eventName} numberOfLines={2}>
            {eventTitle}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            Help us improve your experience by confirming your attendance
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.noButton]}
              onPress={() => handleConfirm(false)}
              disabled={loading}
            >
              {loading && selectedOption === "no" ? (
                <SnooLoader size="small" color="#666" />
              ) : (
                <>
                  <XCircle size={20} color="#666" strokeWidth={2.2} />
                  <Text style={[styles.noButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
                    No, I didn't attend
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => handleConfirm(true)}
              disabled={loading}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.yesButtonGradient}
              >
                {loading && selectedOption === "yes" ? (
                  <SnooLoader size="small" color="#FFF" />
                ) : (
                  <>
                    <CheckCircle2 size={20} color="#FFF" strokeWidth={2.2} />
                    <Text style={[styles.yesButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
                      Yes, I attended
                    </Text>
                  </>
                )}
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
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  eventName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
  },
  noButton: {
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  noButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  yesButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  yesButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
