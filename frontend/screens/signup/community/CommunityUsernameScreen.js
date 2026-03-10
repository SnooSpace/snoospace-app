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
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { apiPost, apiGet } from "../../../api/client";
import { addAccount } from "../../../utils/accountManager";
import { setAuthSession } from "../../../api/auth";
import { deleteCommunitySignupDraft } from "../../../utils/signupDraftManager";
import { triggerInputValidHaptic } from "../../../hooks/useCelebrationHaptics";

const { width } = Dimensions.get("window");

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);

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
    inputScale.value = withSpring(isUsernameFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [isUsernameFocused]);

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
      Alert.alert("Error", "Failed to check username availability");
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

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textSecondary };
    if (username.length < 3)
      return {
        text: "Username must be at least 3 characters",
        color: COLORS.textSecondary,
      };
    if (isAvailable === true)
      return {
        text: "âœ“ Username is available",
        color: COLORS.success || "#00C851",
      };
    if (isAvailable === false)
      return { text: "âœ— Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textSecondary };
  };

  const status = getUsernameStatus();
  const isButtonDisabled =
    !username || username.length < 3 || !isAvailable || isSubmitting;

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Header Row */}
          <SignupHeader
            role={
              community_type
                ? isStudentCommunity
                  ? "People"
                  : "Communities"
                : "Communities"
            }
            onBack={handleBack}
            onCancel={() => {}}
            hideCancel={true}
          />

          {/* 3. Content Area */}
          <View style={styles.content}>
            <View style={styles.header}>
              <Animated.Text 
                entering={FadeInDown.delay(100).duration(600).springify()}
                style={styles.title}
              >
                Choose Your Community Username
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={styles.globalHelperText}
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
                  <Animated.View
                    style={[
                      styles.inputWrapper,
                      animatedInputStyle,
                      {
                        borderColor:
                          isAvailable === false
                            ? COLORS.error
                            : isAvailable === true
                              ? COLORS.success || "#00C851"
                              : "rgba(0,0,0,0.1)",
                      },
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
                      onFocus={() => setIsUsernameFocused(true)}
                      onBlur={() => setIsUsernameFocused(false)}
                    />
                    {isChecking && (
                      <SnooLoader size="small" color={COLORS.primary} />
                    )}
                  </Animated.View>
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.text}
                  </Text>
                </View>

                <View style={styles.rulesContainer}>
                  <Text style={styles.rulesTitle}>Username Rules:</Text>
                  <Text style={styles.rule}>â€¢ 3-30 characters long</Text>
                  <Text style={styles.rule}>
                    â€¢ Only letters, numbers, underscores, and dots
                  </Text>
                  <Text style={styles.rule}>
                    â€¢ Must be unique across all users
                  </Text>
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
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -8 },
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
    paddingHorizontal: 25,
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
    lineHeight: 38,
  },
  globalHelperText: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
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
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
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
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
  },
  rulesTitle: {
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    color: COLORS.primary,
    marginBottom: 12,
  },
  rule: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: "Manrope-Medium",
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



