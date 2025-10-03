import React, { useState } from "react";
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

import { apiPost } from "../../api/client";

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
  body: 16,
  small: 13,
};

const SPACING = {
  horizontal: 24,
  vertical: 20,
};
// ---------------------------------

const EmailInputScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setError("");
    setLoading(true);
    try {
      await apiPost("/auth/send-otp", { email });
      navigation.navigate("Verification", { email });
    } catch (e) {
      setError(e.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.header} />

          <View style={styles.content}>
            <Text style={styles.title}>Enter your email</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.helperText}>
              Verification code will be sent to this email
            </Text>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, !email && styles.disabledButton]}
            onPress={handleContinue}
            disabled={!email}
          >
            <Text style={styles.buttonText}>{loading ? "SENDING..." : "SEND CODE"}</Text>
          </TouchableOpacity>
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
    justifyContent: "space-between",
    paddingHorizontal: SPACING.horizontal,
    paddingVertical: SPACING.vertical,
  },
  header: {
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    marginBottom: 80,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 40,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  helperText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
});

export default EmailInputScreen;