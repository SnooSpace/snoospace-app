import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, Platform, StatusBar, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GlassBackButton from "../../../components/GlassBackButton";
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityEmailScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false);
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

      if (response) {
        console.log("OTP sent successfully, navigating to OTP screen");
        setRetryCount(0);
        navigation.navigate("CommunityOtp", { email });
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
      if (retryCount >= 2 || !error.includes("Retrying...")) {
        setLoading(false);
      }
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
    console.log("[CommunityEmailScreen] Proceeding to send OTP for:", email);
    await sendOtpAndNavigate();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.header}>
          <GlassBackButton
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter your email</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code to confirm your email.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isFocused && styles.inputFocused]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={validateEmail}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />
          </View>

          {/* Inline error message for invalid email when touched */}
          {touched && email.length > 0 && !isValidEmail && (
            <Text style={styles.validationErrorText}>
              Please enter a valid email address.
            </Text>
          )}

          {/* API/Network Error display */}
          {error ? <Text style={styles.apiErrorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.buttonContainer,
              (!isValidEmail || loading) && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isValidEmail || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <SnooLoader color={COLORS.textInverted} />
              ) : (
                <Text style={[styles.buttonText, { fontFamily: 'Manrope-SemiBold' }]}>Get Code</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  contentContainer: {
    paddingTop: 30,
    flex: 0,
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
  inputContainer: {
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  validationErrorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  apiErrorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 15,
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: 150,
    marginBottom: 20,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityEmailScreen;
