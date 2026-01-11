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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as sessionManager from "../../../utils/sessionManager";
import { addAccount } from "../../../utils/accountManager";
import { setAuthSession, clearPendingOtp } from "../../../api/auth";
import {
  startForegroundWatch,
  attachAppStateListener,
} from "../../../services/LocationTracker";
import AccountPickerModal from "../../../components/modals/AccountPickerModal";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

// Removed local constants in favor of theme constants
const RESEND_COOLDOWN = 60;

const LoginOtpScreen = ({ navigation, route }) => {
  const { email, isAddingAccount, loginViaUsername, targetAccount } =
    route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Account picker state
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  /**
   * Navigate to appropriate home screen based on user type
   */
  const navigateToHome = (userType) => {
    switch (userType) {
      case "member":
        navigation.reset({ index: 0, routes: [{ name: "MemberHome" }] });
        break;
      case "community":
        navigation.reset({ index: 0, routes: [{ name: "CommunityHome" }] });
        break;
      case "sponsor":
        navigation.reset({ index: 0, routes: [{ name: "SponsorHome" }] });
        break;
      case "venue":
        navigation.reset({ index: 0, routes: [{ name: "VenueHome" }] });
        break;
      default:
        Alert.alert("Error", "Unknown user role. Please contact support.");
    }
  };

  /**
   * Complete login - save session and navigate
   */
  const completeLogin = async (user, session) => {
    // Save to legacy account manager for backward compatibility
    await addAccount({
      id: user.id,
      type: user.type,
      username: user.username,
      email: user.email || email,
      name: user.name || user.username,
      profilePicture: user.avatar || null,
      authToken: session.accessToken,
      refreshToken: session.refreshToken,
      isLoggedIn: true,
    });

    // Set legacy auth session for API client compatibility
    await setAuthSession(session.accessToken, email, session.refreshToken);

    // CRITICAL: Clear pending OTP so AuthGate doesn't redirect back to OTP screen on reload
    await clearPendingOtp();

    // Start location tracking
    console.log("[LoginOtpV2] Starting location tracking...");
    await startForegroundWatch();
    attachAppStateListener();

    if (isAddingAccount) {
      Alert.alert("Account Added", "Switching to new account...");
    }

    navigateToHome(user.type);
  };

  /**
   * Handle account selection from picker
   */
  const handleAccountSelected = async (account) => {
    setPickerLoading(true);
    try {
      console.log(
        "[LoginOtpV2] Creating session for selected account:",
        account.type,
        account.id
      );

      const result = await sessionManager.createSession(
        account.id,
        account.type,
        account.email || email
      );

      await completeLogin(result.user, result.session);
      setShowAccountPicker(false);
    } catch (e) {
      console.error("[LoginOtpV2] Account selection error:", e);
      Alert.alert("Error", e.message || "Failed to login to selected account");
    } finally {
      setPickerLoading(false);
    }
  };

  /**
   * Handle multiple accounts selection - login to all selected accounts
   */
  const handleMultipleAccountsSelected = async (selectedAccounts) => {
    setPickerLoading(true);
    try {
      console.log(
        "[LoginOtpV2] Logging into multiple accounts:",
        selectedAccounts.length
      );

      // Login to each account and save them
      let primaryUser = null;
      let primarySession = null;

      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        console.log(
          `[LoginOtpV2] Processing account ${i + 1}/${
            selectedAccounts.length
          }:`,
          account.type
        );

        const result = await sessionManager.createSession(
          account.id,
          account.type,
          account.email || email
        );

        // Save account to account manager
        await addAccount({
          id: result.user.id,
          type: result.user.type,
          username: result.user.username,
          email: result.user.email || email,
          name: result.user.name || result.user.username,
          profilePicture: result.user.avatar || null,
          authToken: result.session.accessToken,
          refreshToken: result.session.refreshToken,
          isLoggedIn: true,
        });

        // First account becomes the primary (active) account
        if (i === 0) {
          primaryUser = result.user;
          primarySession = result.session;
        }
      }

      // Complete login with the first account
      if (primaryUser && primarySession) {
        await setAuthSession(
          primarySession.accessToken,
          email,
          primarySession.refreshToken
        );
        await clearPendingOtp();

        console.log("[LoginOtpV2] Starting location tracking...");
        await startForegroundWatch();
        attachAppStateListener();

        Alert.alert(
          "Accounts Logged In",
          `Successfully logged into ${selectedAccounts.length} accounts. You can switch between them from your profile.`
        );

        setShowAccountPicker(false);
        navigateToHome(primaryUser.type);
      }
    } catch (e) {
      console.error("[LoginOtpV2] Multiple account selection error:", e);
      Alert.alert("Error", e.message || "Failed to login to selected accounts");
    } finally {
      setPickerLoading(false);
    }
  };

  /**
   * Handle OTP verification using V2 endpoints
   */
  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log(
        "[LoginOtpV2] Verifying OTP for:",
        email,
        "viaUsername:",
        loginViaUsername
      );

      // Verify OTP with V2 endpoint
      const result = await sessionManager.verifyOtp(email, otp);

      // Handle different response scenarios
      if (result.requiresAccountCreation) {
        // No accounts found - redirect to account type selection
        console.log("[LoginOtpV2] No accounts found, redirecting to signup");
        Alert.alert(
          "No Account Found",
          "No account exists with this email. Would you like to create one?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Create Account",
              onPress: () => navigation.navigate("Landing"),
            },
          ]
        );
        return;
      }

      // If logged in via username, skip account picker and login directly
      if (loginViaUsername && targetAccount) {
        console.log(
          "[LoginOtpV2] Username login - direct login to account:",
          targetAccount.type,
          targetAccount.id
        );
        const sessionResult = await sessionManager.createSession(
          targetAccount.id,
          targetAccount.type,
          email
        );
        await completeLogin(sessionResult.user, sessionResult.session);
        return;
      }

      // Email login flow - show account picker if multiple accounts
      if (result.requiresAccountSelection) {
        // Multiple accounts - show picker
        console.log("[LoginOtpV2] Multiple accounts found, showing picker");
        setAccounts(result.accounts);
        setShowAccountPicker(true);
        return;
      }

      if (result.autoLogin && result.session) {
        // Single account - auto-logged in
        console.log("[LoginOtpV2] Single account, auto-login successful");
        await completeLogin(result.user, result.session);
        return;
      }

      // Unexpected response
      console.warn("[LoginOtpV2] Unexpected response:", result);
      throw new Error("Unexpected server response");
    } catch (e) {
      console.error("[LoginOtpV2] OTP verification error:", e);
      if (e.message && e.message.includes("timed out")) {
        setError(
          "Request timed out. Please check your internet connection and try again."
        );
      } else {
        setError(e.message || "Invalid verification code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setResendLoading(true);
    setError("");
    try {
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
      {/* Header Section (Only Back Button) */}
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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.buttonContainer, loading && styles.buttonDisabled]}
          onPress={handleVerify}
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
              <Text style={styles.buttonText}>Login</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={resendTimer > 0 || resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#5f27cd" size="small" />
          ) : (
            <Text style={styles.resendText}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Account Picker Modal */}
      <AccountPickerModal
        visible={showAccountPicker}
        onClose={() => setShowAccountPicker(false)}
        accounts={accounts}
        onSelectAccount={handleAccountSelected}
        onSelectMultiple={handleMultipleAccountsSelected}
        loading={pickerLoading}
        email={email}
      />
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
    fontSize: 24,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    letterSpacing: 4,
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

export default LoginOtpScreen;
