import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";

const { width, height } = Dimensions.get("window");

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from "../../../components/Progressbar";

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

  const { userData, accessToken } = route.params;

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
      Alert.alert("Invalid Username", "Username must be at least 3 characters long");
      return;
    }

    if (isAvailable !== true) {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the member record with ALL data including username (single API call)
      const signupResult = await apiPost("/members/signup", {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        dob: userData.dob,
        gender: userData.gender,
        location: userData.location,
        interests: userData.interests,
        profile_photo_url: userData.profile_photo_url || null,
        username: username, // Include username in signup
      });

      // Get the new member's ID
      const memberId = signupResult?.member?.id;
      
      if (!memberId) {
        throw new Error("Failed to create account - please try again");
      }

      console.log('[MemberUsername] Signup successful, member ID:', memberId);

      // Navigate to member home
      navigation.reset({
        index: 0,
        routes: [{ name: "MemberHome" }],
      });
    } catch (error) {
      console.error("Error completing signup:", error);
      Alert.alert("Error", error?.message || "Failed to complete signup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textSecondary };
    if (username.length < 3) return { text: "Username must be at least 3 characters", color: COLORS.textSecondary };
    if (isAvailable === true) return { text: "✓ Username is available", color: COLORS.success || "#00C851" };
    if (isAvailable === false) return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textSecondary };
  };

  const status = getUsernameStatus();
  const isButtonDisabled = !username || username.length < 3 || !isAvailable || isSubmitting;

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
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
              <Text style={styles.stepText}>Step 8 of 8</Text>
              <ProgressBar progress={100} />
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
                <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
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
                <Text style={styles.rule}>• Only letters, numbers, underscores, and dots</Text>
                <Text style={styles.rule}>• Must be unique across all users</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 4. Fixed Button Container - Outside ScrollView for stickiness */}
        <View style={styles.buttonFixedContainer}>
          <TouchableOpacity
            style={[
              styles.nextButtonContainer,
              isButtonDisabled && styles.nextButtonDisabled
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
    paddingHorizontal: width * 0.05,
    backgroundColor: COLORS.background,
    paddingBottom: 100, // Space for fixed button
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

  // --- Progress Bar Styles ---
  progressContainer: {
    width: "100%",
    marginBottom: 40,
    height: 20,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  // --- Content Styles ---
  content: {
    paddingTop: 0,
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
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)", // Subtle separator
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
