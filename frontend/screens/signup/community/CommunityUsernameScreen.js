import React, { useState, useEffect } from "react";
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
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { apiPost, apiGet } from "../../../api/client";
import { addAccount } from "../../../utils/accountManager";
import { setAuthSession } from "../../../api/auth";
import { deleteCommunitySignupDraft, getCommunityDraftData } from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import { triggerInputValidHaptic } from "../../../hooks/useCelebrationHaptics";

const { width } = Dimensions.get("window");

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if needed
  useEffect(() => {
    const hydrateFromDraft = async () => {
      // route.params.username usually comes from a previous attempt or passing data forward
      if (!route.params?.username) {
        const draftData = await getCommunityDraftData();
        if (draftData?.username) {
          console.log("[CommunityUsername] Hydrating from draft");
          setUsername(draftData.username);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  // Animation values
  const buttonScale = useSharedValue(1);
  const inputScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  // Trigger button bounce when validity changes to true (isButtonDisabled becomes false)
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  useEffect(() => {
    inputScale.value = withSpring(isFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [isFocused]);

  // Support both organization flow (userData object) and non-org flow (direct params)
  const routeParams = route.params || {};
  const {
    userData: existingUserData,
    accessToken,
    refreshToken,
    // Direct params for non-organization flow
    email,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    heads, // College-affiliated communities pass heads from CollegeHeadsScreen
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  } = routeParams;

  // Build userData from either existing userData or direct params
  const userData = existingUserData || {
    email,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    heads, // Include heads for college-affiliated communities
    community_type,
    college_id,
    college_subtype,
    club_type,
    community_theme,
  };

  console.log("[CommunityUsername] Route params:", {
    userDataEmail: userData?.email,
    accessTokenLength: accessToken?.length,
    refreshTokenLength: refreshToken?.length,
    userDataKeys: Object.keys(userData || {}),
    community_type: userData?.community_type,
  });

  // Debounced username availability check
  useEffect(() => {
    if (username.length >= 3) {
      const timeoutId = setTimeout(() => {
        checkUsernameAvailability();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setIsAvailable(null);
    }
  }, [username]);

  // Trigger haptic when username becomes available
  useEffect(() => {
    if (isAvailable === true) {
      triggerInputValidHaptic();
    }
  }, [isAvailable]);

  const checkUsernameAvailability = async () => {
    if (username.length < 3) return;

    setIsChecking(true);
    try {
      const response = await apiPost("/username/check", { username });
      setIsAvailable(response.available);
    } catch (error) {
      console.error("Error checking username:", error);
      // Don't show alert for debounced check failures to avoid UX interruption
    } finally {
      setIsChecking(false);
    }
  };

  const validateUsername = (text) => {
    // Only allow alphanumeric characters, underscores, and dots
    const regex = /^[a-zA-Z0-9_.]*$/;
    if (regex.test(text)) {
      setUsername(text);
    }
  };

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textSecondary, icon: null };
    if (username.length < 3)
      return {
        text: "Username must be at least 3 characters",
        color: COLORS.textSecondary,
        icon: null,
      };
    if (isAvailable === true)
      return {
        text: "Username is available",
        color: "#16A34A",
        icon: <Check size={16} color="#16A34A" strokeWidth={3} />,
      };
    if (isAvailable === false)
      return { 
        text: "Username is already taken", 
        color: "#DC2626",
        icon: <X size={16} color="#DC2626" strokeWidth={3} />
      };
    return { text: "", color: COLORS.textSecondary, icon: null };
  };

  const status = getUsernameStatus();
  const isButtonDisabled =
    !username || username.length < 3 || !isAvailable || isSubmitting;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleFinish = async () => {
    if (!username || username.length < 3) {
      Alert.alert(
        "Invalid Username",
        "Username must be at least 3 characters long",
      );
      return;
    }

    if (isAvailable !== true) {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Create the community record with ALL data including username
      const signupPayload = {
        ...userData,
        username: username.toLowerCase().trim(), // Include username in signup
      };

      console.log("[CommunityUsername] Creating community with payload:", {
        name: signupPayload.name,
        email: signupPayload.email,
        username: signupPayload.username,
      });

      const signupResult = await apiPost(
        "/communities/signup",
        signupPayload,
        15000,
        accessToken,
      );
      const communityProfile = signupResult?.community;
      // Get tokens from signup response (backend now returns them)
      const newAccessToken = signupResult?.accessToken;
      const newRefreshToken = signupResult?.refreshToken;

      if (!communityProfile || !communityProfile.id) {
        throw new Error("Failed to create community account");
      }

      const communityId = String(communityProfile.id);

      console.log("[CommunityUsername] Community created:", {
        communityId,
        username: communityProfile.username,
        email: communityProfile.email,
        hasAccessToken: !!newAccessToken,
        hasRefreshToken: !!newRefreshToken,
      });

      // Step 2: Add the new community account to account manager
      // Use tokens from signup response (not route params)
      await addAccount({
        id: communityId,
        type: "community",
        username: communityProfile.username || username,
        email: userData.email || communityProfile.email,
        name: communityProfile.name || userData.name,
        profilePicture: communityProfile.logo_url || userData.logo_url || null,
        authToken: newAccessToken, // From signup response
        refreshToken: newRefreshToken, // From signup response
        isLoggedIn: true,
      });

      // Step 3: Also update the old auth storage for backward compatibility
      if (newAccessToken) {
        await setAuthSession(newAccessToken, userData.email, newRefreshToken);
      }

      console.log("[CommunitySignup] Account added and auth session updated");

      // Step 4: Delete draft on successful completion
      try {
        await deleteCommunitySignupDraft();
        console.log(
          "[CommunityUsername] Draft deleted after successful signup",
        );
      } catch (e) {
        console.log(
          "[CommunityUsername] Draft deletion failed (non-critical):",
          e.message,
        );
      }

      // Step 5: Navigate to celebration screen
      navigation.reset({
        index: 0,
        routes: [{ name: "Celebration", params: { role: "Community" } }],
      });
    } catch (error) {
      console.error("Error completing signup:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to complete signup. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      }),
    );
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />

        <SignupHeader
          role="Community"
          onBack={handleBack}
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* 3. Content Area */}
          <View style={styles.content}>
            <View style={styles.header}>
              <Animated.Text 
                entering={FadeInDown.delay(100).duration(600).springify()}
                style={styles.title}
              >
                Time to claim your community's space
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
                  >
                    <TextInput
                      style={styles.textInput}
                      value={username}
                      onChangeText={validateUsername}
                      placeholder="Enter your username"
                      placeholderTextColor={COLORS.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={30}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
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
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.nextButtonDisabled,
                    { minWidth: 220, paddingHorizontal: 32, marginRight: -33 },
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
                      {isSubmitting ? "Finishing..." : "Complete Setup"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    marginTop: 40,
  },
  header: {
    marginBottom: 40,
    paddingRight: 10,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 24,
  },
  card: {
    width: "100%",
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
    marginBottom: 30,
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
  },
  statusText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
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

  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonDisabled: {
    opacity: 0.8,
    shadowOpacity: 0,
  },
  nextButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityUsernameScreen;



