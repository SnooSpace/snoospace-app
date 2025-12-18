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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost, apiGet } from "../../../api/client";
import { addAccount } from "../../../utils/accountManager";
import { setAuthSession } from "../../../api/auth";

const { width } = Dimensions.get("window");

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from "../../../components/Progressbar";

const CommunityUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { userData, accessToken, refreshToken } = route.params;
  
  console.log('[CommunityUsername] Route params:', {
    userDataEmail: userData?.email,
    accessTokenLength: accessToken?.length,
    refreshTokenLength: refreshToken?.length,
    userDataKeys: Object.keys(userData || {})
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
      // Step 1: Create the community record with ALL data including username
      const signupPayload = {
        ...userData,
        username: username.toLowerCase().trim(), // Include username in signup
      };
      
      console.log('[CommunityUsername] Creating community with payload:', {
        name: signupPayload.name,
        email: signupPayload.email,
        username: signupPayload.username,
      });
      
      const signupResult = await apiPost('/communities/signup', signupPayload, 15000, accessToken);
      const communityProfile = signupResult?.community;
      // Get tokens from signup response (backend now returns them)
      const newAccessToken = signupResult?.accessToken;
      const newRefreshToken = signupResult?.refreshToken;
      
      if (!communityProfile || !communityProfile.id) {
        throw new Error("Failed to create community account");
      }

      const communityId = String(communityProfile.id);
      
      console.log('[CommunityUsername] Community created:', {
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
        type: 'community',
        username: communityProfile.username || username,
        email: userData.email || communityProfile.email,
        name: communityProfile.name || userData.name,
        profilePicture: communityProfile.logo_url || userData.logo_url || null,
        authToken: newAccessToken,     // From signup response
        refreshToken: newRefreshToken,  // From signup response
        isLoggedIn: true,
      });
      
      // Step 3: Also update the old auth storage for backward compatibility
      if (newAccessToken) {
        await setAuthSession(newAccessToken, userData.email, newRefreshToken);
      }
      
      console.log('[CommunitySignup] Account added and auth session updated');

      // Step 4: Navigate to community home with navigation reset
      navigation.reset({ index: 0, routes: [{ name: "CommunityHome" }] });
    } catch (error) {
      console.error("Error completing signup:", error);
      Alert.alert("Error", error?.message || "Failed to complete signup. Please try again.");
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
      return { text: "✓ Username is available", color: COLORS.success || "#00C851" };
    if (isAvailable === false)
      return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textSecondary };
  };

  const status = getUsernameStatus();
  const isButtonDisabled =
    !username || username.length < 3 || !isAvailable || isSubmitting;

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* 1. Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 2. Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 9 of 9</Text>
          <ProgressBar progress={100} />
        </View>

        {/* 3. Content Area */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Community Username</Text>
            <Text style={styles.subtitle}>
              This will be your unique identifier on SnooSpace
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={[styles.inputWrapper, { borderColor: isAvailable === false ? COLORS.error : (isAvailable === true ? (COLORS.success || "#00C851") : COLORS.border) }]}>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={validateUsername}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
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
            <Text style={styles.rule}>• Must be unique across all users</Text>
          </View>
        </View>
      </View>

      {/* 4. Fixed Button Container */}
      <View style={styles.buttonFixedContainer}>
        <TouchableOpacity
          style={[
            styles.nextButtonContainer,
            isButtonDisabled && styles.nextButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={isButtonDisabled}
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
    paddingHorizontal: width * 0.05,
    backgroundColor: COLORS.background,
  },

  // --- Header Styles ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
    paddingTop: 15,
    paddingBottom: 5,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles (Re-added) ---
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
    flex: 1,
    // Adjusted top padding slightly lower to accommodate progress bar height
    paddingTop: 0,
    paddingBottom: Platform.OS === "ios" ? 40 : 25, // Add bottom padding to prevent content overlap with button
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
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
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: "100%",
  },
  statusText: {
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  rule: {
    fontSize: 14,
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
    zIndex: 10,
  },
  nextButtonContainer: {
    width: "100%",
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    height: 70,
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
    fontWeight: "700",
  },
});

export default CommunityUsernameScreen;
