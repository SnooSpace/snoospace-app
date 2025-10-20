import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { apiPost } from "../../../api/client";
import { setAuthSession, clearPendingOtp } from "../../../api/auth";

// --- CONSTANTS DEFINED LOCALLY ---
const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  inputBorder: "#E0E0E0",
  white: "#fff",
};

const FONT_SIZES = {
  largeHeader: 28,
  mediumHeader: 22,
  body: 16,
  small: 13,
};

const SPACING = {
  horizontal: 24,
  vertical: 20,
};
// ---------------------------------

const CODE_LENGTH = 6;

const VerificationScreen = ({ route, navigation }) => {
  const { email } = route.params || {};
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChangeCode = (text, index) => {
    const newCode = [...code];
    newCode[index] = text.slice(-1);

    setCode(newCode);

    if (text && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyPress = ({ nativeEvent: { key } }, index) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const RESEND_COOLDOWN_SECONDS = 60;
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Start cooldown timer on mount
  useEffect(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, []);

  // Tick down cooldown every second
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    const enteredCode = code.join("");
    if (enteredCode.length !== CODE_LENGTH) {
      alert("Please enter the full 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const resp = await apiPost("/auth/verify-otp", { email, token: enteredCode }, 8000);
      const accessToken = resp.data?.session?.access_token;
      if (accessToken) {
        await setAuthSession(accessToken, email);
      }
      await clearPendingOtp();
      navigation.navigate("MemberPhone", { email, accessToken });
    } catch (e) {
      setError(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0) return;
    try {
      await apiPost("/auth/send-otp", { email }, 8000);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      alert(`Code resent to ${email || 'your email'}.`);
    } catch (e) {
      alert(e.message || "Failed to resend code");
    }
  };

  const isCodeComplete = code.every((digit) => digit !== "");

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>

          <View style={styles.content}>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {email ? `your email (${email})` : 'your email'}.
            </Text>

            <View style={styles.codeInputContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(text) => handleChangeCode(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  caretHidden={true}
                />
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.verifyButton, !isCodeComplete && styles.disabledButton]}
              onPress={handleVerify}
              disabled={!isCodeComplete}
            >
              <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify"}</Text>
            </TouchableOpacity>

            {!!error && <Text style={[styles.resendText, { color: 'red', textAlign: 'center' }]}>{error}</Text>}

            <TouchableOpacity style={styles.resendButton} onPress={handleResendCode} disabled={cooldown > 0}>
              <Text style={styles.resendText}>
                {cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : <>Didn't receive the code? <Text style={styles.resendLink}>Resend</Text></>}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.horizontal,
    paddingVertical: SPACING.vertical,
  },
  header: {
    paddingBottom: SPACING.vertical,
  },
  headerTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 80,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
    marginBottom: 40,
    textAlign: "center",
    paddingHorizontal: SPACING.horizontal / 2,
  },
  codeInputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
    marginBottom: 40,
  },
  codeInput: {
    width: 45,
    height: 60,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    textAlign: "center",
    fontSize: FONT_SIZES.mediumHeader,
    fontWeight: "bold",
    color: COLORS.textDark,
  },
  footer: {
    paddingBottom: SPACING.vertical,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  resendText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textDark,
  },
  resendLink: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});

export default VerificationScreen;