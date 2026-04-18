import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { X, Check } from "lucide-react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import {
  startEmailChange as startMemberEmailChange,
  verifyEmailChange as verifyMemberEmailChange,
} from "../api/members";
import SnooLoader from "./ui/SnooLoader";
import {
  COLORS,
  FONTS,
  BORDER_RADIUS,
  SPACING,
  SHADOWS,
} from "../constants/theme";

// Theme Constants aligned with user request
const PRIMARY_BLUE = "#3B82F6"; // Restrained blue primary accent
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = COLORS.textPrimary || "#1D1D1F";
const TEXT_SECONDARY = COLORS.textSecondary || "#8E8E93";
const INPUT_BG = "#F3F4F6";
const MODAL_OVERLAY = "rgba(0, 0, 0, 0.4)";

export default function EmailChangeModal({
  visible,
  currentEmail,
  onClose,
  onComplete,
  startEmailChange: customStartEmailChange,
  verifyEmailChange: customVerifyEmailChange,
}) {
  const startEmailChange = customStartEmailChange || startMemberEmailChange;
  const verifyEmailChange = customVerifyEmailChange || verifyMemberEmailChange;

  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // 'email' or 'otp'
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState(null);

  const handleRequestOtp = async () => {
    setError(null);
    if (!newEmail.trim()) {
      setError("Please enter a new email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail?.toLowerCase()) {
      setError("New email must be different from current email");
      return;
    }

    try {
      setSendingOtp(true);
      await startEmailChange(newEmail.trim());
      setStep("otp");
    } catch (error) {
      console.error("Error sending OTP:", error);
      setError(error?.message || "Failed to send verification code");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setLoading(true);
      await verifyEmailChange(newEmail.trim(), otp.trim());

      // Success flow
      Alert.alert(
        "Email Updated",
        "Your email has been successfully changed.",
        [
          {
            text: "OK",
            onPress: () => {
              onComplete(newEmail.trim());
              handleClose();
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setError(error?.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewEmail("");
    setOtp("");
    setStep("email");
    setLoading(false);
    setSendingOtp(false);
    setError(null);
    onClose();
  };

  const isValidEmailStep = newEmail.trim().length > 0 && !sendingOtp;
  const isValidOtpStep = otp.trim().length === 6 && !loading;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardStickyView style={styles.keyboardView}>
              <View style={styles.modalContent}>
                {/* Drag Handle (Optional subtle detail) */}
                <View style={styles.dragHandleContainer}>
                  <View style={styles.dragHandle} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Change Email</Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={22} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                </View>

                {/* Body Content */}
                <View style={styles.body}>
                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {step === "email" ? (
                    <>
                      {/* Current Email (Read-only) */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Current email</Text>
                        <View style={styles.readOnlyInput}>
                          <Text style={styles.readOnlyText}>
                            {currentEmail}
                          </Text>
                        </View>
                      </View>

                      {/* New Email */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>New email</Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              borderColor: newEmail
                                ? PRIMARY_BLUE
                                : "transparent",
                            },
                          ]} // Subtle active border logic if needed, usually focus handles it
                          placeholder="Enter your new email"
                          placeholderTextColor={TEXT_SECONDARY} // Lighter placeholder
                          value={newEmail}
                          onChangeText={(t) => {
                            setNewEmail(t);
                            if (error) setError(null);
                          }}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          editable={!sendingOtp}
                          autoFocus={true}
                        />
                      </View>

                      {/* CTA */}
                      <TouchableOpacity
                        style={[
                          styles.primaryButton,
                          !isValidEmailStep && styles.buttonDisabled,
                        ]}
                        onPress={handleRequestOtp}
                        disabled={!isValidEmailStep}
                      >
                        {sendingOtp ? (
                          <SnooLoader size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[styles.primaryButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
                            Send verification code
                          </Text>
                        )}
                      </TouchableOpacity>

                      <Text style={styles.microcopy}>
                        We’ll send a verification code to your new email.
                      </Text>
                    </>
                  ) : (
                    <>
                      {/* OTP Step */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                          Enter verification code
                        </Text>
                        <TextInput
                          style={[
                            styles.input,
                            { letterSpacing: 4, textAlign: "center" },
                          ]}
                          placeholder="000000"
                          placeholderTextColor={TEXT_SECONDARY}
                          value={otp}
                          onChangeText={(text) => {
                            setOtp(text.replace(/[^0-9]/g, "").slice(0, 6));
                            if (error) setError(null);
                          }}
                          keyboardType="number-pad"
                          maxLength={6}
                          editable={!loading}
                          autoFocus={true}
                        />
                        <Text style={styles.helperText}>
                          Sent to{" "}
                          <Text
                            style={{
                              fontFamily: FONTS.medium,
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {newEmail}
                          </Text>
                        </Text>
                      </View>

                      <View style={styles.otpButtonRow}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => {
                            setStep("email");
                            setOtp("");
                            setError(null);
                          }}
                          disabled={loading}
                        >
                          <Text style={styles.secondaryButtonText}>Back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            { flex: 2 },
                            !isValidOtpStep && styles.buttonDisabled,
                          ]}
                          onPress={handleVerifyOtp}
                          disabled={!isValidOtpStep}
                        >
                          {loading ? (
                            <SnooLoader size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={[styles.primaryButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
                              Verify Email
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </KeyboardStickyView>
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
    justifyContent: "flex-end", // Bottom sheet style
  },
  keyboardView: {
    width: "100%",
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24, // Safe area padding
    width: "100%",
    ...SHADOWS.medium,
  },
  dragHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB", // Subtle gray handle
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.primary, // Using primary font (likely Manrope Semibold/Bold)
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 24,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13, // Slightly smaller, refined label
    fontFamily: FONTS.medium,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textTransform: "uppercase", // Editorial touch often used in app
    letterSpacing: 0.5,
  },
  readOnlyInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16, // Matches Edit Profile inputs
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  readOnlyText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: TEXT_SECONDARY, // Muted for read-only
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 16, // Matches Edit Profile inputs
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: TEXT_PRIMARY,
  },
  helperText: {
    marginTop: 8,
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: FONTS.regular,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 16, // Matches app buttons
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.medium, // Semibold/Medium for buttons
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  microcopy: {
    marginTop: 16,
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: FONTS.regular,
    textAlign: "center",
  },
  otpButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
});
