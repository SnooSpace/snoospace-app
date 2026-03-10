import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, Alert, Modal, TouchableWithoutFeedback, Pressable, ImageBackground } from "react-native";
import { BlurView } from "expo-blur";
import { Mail } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import MaskedView from "@react-native-masked-view/masked-view";

import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { apiPost } from "../../../api/client";
import { setPendingOtp } from "../../../api/auth";
import SnooLoader from "../../../components/ui/SnooLoader";

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

const MemberEmailScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      checkResendTimer();
    }, [])
  );

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
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
        setResendTimer(remaining > 0 ? remaining : 0);
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

  const sendOtpAndNavigate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiPost("/auth/v2/send-otp", { email }, 15000);
      await setPendingOtp("signup_member", email, 600);

      if (response) {
        await AsyncStorage.setItem("last_otp_timestamp", Date.now().toString());
        setRetryCount(0);
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
          setTimeout(() => { if (retryCount < 2) sendOtpAndNavigate(); }, 2000);
        } else {
          setError("Request timed out after multiple attempts. Please check your connection.");
        }
      } else {
        setError(e.message || "Failed to send verification code. Please try again.");
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
    await sendOtpAndNavigate();
  };

  return (
    <ImageBackground 
      source={require("../../../assets/wave.png")} 
      style={styles.backgroundImage}
      imageStyle={{ transform: [{ scaleX: -1 }, { scaleY: -1 }], opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader onBack={() => navigation.goBack()} role="People" />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentContainer}>
            <Text style={styles.title}>What's your email?</Text>
            <Text style={styles.subtitle}>
              We'll use it to send you a verification code.
            </Text>

            <View style={styles.card}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <Text style={styles.inputLabel}>Email address</Text>
                <Pressable 
                  onPress={() => inputRef.current?.focus()}
                  style={[styles.inputContainer, isFocused && styles.inputFocusedContainer]}
                >
                  <Mail size={20} color="#8AADC4" style={styles.inputIcon} strokeWidth={2.5} />
                  <TextInput
                    ref={inputRef}
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
                </Pressable>

                {touched && email.length > 0 && !isValidEmail && (
                  <Text style={styles.validationErrorText}>
                    Please enter a valid email address.
                  </Text>
                )}

                {error ? <Text style={styles.apiErrorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[
                    styles.buttonContainer,
                    (!isValidEmail || loading || resendTimer > 0) && styles.buttonDisabled,
                  ]}
                  onPress={handleContinue}
                  disabled={!isValidEmail || loading || resendTimer > 0}
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
                      <Text style={styles.buttonText}>
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Send Code"}
                      </Text>
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

export default MemberEmailScreen;
