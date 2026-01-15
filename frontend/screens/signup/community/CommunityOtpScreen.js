import React, { useState, useEffect } from "react";
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
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import Reanimated, { ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as sessionManager from "../../../utils/sessionManager";
import * as accountManager from "../../../utils/accountManager";
import { setAuthSession, clearPendingOtp } from "../../../api/auth";
import { createCommunitySignupDraft } from "../../../utils/signupDraftManager";

import { LinearGradient } from "expo-linear-gradient";
import AccountPickerModal from "../../../components/modals/AccountPickerModal";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GlassBackButton from "../../../components/GlassBackButton";

const RESEND_COOLDOWN = 60; // 60 seconds

const CommunityOtpScreen = ({ navigation, route }) => {
  const { email } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  // Button feedback state
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  // Account Picker Modal state
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountPickerLoading, setAccountPickerLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

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

      // Success Feedback
      setLoading(false);
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Store verification result for later use
      setVerificationResult(result);

      setTimeout(async () => {
        setIsSuccess(false);
        await clearPendingOtp();

        // Check if accounts exist for this email
        if (result.accounts && result.accounts.length > 0) {
          // Show account picker modal
          setAccounts(result.accounts);
          setShowAccountPicker(true);
        } else {
          // No accounts - proceed to signup
          let accessToken = null;
          let refreshToken = null;

          if (result.session) {
            accessToken = result.session.accessToken;
            refreshToken = result.session.refreshToken;
            if (accessToken) {
              await setAuthSession(accessToken, email, refreshToken);
            }
          }

          // Create client-side draft for crash resume
          try {
            console.log(
              "[CommunityOtpScreen] 🆕 Creating client-side draft for:",
              email
            );
            const activeAccount = await accountManager.getActiveAccount();
            const originAccountId = activeAccount?.id || null;
            await createCommunitySignupDraft(email, originAccountId);
            console.log(
              "[CommunityOtpScreen] ✅ Draft created, origin account:",
              originAccountId
            );
          } catch (draftError) {
            console.log(
              "[CommunityOtpScreen] ⚠️ Draft creation failed (non-critical):",
              draftError.message
            );
          }

          console.log("[CommunityOtp] OTP verified, navigating with:", {
            email,
            accessTokenLength: accessToken?.length,
            refreshTokenLength: refreshToken?.length,
          });

          // Navigate to type selection screen
          navigation.navigate("CommunityTypeSelect", {
            email,
            accessToken,
            refreshToken,
          });
        }
      }, 1000);
    } catch (e) {
      setLoading(false);
      setIsError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      setTimeout(() => setIsError(false), 2000);
      setError(e.message || "Invalid verification code.");
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

  // Handle selecting an existing account from the picker
  const handleSelectAccount = async (account) => {
    setAccountPickerLoading(true);
    try {
      // Create session for the selected account
      const session = await sessionManager.createSession(
        account.id,
        account.type,
        email
      );

      await setAuthSession(session.accessToken, email, session.refreshToken);
      setShowAccountPicker(false);

      // Navigate to the appropriate home screen based on account type
      const rootNav = navigation.getParent() || navigation;
      const homeScreen =
        account.type === "member"
          ? "MemberHome"
          : account.type === "community"
          ? "CommunityHome"
          : account.type === "sponsor"
          ? "SponsorHome"
          : account.type === "venue"
          ? "VenueHome"
          : "MemberHome";

      rootNav.reset({
        index: 0,
        routes: [{ name: homeScreen }],
      });
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to login. Please try again.");
    } finally {
      setAccountPickerLoading(false);
    }
  };

  // Handle creating a new Community profile
  const handleCreateNewProfile = async () => {
    setShowAccountPicker(false);

    let accessToken = null;
    let refreshToken = null;

    if (verificationResult?.session) {
      accessToken = verificationResult.session.accessToken;
      refreshToken = verificationResult.session.refreshToken;
      if (accessToken) {
        await setAuthSession(accessToken, email, refreshToken);
      }
    }

    // Create client-side draft for crash resume
    try {
      console.log(
        "[CommunityOtpScreen] 🆕 Creating client-side draft for new profile:",
        email
      );
      const activeAccount = await accountManager.getActiveAccount();
      const originAccountId = activeAccount?.id || null;
      await createCommunitySignupDraft(email, originAccountId);
      console.log(
        "[CommunityOtpScreen] ✅ Draft created, origin account:",
        originAccountId
      );
    } catch (draftError) {
      console.log(
        "[CommunityOtpScreen] ⚠️ Draft creation failed (non-critical):",
        draftError.message
      );
    }

    // Navigate to signup flow
    navigation.navigate("CommunityTypeSelect", {
      email,
      accessToken,
      refreshToken,
    });
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
          />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isFocused && styles.inputFocused]}
              placeholder="000000"
              placeholderTextColor={COLORS.textSecondary}
              value={otp}
              onChangeText={setOtp}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              fontSize={24}
              letterSpacing={4}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.buttonContainer,
              (loading || isSuccess || isError) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={loading || isSuccess || isError}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                isSuccess
                  ? ["#34C759", "#2FB350"]
                  : isError
                  ? [COLORS.error, COLORS.error]
                  : COLORS.primaryGradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textInverted} />
              ) : isSuccess ? (
                <Reanimated.View entering={ZoomIn}>
                  <Ionicons
                    name="checkmark"
                    size={24}
                    color={COLORS.textInverted}
                  />
                </Reanimated.View>
              ) : isError ? (
                <Reanimated.View entering={ZoomIn}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.textInverted}
                  />
                </Reanimated.View>
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
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  resendTimer > 0 && styles.resendTextDisabled,
                ]}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Account Picker Modal */}
      <AccountPickerModal
        visible={showAccountPicker}
        onClose={() => setShowAccountPicker(false)}
        accounts={accounts}
        onSelectAccount={handleSelectAccount}
        onCreateNewProfile={handleCreateNewProfile}
        loading={accountPickerLoading}
        email={email}
      />
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    // Add padding for Android status bar
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
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    letterSpacing: 8,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  buttonContainer: {
    marginTop: 40,
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
    paddingVertical: 10,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  resendTextDisabled: {
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 15,
    textAlign: "center",
  },
});

export default CommunityOtpScreen;
