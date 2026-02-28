import React, { useEffect, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, TouchableWithoutFeedback, Dimensions, Platform, StatusBar, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import Reanimated, { ZoomIn } from "react-native-reanimated";
import { useRef } from "react";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as sessionManager from "../../../utils/sessionManager";
import * as accountManager from "../../../utils/accountManager";
import { setAuthSession, clearPendingOtp } from "../../../api/auth";
import { createSignupDraft } from "../../../utils/signupDraftManager";
import { LinearGradient } from "expo-linear-gradient";
import AccountPickerModal from "../../../components/modals/AccountPickerModal";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";

// Removed local constants in favor of theme constants
const RESEND_COOLDOWN = 60;
const { width } = Dimensions.get("window");

// Helper for Gradient Text
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

const VerificationScreen = ({ route, navigation }) => {
  const { email } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showGoBackModal, setShowGoBackModal] = useState(false);

  // Account Picker Modal state
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountPickerLoading, setAccountPickerLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const insets = useSafeAreaInsets();

  // Button feedback state
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  // Toast state
  const [showResendToast, setShowResendToast] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
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

      // Delay to show animation
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

          // Create client-side draft for crash resume (NOT a backend record)
          try {
            console.log(
              "[MemberOtpScreen] 🆕 Creating client-side draft for:",
              email,
            );
            const activeAccount = await accountManager.getActiveAccount();
            const originAccountId = activeAccount?.id || null;
            await createSignupDraft(email, originAccountId);
            console.log(
              "[MemberOtpScreen] ✅ Draft created, origin account:",
              originAccountId,
            );
          } catch (draftError) {
            console.log(
              "[MemberOtpScreen] ⚠️ Draft creation failed (non-critical):",
              draftError.message,
            );
          }

          navigation.navigate("MemberName", {
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

      // Show checkmark/X then reset
      setTimeout(() => setIsError(false), 2000);

      if (e.message && e.message.includes("timed out")) {
        setError(
          "Request timed out. Please check your internet connection and try again.",
        );
      } else {
        setError(e.message || "Verification failed");
      }
    }
  };

  // Handle selecting an existing account from the picker
  const handleSelectAccount = async (account) => {
    setAccountPickerLoading(true);
    try {
      // Create session for the selected account
      const result = await sessionManager.createSession(
        account.id,
        account.type,
        account.email || email,
      );

      // Save to account manager (matching LoginOtpScreen behavior)
      await accountManager.addAccount({
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

      // Set legacy auth session for API client compatibility
      await setAuthSession(
        result.session.accessToken,
        result.user.email || email,
        result.session.refreshToken,
      );

      // Clear pending OTP
      await clearPendingOtp();

      setShowAccountPicker(false);

      // Navigate to the appropriate home screen based on account type
      // Use getParent() to access root AppNavigator from nested MemberSignupNavigator
      const rootNav = navigation.getParent() || navigation;
      const homeScreen =
        result.user.type === "member"
          ? "MemberHome"
          : result.user.type === "community"
            ? "CommunityHome"
            : result.user.type === "sponsor"
              ? "SponsorHome"
              : result.user.type === "venue"
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

  // Handle creating a new profile
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

    // Create client-side draft for crash resume (NOT a backend record)
    try {
      console.log(
        "[MemberOtpScreen] 🆕 Creating client-side draft for new profile:",
        email,
      );
      const activeAccount = await accountManager.getActiveAccount();
      const originAccountId = activeAccount?.id || null;
      await createSignupDraft(email, originAccountId);
      console.log(
        "[MemberOtpScreen] ✅ Draft created, origin account:",
        originAccountId,
      );
    } catch (draftError) {
      console.log(
        "[MemberOtpScreen] ⚠️ Draft creation failed (non-critical):",
        draftError.message,
      );
    }

    // Navigate to signup flow
    navigation.navigate("MemberName", {
      email,
      accessToken,
      refreshToken,
    });
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setResendLoading(true);
    setError("");
    try {
      // Use V2 endpoint for sending OTP
      await sessionManager.sendOtp(email);
      // Show custom toast instead of Alert
      setShowResendToast(true);

      // Animate In
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after 5 seconds
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 20,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => setShowResendToast(false));
      }, 5000);

      setResendTimer(RESEND_COOLDOWN);
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <SignupHeader onBack={() => setShowGoBackModal(true)} />

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
              <SnooLoader color={COLORS.textInverted} />
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
                <Ionicons name="close" size={24} color={COLORS.textInverted} />
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
            <SnooLoader color={COLORS.primary} size="small" />
          ) : (
            <Text style={styles.resendText}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modern Go Back Modal */}
      <Modal
        visible={showGoBackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoBackModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowGoBackModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Go Back?</Text>
                <Text style={styles.modalMessage}>
                  You'll need to request a new code if you go back.
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={() => setShowGoBackModal(false)}
                  >
                    <Text style={styles.modalSecondaryButtonText}>Stay</Text>
                  </TouchableOpacity>

                  <View style={styles.modalVerticalDivider} />

                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={() => {
                      setShowGoBackModal(false);
                      navigation.goBack();
                    }}
                  >
                    <GradientText style={styles.modalPrimaryButtonText}>
                      Change Email
                    </GradientText>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Resend Success Toast */}
      {showResendToast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              bottom: 50 + insets.bottom,
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.toastText}>Code resent to {email}</Text>
        </Animated.View>
      )}

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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingTop: 24,
    alignItems: "center",
    ...SHADOWS.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  modalMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    width: "100%",
    height: 50,
  },
  modalSecondaryButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "400",
  },
  modalVerticalDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "#eee",
  },
  modalPrimaryButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    // Color handled by GradientText
  },
  toastContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: COLORS.success || "#34C759", // Green color
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
    flex: 1,
  },
});

export default VerificationScreen;
