import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow
import ProgressBar from "../../../components/Progressbar";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import { getSignupInterests } from "../../../api/categories";
import SnooLoader from "../../../components/ui/SnooLoader";

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

const VenueInterestScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, category, logo_url, bio } =
    route.params || {};
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [allInterests, setAllInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch interests from API on mount
  useEffect(() => {
    const loadInterests = async () => {
      try {
        const interests = await getSignupInterests();
        const labels = interests.map((i) => i.label || i);
        setAllInterests(labels);
      } catch (error) {
        console.error("Error loading interests:", error);
        setAllInterests([]);
      } finally {
        setLoading(false);
      }
    };
    loadInterests();
  }, []);

  const toggleInterest = (interest) => {
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

  const handleFinish = () => {
    navigation.navigate("VenueAddress", {
      email,
      accessToken,
      phone,
      name,
      category,
      logo_url,
      bio,
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
          <Text style={styles.stepText}>Step 7 of 11</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={63} />
          </View>
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
              <SnooLoader size="large" color={COLORS.primary} />
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
      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.finishButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleFinish}
          disabled={isButtonDisabled}
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
    padding: 20,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
    marginLeft: -40,
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
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
    borderColor: COLORS.border,
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
    borderColor: COLORS.border,
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
    width: "100%",
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

export default VenueInterestScreen;
