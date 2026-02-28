import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, Alert, Modal, TouchableWithoutFeedback, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskedView from "@react-native-masked-view/masked-view";

import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";

import { apiPost } from "../../../api/client";
import { setPendingOtp, checkEmailExists } from "../../../api/auth";
import SnooLoader from "../../../components/ui/SnooLoader";

const { width } = Dimensions.get("window");

// Helper for Gradient Text
const GradientText = (props) => {
  return (
    <MaskedView maskElement={<Text {...props} />}>
      <LinearGradient
        colors={COLORS.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text {...props} style={[props.style, { opacity: 0 }]} />
      </LinearGradient>
    </MaskedView>
  );
};

const EmailInputScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false); // track if user has typed
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [showAccountExistsModal, setShowAccountExistsModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      checkResendTimer();
    }, [])
  );

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const checkResendTimer = async () => {
    try {
      const lastTimeStr = await AsyncStorage.getItem("last_otp_timestamp");
      if (lastTimeStr) {
        const lastTime = parseInt(lastTimeStr, 10);
        const elapsed = Math.floor((Date.now() - lastTime) / 1000);
        const remaining = 60 - elapsed;
        if (remaining > 0) {
          setResendTimer(remaining);
        } else {
          setResendTimer(0);
        }
      }
    } catch (e) {
      console.error("Error checking resend timer:", e);
    }
  };

  const validateEmail = (text) => {
    setEmail(text);
    setTouched(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
  };

  // Send OTP and navigate to OTP screen
  const sendOtpAndNavigate = async () => {
    setLoading(true);
    setError("");

    try {
      // Use V2 endpoint which supports multi-account
      const response = await apiPost("/auth/v2/send-otp", { email }, 15000);
      await setPendingOtp("signup_member", email, 600);

      // Only navigate if we get a successful response
      if (response) {
        console.log("OTP sent successfully, navigating to OTP screen");
        await AsyncStorage.setItem("last_otp_timestamp", Date.now().toString());
        setRetryCount(0); // Reset retry count on success
        navigation.navigate("MemberOtp", { email });
      } else {
        setError("Failed to send verification code. Please try again.");
      }
    } catch (e) {
      console.error("OTP send error:", e);
      const msg = (e.message || "").toLowerCase();

      if (msg.includes("timeout") || msg.includes("timed out")) {
        setRetryCount((prev) => prev + 1);
        if (retryCount < 2) {
          setError(`Request timed out. Retrying... (${retryCount + 1}/3)`);
          // Auto retry after 2 seconds
          setTimeout(() => {
            if (retryCount < 2) {
              sendOtpAndNavigate();
            }
          }, 2000);
        } else {
          setError(
            "Request timed out after multiple attempts. Please check your internet connection and try again."
          );
        }
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setError(
          "Network error. Please check your internet connection and try again."
        );
      } else {
        setError(
          e.message || "Failed to send verification code. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!isValidEmail) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    // Multi-Account System: Skip email existence check
    // Account selection happens AFTER OTP verification, not before
    // This allows users to create multiple profiles with the same email
    console.log("[MemberEmailScreen] Proceeding to send OTP for:", email);
    await sendOtpAndNavigate();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <SignupHeader onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your email?</Text>
          <Text style={styles.subtitle}>
            We'll use it to keep you updated on events.
          </Text>

          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            onChangeText={validateEmail}
            value={email}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter your email"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />

          {/* Error message if invalid */}
          {touched && email.length > 0 && !isValidEmail && (
            <Text style={styles.errorText}>
              Please enter a valid email address
            </Text>
          )}

          <Text style={styles.infoText}>
            Email will be used to send code for your login.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <KeyboardStickyView
        offset={{
          closed: 0,
          opened: 0,
        }}
        style={styles.stickyFooter}
      >
        <View
          style={[
            styles.footer,
            { paddingBottom: 60 + (Platform.OS === "ios" ? 0 : 0) },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.continueButtonContainer,
              (!isValidEmail || loading || resendTimer > 0) &&
                styles.disabledButton,
            ]}
            onPress={handleContinue}
            disabled={!isValidEmail || loading || resendTimer > 0}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButton}
            >
              {loading ? (
                <SnooLoader color={COLORS.textInverted} />
              ) : (
                <Text style={styles.buttonText}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Get Code"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>

      {/* Account Exists Modal */}
      <Modal
        visible={showAccountExistsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccountExistsModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowAccountExistsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Account Exists</Text>
                <Text style={styles.modalMessage}>
                  An account with this email already exists. Would you like to
                  create a new account with the same email or use a different
                  email?
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={() => setShowAccountExistsModal(false)}
                  >
                    <Text style={styles.modalSecondaryButtonText}>
                      Use Different Email
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.modalVerticalDivider} />

                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={() => {
                      setShowAccountExistsModal(false);
                      sendOtpAndNavigate();
                    }}
                  >
                    <GradientText style={styles.modalPrimaryButtonText}>
                      Continue Anyway
                    </GradientText>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  contentContainer: {
    flex: 0,
    marginTop: 50,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 5,
    marginLeft: 5,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginLeft: 5,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
  },
  continueButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 24,
    alignItems: "center",
    ...SHADOWS.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold", // Using bold to simulate the look, can use serif if font available
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", // Attempting to match the serif look from image
  },
  modalMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    width: "100%",
    height: 50,
  },
  modalSecondaryButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "400",
  },
  modalVerticalDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#eee",
  },
  modalPrimaryButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    // Color is handled by GradientText components
  },
});

export default EmailInputScreen;
