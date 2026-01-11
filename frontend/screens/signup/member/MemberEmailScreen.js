import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

import { apiPost } from "../../../api/client";
import { setPendingOtp, checkEmailExists } from "../../../api/auth";

const EmailInputScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false); // track if user has typed
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

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

    setLoading(true);
    setError("");

    try {
      // Check if email already has accounts
      console.log("[MemberEmailScreen] Checking if email exists:", email);
      const exists = await checkEmailExists(email);
      console.log("[MemberEmailScreen] Email exists result:", exists);

      if (exists) {
        setLoading(false);
        console.log("[MemberEmailScreen] Showing confirmation dialog");
        // Show confirmation dialog
        Alert.alert(
          "Account Exists",
          "An account with this email already exists. Would you like to create a new account with the same email or use a different email?",
          [
            {
              text: "Use Different Email",
              style: "cancel",
            },
            {
              text: "Continue Anyway",
              onPress: () => sendOtpAndNavigate(),
            },
          ]
        );
        return;
      }

      // No existing account - proceed directly
      console.log(
        "[MemberEmailScreen] No existing account, proceeding to send OTP"
      );
      await sendOtpAndNavigate();
    } catch (e) {
      console.error("Email check error:", e);
      // On error, proceed anyway
      await sendOtpAndNavigate();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              // Use parent navigator since this is the first screen of nested navigator
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.getParent()?.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

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
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButtonContainer,
            (!isValidEmail || loading) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!isValidEmail || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <Text style={styles.buttonText}>Get Code</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
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
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
  },
  continueButtonContainer: {
    marginVertical: 200, // Kept from original, though looks large
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
});

export default EmailInputScreen;
