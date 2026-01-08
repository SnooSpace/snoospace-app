import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

/**
 * Blocking modal for attendance confirmation
 * Cannot be dismissed via back button, backdrop, or swipe
 */
export default function AttendanceConfirmationModal({
  visible,
  eventTitle,
  onConfirmAttendance,
  loading = false,
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
      onRequestClose={() => {}} // Prevent back button dismiss
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="help-circle" size={56} color={COLORS.primary} />
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
                <ActivityIndicator size="small" color="#666" />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color="#666"
                  />
                  <Text style={styles.noButtonText}>No, I didn't attend</Text>
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
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.yesButtonText}>Yes, I attended</Text>
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
