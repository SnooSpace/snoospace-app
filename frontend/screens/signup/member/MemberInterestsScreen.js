import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow

import HapticsService from "../../../services/HapticsService";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import { getSignupInterests } from "../../../api/categories";
import {
  updateSignupDraft,
  deleteSignupDraft,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

// --- Design Constants ---
// Removed local constants in favor of theme constants
const MIN_SELECTIONS = 3; // Requirement from the design text
const MAX_SELECTIONS = 7; // Maximum selections allowed

// --- Reusable Interest Chip Component ---
const InterestChip = ({ label, isSelected, onPress, isDisabled }) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSelected ? styles.chipSelected : styles.chipUnselected,
        isDisabled && styles.chipDisabled,
      ]}
      onPress={() => !isDisabled && onPress(label)}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.chipText,
          isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
          isDisabled && styles.chipTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const InterestsScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns,
    showPronouns,
    gender,
    location,
    interests: initialInterests,
  } = route.params || {};
  const [selectedInterests, setSelectedInterests] = useState(
    initialInterests || []
  );
  const [allInterests, setAllInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Fetch interests from API on mount
  useEffect(() => {
    const loadInterests = async () => {
      try {
        const interests = await getSignupInterests();
        // Extract labels from interest objects
        const labels = interests.map((i) => i.label || i);
        setAllInterests(labels);
      } catch (error) {
        console.error("Error loading interests:", error);
        // Fallback to empty array - user will see "no interests available"
        setAllInterests([]);
      } finally {
        setLoading(false);
      }
    };
    loadInterests();
  }, []);

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const toggleInterest = (interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        // Deselect
        return prev.filter((i) => i !== interest);
      } else {
        // Select - but only if we haven't reached the maximum
        if (prev.length < MAX_SELECTIONS) {
          return [...prev, interest];
        }
        return prev; // Don't add if at maximum
      }
    });
  };

  const handleFinish = async () => {
    // Update client-side draft
    try {
      await updateSignupDraft("MemberInterests", {
        interests: selectedInterests,
      });
      console.log("[MemberInterestsScreen] Draft updated");
    } catch (e) {
      console.log("[MemberInterestsScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberPhone", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob,
      pronouns,
      showPronouns,
      gender,
      location,
      interests: selectedInterests,
    });
  };

  // Check if the selection requirement is met
  const isButtonDisabled = selectedInterests.length < MIN_SELECTIONS;

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
                navigation.replace("MemberLocation", {
                  email,
                  accessToken,
                  refreshToken,
                  name,
                  profile_photo_url,
                  dob,
                  pronouns,
                  showPronouns,
                  gender,
                  location,
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
          <Text style={styles.title}>What are you interested in?</Text>
          <Text style={styles.subtitle}>
            Select {MIN_SELECTIONS}-{MAX_SELECTIONS} interests to personalize
            your experience.
          </Text>

          {/* Interest Chips Container */}
          <View style={styles.chipsContainer}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : allInterests.length === 0 ? (
              <Text style={styles.subtitle}>No interests available</Text>
            ) : (
              allInterests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                const isDisabled =
                  !isSelected && selectedInterests.length >= MAX_SELECTIONS;

                return (
                  <InterestChip
                    key={interest}
                    label={interest}
                    isSelected={isSelected}
                    isDisabled={isDisabled}
                    onPress={toggleInterest}
                  />
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.finishButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleFinish}
          disabled={isButtonDisabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.finishButton}
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
  },
  header: {
    paddingHorizontal: 20,
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -15, // Optional: Offset to visually align the icon with the screen edge
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
    marginLeft: -40, // Visual centering adjustment
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  percentageText: {
    position: "absolute",
    top: 0,
    right: 5,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "600",
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
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },

  // --- Chip Styles ---
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipUnselected: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.textSecondary + "80",
  },
  chipText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: COLORS.textInverted,
  },
  chipTextUnselected: {
    color: COLORS.textPrimary,
  },
  chipDisabled: {
    backgroundColor: COLORS.inputBackground,
    borderColor: "#e9ecef",
    opacity: 0.5,
  },
  chipTextDisabled: {
    color: COLORS.textSecondary,
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    marginBottom: 50,
  },
  finishButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  finishButton: {
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
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -15, // Optional: Offset to visually align the icon with the screen edge
  },
});

export default InterestsScreen;
