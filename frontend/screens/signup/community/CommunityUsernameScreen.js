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
import { apiPost } from "../../../api/client";

const { width } = Dimensions.get("window");

// --- Consistent Design Constants ---
const PRIMARY_COLOR = "#5f27cd";
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";
const BACKGROUND_COLOR = "#ffffff";
const INPUT_BACKGROUND = "#f8f9fa";
const TRACK_COLOR = "#e0e0e0";

const COLORS = {
  primary: PRIMARY_COLOR,
  textDark: TEXT_COLOR,
  textLight: LIGHT_TEXT_COLOR,
  background: BACKGROUND_COLOR,
  white: "#fff",
  error: "#FF4444",
  success: "#00C851",
};

const FONT_SIZES = {
  largeHeader: 32,
  body: 16,
  small: 14,
};

// --- Custom Progress Bar Reimplementation ---

/**
 * Custom Simple Progress Bar Component (Guaranteed to work)
 */
const SimpleProgressBar = ({ progress }) => {
  return (
    <View style={progressBarStyles.track}>
      <View style={[progressBarStyles.fill, { width: `${progress}%` }]} />
    </View>
  );
};

const progressBarStyles = StyleSheet.create({
  track: {
    height: 8,
    width: "100%",
    backgroundColor: TRACK_COLOR,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
  },
});

const CommunityUsernameScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await apiPost(
        "/username/set",
        {
          username,
          userType: "community",
        },
        15000,
        accessToken
      );

      // Navigate to community home (Final step)
      navigation.navigate("CommunityHome");
    } catch (error) {
      console.error("Error setting username:", error);
      Alert.alert("Error", "Failed to set username. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textLight };
    if (username.length < 3)
      return {
        text: "Username must be at least 3 characters",
        color: COLORS.textLight,
      };
    if (isAvailable === true)
      return { text: "✓ Username is available", color: COLORS.success };
    if (isAvailable === false)
      return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textLight };
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
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        {/* 2. Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 9 of 9</Text>
          <SimpleProgressBar progress={100} />
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
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={validateUsername}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textLight}
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
            styles.nextButton,
            isButtonDisabled && styles.nextButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={isButtonDisabled}
        >
          <Text style={styles.nextButtonText}>
            {isSubmitting ? "Setting Username..." : "Complete Signup"}
          </Text>
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
    height: 20,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textLight,
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
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: FONT_SIZES.body,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: TRACK_COLOR,
    borderRadius: 15,
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: INPUT_BACKGROUND,
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
    height: "100%",
  },
  statusText: {
    fontSize: FONT_SIZES.small,
    marginTop: 8,
    marginLeft: 4,
  },

  // --- Rules Container Styles ---
  rulesContainer: {
    backgroundColor: INPUT_BACKGROUND,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: TRACK_COLOR,
  },
  rulesTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  rule: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textDark,
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
  nextButton: {
    backgroundColor: COLORS.primary,
    height: 70,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.textLight,
    opacity: 0.8,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
});

export default CommunityUsernameScreen;
