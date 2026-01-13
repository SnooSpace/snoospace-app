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
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";
import { setPendingOtp } from "../../../api/auth";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { ZoomIn } from "react-native-reanimated";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";

// Removed local constants in favor of theme constants

const LoginScreen = ({ navigation, route }) => {
  const { email: preFilledEmail, isAddingAccount } = route.params || {};
  const [emailOrUsername, setEmailOrUsername] = useState(preFilledEmail || "");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleLogin = async () => {
    if (!emailOrUsername) {
      Alert.alert("Error", "Please enter your email or username.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start login flow (sends OTP only if account exists)
      // Backend will resolve username to email if needed
      const response = await apiPost(
        "/auth/login/start",
        { email: emailOrUsername.trim() },
        15000
      );

      // Backend returns the resolved email (important when username was used)
      const resolvedEmail = response.email || emailOrUsername;
      // Track if login was via username (for direct login without account picker)
      const loginViaUsername = response.loginViaUsername || false;
      // The specific account if logged in via username
      const targetAccount = response.targetAccount || null;

      await setPendingOtp("login", resolvedEmail, 600);

      setLoading(false);
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        navigation.navigate("LoginOtp", {
          email: resolvedEmail,
          isAddingAccount,
          loginViaUsername,
          targetAccount,
        });
        setIsSuccess(false);
      }, 1000);
    } catch (e) {
      console.error("Login error:", e);
      // Even if request times out but email was sent successfully, navigate to OTP
      // Check if the error is specifically a timeout
      if (e.message && e.message.includes("timed out")) {
        // For timeout, we can't know the resolved email, so use what was entered
        const fallbackEmail = emailOrUsername.includes("@")
          ? emailOrUsername
          : null;
        Alert.alert(
          "Request Timeout",
          "The request took longer than expected. If you received the code in your email, you can enter it on the next screen.",
          [
            {
              text: "Enter Code Anyway",
              onPress: () => {
                if (fallbackEmail) {
                  setPendingOtp("login", fallbackEmail, 600);
                  navigation.navigate("LoginOtp", { email: fallbackEmail });
                } else {
                  Alert.alert(
                    "Error",
                    "Please use your email address to login when connection is slow."
                  );
                }
              },
            },
            {
              text: "Try Again",
              onPress: () => {
                setError("Please try again.");
              },
            },
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
      <SignupHeader
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate("Landing");
          }
        }}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>
          Enter your email or username to receive a login code.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            placeholder="Email or username"
            placeholderTextColor={COLORS.textSecondary}
            value={emailOrUsername}
            onChangeText={setEmailOrUsername}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.buttonContainer,
            (loading || isSuccess) && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading || isSuccess}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isSuccess ? ["#34C759", "#2FB350"] : COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : isSuccess ? (
              <Animated.View entering={ZoomIn}>
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={COLORS.textInverted}
                />
              </Animated.View>
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
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
