import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, Platform, StatusBar, ScrollView, Pressable, ImageBackground } from "react-native";
import { BlurView } from "expo-blur";
import { SquareAsterisk, Check, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Reanimated, { ZoomIn } from "react-native-reanimated";
import MaskedView from "@react-native-masked-view/masked-view";
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
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";

const RESEND_COOLDOWN = 60; // 60 seconds

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

const CommunityOtpScreen = ({ navigation, route }) => {
  const { email } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showGoBackModal, setShowGoBackModal] = useState(false);
  const inputRef = useRef(null);

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
      const result = await sessionManager.verifyOtp(email, otp);

      // Success Feedback
      setLoading(false);
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setVerificationResult(result);

      setTimeout(async () => {
        setIsSuccess(false);
        await clearPendingOtp();

        if (result.accounts && result.accounts.length > 0) {
          setAccounts(result.accounts);
          setShowAccountPicker(true);
        } else {
          let accessToken = null;
          let refreshToken = null;

          if (result.session) {
            accessToken = result.session.accessToken;
            refreshToken = result.session.refreshToken;
            if (accessToken) {
              await setAuthSession(accessToken, email, refreshToken);
            }
          }

          try {
            const activeAccount = await accountManager.getActiveAccount();
            const originAccountId = activeAccount?.id || null;
            await createCommunitySignupDraft(email, originAccountId);
          } catch (draftError) {
            console.log("[CommunityOtpScreen] Draft creation failed (non-critical)");
          }

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
      await sessionManager.sendOtp(email);
      Alert.alert("Success", `Code resent to ${email}.`);
      setResendTimer(RESEND_COOLDOWN);
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  const handleSelectAccount = async (account) => {
    setAccountPickerLoading(true);
    try {
      const result = await sessionManager.createSession(
        account.id,
        account.type,
        account.email || email,
      );

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

      await setAuthSession(
        result.session.accessToken,
        result.user.email || email,
        result.session.refreshToken,
      );

      await clearPendingOtp();
      setShowAccountPicker(false);

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

    try {
      const activeAccount = await accountManager.getActiveAccount();
      const originAccountId = activeAccount?.id || null;
      await createCommunitySignupDraft(email, originAccountId);
    } catch (draftError) {
      console.log("[CommunityOtpScreen] Draft creation failed (non-critical)");
    }

    navigation.navigate("CommunityTypeSelect", {
      email,
      accessToken,
      refreshToken,
    });
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
        <SignupHeader 
          onBack={() => setShowGoBackModal(true)} 
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

            <View style={styles.card}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <Pressable 
                  onPress={() => inputRef.current?.focus()}
                  style={[styles.inputContainer, isFocused && styles.inputFocusedContainer]}
                >
                  {otp.length === 0 && (
                    <View style={styles.placeholderContainer} pointerEvents="none">
                      {[...Array(6)].map((_, i) => (
                        <SquareAsterisk key={i} size={20} color="#8AADC4" strokeWidth={2} style={styles.asteriskIcon} />
                      ))}
                    </View>
                  )}
                  <TextInput
                    ref={inputRef}
                    style={[
                      styles.input,
                      otp.length === 0 && styles.inputTransparentText,
                    ]}
                    placeholder=""
                    placeholderTextColor="transparent"
                    underlineColorAndroid="transparent"
                    value={otp}
                    onChangeText={setOtp}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                  />
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[
                    styles.buttonContainer,
                    (loading || isSuccess || isError || otp.length !== 6) && styles.buttonDisabled,
                    (!loading && !isSuccess && !isError && otp.length !== 6) && styles.buttonInactive,
                  ]}
                  onPress={handleVerify}
                  disabled={loading || isSuccess || isError || otp.length !== 6}
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
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    {loading ? (
                      <SnooLoader color={COLORS.textInverted} />
                    ) : isSuccess ? (
                      <Reanimated.View entering={ZoomIn}>
                        <Check size={24} color={COLORS.textInverted} strokeWidth={2.5} />
                      </Reanimated.View>
                    ) : isError ? (
                      <Reanimated.View entering={ZoomIn}>
                        <X size={24} color={COLORS.textInverted} strokeWidth={2.5} />
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
            </View>
          </View>
        </ScrollView>

        <AccountPickerModal
          visible={showAccountPicker}
          onClose={() => setShowAccountPicker(false)}
          accounts={accounts}
          onSelectAccount={handleSelectAccount}
          onCreateNewProfile={handleCreateNewProfile}
          loading={accountPickerLoading}
          email={email}
        />

        <Modal
          visible={showGoBackModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGoBackModal(false)}
          statusBarTranslucent={true}
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
      </SafeAreaView>
    </ImageBackground>
  );
};

// --- Styles ---
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
  inputContainer: {
    height: 56,
    marginBottom: 4,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F2F5",
    borderColor: "transparent", // Premium greyish background
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.l,
  },
  placeholderContainer: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    zIndex: 1,
    gap: 8,
  },
  asteriskIcon: {
    opacity: 0.8,
  },
  input: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontFamily: "Manrope-Medium",
    fontSize: 24,
    letterSpacing: 4,
    textAlign: "center",
    color: COLORS.textPrimary,
    backgroundColor: "transparent",
    zIndex: 2,
  },
  inputTransparentText: {
    color: "transparent",
  },
  inputFocusedContainer: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  buttonContainer: {
    height: 56,
    borderRadius: BORDER_RADIUS.l,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.l,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    flexDirection: "row",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonInactive: {
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 10,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  resendTextDisabled: {
    color: COLORS.textMuted,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    marginBottom: 16,
    textAlign: "center",
  },
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
    fontFamily: "BasicCommercial-Bold",
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
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
    fontFamily: "Manrope-SemiBold",
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
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityOtpScreen;
