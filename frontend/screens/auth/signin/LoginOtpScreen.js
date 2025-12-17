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
import { setAuthSession } from "../../../api/auth";
import { startForegroundWatch, attachAppStateListener } from "../../../services/LocationTracker";
import AccountPickerModal from "../../../components/modals/AccountPickerModal";

const TEXT_COLOR = "#1e1e1e";
const RESEND_COOLDOWN = 60;

const LoginOtpScreen = ({ navigation, route }) => {
  const { email, isAddingAccount } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState("");
  
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

    // Start location tracking
    console.log('[LoginOtpV2] Starting location tracking...');
    await startForegroundWatch();
    attachAppStateListener();

    if (isAddingAccount) {
      Alert.alert('Account Added', 'Switching to new account...');
    }

    navigateToHome(user.type);
  };

  /**
   * Handle account selection from picker
   */
  const handleAccountSelected = async (account) => {
    setPickerLoading(true);
    try {
      console.log('[LoginOtpV2] Creating session for selected account:', account.type, account.id);
      
      const result = await sessionManager.createSession(account.id, account.type, account.email || email);
      
      await completeLogin(result.user, result.session);
      setShowAccountPicker(false);
    } catch (e) {
      console.error('[LoginOtpV2] Account selection error:', e);
      Alert.alert('Error', e.message || 'Failed to login to selected account');
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
      console.log('[LoginOtpV2] Verifying OTP for:', email);
      
      // Verify OTP with V2 endpoint
      const result = await sessionManager.verifyOtp(email, otp);

      // Handle different response scenarios
      if (result.requiresAccountCreation) {
        // No accounts found - redirect to account type selection
        console.log('[LoginOtpV2] No accounts found, redirecting to signup');
        Alert.alert(
          'No Account Found',
          'No account exists with this email. Would you like to create one?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Account', 
              onPress: () => navigation.navigate('Landing')
            },
          ]
        );
        return;
      }

      if (result.requiresAccountSelection) {
        // Multiple accounts - show picker
        console.log('[LoginOtpV2] Multiple accounts found, showing picker');
        setAccounts(result.accounts);
        setShowAccountPicker(true);
        return;
      }

      if (result.autoLogin && result.session) {
        // Single account - auto-logged in
        console.log('[LoginOtpV2] Single account, auto-login successful');
        await completeLogin(result.user, result.session);
        return;
      }

      // Unexpected response
      console.warn('[LoginOtpV2] Unexpected response:', result);
      throw new Error('Unexpected server response');

    } catch (e) {
      console.error("[LoginOtpV2] OTP verification error:", e);
      if (e.message && e.message.includes("timed out")) {
        setError("Request timed out. Please check your internet connection and try again.");
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
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="000000"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
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
        loading={pickerLoading}
        email={email}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    color: "#1D2A32",
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1D2A32",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    backgroundColor: "#f8f9fa",
    letterSpacing: 4,
  },
  button: {
    backgroundColor: "#5f27cd",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    color: "#5f27cd",
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});

export default LoginOtpScreen;
