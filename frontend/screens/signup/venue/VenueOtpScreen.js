import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as sessionManager from "../../../utils/sessionManager";
import { setAuthSession, clearPendingOtp } from "../../../api/auth";
import { LinearGradient } from "expo-linear-gradient";
import SnooLoader from "../../../components/ui/SnooLoader";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

const RESEND_COOLDOWN = 60; // 60 seconds

const VenueOtpScreen = ({ navigation, route }) => {
  const { email } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use V2 endpoint for OTP verification
      const result = await sessionManager.verifyOtp(email, otp);

      // For signup, proceed with tokens if available
      let accessToken = null;
      let refreshToken = null;

      if (result.session) {
        accessToken = result.session.accessToken;
        refreshToken = result.session.refreshToken;
        if (accessToken) {
          await setAuthSession(accessToken, email, refreshToken);
        }
      }
      await clearPendingOtp();
      navigation.navigate("VenueName", {
        email,
        accessToken,
        refreshToken,
      });
    } catch (e) {
      setError(e.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setResendLoading(true);
    setError("");
    try {
      // Use V2 endpoint for sending OTP
      await sessionManager.sendOtp(email);
      Alert.alert("Success", `Code resent to ${email}.`);
      setResendTimer(RESEND_COOLDOWN);
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Go Back?",
              "You'll need to request a new code if you go back.",
              [
                { text: "Stay", style: "cancel" },
                { text: "Change Email", onPress: () => navigation.goBack() },
              ]
            );
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Email</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            placeholder="000000"
            placeholderTextColor={COLORS.textSecondary}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            fontSize={24}
            letterSpacing={4}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.buttonContainer, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
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
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={resendTimer > 0 || resendLoading}
        >
          {resendLoading ? (
            <SnooLoader color={COLORS.primary} size="small" />
          ) : (
            <Text style={styles.resendText}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
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
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    backgroundColor: COLORS.inputBackground,
    letterSpacing: 4,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  buttonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    marginTop: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});

export default VenueOtpScreen;
