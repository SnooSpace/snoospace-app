import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";
import { setPendingOtp } from "../../../api/auth";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

// Removed local constants in favor of theme constants

const LoginScreen = ({ navigation, route }) => {
  const { email: preFilledEmail, isAddingAccount } = route.params || {};
  const [email, setEmail] = useState(preFilledEmail || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleLogin = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start login flow (sends OTP only if account exists)
      // Increased timeout to 15000ms to handle slower email delivery
      await apiPost("/auth/login/start", { email }, 15000);
      await setPendingOtp('login', email, 600);
      navigation.navigate("LoginOtp", { email, isAddingAccount });
    } catch (e) {
      console.error("Login error:", e);
      // Even if request times out but email was sent successfully, navigate to OTP
      // Check if the error is specifically a timeout
      if (e.message && e.message.includes("timed out")) {
        Alert.alert(
          "Request Timeout", 
          "The request took longer than expected. If you received the code in your email, you can enter it on the next screen.",
          [
            {
              text: "Enter Code Anyway",
              onPress: () => {
                setPendingOtp('login', email, 600);
                navigation.navigate("LoginOtp", { email });
              }
            },
            {
              text: "Try Again",
              onPress: () => {
                setError("Please try again.");
              }
            }
          ]
        );
      } else {
        setError(e.message || "Failed to send login code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section (Only Back Button) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>
          Enter your email to receive a login code.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              isFocused && styles.inputFocused,
            ]}
            placeholder="Enter your email"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.buttonContainer, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <Text style={styles.buttonText}>Send Login Code</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signupLink}
          onPress={() => navigation.navigate("Landing")}
        >
          <Text style={styles.signupText}>
            Don't have an account?{" "}
            <Text style={styles.signupLinkText}>Sign up</Text>
          </Text>
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
    paddingTop: 50,
    paddingBottom: 10,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
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
    borderRadius: BORDER_RADIUS.m,
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
  buttonContainer: {
    marginTop: 20,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  signupLink: {
    alignItems: "center",
    marginTop: 30,
  },
  signupText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  signupLinkText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});

export default LoginScreen;
