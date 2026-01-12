import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";

// --- Design Constants ---
// Removed local constants in favor of theme constants

const PhoneNumberInputScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleContinue = () => {
    navigation.navigate("MemberName", {
      email,
      accessToken,
      refreshToken,
      phone: phoneNumber,
    });
  };

  // Function to format the phone number as the user types
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, "");
    setPhoneNumber(digits);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>What's your number?</Text>
            <Text style={styles.subtitle}>
              We'll text you a code to verify your phone.
            </Text>

            {/* Phone Number Input */}
            <View
              style={[
                styles.phoneInputContainer,
                isFocused && styles.phoneInputContainerFocused,
              ]}
            >
              {/* Country Code and Flag for India */}
              <View style={styles.countryCodePill}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>

              {/* Actual Phone Number Input Field */}
              <TextInput
                style={styles.inputField}
                onChangeText={formatPhoneNumber}
                value={phoneNumber}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="(000) 000-0000"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                maxLength={10}
              />
            </View>
          </View>
        </ScrollView>

        {/* Fixed Footer/Button Section - Now inside KeyboardAvoidingView */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButtonContainer,
              phoneNumber.length !== 10 && styles.disabledButton,
            ]}
            onPress={handleContinue}
            disabled={phoneNumber.length !== 10}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButton}
            >
              <Text style={styles.buttonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
    marginTop: 50,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  phoneInputContainer: {
    flexDirection: "row",
    height: 50,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  phoneInputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  countryCodePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#e9ecef",
    borderRightWidth: 1,
    borderRightColor: "#ced4da",
  },
  flagEmoji: {
    fontSize: 18,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginRight: 2,
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: "transparent",
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 20 : 30,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
  },
  continueButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
    marginTop: 5,
    marginLeft: 0,
  },
  header: {
    paddingVertical: 60,
  },
});

export default PhoneNumberInputScreen;
