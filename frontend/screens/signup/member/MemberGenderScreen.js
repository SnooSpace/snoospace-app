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

// --- Design Constants ---
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
          <Ionicons name="radio-button-on" size={20} color={PRIMARY_COLOR} />
        </View>
      ) : (
        <View style={styles.radioUnchecked}>
          <Ionicons name="radio-button-off" size={20} color={BORDER_COLOR} />
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
    navigation.navigate('MemberAge', { email, accessToken, phone, name, gender: selectedGender });
  };

  // Button is enabled only when an option is selected
  const isButtonDisabled = selectedGender === null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 1 of 5</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            {/* 20% filled since it's Step 1 of 5 */}
            <View style={[styles.progressBarActive, { width: "20%" }]} />
            <View style={styles.progressBarInactive} />
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
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
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
    color: LIGHT_TEXT_COLOR,
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
  progressBarActive: {
    height: "100%",
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: "100%",
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 30,
  },

  // --- Radio Option Styles ---
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: "#f8f9fa", // Light background color for all options
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  selectedOptionContainer: {
    backgroundColor: PRIMARY_COLOR + "10", // Very light purple background
    borderColor: PRIMARY_COLOR,
  },
  optionText: {
    fontSize: 18,
    color: TEXT_COLOR,
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
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 0,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

export default GenderSelectionScreen;
