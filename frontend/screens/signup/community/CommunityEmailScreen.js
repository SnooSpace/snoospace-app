import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, Platform, StatusBar, ScrollView, ImageBackground } from "react-native";
import { BlurView } from "expo-blur";
import { Mail } from "lucide-react-native";
import { apiPost } from "../../../api/client";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
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
    <ImageBackground 
      source={require("../../../assets/wave.png")} 
      style={styles.backgroundImage}
      imageStyle={{ transform: [{ scaleY: -1 }], opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader onBack={() => navigation.goBack()} role="Community" />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Enter your email</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code to confirm your email.
            </Text>

            <View style={styles.card}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <Text style={styles.inputLabel}>Email address</Text>
                <View style={[styles.inputContainer, isFocused && styles.inputFocusedContainer]}>
                  <Mail size={20} color="#8AADC4" style={styles.inputIcon} strokeWidth={2.5} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    placeholderTextColor="#8AADC4"
                    value={email}
                    onChangeText={validateEmail}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    importantForAutofill="no"
                    autoComplete="off"
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
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    {loading ? (
                      <SnooLoader color={COLORS.textInverted} />
                    ) : (
                      <Text style={styles.buttonText}>Send Code</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingTop: 30,
    flex: 0,
  },
  title: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 34,
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
    lineHeight: 24,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.10,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    padding: 24,
  },
  inputLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
   backgroundColor: "#F0F2F5",
    borderColor: "transparent", // Premium greyish background
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.l,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
  },
  inputFocusedContainer: {
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: COLORS.textPrimary,
    height: "100%",
    backgroundColor: "transparent",
  },
  validationErrorText: {
    fontFamily: "Manrope-Medium",
    color: COLORS.error,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  apiErrorText: {
    fontFamily: "Manrope-Medium",
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  buttonContainer: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    flexDirection: "row",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  infoText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
});

export default CommunityEmailScreen;
