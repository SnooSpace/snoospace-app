import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, HelpCircle, X, Check, XCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "../constants/theme";

export default function EventVerificationPopup({
  activePopup,
  loading,
  onConfirm,
  onReject,
  onAskLater,
}) {
  const insets = useSafeAreaInsets();

  if (!activePopup) return null;

  const { event, type } = activePopup;
  const isGoing = type === "going";

  // Conversational text based on verification type
  const headerText = isGoing ? "Upcoming Event" : "How did it go?";
  const eventName = event.title || "the event";
  const questionText = isGoing
    ? `Still planning to attend "${eventName}"?`
    : `Did you attend "${eventName}"?`;

  const confirmText = isGoing ? "Yes, I'm going" : "Yes, I attended";
  const rejectText = isGoing ? "Can't make it" : "No, didn't attend";

  const bottomMargin = insets.bottom + 80; // Floating above the tab bar

  return (
    <View style={[styles.container, { bottom: bottomMargin }]}>
      {/* Close button (top right X) */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onAskLater}
        disabled={loading}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <X size={18} color="#6B7280" />
      </TouchableOpacity>

      {/* Row with icon and conversational header */}
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
          {isGoing ? (
            <Calendar size={20} color={COLORS.primary} strokeWidth={2} />
          ) : (
            <HelpCircle size={20} color={COLORS.primary} strokeWidth={2} />
          )}
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerText, { fontFamily: "Manrope-SemiBold" }]}>
            {headerText}
          </Text>
        </View>
      </View>

      {/* Question / Description */}
      <Text style={[styles.questionText, { fontFamily: "Manrope-Regular" }]} numberOfLines={3}>
        {questionText}
      </Text>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {/* Reject Option */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={onReject}
          disabled={loading}
        >
          <XCircle size={16} color="#4B5563" strokeWidth={2} />
          <Text style={[styles.rejectText, { fontFamily: "Manrope-SemiBold" }]}>
            {rejectText}
          </Text>
        </TouchableOpacity>

        {/* Confirm Option */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onConfirm}
          disabled={loading}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={[styles.confirmText, { fontFamily: "Manrope-SemiBold" }]}>
                  {confirmText}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Ask Later */}
      <TouchableOpacity
        style={styles.askLaterButton}
        onPress={onAskLater}
        disabled={loading}
      >
        <Text style={[styles.askLaterText, { fontFamily: "Manrope-SemiBold" }]}>
          Ask me later
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 9999,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(99, 102, 241, 0.1)", // soft primary tint
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerText: {
    fontSize: 14,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmGradient: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectText: {
    fontSize: 14,
    color: "#374151",
  },
  confirmText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  askLaterButton: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  askLaterText: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: "center",
  },
});
