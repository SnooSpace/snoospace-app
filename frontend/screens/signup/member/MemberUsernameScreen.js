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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "../../../components/Progressbar";
import { apiPost } from "../../../api/client";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  success: "#00C851",
};

const FONT_SIZES = {
  largeHeader: 28,
  body: 16,
  small: 13,
};

const SPACING = {
  horizontal: 24,
  vertical: 20,
};

const MemberUsernameScreen = ({ navigation, route }) => {
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
      Alert.alert("Invalid Username", "Username must be at least 3 characters long");
      return;
    }

    if (!isAvailable) {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/username/set", { 
        username, 
        userType: 'member' 
      }, 15000, accessToken);

      // Navigate to member home
      navigation.navigate("MemberHome");
    } catch (error) {
      console.error("Error setting username:", error);
      Alert.alert("Error", "Failed to set username. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textLight };
    if (username.length < 3) return { text: "Username must be at least 3 characters", color: COLORS.textLight };
    if (isAvailable === true) return { text: "✓ Username is available", color: COLORS.success };
    if (isAvailable === false) return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textLight };
  };

  const status = getUsernameStatus();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Section (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.headerRow}>
          <Text style={styles.stepText}>Step 8 of 8</Text>
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={100} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Username</Text>
          <Text style={styles.subtitle}>
            This will be your unique identifier on SnooSpace
          </Text>
        </View>

        <View style={styles.content}>
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
            <Text style={styles.rule}>• Only letters, numbers, underscores, and dots</Text>
            <Text style={styles.rule}>• Must be unique across all users</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.nextButton,
            (!username || username.length < 3 || !isAvailable || isSubmitting) && styles.nextButtonDisabled
          ]}
          onPress={handleFinish}
          disabled={!username || username.length < 3 || !isAvailable || isSubmitting}
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
    paddingHorizontal: SPACING.horizontal,
    paddingVertical: SPACING.vertical,
  },
  headerRow: {
    paddingVertical: 15,
    paddingHorizontal: 5,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 5,
    marginLeft: 5,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: FONT_SIZES.body,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.textLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
  },
  statusText: {
    fontSize: FONT_SIZES.small,
    marginTop: 8,
    marginLeft: 4,
  },
  rulesContainer: {
    backgroundColor: "#F8F9FA",
    padding: 20,
    borderRadius: 12,
  },
  rulesTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  rule: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textDark,
    marginBottom: 6,
    lineHeight: 18,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
});

export default MemberUsernameScreen;