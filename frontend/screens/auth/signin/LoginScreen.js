import React, { useState, useRef } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, Platform, StatusBar, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { Mail, Check } from "lucide-react-native";
import { setPendingOtp } from "../../../api/auth";
import * as Haptics from "expo-haptics";
import Animated, { ZoomIn } from "react-native-reanimated";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";
import wave from "../../../assets/wave.png";
import { LinearGradient } from "expo-linear-gradient";

// Removed local constants in favor of theme constants

const LoginScreen = ({ navigation, route }) => {
  const { email: preFilledEmail, isAddingAccount } = route.params || {};
  const [emailOrUsername, setEmailOrUsername] = useState(preFilledEmail || "");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

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

  const isValidEmailOrUsername = emailOrUsername.includes('@');

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ transform: [{ scaleX: -1 }, { scaleY: -1 }], opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Enter your email or username to receive a login code
          </Text>

          <View style={styles.card}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              <Text style={styles.inputLabel}>Email or username</Text>
              <Pressable 
                onPress={() => inputRef.current?.focus()}
                style={[styles.inputContainer, isFocused && styles.inputFocusedContainer]}
              >
                <Mail size={20} color={isFocused ? COLORS.primary : COLORS.textSecondary} style={styles.inputIcon} strokeWidth={2.5} />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={emailOrUsername}
                  onChangeText={setEmailOrUsername}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  importantForAutofill="no"
                  autoComplete="off"
                />
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.buttonContainer,
                  (loading || isSuccess || !isValidEmailOrUsername) && styles.buttonDisabled,
                  isSuccess && styles.buttonSuccessContainer,
                  (!loading && !isSuccess && !isValidEmailOrUsername) && styles.buttonInactive,
                ]}
                onPress={handleLogin}
                disabled={loading || isSuccess || !isValidEmailOrUsername}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isSuccess ? [COLORS.success, COLORS.success] : COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <SnooLoader color={COLORS.textInverted} />
                  ) : isSuccess ? (
                    <Animated.View entering={ZoomIn}>
                      <Check
                        size={24}
                        color={COLORS.textInverted}
                        strokeWidth={2.5}
                      />
                    </Animated.View>
                  ) : (
                    <Text style={styles.buttonText}>Send Login Code</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={styles.signupLinkContainer}>
                <Text style={styles.signupText}>New here? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Landing")}>
                  <Text style={styles.signupLinkText}> Create an account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
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
    backgroundColor: "#F0F2F5",// Premium greyish background
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: BORDER_RADIUS.l,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
  },
  inputFocusedContainer: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
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
  errorText: {
    color: COLORS.error,
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    marginBottom: 16,
    marginTop: -8,
  },
  buttonContainer: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    overflow: "visible",
  },
  buttonGradient: {
    flex: 1,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonInactive: {
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonSuccessContainer: {
    shadowColor: COLORS.success,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  signupLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  signupText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: COLORS.textMuted,
  },
  signupLinkText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: COLORS.primary, // Used COLORS.primary for consistent blue
  },

});

export default LoginScreen;
