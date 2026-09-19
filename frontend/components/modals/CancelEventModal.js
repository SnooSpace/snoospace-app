import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, AlertTriangle, Check, ArrowLeft, Clock } from "lucide-react-native";
import { COLORS } from "../../constants/theme";
import { DISRUPTION_REASON_OPTIONS } from "../../constants/disruptionReasons";

/**
 * CancelEventModal
 *
 * 2-step disruption modal for cancellations and postponements:
 *   Step 1: Reason selection (preset list + optional "other" free text)
 *   Step 2: Attendee impact warning & final confirmation
 *
 * @param {boolean} visible - Modal visibility
 * @param {Object} event - The event being cancelled/postponed ({ id, title, attendeeCount })
 * @param {"cancel"|"postpone"} mode - Modal mode
 * @param {Function} onClose - Called when modal is dismissed
 * @param {Function} onConfirm - Called with ({ reason_category, reason_text })
 */
export default function CancelEventModal({
  visible,
  event,
  mode = "cancel",
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state on open/close
  useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedReason(null);
      setOtherText("");
      setSubmitting(false);
    }
  }, [visible]);

  if (!visible || !event) return null;

  const attendeeCount =
    typeof event.attendeeCount === "number"
      ? event.attendeeCount
      : typeof event.attendees_count === "number"
      ? event.attendees_count
      : 0;

  const isOther = selectedReason === "other";
  const canContinue =
    selectedReason !== null && (!isOther || otherText.trim().length > 0);

  const handleNext = () => {
    if (!canContinue) return;
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleFinalConfirm = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await onConfirm({
        reason_category: selectedReason,
        reason_text: isOther ? otherText.trim() : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.overlay}>
          {/* Backdrop */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView
              intensity={25}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          </Pressable>

          <View style={styles.container}>
            <View style={styles.contentContainer}>
              {/* Top Header with Close and Back */}
              <View style={styles.topNavRow}>
                {step === 2 ? (
                  <Pressable
                    style={styles.navButton}
                    onPress={handleBack}
                    hitSlop={8}
                    disabled={submitting}
                  >
                    <ArrowLeft size={20} color={COLORS.textSecondary} />
                  </Pressable>
                ) : (
                  <View style={styles.navButtonPlaceholder} />
                )}

                <Pressable
                  style={styles.navButton}
                  onPress={onClose}
                  hitSlop={8}
                  disabled={submitting}
                >
                  <X size={20} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              {/* STEP 1: Reason Selection */}
              {step === 1 && (
                <View style={styles.stepContainer}>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.title}>
                      {mode === "postpone" ? "Postpone Event" : "Cancel Event"}
                    </Text>
                    <Text style={styles.message}>
                      {mode === "postpone"
                        ? `Please select a reason for postponing "${event.title}".`
                        : `Please select a reason for cancelling "${event.title}".`}
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.reasonsScroll}
                    contentContainerStyle={styles.reasonsContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {DISRUPTION_REASON_OPTIONS.map((item) => {
                      const isSelected = selectedReason === item.id;
                      return (
                        <View key={item.id}>
                          <Pressable
                            style={[
                              styles.reasonRow,
                              isSelected && styles.reasonRowSelected,
                            ]}
                            onPress={() => setSelectedReason(item.id)}
                          >
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioDot} />}
                            </View>
                            <Text
                              style={[
                                styles.reasonLabel,
                                isSelected && styles.reasonLabelSelected,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>

                          {/* Free-text input when "Other" is selected */}
                          {item.id === "other" && isSelected && (
                            <View style={styles.otherInputWrapper}>
                              <TextInput
                                style={styles.otherInput}
                                placeholder="Please describe the reason..."
                                placeholderTextColor={COLORS.textMuted}
                                multiline
                                maxLength={250}
                                value={otherText}
                                onChangeText={setOtherText}
                                autoFocus
                              />
                              <Text style={styles.charCounter}>
                                {otherText.length}/250
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.footerBox}>
                    <Pressable
                      style={[
                        styles.primaryButton,
                        !canContinue && styles.disabledButton,
                      ]}
                      onPress={handleNext}
                      disabled={!canContinue}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* STEP 2: Final Confirmation */}
              {step === 2 && (
                <View style={styles.stepContainer}>
                  <View style={styles.confirmIconContainer}>
                    <View style={styles.warningIconCircle}>
                      {mode === "postpone" ? (
                        <Clock size={24} color="#D97706" />
                      ) : (
                        <AlertTriangle size={24} color="#D97706" />
                      )}
                    </View>
                  </View>

                  <View style={styles.headerTextContainer}>
                    <Text style={styles.title}>
                      {mode === "postpone"
                        ? "Confirm Postponement"
                        : "Confirm Cancellation"}
                    </Text>
                    <Text style={styles.message}>
                      {mode === "postpone"
                        ? attendeeCount > 0
                          ? `"${event.title}" has ${attendeeCount} registered attendee${
                              attendeeCount !== 1 ? "s" : ""
                            }. Postponing will place ticket payouts on hold and notify all attendees that a new date will be announced soon. Once you set a new date, attendees will have 72 hours to decide whether to keep their tickets or request a full refund.`
                          : `Are you sure you want to postpone "${event.title}"? You will be able to set a new date for the event later.`
                        : attendeeCount > 0
                        ? `"${event.title}" has ${attendeeCount} registered attendee${
                            attendeeCount !== 1 ? "s" : ""
                          }. Cancelling will notify all of them and automatically process 100% refunds. Do you want to proceed?`
                        : `Are you sure you want to cancel "${event.title}"? All registered attendees will be notified.`}
                    </Text>
                  </View>

                  <View style={styles.confirmFooterBox}>
                    <Pressable
                      style={[
                        mode === "postpone"
                          ? styles.postponeButton
                          : styles.destructiveButton,
                        submitting && styles.disabledButton,
                      ]}
                      onPress={handleFinalConfirm}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text
                          style={
                            mode === "postpone"
                              ? styles.postponeButtonText
                              : styles.destructiveButtonText
                          }
                        >
                          {mode === "postpone"
                            ? "Yes, Postpone Event"
                            : "Yes, Cancel Event"}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      onPress={handleBack}
                      disabled={submitting}
                    >
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function PostponeEventModal(props) {
  return <CancelEventModal {...props} mode="postpone" />;
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: "hidden",
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  navButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  stepContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTextContainer: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  reasonsScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  reasonsContent: {
    gap: 8,
    paddingVertical: 2,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  reasonRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0F6FF",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  reasonLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  reasonLabelSelected: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
  },
  otherInputWrapper: {
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 30,
  },
  otherInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: COLORS.textPrimary,
    backgroundColor: "#FFFFFF",
    minHeight: 64,
    textAlignVertical: "top",
  },
  charCounter: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 4,
  },
  footerBox: {
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmIconContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  warningIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmFooterBox: {
    gap: 10,
    marginTop: 8,
  },
  destructiveButton: {
    backgroundColor: "#DC2626",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  postponeButton: {
    backgroundColor: "#D97706",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  postponeButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
});
