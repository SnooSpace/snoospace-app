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
import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import {
  updateSignupDraft,
  deleteSignupDraft,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

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
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns,
    showPronouns,
    gender: initialGender,
  } = route.params || {};
  const [selectedGender, setSelectedGender] = useState(initialGender || null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const genderOptions = ["Male", "Female", "Non-binary"];

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const handleNext = async () => {
    // Update client-side draft
    try {
      await updateSignupDraft("MemberGender", { gender: selectedGender });
      console.log("[MemberGenderScreen] Draft updated");
    } catch (e) {
      console.log("[MemberGenderScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberLocation", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob,
      pronouns,
      showPronouns,
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
        {/* Header Section with Back and Cancel buttons */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MemberPronouns", {
                  email,
                  accessToken,
                  refreshToken,
                  name,
                  profile_photo_url,
                  dob,
                  pronouns,
                  showPronouns,
                });
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowCancelModal(true)}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>How do you identify?</Text>

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
          style={[
            styles.nextButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
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

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    backgroundColor: "#F0F8FF",
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  radioUnchecked: {},
  radioChecked: {},

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
