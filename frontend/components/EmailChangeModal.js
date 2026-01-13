import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  startEmailChange as startMemberEmailChange,
  verifyEmailChange as verifyMemberEmailChange,
} from "../api/members";

const PRIMARY_COLOR = "#6A0DAD";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function EmailChangeModal({
  visible,
  currentEmail,
  onClose,
  onComplete,
  startEmailChange: customStartEmailChange,
  verifyEmailChange: customVerifyEmailChange,
}) {
  // Use custom functions if provided, otherwise use member functions
  const startEmailChange = customStartEmailChange || startMemberEmailChange;
  const verifyEmailChange = customVerifyEmailChange || verifyMemberEmailChange;
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // 'email' or 'otp'
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const handleRequestOtp = async () => {
    if (!newEmail.trim()) {
      Alert.alert("Error", "Please enter a new email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (newEmail.trim().toLowerCase() === currentEmail?.toLowerCase()) {
      Alert.alert("Error", "New email must be different from current email");
      return;
    }

    try {
      setSendingOtp(true);
      await startEmailChange(newEmail.trim());
      setStep("otp");
      Alert.alert("Success", "OTP sent to your new email address");
    } catch (error) {
      console.error("Error sending OTP:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to send OTP. Please try again."
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      await verifyEmailChange(newEmail.trim(), otp.trim());
      Alert.alert("Success", "Email updated successfully!", [
        {
          text: "OK",
          onPress: () => {
            onComplete(newEmail.trim());
            handleClose();
          },
        },
      ]);
    } catch (error) {
      console.error("Error verifying OTP:", error);
      Alert.alert("Error", error?.message || "Invalid OTP. Please try again.");
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
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Change Email</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {step === "email" ? (
              <>
                <Text style={styles.label}>Current Email</Text>
                <Text style={styles.currentEmail}>{currentEmail}</Text>

                <Text style={styles.label}>New Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new email address"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!sendingOtp}
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    sendingOtp && styles.buttonDisabled,
                  ]}
                  onPress={handleRequestOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>New Email</Text>
                <Text style={styles.currentEmail}>{newEmail}</Text>

                <Text style={styles.label}>Enter OTP</Text>
                <Text style={styles.helperText}>
                  We sent a 6-digit code to {newEmail}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  value={otp}
                  onChangeText={(text) =>
                    setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => {
                      setStep("email");
                      setOtp("");
                    }}
                    disabled={loading}
                  >
                    <Text
                      style={[styles.buttonText, styles.secondaryButtonText]}
                    >
                      Back
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.primaryButton,
                      styles.buttonFlex,
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  closeButton: {
    padding: 5,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  currentEmail: {
    fontSize: 16,
    color: TEXT_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#FFFFFF",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonFlex: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: TEXT_COLOR,
  },
});
