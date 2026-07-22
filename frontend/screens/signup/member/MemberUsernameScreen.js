import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  Dimensions,
  ImageBackground,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { Check, X } from "lucide-react-native";
import { apiPost } from "../../../api/client";
import { addAccount } from "../../../utils/accountManager";
import * as sessionManager from "../../../utils/sessionManager";
import {
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import { triggerInputValidHaptic } from "../../../hooks/useCelebrationHaptics";
import { useUsernameCheck } from "../../../hooks/useUsernameCheck";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const { width, height } = Dimensions.get("window");

import { BlurView } from "expo-blur";
import wave from "../../../assets/background/wave.webp";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";

const FONT_SIZES = {
  largeHeader: 32, // Matches Community
  body: 16,
  small: 14,
};

const MemberUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // useUsernameCheck drives all availability state (debounced, abort-safe)
  const { status: checkStatus, suggestions } = useUsernameCheck(username);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger haptic + button bounce when username becomes available
  useEffect(() => {
    if (checkStatus === 'available') {
      triggerInputValidHaptic();
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [checkStatus]);

  const { userData, accessToken, refreshToken, fromCommunitySignup } = route.params;

  // Track email separately so we can hydrate from draft if needed
  const [hydratedEmail, setHydratedEmail] = useState(userData?.email || null);

  // Hydrate from draft if route.params is missing data
  useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getDraftData();
      if (draftData?.username && !username) {
        console.log("[MemberUsernameScreen] Hydrating username from draft");
        setUsername(draftData.username);
      }
      // Hydrate email from draft if missing from userData
      if (!userData?.email && draftData?.email) {
        console.log(
          "[MemberUsernameScreen] Hydrating email from draft:",
          draftData.email,
        );
        setHydratedEmail(draftData.email);
      }
    };
    hydrateFromDraft();
  }, []);

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    if (fromCommunitySignup) {
      navigation.navigate("Celebration", {
        role: "Community",
        fromCommunitySignup: true,
        createdPeopleProfile: false,
      });
    } else {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      });
    }
  };


  const validateUsername = (text) => {
    // Keyboard suggestions often add trailing spaces. Rather than rejecting
    // the whole string, we strip out spaces and invalid characters.
    const formattedText = text.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();
    setUsername(formattedText);
  };

  const handleFinish = async () => {
    if (!username || username.length < 3) {
      Alert.alert(
        "Invalid Username",
        "Username must be at least 3 characters long",
      );
      return;
    }

    if (checkStatus !== 'available') {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      // Use hydratedEmail which falls back to draft email if userData.email is undefined
      const emailToUse = userData?.email || hydratedEmail;

      // Debug: Log all userData being sent
      console.log("[MemberUsername] Signup data:", {
        name: userData.name,
        email: emailToUse,
        phone: userData.phone,
        dob: userData.dob,
        gender: userData.gender,
        pronouns: userData.pronouns,
        showPronouns: userData.showPronouns,
        location: userData.location,
        interests: userData.interests,
        occupation: userData.occupation,
        profile_photo_url: userData.profile_photo_url,
        username: username,
      });

      // Step 1: Create the member record with ALL data including username
      const signupResult = await apiPost("/members/signup", {
        name: userData.name,
        email: emailToUse,
        phone: userData.phone,
        dob: userData.dob,
        gender: userData.gender,
        pronouns: userData.pronouns || [],
        show_pronouns: userData.showPronouns !== false, // default to true
        location: userData.location,
        interests: userData.interests,
        occupation: userData.occupation || null,
        profile_photo_url: userData.profile_photo_url || null,
        username: username,
      });

      // Get the new member's data
      const memberProfile = signupResult?.member;

      if (!memberProfile || !memberProfile.id) {
        throw new Error("Failed to create account - please try again");
      }

      const memberId = String(memberProfile.id);

      console.log("[MemberUsername] Member created:", {
        memberId,
        username: memberProfile.username,
        email: memberProfile.email,
      });

      // Step 2: Create a session for the new member (generates JWT tokens)
      // This internally saves to sessionManager's @sessions_v2 storage
      console.log("[MemberUsername] Creating session for new member...");
      await sessionManager.createSession(memberId, "member", emailToUse);

      // Step 3: Get the stored session with ACTUAL tokens from sessionManager
      // This ensures we use the correctly encrypted/stored tokens
      const storedSession = await sessionManager.getActiveSession();

      console.log("[MemberUsername] Session stored:", {
        hasAccessToken: !!storedSession?.accessToken,
        hasRefreshToken: !!storedSession?.refreshToken,
        accessTokenLength: storedSession?.accessToken?.length,
        refreshTokenLength: storedSession?.refreshToken?.length,
      });

      // Step 4: Sync to accountManager storage (used by AuthGate on app reload)
      // This ensures @accounts has the same tokens as @sessions_v2
      await addAccount({
        id: memberId,
        type: "member",
        username: memberProfile.username || username,
        email: emailToUse || memberProfile.email,
        name: memberProfile.name || userData.name,
        profilePicture:
          memberProfile.profile_photo_url || userData.profile_photo_url || null,
        authToken: storedSession?.accessToken,
        refreshToken: storedSession?.refreshToken || null,
        isLoggedIn: true,
      });

      console.log("[MemberSignup] Account synced to accountManager");

      // Step 5: Delete the signup draft as it is now complete
      try {
        await deleteSignupDraft();
        console.log("[MemberUsername] Signup draft deleted");
      } catch (draftError) {
        console.warn("[MemberUsername] Failed to delete draft:", draftError);
        // Continue anyway, as the account is created
      }

      // Step 6: Navigate to celebration screen
      navigation.reset({
        index: 0,
        routes: [{
          name: "Celebration",
          params: {
            role: "People",
            fromCommunitySignup: fromCommunitySignup ?? false,
            createdPeopleProfile: true,
          },
        }],
      });
    } catch (error) {
      console.error("Error completing signup:", error);
      // Race-condition: username was taken between check and submit
      if (error?.code === 'username_taken' || error?.message === 'username_taken') {
        // suggestions come from the server error payload
        Alert.alert(
          "Username Taken",
          "That username was just taken. Try one of the suggestions below."
        );
        return;
      }
      Alert.alert(
        "Error",
        error?.message || "Failed to complete signup. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (checkStatus === 'checking') return { text: "Checking...", color: COLORS.textSecondary, icon: null };
    if (username.length < 3)
      return {
        text: "Username must be at least 3 characters",
        color: COLORS.textSecondary,
        icon: null,
      };
    if (checkStatus === 'available')
      return {
        text: "Username is available",
        color: "#16A34A",
        icon: <Check size={16} color="#16A34A" strokeWidth={3} />,
      };
    if (checkStatus === 'taken')
      return { 
        text: "Username is already taken", 
        color: "#DC2626",
        icon: <X size={16} color="#DC2626" strokeWidth={3} />
      };
    return { text: "", color: COLORS.textSecondary, icon: null };
  };

  const status = getUsernameStatus();
  const isButtonDisabled =
    !username || username.length < 3 || checkStatus !== 'available' || isSubmitting;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("MemberPhone", {
        ...userData,
        accessToken,
        refreshToken,
      });
    }
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea} importantForAutofill="noExcludeDescendants">
        {/* Cancel Confirmation Modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />

        <SignupHeader
          role="People"
          onBack={handleBack}
          onCancel={() => setShowCancelModal(true)}
        />

        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              {/* 3. Content Area */}
              <View style={styles.content}>
                <View style={styles.header}>
                  <Animated.Text 
                    entering={FadeInDown.delay(100).duration(600).springify()}
                    style={styles.title}
                  >
                    Time to claim your space
                  </Animated.Text>
                  <Animated.Text 
                    entering={FadeInDown.delay(200).duration(600).springify()}
                    style={styles.subtitle}
                  >
                    This will be your unique identifier on SnooSpace
                  </Animated.Text>
                </View>

                <Animated.View 
                  entering={FadeInDown.delay(300).duration(600).springify()}
                  style={styles.card}
                >
                  <BlurView
                    intensity={60}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.cardContent}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Username</Text>
                      <View
                        style={[
                          styles.inputWrapper,
                          isFocused && styles.inputWrapperFocused,
                        ]}
                        importantForAutofill="noExcludeDescendants"
                      >
                        <TextInput
                          style={styles.textInput}
                          value={username}
                          onChangeText={validateUsername}
                          placeholder="Enter your username"
                          placeholderTextColor={COLORS.textSecondary}
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="none"
                          autoComplete="off"
                          importantForAutofill="no"
                          spellCheck={false}
                          maxLength={30}
                          onFocus={() => setIsFocused(true)}
                          onBlur={() => setIsFocused(false)}
                          selectionColor={COLORS.primary}
                          underlineColorAndroid="transparent"
                        />
                        {isChecking && (
                          <SnooLoader size="small" color={COLORS.primary} />
                        )}
                      </View>
                      
                      {/* Status Message */}
                      {status.text ? (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                          {status.icon && <View style={{ marginRight: 4, marginTop: 1 }}>{status.icon}</View>}
                          <Text style={[styles.statusText, { color: status.color, marginTop: 0 }]}>
                            {status.text}
                          </Text>
                        </View>
                      ) : null}

                      {/* Suggestion chips — shown when username is taken */}
                      {checkStatus === 'taken' && suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                          <Text style={styles.suggestionsLabel}>Try one of these:</Text>
                          <View style={styles.chipsRow}>
                            {suggestions.map((s) => (
                              <TouchableOpacity
                                key={s}
                                style={styles.chip}
                                onPress={() => validateUsername(s)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.chipText}>@{s}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={styles.rulesContainer}>
                      <Text style={styles.rulesTitle}>Username Rules:</Text>
                      <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.ruleText}>3-30 characters long</Text>
                      </View>
                      <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.ruleText}>
                          Only letters, numbers, underscores, and dots
                        </Text>
                      </View>
                      <View style={styles.ruleRow}>
                        <Text style={styles.ruleBullet}>•</Text>
                        <Text style={styles.ruleText}>
                          Must be unique across all users
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
                <View
                  style={{
                    width: "100%",
                    alignItems: "flex-end",
                    marginTop: 40,
                  }}
                >
                  <Animated.View entering={FadeInDown.delay(500).duration(600).springify()}>
                    <Animated.View style={animatedButtonStyle}>
                      <TouchableOpacity
                        style={[
                          styles.nextButtonContainer,
                          isButtonDisabled && styles.nextButtonDisabled,
                          { minWidth: 220, paddingHorizontal: 32, marginRight: -35 },
                        ]}
                        onPress={handleFinish}
                        disabled={isButtonDisabled}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={COLORS.primaryGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.nextButton}
                        >
                          <Text style={styles.nextButtonText}>
                            {isSubmitting
                              ? "Setting Username..."
                              : "Complete Signup"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  </Animated.View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingBottom: 40,
  },

  // --- Content Styles ---
  content: {
    paddingTop: 0,
    paddingHorizontal: 25,
    marginTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 24,
  },
  // --- Card Styles ---
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.1,
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
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  inputWrapperFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    height: "100%",
    includeFontPadding: false,
  },
  statusText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },

  // --- Suggestion Chips ---
  suggestionsContainer: {
    marginTop: 12,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },

  // --- Rules Container Styles ---
  rulesContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  rulesTitle: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  ruleBullet: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginRight: 6,
    lineHeight: 20,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  // --- Fixed Button Styles ---
  buttonFixedContainer: {
    paddingHorizontal: width * 0.05,
    paddingTop: 15,
    paddingBottom: 30,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default MemberUsernameScreen;



