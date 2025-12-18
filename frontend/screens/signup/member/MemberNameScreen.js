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
} from "react-native";
import ProgressBar from "../../../components/Progressbar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

// --- Design Constants ---
// Removed local constants in favor of theme constants

const NameInputScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, phone } = route.params || {};
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleNext = () => {
    navigation.navigate("MemberGender", { email, accessToken, refreshToken, phone, name });
  };

  // Determine if the button should be disabled (e.g., if the name is empty)
  const isButtonDisabled = name.trim().length === 0;

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
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 2 of 8</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={25} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your name?</Text>

          {/* Name Input */}
          <TextInput
            style={[
              styles.input,
              isFocused && styles.inputFocused
            ]}
            onChangeText={setName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={name}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="default"
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
          />
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
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
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
    marginBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  footer: {
    backgroundColor: COLORS.background,
    padding: 20,
    marginBottom: 50,
    borderTopWidth: 0,
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

export default NameInputScreen;
