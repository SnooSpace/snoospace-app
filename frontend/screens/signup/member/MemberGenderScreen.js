import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the radio button icon
import ProgressBar from "../../../components/Progressbar";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
const PRIMARY_COLOR = "#5f27cd"; // Deep purple for the button, progress bar, and selected state
const TEXT_COLOR = "#1e1e1e"; // Dark text color
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for step text
const BORDER_COLOR = "#ced4da"; // Light border color
const BACKGROUND_COLOR = "#ffffff"; // White background

// --- Reusable Radio Button Component ---
const RadioOption = ({ label, isSelected, onPress }) => {
  const isChecked = isSelected === label;

  return (
    <TouchableOpacity
      style={[
        styles.optionContainer,
        isChecked && styles.selectedOptionContainer,
      ]}
      onPress={() => onPress(label)}
      activeOpacity={0.7}
    >
      <Text style={styles.optionText}>{label}</Text>

      {/* Radio Icon */}
      {isChecked ? (
        <View style={styles.radioChecked}>
          <Ionicons name="radio-button-on" size={20} color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.radioUnchecked}>
          <Ionicons name="radio-button-off" size={20} color={COLORS.border} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const GenderSelectionScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name } = route.params || {};
  const [selectedGender, setSelectedGender] = useState(null);

  const genderOptions = ["Male", "Female", "Non-binary"];

  const handleNext = () => {
    navigation.navigate("MemberAge", {
      email,
      accessToken,
      phone,
      name,
      gender: selectedGender,
    });
  };

  // Button is enabled only when an option is selected
  const isButtonDisabled = selectedGender === null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
        </View>
        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 3 of 8</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={37.5} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your gender?</Text>

          {/* Gender Options */}
          {genderOptions.map((option) => (
            <RadioOption
              key={option}
              label={option}
              isSelected={selectedGender}
              onPress={setSelectedGender}
            />
          ))}
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButtonContainer, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            <Text style={styles.buttonText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 15,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
  // ProgressBar handles active state
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 30,
  },

  // --- Radio Option Styles ---
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedOptionContainer: {
    backgroundColor: "#F0F8FF", // Very light blue
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  radioUnchecked: {
    // Hidden component, just using the icon's built-in styles
  },
  radioChecked: {
    // Hidden component, just using the icon's built-in styles
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
    marginBottom: 50,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
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
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
});

export default GenderSelectionScreen;
