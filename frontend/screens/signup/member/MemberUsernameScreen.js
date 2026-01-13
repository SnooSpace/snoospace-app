import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";
import { addAccount } from "../../../utils/accountManager";
import * as sessionManager from "../../../utils/sessionManager";
import { deleteSignupDraft } from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const { width, height } = Dimensions.get("window");

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

const FONT_SIZES = {
  largeHeader: 32, // Matches Community
  body: 16,
  small: 14,
};

const MemberUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { userData, accessToken, refreshToken } = route.params;

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

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
        "Username must be at least 3 characters long"
      );
      return;
    }

    if (isAvailable !== true) {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Create the member record with ALL data including username
      const signupResult = await apiPost("/members/signup", {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        dob: userData.dob,
        gender: userData.gender,
        pronouns: userData.pronouns || [],
        show_pronouns: userData.showPronouns !== false, // default to true
        location: userData.location,
        interests: userData.interests,
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
      await sessionManager.createSession(memberId, "member", userData.email);

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
        email: userData.email || memberProfile.email,
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

      // Step 6: Navigate to member home with navigation reset
      navigation.reset({
        index: 0,
        routes: [{ name: "MemberHome" }],
      });
    } catch (error) {
      console.error("Error completing signup:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to complete signup. Please try again."
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
        text: "✓ Username is available",
        color: COLORS.success || "#00C851",
      };
    if (isAvailable === false)
      return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textSecondary };
  };

  const status = getUsernameStatus();
  const isButtonDisabled =
    !username || username.length < 3 || !isAvailable || isSubmitting;

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
    <SafeAreaView style={styles.safeArea}>
      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* 1. Header Row (Back Button & Cancel) */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                accessibilityLabel="Go back"
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={COLORS.textPrimary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowCancelModal(true)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Content Area */}
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>Choose Your Username</Text>
                <Text style={styles.subtitle}>
                  This will be your unique identifier on SnooSpace
                </Text>
              </View>

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
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                </View>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.text}
                </Text>
              </View>

              <View style={styles.rulesContainer}>
                <Text style={styles.rulesTitle}>Username Rules:</Text>
                <Text style={styles.rule}>• 3-30 characters long</Text>
                <Text style={styles.rule}>
                  • Only letters, numbers, underscores, and dots
                </Text>
                <Text style={styles.rule}>
                  • Must be unique across all users
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 4. Fixed Button Container - Outside ScrollView for stickiness */}
        <View style={styles.buttonFixedContainer}>
          <TouchableOpacity
            style={[
              styles.nextButtonContainer,
              isButtonDisabled && styles.nextButtonDisabled,
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
                {isSubmitting ? "Setting Username..." : "Complete Signup"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingBottom: 100, // Space for fixed button
  },

  // --- Header Styles ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.primary || "#007AFF",
    fontWeight: "500",
  },

  // --- Progress Bar Styles ---
  progressContainer: {
    width: "100%",
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  // --- Content Styles ---
  content: {
    paddingTop: 0,
    paddingHorizontal: 25,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: FONT_SIZES.body,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    height: "100%",
  },
  statusText: {
    fontSize: FONT_SIZES.small,
    marginTop: 8,
    marginLeft: 4,
  },

  // --- Rules Container Styles ---
  rulesContainer: {
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rulesTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  rule: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },

  // --- Fixed Button Styles ---
  buttonFixedContainer: {
    position: "absolute",
    bottom: 0,
    width: width,
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
    paddingBottom: Platform.OS === "ios" ? 40 : 25,
  },
  nextButtonContainer: {
    borderRadius: 15,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    height: 70,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  nextButtonText: {
    color: COLORS.textInverted,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
});

export default MemberUsernameScreen;
