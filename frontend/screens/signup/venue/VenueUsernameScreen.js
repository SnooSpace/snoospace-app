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
} from "react-native";
import { apiPost } from "../../../api/client";

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

const FONT_SIZES = {
  largeHeader: 28,
  body: 16,
  small: 13,
};



const VenueUsernameScreen = ({ navigation, route }) => {
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

    if (!isAvailable) {
      Alert.alert("Username Taken", "Please choose a different username");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/username/set", { 
        username, 
        userType: 'venue' 
      }, 15000, accessToken);

      // Navigate to venue home
      navigation.navigate("VenueHome");
    } catch (error) {
      console.error("Error setting username:", error);
      Alert.alert("Error", "Failed to set username. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUsernameStatus = () => {
    if (isChecking) return { text: "Checking...", color: COLORS.textSecondary };
    if (username.length < 3) return { text: "Username must be at least 3 characters", color: COLORS.textSecondary };
    if (isAvailable === true) return { text: "✓ Username is available", color: COLORS.success };
    if (isAvailable === false) return { text: "✗ Username is already taken", color: COLORS.error };
    return { text: "", color: COLORS.textSecondary };
  };

  const status = getUsernameStatus();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Venue Username</Text>
          <Text style={styles.subtitle}>
            This will be your unique identifier on SnooSpace
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={[styles.inputWrapper, isFocused && styles.inputFocused]}>
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

        <TouchableOpacity
          style={[
            styles.nextButtonContainer,
            (!username || username.length < 3 || !isAvailable || isSubmitting) && styles.nextButtonDisabled
          ]}
          onPress={handleFinish}
          disabled={!username || username.length < 3 || !isAvailable || isSubmitting}
        >
          <LinearGradient
            colors={
              (!username || username.length < 3 || !isAvailable || isSubmitting) 
                ? [COLORS.border, COLORS.border] 
                : COLORS.primaryGradient
            }
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
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.inputBackground,
    height: 55,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  statusText: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  rulesContainer: {
    backgroundColor: COLORS.inputBackground,
    padding: 20,
    borderRadius: 12,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  rule: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
    lineHeight: 18,
  },
  nextButtonContainer: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    marginTop: 20,
  },
  nextButton: {
    width: "100%",
    height: "100%",
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  nextButtonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontWeight: "700",
  },
});

export default VenueUsernameScreen;
