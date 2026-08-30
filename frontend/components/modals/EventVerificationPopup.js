import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, HelpCircle, X, Check, XCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "../../constants/theme";

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
  const eventName = event?.title || "the event";
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
        <X size={18} color="#78716C" strokeWidth={2} />
      </TouchableOpacity>

      {/* Row with icon and conversational header */}
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
          {isGoing ? (
            <Calendar size={18} color={COLORS.primary} strokeWidth={2} />
          ) : (
            <HelpCircle size={18} color={COLORS.primary} strokeWidth={2} />
          )}
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerText}>
            {headerText}
          </Text>
        </View>
      </View>

      {/* Question / Description */}
      <Text style={styles.questionText} numberOfLines={3}>
        {questionText}
      </Text>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {/* Reject Option */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={onReject}
          disabled={loading}
          activeOpacity={0.7}
        >
          <XCircle size={16} color="#78716C" strokeWidth={2} />
          <Text style={styles.rejectText}>
            {rejectText}
          </Text>
        </TouchableOpacity>

        {/* Confirm Option */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onConfirm}
          disabled={loading}
          activeOpacity={0.85}
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
                <Text style={styles.confirmText}>
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
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      >
        <Text style={styles.askLaterText}>
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
    backgroundColor: "#F6F4ED", // Warm cream/oatmeal surface
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#E7E2D6", // Soft warm border
    zIndex: 9999,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E0D4",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerText: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 13,
    color: "#78716C",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  questionText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#1C1917",
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
    borderRadius: 12,
    overflow: "hidden",
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: "#E5E0D4",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
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
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#44403C",
  },
  confirmText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  askLaterButton: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  askLaterText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#78716C",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
